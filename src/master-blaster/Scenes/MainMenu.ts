import Vec2 from "../../Wolfie2D/DataTypes/Vec2";
import Input from "../../Wolfie2D/Input/Input";
import Sprite from "../../Wolfie2D/Nodes/Sprites/Sprite";
import Button from "../../Wolfie2D/Nodes/UIElements/Button";
import Label from "../../Wolfie2D/Nodes/UIElements/Label";
import { UIElementType } from "../../Wolfie2D/Nodes/UIElements/UIElementTypes";
import Scene from "../../Wolfie2D/Scene/Scene";
import Color from "../../Wolfie2D/Utils/Color";
import Level1 from "./MBLevel1";
import Level2 from "./MBLevel2";
import { RuntimeModeValue, setRuntimeMode } from "../config/RuntimeMode";
import P2PManager from "../Network/P2PManager";
import LobbyScene from "./LobbyScene";

export const MenuLayers = {
    MAIN: "MAIN"
} as const;


export default class MainMenu extends Scene {
    private static readonly TITLE_LOGO_KEY = "TITLE_LOGO";
    private static readonly TITLE_LOGO_PATH = "game_assets/spritesheets/Logo For Title Screen.png";
    private static readonly TITLE_LOGO_SCALE = 0.82;

    private subtitle!: Label;
    private onlineButton!: Button;
    private localButton!: Button;
    private level1Button!: Button;
    private level2Button!: Button;
    private backButton!: Button;
    private pendingMode: typeof RuntimeModeValue[keyof typeof RuntimeModeValue] = RuntimeModeValue.DEFAULT;

    public loadScene(): void {
        this.load.image(MainMenu.TITLE_LOGO_KEY, MainMenu.TITLE_LOGO_PATH);
    }

    public startScene(): void {
        Input.enableInput();
        this.addUILayer(MenuLayers.MAIN);
        setRuntimeMode(RuntimeModeValue.DEFAULT);

        const size = this.viewport.getHalfSize();
        this.viewport.setFocus(size);
        this.viewport.setZoomLevel(1);

        const titleLogo = <Sprite>this.add.sprite(MainMenu.TITLE_LOGO_KEY, MenuLayers.MAIN);
        titleLogo.position.copy(new Vec2(size.x, size.y - 120));
        titleLogo.scale.set(MainMenu.TITLE_LOGO_SCALE, MainMenu.TITLE_LOGO_SCALE);

        this.subtitle = <Label>this.add.uiElement(UIElementType.LABEL, MenuLayers.MAIN, {
            position: new Vec2(size.x, size.y + 20),
            text: ""
        });
        this.subtitle.font = "PixelSimple";
        this.subtitle.fontSize = 28;
        this.subtitle.textColor = Color.BLACK;
        this.subtitle.backgroundColor = Color.TRANSPARENT;
        this.subtitle.borderColor = Color.TRANSPARENT;

        this.createModeControls(size);
        this.createLevelControls(size);

        // If already in an online session (came from LobbyScene → SPACE)
        if (P2PManager.mySlot !== 0) {
            if (P2PManager.mySlot === 2) {
                // P2: skip the mode step, wait for P1's level choice
                this.showWaitingForHost();
                P2PManager.onLevelSelected((level) => {
                    setRuntimeMode(RuntimeModeValue.DEFAULT);
                    this.sceneManager.changeToScene(level === "level1" ? Level1 : Level2 as any);
                });
            } else {
                // P1: skip mode selection, go straight to level picker
                this.pendingMode = RuntimeModeValue.DEFAULT;
                this.showLevelMenu();
            }
        } else {
            this.showModeMenu();
        }
    }

    public updateScene(): void {
        // nothing — all transitions are event-driven now
    }

    protected createModeControls(size: Vec2): void {
        this.onlineButton = this.createButton(new Vec2(size.x, size.y + 100), "Online");
        this.localButton  = this.createButton(new Vec2(size.x, size.y + 190), "Local");

        this.localButton.onClick = () => {
            this.pendingMode = RuntimeModeValue.LOCAL_COOP_TESTING;
            this.showLevelMenu();
        };
        this.onlineButton.onClick = () => {
            this.pendingMode = RuntimeModeValue.DEFAULT;
            this.showLevelMenu();
        };
    }

    protected createLevelControls(size: Vec2): void {
        this.level1Button = this.createButton(new Vec2(size.x - 130, size.y + 130), "Level 1");
        this.level1Button.onClick = () => this.handleLevelSelection("level1");

        this.level2Button = this.createButton(new Vec2(size.x + 130, size.y + 130), "Level 2");
        this.level2Button.onClick = () => this.handleLevelSelection("level2");

        this.backButton = this.createButton(new Vec2(size.x, size.y + 220), "Back");
        this.backButton.onClick = () => this.showModeMenu();
    }

    protected showModeMenu(): void {
        this.pendingMode = RuntimeModeValue.DEFAULT;
        this.subtitle.text = "Choose a mode";
        this.onlineButton.visible  = true;
        this.localButton.visible   = true;
        this.level1Button.visible  = false;
        this.level2Button.visible  = false;
        this.backButton.visible    = false;
    }

    protected showLevelMenu(): void {
        const localMode = this.pendingMode === RuntimeModeValue.LOCAL_COOP_TESTING;
        this.subtitle.text = localMode ? "Choose a local level" : "Choose an online level";
        this.onlineButton.visible  = false;
        this.localButton.visible   = false;
        this.level1Button.visible  = true;
        this.level2Button.visible  = true;
        this.backButton.visible    = true;
    }

    protected showWaitingForHost(): void {
        this.subtitle.text = "Waiting for host to choose level...";
        this.onlineButton.visible  = false;
        this.localButton.visible   = false;
        this.level1Button.visible  = false;
        this.level2Button.visible  = false;
        this.backButton.visible    = false;
    }

    protected handleLevelSelection(level: "level1" | "level2"): void {
        const localMode = this.pendingMode === RuntimeModeValue.LOCAL_COOP_TESTING;
        setRuntimeMode(localMode ? RuntimeModeValue.LOCAL_COOP_TESTING : RuntimeModeValue.DEFAULT);

        if (localMode) {
            this.sceneManager.changeToScene(level === "level1" ? Level1 : Level2 as any);
            return;
        }

        // Online: no active session yet — go to lobby first
        if (P2PManager.mySlot === 0) {
            this.sceneManager.changeToScene(LobbyScene);
            return;
        }

        // P1 (host) broadcasts choice to P2 and transitions; P2 buttons are hidden
        if (P2PManager.mySlot === 1) {
            P2PManager.selectLevel(level);
            this.sceneManager.changeToScene(level === "level1" ? Level1 : Level2 as any);
        }
    }

    protected createButton(position: Vec2, text: string): Button {
        const button = <Button>this.add.uiElement(UIElementType.BUTTON, MenuLayers.MAIN, { position, text });
        button.backgroundColor = new Color(88, 72, 142);
        button.borderColor     = new Color(38, 32, 70);
        button.borderRadius    = 0;
        button.borderWidth     = 2;
        button.textColor       = Color.WHITE;
        button.setPadding(new Vec2(60, 14));
        button.font            = "PixelSimple";
        button.fontSize        = 32;
        return button;
    }
}
