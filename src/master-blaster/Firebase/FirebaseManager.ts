/**
 * Manages room state via the Firebase Realtime Database REST API.
 * Uses plain fetch() — no Firebase SDK required.
 *
 * Rooms live at: rooms/{roomCode}/players/{playerId}
 * Each player entry: { slot: 1|2, joinedAt: number }
 */

const DB_BASE = "https://mirror-mage-default-rtdb.firebaseio.com";

export interface RoomState {
    roomCode: string;
    playerCount: number;
    mySlot: number;
    status: "waiting" | "full" | "unavailable" | "error";
    joinUrl: string;
    errorMsg: string;
}

export default class FirebaseManager {
    private static _state: RoomState = {
        roomCode: "",
        playerCount: 0,
        mySlot: 0,
        status: "waiting",
        joinUrl: "",
        errorMsg: "",
    };

    private static _playerId: string = "";
    private static _initialized: boolean = false;
    private static _pollHandle: any = null;

    public static get state(): Readonly<RoomState> {
        return this._state;
    }

    public static initialize(): void {
        if (this._initialized) return;
        this._initialized = true;

        this._playerId = this.getOrCreatePlayerId();

        const existingCode = this.readCodeFromHash();
        if (existingCode) {
            this._state.roomCode = existingCode;
            this._state.joinUrl = this.buildJoinUrl(existingCode);
            this.joinRoom(existingCode);
        } else {
            const code = this.generateCode();
            this._state.roomCode = code;
            this._state.joinUrl = this.buildJoinUrl(code);
            window.location.hash = "room=" + code;
            this.createRoom(code);
        }

        window.addEventListener("beforeunload", () => this.removePlayer());
    }

    // -------------------------------------------------------------------------
    // Room operations
    // -------------------------------------------------------------------------

    private static createRoom(code: string): void {
        this.putPlayer(code, 1)
            .then(() => {
                this._state.mySlot = 1;
                this.startPolling(code);
            })
            .catch((e) => this.setError(e));
    }

    private static joinRoom(code: string): void {
        fetch(DB_BASE + "/rooms/" + code + "/players.json")
            .then((r) => r.json())
            .then((players) => {
                const count = players ? Object.keys(players).length : 0;
                if (count >= 2) {
                    this._state.status = "unavailable";
                    this._state.playerCount = 2;
                    return;
                }
                return this.putPlayer(code, 2).then(() => {
                    this._state.mySlot = 2;
                    this.startPolling(code);
                });
            })
            .catch((e) => this.setError(e));
    }

    private static putPlayer(code: string, slot: number): Promise<void> {
        return fetch(
            DB_BASE + "/rooms/" + code + "/players/" + this._playerId + ".json",
            {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ slot, joinedAt: Date.now() }),
            }
        ).then((r) => {
            if (!r.ok) throw new Error("HTTP " + r.status);
        });
    }

    private static removePlayer(): void {
        const code = this._state.roomCode;
        if (!code || !this._playerId) return;
        // sendBeacon keeps the request alive through page unload
        navigator.sendBeacon(
            DB_BASE + "/rooms/" + code + "/players/" + this._playerId + ".json?x-http-method-override=DELETE",
            new Blob(['null'], { type: 'application/json' })
        );
    }

    // -------------------------------------------------------------------------
    // Polling
    // -------------------------------------------------------------------------

    private static startPolling(code: string): void {
        // Immediately fetch once, then every 2 seconds
        this.fetchPlayerCount(code);
        this._pollHandle = setInterval(() => this.fetchPlayerCount(code), 2000);
    }

    private static fetchPlayerCount(code: string): void {
        fetch(DB_BASE + "/rooms/" + code + "/players.json")
            .then((r) => r.json())
            .then((players) => {
                const count = players ? Object.keys(players).length : 0;
                this._state.playerCount = count;
                if (this._state.status !== "unavailable") {
                    this._state.status = count >= 2 ? "full" : "waiting";
                }
            })
            .catch((e) => console.warn("[FirebaseManager] poll error:", e));
    }

    // -------------------------------------------------------------------------
    // Helpers
    // -------------------------------------------------------------------------

    private static setError(e: any): void {
        console.error("[FirebaseManager] error:", e);
        this._state.status = "error";
        this._state.errorMsg = String(e);
    }

    private static getOrCreatePlayerId(): string {
        try {
            let id = sessionStorage.getItem("mm_player_id");
            if (!id) {
                id = Math.random().toString(36).substring(2, 10);
                sessionStorage.setItem("mm_player_id", id);
            }
            return id;
        } catch {
            return Math.random().toString(36).substring(2, 10);
        }
    }

    private static readCodeFromHash(): string | null {
        const match = window.location.hash.match(/room=([A-Z0-9]{6})/);
        return match ? match[1] : null;
    }

    private static generateCode(): string {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code = "";
        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }

    private static buildJoinUrl(code: string): string {
        return (
            window.location.origin +
            window.location.pathname +
            "#room=" + code
        );
    }
}
