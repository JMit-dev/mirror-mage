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
    started: boolean;
    selectedLevel: string;
    runtimePlayers: Partial<Record<1 | 2, RuntimePlayerState>>;
}

export interface RuntimePlayerState {
    x: number;
    y: number;
    invertX: boolean;
    rotation: number;
    updatedAt: number;
}

export default class FirebaseManager {
    private static _state: RoomState = {
        roomCode: "",
        playerCount: 0,
        mySlot: 0,
        status: "waiting",
        joinUrl: "",
        errorMsg: "",
        started: false,
        selectedLevel: "",
        runtimePlayers: {},
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
        this.initializeRoomMeta(code)
            .then(() => this.putPlayer(code, 1))
            .then(() => {
                this._state.mySlot = 1;
                this.startPolling(code);
            })
            .catch((e) => this.setError(e));
    }

    private static joinRoom(code: string): void {
        this.fetchJson("/rooms/" + code + "/players.json")
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

    private static initializeRoomMeta(code: string): Promise<void> {
        return fetch(DB_BASE + "/rooms/" + code + "/meta.json", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ started: false, selectedLevel: "" }),
        }).then((r) => {
            if (!r.ok) throw new Error("HTTP " + r.status);
        });
    }

    public static startGame(): Promise<void> {
        return this.patchRoomMeta({ started: true });
    }

    public static selectLevel(level: string): Promise<void> {
        return this.patchRoomMeta({ selectedLevel: level });
    }

    public static publishPlayerState(slot: 1 | 2, state: RuntimePlayerState): Promise<void> {
        const code = this._state.roomCode;
        if (!code || !this._playerId) {
            return Promise.reject(new Error("No room code"));
        }

        return fetch(DB_BASE + "/rooms/" + code + "/players/" + this._playerId + ".json", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                slot,
                x: state.x,
                y: state.y,
                invertX: state.invertX,
                rotation: state.rotation,
                updatedAt: state.updatedAt
            }),
        }).then((r) => {
            if (!r.ok) throw new Error("HTTP " + r.status);
        });
    }

    private static patchRoomMeta(meta: Record<string, unknown>): Promise<void> {
        const code = this._state.roomCode;
        if (!code) {
            return Promise.reject(new Error("No room code"));
        }

        return fetch(DB_BASE + "/rooms/" + code + "/meta.json", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(meta),
        }).then((r) => {
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
        // Immediately fetch once, then poll frequently enough for scene transitions to feel instant.
        this.fetchRoomState(code);
        this._pollHandle = setInterval(() => this.fetchRoomState(code), 500);
    }

    private static fetchRoomState(code: string): void {
        this.fetchJson("/rooms/" + code + ".json")
            .then((room) => {
                const players = room?.players;
                const count = players ? Object.keys(players).length : 0;
                this._state.playerCount = count;
                if (this._state.status !== "unavailable") {
                    this._state.status = count >= 2 ? "full" : "waiting";
                }
                this._state.started = room?.meta?.started === true;
                this._state.selectedLevel = typeof room?.meta?.selectedLevel === "string" ? room.meta.selectedLevel : "";
                const runtimePlayers: Partial<Record<1 | 2, RuntimePlayerState>> = {};
                if (players) {
                    for (const key in players) {
                        const value = players[key];
                        if (value?.slot === 1 || value?.slot === 2) {
                            runtimePlayers[value.slot] = {
                                x: Number(value.x ?? 0),
                                y: Number(value.y ?? 0),
                                invertX: Boolean(value.invertX),
                                rotation: Number(value.rotation ?? 0),
                                updatedAt: Number(value.updatedAt ?? 0),
                            };
                        }
                    }
                }
                this._state.runtimePlayers = runtimePlayers;
            })
            .catch((e) => console.warn("[FirebaseManager] poll error:", e));
    }

    private static fetchJson(path: string): Promise<any> {
        const separator = path.includes("?") ? "&" : "?";
        return fetch(DB_BASE + path + separator + "t=" + Date.now(), {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" }
        }).then((r) => {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
        });
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
