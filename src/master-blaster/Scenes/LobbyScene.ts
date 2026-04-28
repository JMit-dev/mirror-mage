import Vec2 from "../../Wolfie2D/DataTypes/Vec2";
import Input from "../../Wolfie2D/Input/Input";
import Label from "../../Wolfie2D/Nodes/UIElements/Label";
import { UIElementType } from "../../Wolfie2D/Nodes/UIElements/UIElementTypes";
import Scene from "../../Wolfie2D/Scene/Scene";
import Color from "../../Wolfie2D/Utils/Color";
import FirebaseManager from "../Firebase/FirebaseManager";
import { MBControls } from "../MBControls";
import MainMenu from "./MainMenu";

const LAYER = "LOBBY";

export default class LobbyScene extends Scene {
    private roomCodeLabel!: Label;
    private urlLabel!: Label;
    private playerCountLabel!: Label;
    private slot1Label!: Label;
    private slot2Label!: Label;
    private statusLabel!: Label;
    private startRequested: boolean = false;
    private selectedLevel: "level1" | "level2" | "" = "";
    private forceHostRoom: boolean = false;

    public initScene(init: Record<string, any>): void {
        this.selectedLevel = init?.selectedLevel === "level1" || init?.selectedLevel === "level2"
            ? init.selectedLevel
            : "";
        this.forceHostRoom = init?.forceHostRoom === true;
    }

    public startScene(): void {
        if (this.forceHostRoom) {
            FirebaseManager.initializeAsHost();
        } else {
            FirebaseManager.initializeFromHash();
        }

        Input.enableInput();
        this.addUILayer(LAYER);

        const half = this.viewport.getHalfSize();
        this.viewport.setFocus(half);
        this.viewport.setZoomLevel(1);

        // Title
        const title = <Label>this.add.uiElement(UIElementType.LABEL, LAYER, {
            position: new Vec2(half.x, half.y - 290),
            text: "MIRROR MAGE",
        });
        title.textColor = Color.WHITE;
        title.fontSize = 64;
        title.font = "PixelSimple";

        // Room code header
        const codeHeader = <Label>this.add.uiElement(UIElementType.LABEL, LAYER, {
            position: new Vec2(half.x, half.y - 170),
            text: "ROOM CODE",
        });
        codeHeader.textColor = new Color(160, 160, 210);
        codeHeader.fontSize = 22;

        // Room code — large and gold
        this.roomCodeLabel = <Label>this.add.uiElement(UIElementType.LABEL, LAYER, {
            position: new Vec2(half.x, half.y - 100),
            text: "------",
        });
        this.roomCodeLabel.textColor = new Color(255, 215, 0);
        this.roomCodeLabel.fontSize = 88;
        this.roomCodeLabel.font = "PixelSimple";

        // Share URL
        const urlHeader = <Label>this.add.uiElement(UIElementType.LABEL, LAYER, {
            position: new Vec2(half.x, half.y + 10),
            text: "Share this link:",
        });
        urlHeader.textColor = new Color(160, 160, 160);
        urlHeader.fontSize = 18;

        this.urlLabel = <Label>this.add.uiElement(UIElementType.LABEL, LAYER, {
            position: new Vec2(half.x, half.y + 45),
            text: "Loading...",
        });
        this.urlLabel.textColor = new Color(120, 200, 255);
        this.urlLabel.fontSize = 18;

        // Player count
        this.playerCountLabel = <Label>this.add.uiElement(UIElementType.LABEL, LAYER, {
            position: new Vec2(half.x, half.y + 120),
            text: "0 / 2  players",
        });
        this.playerCountLabel.textColor = Color.WHITE;
        this.playerCountLabel.fontSize = 32;

        // Slot indicators
        this.slot1Label = <Label>this.add.uiElement(UIElementType.LABEL, LAYER, {
            position: new Vec2(half.x - 160, half.y + 195),
            text: "P1  [      ]",
        });
        this.slot1Label.textColor = new Color(80, 80, 80);
        this.slot1Label.fontSize = 26;

        this.slot2Label = <Label>this.add.uiElement(UIElementType.LABEL, LAYER, {
            position: new Vec2(half.x + 160, half.y + 195),
            text: "P2  [      ]",
        });
        this.slot2Label.textColor = new Color(80, 80, 80);
        this.slot2Label.fontSize = 26;

        // Status / start prompt
        this.statusLabel = <Label>this.add.uiElement(UIElementType.LABEL, LAYER, {
            position: new Vec2(half.x, half.y + 265),
            text: "Waiting for players...",
        });
        this.statusLabel.textColor = new Color(140, 140, 140);
        this.statusLabel.fontSize = 26;
    }

    public updateScene(_deltaT: number): void {
        const s = FirebaseManager.state;

        // Room code
        if (s.roomCode) {
            this.roomCodeLabel.text = s.roomCode;
        }

        // Join URL
        if (s.joinUrl) {
            this.urlLabel.text = s.joinUrl;
        }

        // Player count
        this.playerCountLabel.text = s.playerCount + " / 2  players";

        // Slot 1
        if (s.playerCount >= 1) {
            this.slot1Label.text = "P1  [ READY ]";
            this.slot1Label.textColor = new Color(80, 220, 80);
        } else {
            this.slot1Label.text = "P1  [      ]";
            this.slot1Label.textColor = new Color(80, 80, 80);
        }

        // Slot 2
        if (s.playerCount >= 2) {
            this.slot2Label.text = "P2  [ READY ]";
            this.slot2Label.textColor = new Color(80, 220, 80);
        } else {
            this.slot2Label.text = "P2  [      ]";
            this.slot2Label.textColor = new Color(80, 80, 80);
        }

        // Room full message
        if (s.status === "unavailable") {
            this.statusLabel.text = "Room is full — try a new link.";
            this.statusLabel.textColor = new Color(220, 80, 80);
            return;
        }

        if (s.status === "error") {
            this.statusLabel.text = s.errorMsg || "Could not connect to Firebase.";
            this.statusLabel.textColor = new Color(220, 80, 80);
            return;
        }

        // Ready — let host start
        if (s.playerCount >= 2) {
            if (s.mySlot === 1) {
                this.statusLabel.text = "Press SPACE to start!";
                this.statusLabel.textColor = new Color(80, 220, 80);
                if (!this.startRequested && Input.isJustPressed(MBControls.JUMP)) {
                    this.startRequested = true;
                    this.startSelectedGame().catch(() => {
                        this.startRequested = false;
                    });
                }
            } else {
                this.statusLabel.text = "Waiting for host to start...";
                this.statusLabel.textColor = new Color(80, 220, 80);
            }
        } else {
            this.statusLabel.text = "Waiting for players...";
            this.statusLabel.textColor = new Color(140, 140, 140);
        }

        if (s.started) {
            this.sceneManager.changeToScene(MainMenu);
        }
    }

    private async startSelectedGame(): Promise<void> {
        if (this.selectedLevel) {
            await FirebaseManager.selectLevel(this.selectedLevel);
        }
        await FirebaseManager.startGame();
    }
}
