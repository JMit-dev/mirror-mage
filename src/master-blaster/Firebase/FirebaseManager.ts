/** Minimal typings for the Firebase compat global loaded via CDN */
declare const firebase: {
    database(url?: string): FirebaseDatabase;
};

interface FirebaseDatabase {
    ref(path: string): FirebaseRef;
}

interface FirebaseRef {
    set(value: any): Promise<void>;
    once(event: string): Promise<FirebaseSnapshot>;
    on(event: string, callback: (snapshot: FirebaseSnapshot) => void): void;
    off(): void;
    onDisconnect(): { remove(): Promise<void> };
    child(path: string): FirebaseRef;
}

interface FirebaseSnapshot {
    val(): any;
}

/** Shared room state updated by Firebase listeners */
export interface RoomState {
    roomCode: string;
    playerCount: number;
    mySlot: number;
    status: "waiting" | "full" | "unavailable" | "error";
    joinUrl: string;
    errorMsg: string;
}

/**
 * Manages Firebase Realtime Database room creation and joining for the lobby.
 *
 * Rooms live at: rooms/{roomCode}/players/{playerId}
 * Each player entry: { slot: 1|2, joinedAt: number }
 */
export default class FirebaseManager {
    private static readonly DB_URL =
        "https://mirror-mage-default-rtdb.firebaseio.com";

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
            this.joinRoom(existingCode);
        } else {
            const code = this.generateCode();
            this._state.roomCode = code;
            window.location.hash = "room=" + code;
            this.createRoom(code);
        }
    }

    // -------------------------------------------------------------------------
    // Private helpers
    // -------------------------------------------------------------------------

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
        return window.location.origin + window.location.pathname + "#room=" + code;
    }

    private static createRoom(code: string): void {
        try {
            if (typeof firebase === "undefined" || typeof firebase.database !== "function") {
                throw new Error("Firebase SDK not loaded");
            }
            const playerRef = firebase.database(FirebaseManager.DB_URL).ref(
                "rooms/" + code + "/players/" + this._playerId
            );
            playerRef
                .set({ slot: 1, joinedAt: Date.now() })
                .catch((err: any) => console.error("[FirebaseManager] set failed:", err));
            playerRef.onDisconnect().remove();

            this._state.mySlot = 1;
            this._state.status = "waiting";
            this._state.joinUrl = this.buildJoinUrl(code);

            this.listenToRoom(code);
        } catch (e) {
            console.error("[FirebaseManager] createRoom error:", e);
            this._state.status = "error";
            this._state.errorMsg = String(e);
        }
    }

    private static joinRoom(code: string): void {
        try {
            this._state.joinUrl = this.buildJoinUrl(code);

            firebase
                .database()
                .ref("rooms/" + code + "/players")
                .once("value")
                .then((snapshot) => {
                    const players = snapshot.val() || {};
                    const count = Object.keys(players).length;

                    if (count >= 2) {
                        this._state.status = "full";
                        this._state.playerCount = 2;
                        return;
                    }

                    const playerRef = firebase.database(FirebaseManager.DB_URL).ref(
                        "rooms/" + code + "/players/" + this._playerId
                    );
                    playerRef.set({ slot: 2, joinedAt: Date.now() });
                    playerRef.onDisconnect().remove();
                    this._state.mySlot = 2;
                    this.listenToRoom(code);
                });
        } catch (e) {
            console.error("[FirebaseManager] joinRoom error:", e);
            this._state.status = "error";
            this._state.errorMsg = String(e);
        }
    }

    private static listenToRoom(code: string): void {
        firebase
            .database()
            .ref("rooms/" + code + "/players")
            .on("value", (snapshot) => {
                const players = snapshot.val() || {};
                this._state.playerCount = Object.keys(players).length;
                if (this._state.status !== "full") {
                    this._state.status =
                        this._state.playerCount >= 2 ? "full" : "waiting";
                }
            });
    }
}
