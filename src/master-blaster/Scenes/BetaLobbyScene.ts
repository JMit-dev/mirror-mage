import Vec2 from "../../Wolfie2D/DataTypes/Vec2";
import Input from "../../Wolfie2D/Input/Input";
import Button from "../../Wolfie2D/Nodes/UIElements/Button";
import Label from "../../Wolfie2D/Nodes/UIElements/Label";
import { UIElementType } from "../../Wolfie2D/Nodes/UIElements/UIElementTypes";
import Scene from "../../Wolfie2D/Scene/Scene";
import Color from "../../Wolfie2D/Utils/Color";
import { getRuntimeConfig, TurnMode, TurnModeValue } from "../config/RuntimeConfig";
import P2PManager from "../Network/P2PManager";
import MainMenu from "./MainMenu";

const DB_BASE = "https://mirror-mage-default-rtdb.firebaseio.com";
const LAYER = "BETA_LOBBY";

type ListedRoom = {
    code: string;
    playerCount: number;
    createdAt: number;
    transportMode: TurnMode;
};

export default class BetaLobbyScene extends Scene {
    private static readonly ROOM_LIMIT = 6;
    private static readonly MAX_PLAYERS = 4;
    private static readonly ROOM_TTL_MS = 30 * 60 * 1000;
    private static readonly REFRESH_INTERVAL = 2;
    private static readonly ROOM_BUTTON_COLUMNS = 3;
    private static readonly ROOM_BUTTON_X_SPACING = 330;
    private static readonly ROOM_BUTTON_Y_SPACING = 72;

    private title!: Label;
    private statusLabel!: Label;
    private roomButtons: Array<Button> = [];
    private createButton!: Button;
    private refreshButton!: Button;
    private backButton!: Button;
    private waitingRoomLabel!: Label;
    private waitingRoomCodeLabel!: Label;
    private waitingRoomPlayersLabel!: Label;
    private waitingRoomTransportLabel!: Label;
    private startButton!: Button;
    private rooms: Array<ListedRoom> = [];
    private refreshTimer = 0;
    private roomMetaPollTimer = 0;
    private relayRetryTimer = 0;
    private roomMetaRequestInFlight = false;
    private hosting = false;
    private joining = false;
    private activeRoomCode = "";
    private activeSlot: 0 | 1 | 2 | 3 | 4 = 0;
    private currentTransportMode: TurnMode = TurnModeValue.P2P_THEN_TURN;

    public startScene(): void {
        Input.enableInput();
        this.addUILayer(LAYER);
        P2PManager.disconnect();

        const half = this.viewport.getHalfSize();
        this.viewport.setFocus(half);
        this.viewport.setZoomLevel(1);

        this.title = this.createLabel(new Vec2(half.x, half.y - 260), "Lobby", 52, Color.BLACK);
        this.statusLabel = this.createLabel(new Vec2(half.x, half.y - 190), "Loading rooms...", 24, new Color(40, 40, 40));

        this.createButton = this.createButtonControl(new Vec2(half.x - 180, half.y - 120), "Make Room");
        this.createButton.onClick = () => this.createRoom();

        this.refreshButton = this.createButtonControl(new Vec2(half.x + 180, half.y - 120), "Refresh");
        this.refreshButton.onClick = () => this.refreshRooms();

        for (let i = 0; i < BetaLobbyScene.ROOM_LIMIT; i++) {
            const button = this.createButtonControl(this.getRoomButtonPosition(half, i), "Empty");
            const index = i;
            button.onClick = () => this.joinRoom(index);
            this.roomButtons.push(button);
        }

        this.waitingRoomLabel = this.createLabel(new Vec2(half.x, half.y - 95), "Waiting Room", 38, Color.BLACK);
        this.waitingRoomCodeLabel = this.createLabel(new Vec2(half.x, half.y - 20), "Room ------", 34, new Color(88, 72, 142));
        this.waitingRoomPlayersLabel = this.createLabel(new Vec2(half.x, half.y + 45), "Players 1/4", 28, new Color(40, 40, 40));
        this.waitingRoomTransportLabel = this.createLabel(new Vec2(half.x, half.y + 95), "Transport: direct", 24, new Color(60, 60, 60));
        this.startButton = this.createButtonControl(new Vec2(half.x, half.y + 175), "Start");
        this.startButton.onClick = () => this.startHostedGame();

        this.backButton = this.createButtonControl(new Vec2(half.x, half.y + 260), "Back");
        this.backButton.onClick = () => {
            this.leaveBetaLobby();
        };

        this.showRoomList();
        this.registerP2PCallbacks();

        const hashRoomCode = this.readCodeFromHash();
        if (hashRoomCode) {
            this.statusLabel.text = "Opening room " + hashRoomCode + "...";
            this.joinRoomByCode(hashRoomCode);
            return;
        }

        this.refreshRooms();
    }

    public updateScene(deltaT: number): void {
        if (this.hosting || this.joining) {
            this.roomMetaPollTimer -= deltaT;
            this.relayRetryTimer -= deltaT;

            if (this.roomMetaPollTimer <= 0) {
                this.pollActiveRoomMeta();
            }

            if (
                this.joining &&
                this.currentTransportMode === TurnModeValue.TURN_ONLY &&
                !P2PManager.isConnected &&
                this.relayRetryTimer <= 0
            ) {
                this.relayRetryTimer = this.secondsFromMs(getRuntimeConfig().network.relayRetryMs);
                this.startConnectionAttempt(TurnModeValue.TURN_ONLY, "Retrying room with TURN relay...");
            }

            if (this.hosting && P2PManager.playerCount >= 2) {
                this.statusLabel.text = "Player joined. Press Start.";
                this.waitingRoomPlayersLabel.text = "Players " + P2PManager.playerCount + "/" + BetaLobbyScene.MAX_PLAYERS;
                this.startButton.visible = true;
                if (Input.isKeyJustPressed("space")) {
                    this.startHostedGame();
                }
            }
            return;
        }

        this.refreshTimer -= deltaT;
        if (this.refreshTimer <= 0) {
            this.refreshRooms();
        }
    }

    private registerP2PCallbacks(): void {
        P2PManager.onPeerConnected(() => {
            if (this.hosting) {
                this.updateRoomMeta(P2PManager.roomCode, { playerCount: P2PManager.playerCount });
                this.statusLabel.text = "Player joined. Press Start.";
                this.waitingRoomPlayersLabel.text = "Players " + P2PManager.playerCount + "/" + BetaLobbyScene.MAX_PLAYERS;
                this.startButton.visible = true;
            }
        });

        P2PManager.onOpen(() => {
            this.relayRetryTimer = 0;
            if (this.joining) {
                this.statusLabel.text = this.currentTransportMode === TurnModeValue.TURN_ONLY
                    ? "Joined room via TURN. Waiting for host..."
                    : "Joined room. Waiting for host...";
            }
        });

        P2PManager.onConnectionFailed((reason) => {
            if (!this.hosting && !this.joining) {
                return;
            }

            if (this.currentTransportMode === TurnModeValue.P2P_THEN_TURN) {
                this.statusLabel.text = "Direct connection failed. Switching room to TURN...";
                this.requestRelayFallback(reason);
                return;
            }

            if (this.joining) {
                this.statusLabel.text = "TURN connect retry queued...";
                this.relayRetryTimer = this.secondsFromMs(getRuntimeConfig().network.relayRetryMs);
                return;
            }

            this.statusLabel.text = "TURN host error: " + reason;
        });

        P2PManager.onStart(() => {
            this.updateRoomMeta(P2PManager.roomCode, { started: true, playerCount: P2PManager.playerCount });
            this.sceneManager.changeToScene(MainMenu);
        });
    }

    private createRoom(): void {
        if (this.hosting || this.joining) return;

        this.hosting = true;
        this.joining = false;
        this.activeSlot = 1;
        this.activeRoomCode = this.generateCode();
        this.currentTransportMode = this.getInitialTransportMode();
        this.statusLabel.text = "Creating room...";

        this.createRoomRecord(this.activeRoomCode, this.currentTransportMode).then(() => {
            this.startConnectionAttempt(this.currentTransportMode, this.getHostingStatusText(this.currentTransportMode));
            this.refreshRooms();
        }).catch((error) => {
            this.statusLabel.text = "Could not create room: " + String(error.message ?? error);
            this.hosting = false;
            this.activeRoomCode = "";
            this.activeSlot = 0;
            P2PManager.disconnect();
            window.location.hash = "";
        });
    }

    private joinRoom(index: number): void {
        const room = this.rooms[index];
        if (room === undefined) {
            return;
        }
        this.joinRoomByCode(room.code);
    }

    private joinRoomByCode(code: string): void {
        if (this.hosting || this.joining) return;

        this.joining = true;
        this.hosting = false;
        this.activeRoomCode = code;
        this.activeSlot = 2;
        this.statusLabel.text = "Joining room " + code + "...";

        this.fetchJson("/rooms/" + code + "/meta.json")
            .then((meta) => {
                if (meta?.beta !== true || meta?.started === true) {
                    throw new Error("Room is unavailable");
                }

                const currentCount = Number(meta?.playerCount ?? 0);
                if (currentCount >= BetaLobbyScene.MAX_PLAYERS) {
                    throw new Error("Room is full");
                }

                this.currentTransportMode = this.normalizeTransportMode(meta?.transportMode);
                return this.updateRoomMeta(code, {
                    playerCount: Math.min(BetaLobbyScene.MAX_PLAYERS, Math.max(1, currentCount + 1))
                });
            })
            .then(() => {
                this.startConnectionAttempt(this.currentTransportMode, this.getJoiningStatusText(this.currentTransportMode));
            })
            .catch((error) => {
                this.statusLabel.text = "Could not join room: " + String(error.message ?? error);
                this.joining = false;
                this.activeRoomCode = "";
                this.activeSlot = 0;
                window.location.hash = "";
                this.showRoomList();
                this.refreshRooms();
            });
    }

    private startConnectionAttempt(mode: TurnMode, status: string): void {
        if (!this.activeRoomCode) {
            return;
        }

        this.currentTransportMode = mode;
        this.roomMetaPollTimer = this.secondsFromMs(getRuntimeConfig().network.roomMetaPollMs);
        this.relayRetryTimer = this.secondsFromMs(getRuntimeConfig().network.relayRetryMs);
        this.waitingRoomTransportLabel.text = "Transport: " + this.getTransportLabel(mode);
        this.showWaitingRoom(status);

        P2PManager.disconnect(false);
        P2PManager.initRoom(this.activeRoomCode);

        if (this.hosting) {
            P2PManager.host(mode);
        } else if (this.joining) {
            P2PManager.join(mode);
        }
    }

    private pollActiveRoomMeta(): void {
        if (!this.activeRoomCode || this.roomMetaRequestInFlight) {
            return;
        }

        this.roomMetaPollTimer = this.secondsFromMs(getRuntimeConfig().network.roomMetaPollMs);
        this.roomMetaRequestInFlight = true;
        this.fetchJson("/rooms/" + this.activeRoomCode + "/meta.json")
            .then((meta) => {
                const playerCount = Math.max(1, Math.min(BetaLobbyScene.MAX_PLAYERS, Number(meta?.playerCount ?? (this.hosting ? 1 : 2))));
                this.waitingRoomPlayersLabel.text = "Players " + playerCount + "/" + BetaLobbyScene.MAX_PLAYERS;

                const roomTransportMode = this.normalizeTransportMode(meta?.transportMode);
                this.waitingRoomTransportLabel.text = "Transport: " + this.getTransportLabel(roomTransportMode);

                if (roomTransportMode !== this.currentTransportMode) {
                    this.startConnectionAttempt(
                        roomTransportMode,
                        roomTransportMode === TurnModeValue.TURN_ONLY
                            ? "Switching room to TURN relay..."
                            : "Switching room to direct mode..."
                    );
                }
            })
            .catch(() => {
                this.statusLabel.text = "Could not refresh room status.";
            })
            .then(() => {
                this.roomMetaRequestInFlight = false;
            })
        ;
    }

    private requestRelayFallback(reason: string): void {
        if (!this.activeRoomCode) {
            return;
        }

        this.updateRoomMeta(this.activeRoomCode, {
            transportMode: TurnModeValue.TURN_ONLY,
            transportReason: reason,
            transportSwitchedAt: Date.now()
        }).catch(() => {
            this.statusLabel.text = "Could not switch room to TURN.";
        });
    }

    private refreshRooms(): void {
        this.refreshTimer = BetaLobbyScene.REFRESH_INTERVAL;
        this.fetchJson("/rooms.json")
            .then((rooms) => {
                const now = Date.now();
                this.rooms = [];
                if (rooms) {
                    for (const code in rooms) {
                        const meta = rooms[code]?.meta;
                        if (
                            meta?.beta === true &&
                            meta?.started !== true &&
                            Number(meta?.playerCount ?? 0) < BetaLobbyScene.MAX_PLAYERS &&
                            now - Number(meta?.createdAt ?? 0) < BetaLobbyScene.ROOM_TTL_MS
                        ) {
                            this.rooms.push({
                                code,
                                playerCount: Number(meta.playerCount ?? 1),
                                createdAt: Number(meta.createdAt ?? 0),
                                transportMode: this.normalizeTransportMode(meta.transportMode)
                            });
                        }
                    }
                }

                this.rooms.sort((a, b) => b.createdAt - a.createdAt);
                this.rooms = this.rooms.slice(0, BetaLobbyScene.ROOM_LIMIT);
                this.updateRoomButtons();
                if (!this.hosting && !this.joining) {
                    this.statusLabel.text = this.rooms.length === 0
                        ? "No rooms available. Make one."
                        : "Choose a room or make one.";
                }
            })
            .catch(() => {
                if (!this.hosting && !this.joining) {
                    this.statusLabel.text = "Could not load rooms.";
                }
            });
    }

    private updateRoomButtons(): void {
        const showingWaitingRoom = this.hosting || this.joining;

        for (let i = 0; i < this.roomButtons.length; i++) {
            const room = this.rooms[i];
            const button = this.roomButtons[i];
            button.text = room === undefined
                ? "Empty Room"
                : "Join " + room.code + "   " + room.playerCount + "/" + BetaLobbyScene.MAX_PLAYERS + "   " + this.getTransportBadge(room.transportMode);
            button.visible = !showingWaitingRoom;
            button.sizeToText();
        }
    }

    private showRoomList(): void {
        this.createButton.visible = true;
        this.refreshButton.visible = true;
        this.roomButtons.forEach(button => button.visible = true);
        this.waitingRoomLabel.visible = false;
        this.waitingRoomCodeLabel.visible = false;
        this.waitingRoomPlayersLabel.visible = false;
        this.waitingRoomTransportLabel.visible = false;
        this.startButton.visible = false;
    }

    private showWaitingRoom(status: string): void {
        this.statusLabel.text = status;
        this.createButton.visible = false;
        this.refreshButton.visible = false;
        this.roomButtons.forEach(button => button.visible = false);
        this.waitingRoomLabel.visible = true;
        this.waitingRoomCodeLabel.visible = true;
        this.waitingRoomPlayersLabel.visible = true;
        this.waitingRoomTransportLabel.visible = true;
        this.waitingRoomCodeLabel.text = "Room " + this.activeRoomCode;
        const displayedCount = Math.max(1, Math.min(BetaLobbyScene.MAX_PLAYERS, P2PManager.playerCount || (this.hosting ? 1 : 2)));
        this.waitingRoomPlayersLabel.text = "Players " + displayedCount + "/" + BetaLobbyScene.MAX_PLAYERS;
        this.waitingRoomTransportLabel.text = "Transport: " + this.getTransportLabel(this.currentTransportMode);
        this.startButton.visible = this.hosting && P2PManager.playerCount >= 2;
    }

    private startHostedGame(): void {
        if (!this.hosting || P2PManager.playerCount < 2) return;

        this.statusLabel.text = "Starting...";
        this.updateRoomMeta(P2PManager.roomCode, {
            started: true,
            playerCount: P2PManager.playerCount,
            transportMode: this.currentTransportMode
        });
        P2PManager.requestStart();
    }

    private createRoomRecord(code: string, transportMode: TurnMode): Promise<void> {
        return fetch(DB_BASE + "/rooms/" + code + ".json", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                meta: {
                    beta: true,
                    createdAt: Date.now(),
                    playerCount: 1,
                    started: false,
                    transportMode
                }
            })
        }).then((response) => {
            if (!response.ok) throw new Error("HTTP " + response.status);
        });
    }

    private updateRoomMeta(code: string, meta: Record<string, unknown>): Promise<void> {
        return fetch(DB_BASE + "/rooms/" + code + "/meta.json", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(meta)
        }).then((response) => {
            if (!response.ok) throw new Error("HTTP " + response.status);
        });
    }

    private leaveBetaLobby(): void {
        const code = this.activeRoomCode;
        const slot = this.activeSlot;

        P2PManager.disconnect();
        window.location.hash = "";

        if (code && slot === 1) {
            this.updateRoomMeta(code, { started: true, playerCount: 0 });
        } else if (code && slot >= 2) {
            this.updateRoomMeta(code, { playerCount: 1 });
        }

        this.sceneManager.changeToScene(MainMenu);
    }

    private fetchJson(path: string): Promise<any> {
        return fetch(DB_BASE + path + "?t=" + Date.now(), {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" }
        }).then((response) => {
            if (!response.ok) throw new Error("HTTP " + response.status);
            return response.json();
        });
    }

    private generateCode(): string {
        const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        let code = "";
        for (let i = 0; i < 6; i++) {
            code += chars[Math.floor(Math.random() * chars.length)];
        }
        return code;
    }

    private readCodeFromHash(): string | null {
        const match = window.location.hash.match(/room=([A-Z0-9]{6})/);
        return match ? match[1] : null;
    }

    private getInitialTransportMode(): TurnMode {
        return getRuntimeConfig().network.turnMode === TurnModeValue.TURN_ONLY
            ? TurnModeValue.TURN_ONLY
            : TurnModeValue.P2P_THEN_TURN;
    }

    private normalizeTransportMode(value: unknown): TurnMode {
        return Number(value) === TurnModeValue.TURN_ONLY
            ? TurnModeValue.TURN_ONLY
            : TurnModeValue.P2P_THEN_TURN;
    }

    private getTransportLabel(mode: TurnMode): string {
        return mode === TurnModeValue.TURN_ONLY ? "TURN relay" : "direct P2P";
    }

    private getTransportBadge(mode: TurnMode): string {
        return mode === TurnModeValue.TURN_ONLY ? "[TURN]" : "[AUTO]";
    }

    private getHostingStatusText(mode: TurnMode): string {
        return mode === TurnModeValue.TURN_ONLY
            ? "Room created. Waiting with TURN relay..."
            : "Room created. Trying direct P2P first...";
    }

    private getJoiningStatusText(mode: TurnMode): string {
        return mode === TurnModeValue.TURN_ONLY
            ? "Joining room with TURN relay..."
            : "Joining room with direct P2P...";
    }

    private secondsFromMs(ms: number): number {
        return Math.max(0.25, ms / 1000);
    }

    private getRoomButtonPosition(half: Vec2, index: number): Vec2 {
        const column = index % BetaLobbyScene.ROOM_BUTTON_COLUMNS;
        const row = Math.floor(index / BetaLobbyScene.ROOM_BUTTON_COLUMNS);
        const startX = half.x - BetaLobbyScene.ROOM_BUTTON_X_SPACING;
        const x = startX + column * BetaLobbyScene.ROOM_BUTTON_X_SPACING;
        const y = half.y - 35 + row * BetaLobbyScene.ROOM_BUTTON_Y_SPACING;
        return new Vec2(x, y);
    }

    private createLabel(position: Vec2, text: string, fontSize: number, color: Color): Label {
        const label = <Label>this.add.uiElement(UIElementType.LABEL, LAYER, { position, text });
        label.font = "PixelSimple";
        label.fontSize = fontSize;
        label.textColor = color;
        label.backgroundColor = Color.TRANSPARENT;
        label.borderColor = Color.TRANSPARENT;
        return label;
    }

    private createButtonControl(position: Vec2, text: string): Button {
        const button = <Button>this.add.uiElement(UIElementType.BUTTON, LAYER, { position, text });
        button.backgroundColor = new Color(88, 72, 142);
        button.borderColor = new Color(38, 32, 70);
        button.borderRadius = 0;
        button.borderWidth = 2;
        button.textColor = Color.WHITE;
        button.setPadding(new Vec2(34, 10));
        button.font = "PixelSimple";
        button.fontSize = 26;
        return button;
    }
}
