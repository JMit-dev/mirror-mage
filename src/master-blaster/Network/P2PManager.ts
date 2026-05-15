/**
 * Manages a WebRTC peer-to-peer DataChannel between one host and up to three guests.
 * The host relays gameplay packets between all connected peers.
 *
 * No Firebase is used here.
 */
// PeerJS is loaded from CDN as a global — no npm import needed.
declare const Peer: any;

type MessageHandler = (data: ArrayBuffer) => void;

/** Peer ID prefix to avoid collisions with other PeerJS users */
const PEER_PREFIX = "mm-";
/** Sent by host to both clients to trigger game start */
const PACKET_START = 0xfe;
/** Sent by host to all clients to indicate level selection: [0xfd, levelByte] */
const PACKET_LEVEL = 0xfd;
/** Sent by host to assign a slot to a newly connected guest: [0xfb, slotByte] */
const PACKET_ASSIGN_SLOT = 0xfb;
/** Sent by host to all clients when room population changes: [0xfa, playerCount] */
const PACKET_ROOM_STATE = 0xfa;

export default class P2PManager {
    private static _peer: any | null = null;
    private static _hostConn: any | null = null;
    private static _connected: boolean = false;
    private static _mySlot: 0 | 1 | 2 | 3 | 4 = 0;
    private static _roomCode: string = "";
    private static _playerCount: number = 0;
    private static _nextHostSlot: 2 | 3 | 4 = 2;

    private static _messageHandlers: MessageHandler[] = [];
    private static _openHandlers: Array<() => void> = [];
    private static _peerConnectedHandlers: Array<() => void> = [];
    private static _startHandlers: Array<() => void> = [];
    private static _levelSelectHandlers: Array<(level: "level1" | "level2") => void> = [];
    private static _slotAssignedHandlers: Array<(slot: 1 | 2 | 3 | 4) => void> = [];

    private static _hostConnections: Map<1 | 2 | 3 | 4, any> = new Map();

    // -------------------------------------------------------------------------
    // Public getters
    // -------------------------------------------------------------------------

    public static get isConnected(): boolean { return this._connected; }
    public static get mySlot(): 0 | 1 | 2 | 3 | 4 { return this._mySlot; }
    public static get roomCode(): string { return this._roomCode; }
    public static get playerCount(): number { return this._playerCount; }

    // -------------------------------------------------------------------------
    // Lobby setup
    // -------------------------------------------------------------------------

    /** Read or generate the room code from the URL hash. Call before host/join. */
    public static initRoom(roomCode?: string): string {
        let code = roomCode ?? this._readCodeFromHash();
        if (!code) {
            code = this._generateCode();
        }
        window.location.hash = "room=" + code;
        this._roomCode = code;
        return code;
    }

    /** P1 creates the room — registers a PeerJS peer with the room code as ID. */
    public static host(): void {
        this._mySlot = 1;
        this._playerCount = 1;
        this._nextHostSlot = 2;
        this._connected = true;

        this._peer = new Peer(PEER_PREFIX + this._roomCode);
        this._peer.on("connection", (conn: any) => {
            const slot = this._allocateHostSlot();
            if (slot === null) {
                conn.close();
                return;
            }

            this._hostConnections.set(slot, conn);
            this._wireHostConn(conn, slot);
            this._sendRoomState();
            for (const h of this._peerConnectedHandlers) h();
        });
        this._peer.on("error", (e: any) => console.error("[P2P host]", e));
    }

    /** P2+ joins an existing room — connects to the host's PeerJS peer ID. */
    public static join(): void {
        this._mySlot = 0;
        this._playerCount = 1;
        this._connected = false;

        this._peer = new Peer();
        this._peer.on("open", () => {
            const conn = this._peer!.connect(PEER_PREFIX + this._roomCode, {
                reliable: true,
                serialization: "raw",
            });
            this._hostConn = conn;
            this._wireGuestConn(conn);
        });
        this._peer.on("error", (e: any) => console.error("[P2P guest]", e));
    }

    // -------------------------------------------------------------------------
    // Sending
    // -------------------------------------------------------------------------

    public static send(data: ArrayBuffer): void {
        if (this._mySlot === 1) {
            for (const conn of this._hostConnections.values()) {
                if (conn?.open) {
                    conn.send(data);
                }
            }
            this._dispatchLocal(data);
            return;
        }

        if (this._hostConn?.open) {
            this._hostConn.send(data);
        }
    }

    /**
     * P1 calls this to start the game.
     * Sends a start packet to all guests and triggers local start handlers immediately.
     */
    public static requestStart(): void {
        const buf = new ArrayBuffer(1);
        new DataView(buf).setUint8(0, PACKET_START);
        this.send(buf);
        this._fireStart();
    }

    // -------------------------------------------------------------------------
    // Callbacks
    // -------------------------------------------------------------------------

    /** Registers a handler for incoming game-data packets. */
    public static onMessage(handler: MessageHandler): void {
        this._messageHandlers.push(handler);
    }

    /** Fires when the P2P DataChannel is fully open and ready for game data. */
    public static onOpen(handler: () => void): void {
        if (this._connected) handler();
        else this._openHandlers.push(handler);
    }

    /** Fires when the remote peer connects and the room count changes. */
    public static onPeerConnected(handler: () => void): void {
        if (this._playerCount >= 2) handler();
        else this._peerConnectedHandlers.push(handler);
    }

    /** Fires on BOTH clients when P1 calls requestStart(). */
    public static onStart(handler: () => void): void {
        this._startHandlers.push(handler);
    }

    /** P1 calls this to broadcast level selection to guests. */
    public static selectLevel(level: "level1" | "level2"): void {
        const buf = new ArrayBuffer(2);
        const v = new DataView(buf);
        v.setUint8(0, PACKET_LEVEL);
        v.setUint8(1, level === "level1" ? 1 : 2);
        this.send(buf);
        this._dispatchLocal(buf);
    }

    /** Fires on guests when P1 calls selectLevel(). */
    public static onLevelSelected(handler: (level: "level1" | "level2") => void): void {
        this._levelSelectHandlers.push(handler);
    }

    /** Fires when a guest receives their assigned slot number. */
    public static onSlotAssigned(handler: (slot: 1 | 2 | 3 | 4) => void): void {
        if (this._mySlot >= 1) {
            handler(this._mySlot as 1 | 2 | 3 | 4);
            return;
        }
        this._slotAssignedHandlers.push(handler);
    }

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------

    public static disconnect(): void {
        for (const conn of this._hostConnections.values()) {
            try { conn?.close(); } catch { /* ignore */ }
        }
        this._hostConnections.clear();
        try { this._hostConn?.close(); } catch { /* ignore */ }
        try { this._peer?.destroy(); } catch { /* ignore */ }

        this._peer = null;
        this._hostConn = null;
        this._connected = false;
        this._mySlot = 0;
        this._playerCount = 0;
        this._nextHostSlot = 2;
        this._messageHandlers = [];
        this._openHandlers = [];
        this._peerConnectedHandlers = [];
        this._startHandlers = [];
        this._levelSelectHandlers = [];
        this._slotAssignedHandlers = [];
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    private static _allocateHostSlot(): 2 | 3 | 4 | null {
        if (this._hostConnections.size >= 3) {
            return null;
        }

        const slot = this._nextHostSlot;
        if (slot === 2) this._nextHostSlot = 3;
        else if (slot === 3) this._nextHostSlot = 4;
        else this._nextHostSlot = 4;
        this._playerCount = this._hostConnections.size + 2;
        return slot;
    }

    private static _wireHostConn(conn: any, slot: 2 | 3 | 4): void {
        conn.on("open", () => {
            this._connected = true;
            this._sendAssignSlot(conn, slot);
            this._sendRoomState();
            for (const h of this._openHandlers) h();
            this._openHandlers = [];
            console.log("[P2P] host connection open for slot", slot);
        });

        conn.on("data", (raw: unknown) => {
            const buf = this._normaliseBuffer(raw);
            if (buf === null) {
                return;
            }

            // Relay gameplay packets from one guest to every other guest.
            this._relayFromHostConn(slot, buf);
            this._dispatchLocal(buf);
        });

        conn.on("close", () => {
            this._hostConnections.delete(slot);
            this._playerCount = this._hostConnections.size + 1;
            this._sendRoomState();
            console.warn("[P2P] guest disconnected from slot", slot);
        });

        conn.on("error", (e: any) => console.error("[P2P host conn]", e));
    }

    private static _wireGuestConn(conn: any): void {
        conn.on("open", () => {
            this._connected = true;
            for (const h of this._openHandlers) h();
            this._openHandlers = [];
            console.log("[P2P] DataChannel open — all game data is P2P");
        });

        conn.on("data", (raw: unknown) => {
            const buf = this._normaliseBuffer(raw);
            if (buf === null) {
                return;
            }

            const v = new DataView(buf);
            const type = v.getUint8(0);

            if (buf.byteLength === 2 && type === PACKET_ASSIGN_SLOT) {
                this._mySlot = v.getUint8(1) as 1 | 2 | 3 | 4;
                this._playerCount = Math.max(this._playerCount, 2);
                this._fireSlotAssigned();
                return;
            }

            if (buf.byteLength === 2 && type === PACKET_ROOM_STATE) {
                this._playerCount = Math.max(1, Math.min(4, v.getUint8(1)));
                return;
            }

            if (buf.byteLength === 1 && type === PACKET_START) {
                this._fireStart();
                return;
            }

            if (buf.byteLength === 2 && type === PACKET_LEVEL) {
                const level: "level1" | "level2" = v.getUint8(1) === 1 ? "level1" : "level2";
                const handlers = this._levelSelectHandlers.slice();
                this._levelSelectHandlers = [];
                for (const h of handlers) h(level);
                return;
            }

            this._dispatchLocal(buf);
        });

        conn.on("close", () => {
            this._connected = false;
            console.warn("[P2P] DataChannel closed");
        });

        conn.on("error", (e: any) => console.error("[P2P conn]", e));
    }

    private static _relayFromHostConn(senderSlot: 2 | 3 | 4, data: ArrayBuffer): void {
        const v = new DataView(data);
        const type = v.getUint8(0);

        if (type === PACKET_START || type === PACKET_LEVEL) {
            for (const conn of this._hostConnections.values()) {
                if (conn?.open) {
                    conn.send(data);
                }
            }
            this._dispatchLocal(data);
            return;
        }

        for (const [slot, conn] of this._hostConnections.entries()) {
            if (slot !== senderSlot && conn?.open) {
                conn.send(data);
            }
        }
    }

    private static _dispatchLocal(data: ArrayBuffer): void {
        const v = new DataView(data);
        const type = v.getUint8(0);

        if (data.byteLength === 1 && type === PACKET_START) {
            this._fireStart();
            return;
        }

        if (data.byteLength === 2 && type === PACKET_LEVEL) {
            const level: "level1" | "level2" = v.getUint8(1) === 1 ? "level1" : "level2";
            const handlers = this._levelSelectHandlers.slice();
            this._levelSelectHandlers = [];
            for (const h of handlers) h(level);
            return;
        }

        for (const h of this._messageHandlers) h(data);
    }

    private static _sendAssignSlot(conn: any, slot: 2 | 3 | 4): void {
        const buf = new ArrayBuffer(2);
        const v = new DataView(buf);
        v.setUint8(0, PACKET_ASSIGN_SLOT);
        v.setUint8(1, slot);
        if (conn?.open) {
            conn.send(buf);
        }
    }

    private static _sendRoomState(): void {
        const buf = new ArrayBuffer(2);
        const v = new DataView(buf);
        v.setUint8(0, PACKET_ROOM_STATE);
        v.setUint8(1, Math.max(1, Math.min(4, this._playerCount)));

        if (this._mySlot === 1) {
            for (const conn of this._hostConnections.values()) {
                if (conn?.open) {
                    conn.send(buf);
                }
            }
        } else if (this._hostConn?.open) {
            this._hostConn.send(buf);
        }
    }

    private static _fireStart(): void {
        const handlers = this._startHandlers.slice();
        this._startHandlers = [];
        for (const h of handlers) h();
    }

    private static _fireSlotAssigned(): void {
        const handlers = this._slotAssignedHandlers.slice();
        this._slotAssignedHandlers = [];
        for (const h of handlers) h(this._mySlot as 1 | 2 | 3 | 4);
    }

    private static _normaliseBuffer(raw: unknown): ArrayBuffer | null {
        if (raw instanceof ArrayBuffer) {
            return raw;
        }
        if (ArrayBuffer.isView(raw)) {
            return raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
        }
        return null;
    }

    private static _readCodeFromHash(): string | null {
        const match = window.location.hash.match(/room=([A-Z0-9]{6})/);
        return match ? match[1] : null;
    }

    private static _generateCode(): string {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code = "";
        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }
}
