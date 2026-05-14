import Vec2 from "../../Wolfie2D/DataTypes/Vec2";
import Input from "../../Wolfie2D/Input/Input";
import Label from "../../Wolfie2D/Nodes/UIElements/Label";
import { UIElementType } from "../../Wolfie2D/Nodes/UIElements/UIElementTypes";
import Scene from "../../Wolfie2D/Scene/Scene";
import Color from "../../Wolfie2D/Utils/Color";
import P2PManager from "../Network/P2PManager";
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

    public startScene(): void {
        Input.enableInput();
        this.addUILayer(LAYER);

        const half = this.viewport.getHalfSize();
        this.viewport.setFocus(half);
        this.viewport.setZoomLevel(1);

        // If a room code is already in the URL hash, we are P2 (guest).
        const isGuest = !!window.location.hash.match(/room=[A-Z0-9]{6}/);
        P2PManager.initRoom();

        if (isGuest) {
            P2PManager.join();
        } else {
            P2PManager.host();
        }

        // Both clients transition here when P1 presses SPACE
        P2PManager.onStart(() => {
            this.sceneManager.changeToScene(MainMenu);
        });

        this._buildUI(half);
    }

    public updateScene(_deltaT: number): void {
        const slot  = P2PManager.mySlot;
        const count = P2PManager.playerCount;
        const code  = P2PManager.roomCode;

        this.roomCodeLabel.text    = code || "------";
        this.urlLabel.text         = window.location.href;
        this.playerCountLabel.text = count + " / 2  players";

        // Slot 1 indicator
        if (count >= 1) {
            this.slot1Label.text      = "P1  [ READY ]";
            this.slot1Label.textColor = new Color(80, 220, 80);
        } else {
            this.slot1Label.text      = "P1  [      ]";
            this.slot1Label.textColor = new Color(80, 80, 80);
        }

        // Slot 2 indicator
        if (count >= 2) {
            this.slot2Label.text      = "P2  [ READY ]";
            this.slot2Label.textColor = new Color(80, 220, 80);
        } else {
            this.slot2Label.text      = "P2  [      ]";
            this.slot2Label.textColor = new Color(80, 80, 80);
        }

        // Status / start prompt
        if (count >= 2) {
            if (slot === 1) {
                this.statusLabel.text      = "Press SPACE to start!";
                this.statusLabel.textColor = new Color(80, 220, 80);
                if (Input.isKeyJustPressed("space")) {
                    P2PManager.requestStart();
                }
            } else {
                this.statusLabel.text      = "Waiting for host to start...";
                this.statusLabel.textColor = new Color(80, 220, 80);
            }
        } else {
            this.statusLabel.text      = "Waiting for players...";
            this.statusLabel.textColor = new Color(140, 140, 140);
        }
    }

    private _buildUI(half: Vec2): void {
        const title = <Label>this.add.uiElement(UIElementType.LABEL, LAYER, {
            position: new Vec2(half.x, half.y - 290),
            text: "MIRROR MAGE",
        });
        title.textColor = Color.WHITE;
        title.fontSize  = 64;
        title.font      = "PixelSimple";

        const codeHeader = <Label>this.add.uiElement(UIElementType.LABEL, LAYER, {
            position: new Vec2(half.x, half.y - 170),
            text: "ROOM CODE",
        });
        codeHeader.textColor = new Color(160, 160, 210);
        codeHeader.fontSize  = 22;

        this.roomCodeLabel = <Label>this.add.uiElement(UIElementType.LABEL, LAYER, {
            position: new Vec2(half.x, half.y - 100),
            text: "------",
        });
        this.roomCodeLabel.textColor = new Color(255, 215, 0);
        this.roomCodeLabel.fontSize  = 88;
        this.roomCodeLabel.font      = "PixelSimple";

        const urlHeader = <Label>this.add.uiElement(UIElementType.LABEL, LAYER, {
            position: new Vec2(half.x, half.y + 10),
            text: "Share this link:",
        });
        urlHeader.textColor = new Color(160, 160, 160);
        urlHeader.fontSize  = 18;

        this.urlLabel = <Label>this.add.uiElement(UIElementType.LABEL, LAYER, {
            position: new Vec2(half.x, half.y + 45),
            text: "Loading...",
        });
        this.urlLabel.textColor = new Color(120, 200, 255);
        this.urlLabel.fontSize  = 18;

        this.playerCountLabel = <Label>this.add.uiElement(UIElementType.LABEL, LAYER, {
            position: new Vec2(half.x, half.y + 120),
            text: "0 / 2  players",
        });
        this.playerCountLabel.textColor = Color.WHITE;
        this.playerCountLabel.fontSize  = 32;

        this.slot1Label = <Label>this.add.uiElement(UIElementType.LABEL, LAYER, {
            position: new Vec2(half.x - 160, half.y + 195),
            text: "P1  [      ]",
        });
        this.slot1Label.textColor = new Color(80, 80, 80);
        this.slot1Label.fontSize  = 26;

        this.slot2Label = <Label>this.add.uiElement(UIElementType.LABEL, LAYER, {
            position: new Vec2(half.x + 160, half.y + 195),
            text: "P2  [      ]",
        });
        this.slot2Label.textColor = new Color(80, 80, 80);
        this.slot2Label.fontSize  = 26;

        this.statusLabel = <Label>this.add.uiElement(UIElementType.LABEL, LAYER, {
            position: new Vec2(half.x, half.y + 265),
            text: "Waiting for players...",
        });
        this.statusLabel.textColor = new Color(140, 140, 140);
        this.statusLabel.fontSize  = 26;
    }
}
