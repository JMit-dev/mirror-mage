import Vec2 from "../../Wolfie2D/DataTypes/Vec2";
import Input from "../../Wolfie2D/Input/Input";
import Sprite from "../../Wolfie2D/Nodes/Sprites/Sprite";
import Button from "../../Wolfie2D/Nodes/UIElements/Button";
import Label from "../../Wolfie2D/Nodes/UIElements/Label";
import { UIElementType } from "../../Wolfie2D/Nodes/UIElements/UIElementTypes";
import Scene from "../../Wolfie2D/Scene/Scene";
import Color from "../../Wolfie2D/Utils/Color";
import FirebaseManager from "../Firebase/FirebaseManager";
import Level1 from "./MBLevel1";
import Level2 from "./MBLevel2";
import LobbyScene from "./LobbyScene";
import { RuntimeModeValue, isLocalCoopTestingMode, setRuntimeMode } from "../config/RuntimeMode";


// Layers for the main menu scene
export const MenuLayers = {
    MAIN: "MAIN"
} as const;

type MenuStep = "mode" | "level";

export default class MainMenu extends Scene {
    private static readonly TITLE_LOGO_KEY = "TITLE_LOGO";
    private static readonly TITLE_LOGO_PATH = "game_assets/spritesheets/Logo For Title Screen.png";
    private static readonly TITLE_LOGO_SCALE = 0.82;

    private levelLaunchRequested: boolean = false;
    private subtitle!: Label;
    private onlineButton!: Button;
    private localButton!: Button;
    private level1Button!: Button;
    private level2Button!: Button;
    private backButton!: Button;
    private currentStep: MenuStep = "mode";
    private pendingMode: typeof RuntimeModeValue[keyof typeof RuntimeModeValue] = RuntimeModeValue.DEFAULT;

    public loadScene(): void {
        this.load.image(MainMenu.TITLE_LOGO_KEY, MainMenu.TITLE_LOGO_PATH);
    }

    public startScene(): void {
        Input.enableInput();
        this.addUILayer(MenuLayers.MAIN);
        setRuntimeMode(RuntimeModeValue.DEFAULT);

        // Center the viewport
        let size = this.viewport.getHalfSize();
        this.viewport.setFocus(size);
        this.viewport.setZoomLevel(1);

        const titleLogo = <Sprite>this.add.sprite(MainMenu.TITLE_LOGO_KEY, MenuLayers.MAIN);
        titleLogo.position.copy(new Vec2(size.x, size.y - 120));
        titleLogo.scale.set(MainMenu.TITLE_LOGO_SCALE, MainMenu.TITLE_LOGO_SCALE);

        this.subtitle = <Label>this.add.uiElement(UIElementType.LABEL, MenuLayers.MAIN, {position: new Vec2(size.x, size.y + 20), text: ""});
        this.subtitle.font = "PixelSimple";
        this.subtitle.fontSize = 28;
        this.subtitle.textColor = Color.BLACK;
        this.subtitle.backgroundColor = Color.TRANSPARENT;
        this.subtitle.borderColor = Color.TRANSPARENT;

        if (this.hasRoomCodeInHash()) {
            this.sceneManager.changeToScene(LobbyScene);
            return;
        }

        this.createModeControls(size);
        this.createLevelControls(size);
        this.showModeMenu();
    }

    public updateScene(): void {
        if (isLocalCoopTestingMode()) {
            return;
        }

        switch (FirebaseManager.state.selectedLevel) {
            case "level1":
                this.sceneManager.changeToScene(Level1);
                break;
            case "level2":
                this.sceneManager.changeToScene(Level2);
                break;
        }
    }

    protected createModeControls(size: Vec2): void {
        this.onlineButton = this.createModeButton(new Vec2(size.x, size.y + 100), "Online");
        this.localButton = this.createModeButton(new Vec2(size.x, size.y + 190), "Local");
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
        this.level1Button = this.createLevelButton(new Vec2(size.x - 130, size.y + 130), "Level 1");
        this.level1Button.onClick = () => this.handleLevelSelection("level1");

        this.level2Button = this.createLevelButton(new Vec2(size.x + 130, size.y + 130), "Level 2");
        this.level2Button.onClick = () => this.handleLevelSelection("level2");

        this.backButton = this.createModeButton(new Vec2(size.x, size.y + 220), "Back");
        this.backButton.onClick = () => this.showModeMenu();
    }

    protected createModeButton(position: Vec2, text: string): Button {
        const button = <Button>this.add.uiElement(UIElementType.BUTTON, MenuLayers.MAIN, {position, text});
        button.backgroundColor = new Color(88, 72, 142);
        button.borderColor = new Color(38, 32, 70);
        button.borderRadius = 0;
        button.borderWidth = 2;
        button.textColor = Color.WHITE;
        button.setPadding(new Vec2(60, 14));
        button.font = "PixelSimple";
        button.fontSize = 32;
        return button;
    }

    protected showModeMenu(): void {
        this.currentStep = "mode";
        this.pendingMode = RuntimeModeValue.DEFAULT;
        this.subtitle.text = "Choose a mode";
        this.onlineButton.visible = true;
        this.localButton.visible = true;
        this.level1Button.visible = false;
        this.level2Button.visible = false;
        this.backButton.visible = false;
    }

    protected showLevelMenu(): void {
        this.currentStep = "level";
        const localMode = this.pendingMode === RuntimeModeValue.LOCAL_COOP_TESTING;
        this.subtitle.text = localMode
            ? "Choose a local level"
            : "Choose an online level";
        this.onlineButton.visible = false;
        this.localButton.visible = false;
        this.level1Button.visible = true;
        this.level2Button.visible = true;
        this.backButton.visible = true;
    }

    protected handleLevelSelection(level: "level1" | "level2"): void {
        const localMode = this.pendingMode === RuntimeModeValue.LOCAL_COOP_TESTING;
        setRuntimeMode(localMode ? RuntimeModeValue.LOCAL_COOP_TESTING : RuntimeModeValue.DEFAULT);

        if (localMode) {
            if (level === "level1") this.sceneManager.changeToScene(Level1);
            else this.sceneManager.changeToScene(Level2);
            return;
        }

        if (FirebaseManager.state.mySlot === 0) {
            this.sceneManager.changeToScene(LobbyScene, {
                selectedLevel: level
            });
            return;
        }

        if (FirebaseManager.state.mySlot === 1 && !this.levelLaunchRequested) {
            this.levelLaunchRequested = true;
            FirebaseManager.selectLevel(level).catch(() => {
                this.levelLaunchRequested = false;
            });
        }
    }

    protected hasRoomCodeInHash(): boolean {
        return /room=[A-Z0-9]{6}/.test(window.location.hash);
    }

    protected createLevelButton(position: Vec2, text: string): Button {
        const button = <Button>this.add.uiElement(UIElementType.BUTTON, MenuLayers.MAIN, {position, text});
        button.backgroundColor = new Color(88, 72, 142);
        button.borderColor = new Color(38, 32, 70);
        button.borderRadius = 0;
        button.borderWidth = 2;
        button.textColor = Color.WHITE;
        button.setPadding(new Vec2(60, 14));
        button.font = "PixelSimple";
        button.fontSize = 32;
        return button;
    }
}
