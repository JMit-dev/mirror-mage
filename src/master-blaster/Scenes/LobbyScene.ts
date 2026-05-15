import Vec2 from "../../Wolfie2D/DataTypes/Vec2";
import Input from "../../Wolfie2D/Input/Input";
import Button from "../../Wolfie2D/Nodes/UIElements/Button";
import Label from "../../Wolfie2D/Nodes/UIElements/Label";
import { UIElementType } from "../../Wolfie2D/Nodes/UIElements/UIElementTypes";
import Scene from "../../Wolfie2D/Scene/Scene";
import Color from "../../Wolfie2D/Utils/Color";
import P2PManager from "../Network/P2PManager";
import MainMenu from "./MainMenu";

const LAYER = "LOBBY";

export default class LobbyScene extends Scene {
    private roomCodeLabel!: Label;
    private urlLabel!: Label;
    private playerCountLabel!: Label;
    private slot1Label!: Label;
    private slot2Label!: Label;
    private slot3Label!: Label;
    private slot4Label!: Label;
    private startButton!: Button;
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
        this.playerCountLabel.text = "Joined: " + count + " / 4";

        this._updateSlotLabel(this.slot1Label, 1, count >= 1);
        this._updateSlotLabel(this.slot2Label, 2, count >= 2);
        this._updateSlotLabel(this.slot3Label, 3, count >= 3);
        this._updateSlotLabel(this.slot4Label, 4, count >= 4);

        this.startButton.visible = slot === 1 && count >= 2;
        this.startButton.text = count >= 4 ? "Start Match" : "Start When Ready";

        // Status / start prompt
        if (count >= 2) {
            if (slot === 1) {
                this.statusLabel.text      = count >= 4 ? "Press SPACE to start with 4 players!" : "Press SPACE to start with the joined players!";
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
            text: "Joined: 0 / 4",
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

        this.slot3Label = <Label>this.add.uiElement(UIElementType.LABEL, LAYER, {
            position: new Vec2(half.x - 160, half.y + 245),
            text: "P3  [      ]",
        });
        this.slot3Label.textColor = new Color(80, 80, 80);
        this.slot3Label.fontSize  = 26;

        this.slot4Label = <Label>this.add.uiElement(UIElementType.LABEL, LAYER, {
            position: new Vec2(half.x + 160, half.y + 245),
            text: "P4  [      ]",
        });
        this.slot4Label.textColor = new Color(80, 80, 80);
        this.slot4Label.fontSize  = 26;

        this.startButton = <Button>this.add.uiElement(UIElementType.BUTTON, LAYER, {
            position: new Vec2(half.x, half.y + 200),
            text: "Start Match",
        });
        this.startButton.backgroundColor = new Color(88, 72, 142);
        this.startButton.borderColor     = new Color(38, 32, 70);
        this.startButton.borderRadius    = 0;
        this.startButton.borderWidth     = 2;
        this.startButton.textColor       = Color.WHITE;
        this.startButton.setPadding(new Vec2(70, 14));
        this.startButton.font            = "PixelSimple";
        this.startButton.fontSize        = 28;
        this.startButton.onClick = () => {
            if (P2PManager.mySlot === 1 && P2PManager.playerCount >= 2) {
                P2PManager.requestStart();
            }
        };
        this.startButton.visible = false;

        this.statusLabel = <Label>this.add.uiElement(UIElementType.LABEL, LAYER, {
            position: new Vec2(half.x, half.y + 265),
            text: "Waiting for players...",
        });
        this.statusLabel.textColor = new Color(140, 140, 140);
        this.statusLabel.fontSize  = 26;
    }

    private _updateSlotLabel(label: Label, slotNum: number, ready: boolean): void {
        label.text = "P" + slotNum + (ready ? "  [ READY ]" : "  [      ]");
        label.textColor = ready ? new Color(80, 220, 80) : new Color(80, 80, 80);
    }
}
