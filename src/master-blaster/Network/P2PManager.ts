/**
 * Manages a WebRTC peer-to-peer DataChannel between two players.
 * Firebase is used only for signaling (offer/answer/ICE candidate exchange).
 * All game data flows directly P2P after the connection is established.
 */

const DB_BASE = "https://mirror-mage-default-rtdb.firebaseio.com";

const ICE_SERVERS: RTCIceServer[] = [
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
];

type MessageHandler = (data: ArrayBuffer) => void;

export default class P2PManager {
    private static _pc: RTCPeerConnection | null = null;
    private static _channel: RTCDataChannel | null = null;
    private static _connected: boolean = false;
    private static _messageHandlers: MessageHandler[] = [];
    private static _openHandlers: Array<() => void> = [];
    private static _icePollHandle: ReturnType<typeof setInterval> | null = null;
    private static _seenRemoteCandidates: Set<string> = new Set();
    private static _roomCode: string = "";
    private static _isHost: boolean = false;

    public static get isConnected(): boolean {
        return this._connected;
    }

    public static onMessage(handler: MessageHandler): void {
        this._messageHandlers.push(handler);
    }

    public static onOpen(handler: () => void): void {
        if (this._connected) {
            handler();
        } else {
            this._openHandlers.push(handler);
        }
    }

    public static send(data: ArrayBuffer): void {
        if (this._channel && this._channel.readyState === "open") {
            this._channel.send(data);
        }
    }

    public static async connect(roomCode: string, isHost: boolean): Promise<void> {
        this._roomCode = roomCode;
        this._isHost = isHost;
        this._seenRemoteCandidates = new Set();

        this._pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

        this._pc.onicecandidate = (e) => {
            if (e.candidate) {
                this._appendIceCandidate(e.candidate.toJSON());
            }
        };

        if (isHost) {
            this._channel = this._pc.createDataChannel("game", { ordered: true });
            this._wireChannel(this._channel);

            const offer = await this._pc.createOffer();
            await this._pc.setLocalDescription(offer);
            await this._putSignal("offer", { sdp: offer.sdp, type: offer.type });

            // Wait for guest's answer
            const answer = await this._pollSignal("answer");
            await this._pc.setRemoteDescription(new RTCSessionDescription(answer));
        } else {
            this._pc.ondatachannel = (e) => {
                this._channel = e.channel;
                this._wireChannel(this._channel);
            };

            const offer = await this._pollSignal("offer");
            await this._pc.setRemoteDescription(new RTCSessionDescription(offer));

            const answer = await this._pc.createAnswer();
            await this._pc.setLocalDescription(answer);
            await this._putSignal("answer", { sdp: answer.sdp, type: answer.type });
        }

        // Poll Firebase for the remote peer's ICE candidates every second
        this._icePollHandle = setInterval(() => this._fetchRemoteCandidates(), 1000);
    }

    public static disconnect(): void {
        if (this._icePollHandle !== null) {
            clearInterval(this._icePollHandle);
            this._icePollHandle = null;
        }
        this._channel?.close();
        this._pc?.close();
        this._channel = null;
        this._pc = null;
        this._connected = false;
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

    private static _wireChannel(channel: RTCDataChannel): void {
        channel.binaryType = "arraybuffer";

        channel.onopen = () => {
            this._connected = true;
            if (this._icePollHandle !== null) {
                clearInterval(this._icePollHandle);
                this._icePollHandle = null;
            }
            for (const h of this._openHandlers) h();
            this._openHandlers = [];
            console.log("[P2P] DataChannel open — game data now flows P2P");
        };

        channel.onmessage = (e) => {
            for (const h of this._messageHandlers) h(e.data as ArrayBuffer);
        };

        channel.onclose = () => {
            this._connected = false;
            console.warn("[P2P] DataChannel closed");
        };

        channel.onerror = (e) => {
            console.error("[P2P] DataChannel error", e);
        };
    }

    private static async _putSignal(key: string, data: unknown): Promise<void> {
        await fetch(`${DB_BASE}/rooms/${this._roomCode}/rtc/${key}.json`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data),
        });
    }

    private static async _pollSignal(key: string): Promise<any> {
        while (true) {
            const r = await fetch(
                `${DB_BASE}/rooms/${this._roomCode}/rtc/${key}.json?t=${Date.now()}`,
                { cache: "no-store" }
            );
            const data = await r.json();
            if (data) return data;
            await new Promise<void>((res) => setTimeout(res, 400));
        }
    }

    private static _appendIceCandidate(candidate: RTCIceCandidateInit): void {
        const slot = this._isHost ? "ice_host" : "ice_guest";
        const url = `${DB_BASE}/rooms/${this._roomCode}/rtc/${slot}.json`;
        fetch(url + "?t=" + Date.now(), { cache: "no-store" })
            .then((r) => r.json())
            .then((existing: RTCIceCandidateInit[] | null) => {
                const list = Array.isArray(existing) ? existing : [];
                list.push(candidate);
                return fetch(url, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(list),
                });
            })
            .catch(() => {});
    }

    private static _fetchRemoteCandidates(): void {
        if (!this._pc) return;
        const slot = this._isHost ? "ice_guest" : "ice_host";
        fetch(
            `${DB_BASE}/rooms/${this._roomCode}/rtc/${slot}.json?t=${Date.now()}`,
            { cache: "no-store" }
        )
            .then((r) => r.json())
            .then((list: RTCIceCandidateInit[] | null) => {
                if (!Array.isArray(list)) return;
                for (const c of list) {
                    const key = JSON.stringify(c);
                    if (!this._seenRemoteCandidates.has(key)) {
                        this._seenRemoteCandidates.add(key);
                        this._pc!.addIceCandidate(new RTCIceCandidate(c)).catch(() => {});
                    }
                }
            })
            .catch(() => {});
    }
}
