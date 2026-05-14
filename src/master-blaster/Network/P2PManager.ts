/**
 * Manages a WebRTC peer-to-peer DataChannel between two players via PeerJS.
 * PeerJS handles the WebRTC signaling (offer/answer/ICE) through its free
 * hosted server. All game data flows directly P2P after the channel opens.
 *
 * No Firebase is used here.
 */
// PeerJS is loaded from CDN as a global — no npm import needed.
declare const Peer: any;

type MessageHandler = (data: ArrayBuffer) => void;

/** Peer ID prefix to avoid collisions with other PeerJS users */
const PEER_PREFIX = "mm-";
/** Sent by P1 to both clients to trigger game start */
const PACKET_START = 0xfe;
/** Sent by P1 to both clients to indicate level selection: [0xfd, levelByte] */
const PACKET_LEVEL = 0xfd;

export default class P2PManager {
    private static _peer: any | null = null;
    private static _conn: any | null = null;
    private static _connected: boolean = false;
    private static _mySlot: 0 | 1 | 2 = 0;
    private static _roomCode: string = "";
    private static _playerCount: number = 0;

    private static _messageHandlers: MessageHandler[] = [];
    private static _openHandlers: Array<() => void> = [];
    private static _peerConnectedHandlers: Array<() => void> = [];
    private static _startHandlers: Array<() => void> = [];
    private static _levelSelectHandlers: Array<(level: "level1" | "level2") => void> = [];

    // -------------------------------------------------------------------------
    // Public getters
    // -------------------------------------------------------------------------

    public static get isConnected(): boolean { return this._connected; }
    public static get mySlot(): 0 | 1 | 2 { return this._mySlot; }
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

        this._peer = new Peer(PEER_PREFIX + this._roomCode);
        this._peer.on("connection", (conn: any) => {
            this._playerCount = 2;
            for (const h of this._peerConnectedHandlers) h();
            this._wireConn(conn);
        });
        this._peer.on("error", (e: any) => console.error("[P2P host]", e));
    }

    /** P2 joins an existing room — connects to P1's PeerJS peer ID. */
    public static join(): void {
        this._mySlot = 2;
        this._playerCount = 1;

        this._peer = new Peer();
        this._peer.on("open", () => {
            const conn = this._peer!.connect(PEER_PREFIX + this._roomCode, {
                reliable: true,
                serialization: "raw",
            });
            this._wireConn(conn);
        });
        this._peer.on("error", (e: any) => console.error("[P2P guest]", e));
    }

    // -------------------------------------------------------------------------
    // Sending
    // -------------------------------------------------------------------------

    public static send(data: ArrayBuffer): void {
        if (this._conn?.open) {
            this._conn.send(data);
        }
    }

    /**
     * P1 calls this to start the game.
     * Sends a start packet to P2 and triggers local start handlers immediately.
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

    /** Fires when the remote peer connects (playerCount becomes 2). */
    public static onPeerConnected(handler: () => void): void {
        if (this._playerCount >= 2) handler();
        else this._peerConnectedHandlers.push(handler);
    }

    /** Fires on BOTH clients when P1 calls requestStart(). */
    public static onStart(handler: () => void): void {
        this._startHandlers.push(handler);
    }

    /** P1 calls this to broadcast level selection to P2 and transition locally. */
    public static selectLevel(level: "level1" | "level2"): void {
        const buf = new ArrayBuffer(2);
        const v = new DataView(buf);
        v.setUint8(0, PACKET_LEVEL);
        v.setUint8(1, level === "level1" ? 1 : 2);
        this.send(buf);
    }

    /** Fires on P2 when P1 calls selectLevel(). */
    public static onLevelSelected(handler: (level: "level1" | "level2") => void): void {
        this._levelSelectHandlers.push(handler);
    }

    // -------------------------------------------------------------------------
    // Cleanup
    // -------------------------------------------------------------------------

    public static disconnect(): void {
        this._conn?.close();
        this._peer?.destroy();
        this._conn = null;
        this._peer = null;
        this._connected = false;
        this._mySlot = 0;
        this._playerCount = 0;
        this._messageHandlers = [];
        this._openHandlers = [];
        this._peerConnectedHandlers = [];
        this._startHandlers = [];
        this._levelSelectHandlers = [];
    }

    // -------------------------------------------------------------------------
    // Internal
    // -------------------------------------------------------------------------

    private static _wireConn(conn: any): void {
        this._conn = conn;

        conn.on("open", () => {
            this._connected = true;
            this._playerCount = 2;
            // Flush any deferred peer-connected handlers (P2 side)
            for (const h of this._peerConnectedHandlers) h();
            this._peerConnectedHandlers = [];
            for (const h of this._openHandlers) h();
            this._openHandlers = [];
            console.log("[P2P] DataChannel open — all game data is P2P");
        });

        conn.on("data", (raw: unknown) => {
            // Normalise to ArrayBuffer
            let buf: ArrayBuffer;
            if (raw instanceof ArrayBuffer) {
                buf = raw;
            } else if (ArrayBuffer.isView(raw)) {
                buf = raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength);
            } else {
                return;
            }

            const v = new DataView(buf);
            const type = v.getUint8(0);

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

            for (const h of this._messageHandlers) h(buf);
        });

        conn.on("close", () => {
            this._connected = false;
            console.warn("[P2P] DataChannel closed");
        });

        conn.on("error", (e: any) => console.error("[P2P conn]", e));
    }

    private static _fireStart(): void {
        const handlers = this._startHandlers.slice();
        this._startHandlers = [];
        for (const h of handlers) h();
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
