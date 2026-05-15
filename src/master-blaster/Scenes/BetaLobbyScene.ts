import Vec2 from "../../Wolfie2D/DataTypes/Vec2";
import Input from "../../Wolfie2D/Input/Input";
import Button from "../../Wolfie2D/Nodes/UIElements/Button";
import Label from "../../Wolfie2D/Nodes/UIElements/Label";
import { UIElementType } from "../../Wolfie2D/Nodes/UIElements/UIElementTypes";
import Scene from "../../Wolfie2D/Scene/Scene";
import Color from "../../Wolfie2D/Utils/Color";
import P2PManager from "../Network/P2PManager";
import MainMenu from "./MainMenu";

const DB_BASE = "https://mirror-mage-default-rtdb.firebaseio.com";
const LAYER = "BETA_LOBBY";

type ListedRoom = {
    code: string;
    playerCount: number;
    createdAt: number;
};

export default class BetaLobbyScene extends Scene {
    private static readonly ROOM_LIMIT = 3;
    private static readonly MAX_PLAYERS = 4;
    private static readonly ROOM_TTL_MS = 30 * 60 * 1000;
    private static readonly REFRESH_INTERVAL = 2;

    private title!: Label;
    private statusLabel!: Label;
    private roomButtons: Array<Button> = [];
    private createButton!: Button;
    private refreshButton!: Button;
    private backButton!: Button;
    private waitingRoomLabel!: Label;
    private waitingRoomCodeLabel!: Label;
    private waitingRoomPlayersLabel!: Label;
    private startButton!: Button;
    private rooms: Array<ListedRoom> = [];
    private refreshTimer = 0;
    private hosting = false;
    private joining = false;
    private activeRoomCode = "";
    private activeSlot: 0 | 1 | 2 | 3 | 4 = 0;

    public startScene(): void {
        Input.enableInput();
        this.addUILayer(LAYER);
        P2PManager.disconnect();

        const half = this.viewport.getHalfSize();
        this.viewport.setFocus(half);
        this.viewport.setZoomLevel(1);

        this.title = this.createLabel(new Vec2(half.x, half.y - 260), "Lobby (beta)", 52, Color.BLACK);
        this.statusLabel = this.createLabel(new Vec2(half.x, half.y - 190), "Loading rooms...", 24, new Color(40, 40, 40));

        this.createButton = this.createButtonControl(new Vec2(half.x - 180, half.y - 120), "Make Room");
        this.createButton.onClick = () => this.createRoom();

        this.refreshButton = this.createButtonControl(new Vec2(half.x + 180, half.y - 120), "Refresh");
        this.refreshButton.onClick = () => this.refreshRooms();

        for (let i = 0; i < BetaLobbyScene.ROOM_LIMIT; i++) {
            const button = this.createButtonControl(new Vec2(half.x, half.y - 35 + i * 62), "Empty");
            const index = i;
            button.onClick = () => this.joinRoom(index);
            this.roomButtons.push(button);
        }

        this.waitingRoomLabel = this.createLabel(new Vec2(half.x, half.y - 75), "Waiting Room", 38, Color.BLACK);
        this.waitingRoomCodeLabel = this.createLabel(new Vec2(half.x, half.y), "Room ------", 34, new Color(88, 72, 142));
        this.waitingRoomPlayersLabel = this.createLabel(new Vec2(half.x, half.y + 70), "Players 1/4", 28, new Color(40, 40, 40));
        this.startButton = this.createButtonControl(new Vec2(half.x, half.y + 155), "Start");
        this.startButton.onClick = () => this.startHostedGame();

        this.backButton = this.createButtonControl(new Vec2(half.x, half.y + 305), "Back");
        this.backButton.onClick = () => {
            this.leaveBetaLobby();
        };

        this.showRoomList();

        P2PManager.onPeerConnected(() => {
            if (this.hosting) {
                this.updateRoomMeta(P2PManager.roomCode, { playerCount: P2PManager.playerCount });
                this.statusLabel.text = "Player joined. Press Start.";
                this.waitingRoomPlayersLabel.text = "Players " + P2PManager.playerCount + "/" + BetaLobbyScene.MAX_PLAYERS;
                this.startButton.visible = true;
            }
        });

        P2PManager.onOpen(() => {
            if (this.joining) {
                this.statusLabel.text = "Joined room. Waiting for host...";
            }
        });

        P2PManager.onStart(() => {
            this.updateRoomMeta(P2PManager.roomCode, { started: true, playerCount: P2PManager.playerCount });
            this.sceneManager.changeToScene(MainMenu);
        });

        this.refreshRooms();
    }

    public updateScene(deltaT: number): void {
        this.refreshTimer -= deltaT;
        if (this.refreshTimer <= 0 && !this.hosting && !this.joining) {
            this.refreshRooms();
        }

        if (this.hosting && P2PManager.playerCount >= 2) {
            this.statusLabel.text = "Player joined. Press Start.";
            this.waitingRoomPlayersLabel.text = "Players " + P2PManager.playerCount + "/" + BetaLobbyScene.MAX_PLAYERS;
            this.startButton.visible = true;
            if (Input.isKeyJustPressed("space")) {
                this.startHostedGame();
            }
        }
    }

    private createRoom(): void {
        if (this.hosting || this.joining) return;

        this.hosting = true;
        this.statusLabel.text = "Creating room...";
        const code = this.generateCode();
        this.activeRoomCode = code;
        this.activeSlot = 1;
        this.createRoomRecord(code).then(() => {
            P2PManager.initRoom(code);
            P2PManager.host();
            this.showWaitingRoom("Room " + code + " created. Waiting for player...");
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
        if (this.hosting || this.joining) return;

        const room = this.rooms[index];
        if (room === undefined || room.playerCount >= BetaLobbyScene.MAX_PLAYERS) return;

        this.joining = true;
        this.activeRoomCode = room.code;
        this.activeSlot = 2;
        this.statusLabel.text = "Joining room " + room.code + "...";
        P2PManager.initRoom(room.code);
        this.updateRoomMeta(room.code, { playerCount: Math.min(BetaLobbyScene.MAX_PLAYERS, room.playerCount + 1) })
            .then(() => {
                this.showWaitingRoom("Joined room. Waiting for host...");
                P2PManager.join();
            })
            .catch(() => {
                this.statusLabel.text = "Could not join room.";
                this.joining = false;
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
                                createdAt: Number(meta.createdAt ?? 0)
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
                : "Join " + room.code + "   " + room.playerCount + "/" + BetaLobbyScene.MAX_PLAYERS;
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
        this.waitingRoomCodeLabel.text = "Room " + this.activeRoomCode;
        const displayedCount = Math.max(1, Math.min(BetaLobbyScene.MAX_PLAYERS, P2PManager.playerCount || (this.hosting ? 1 : 2)));
        this.waitingRoomPlayersLabel.text = "Players " + displayedCount + "/" + BetaLobbyScene.MAX_PLAYERS;
        this.startButton.visible = this.hosting && P2PManager.playerCount >= 2;
    }

    private startHostedGame(): void {
        if (!this.hosting || P2PManager.playerCount < 2) return;

        this.statusLabel.text = "Starting...";
        this.updateRoomMeta(P2PManager.roomCode, { started: true, playerCount: P2PManager.playerCount });
        P2PManager.requestStart();
    }

    private createRoomRecord(code: string): Promise<void> {
        return fetch(DB_BASE + "/rooms/" + code + ".json", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                meta: {
                    beta: true,
                    createdAt: Date.now(),
                    playerCount: 1,
                    started: false
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
        } else if (code && slot === 2) {
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
