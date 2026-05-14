import Vec2 from "../../Wolfie2D/DataTypes/Vec2";
import Input from "../../Wolfie2D/Input/Input";
import { GraphicType } from "../../Wolfie2D/Nodes/Graphics/GraphicTypes";
import Sprite from "../../Wolfie2D/Nodes/Sprites/Sprite";
import Label from "../../Wolfie2D/Nodes/UIElements/Label";
import { UIElementType } from "../../Wolfie2D/Nodes/UIElements/UIElementTypes";
import RenderingManager from "../../Wolfie2D/Rendering/RenderingManager";
import Scene from "../../Wolfie2D/Scene/Scene";
import SceneManager from "../../Wolfie2D/Scene/SceneManager";
import Viewport from "../../Wolfie2D/SceneGraph/Viewport";
import Color from "../../Wolfie2D/Utils/Color";
import MainMenu from "./MainMenu";

const WinLayers = {
    MAIN: "MAIN",
    UI: "UI"
} as const;

export default class WinScene extends Scene {
    private static readonly TROPHY_KEY = "WIN_TROPHY";
    private static readonly TROPHY_PATH = "game_assets/spritesheets/trophy-transparent-256.png";
    private static readonly WIZARD_1_KEY = "WIN_WIZARD_1";
    private static readonly WIZARD_1_PATH = "game_assets/spritesheets/wizard-win-1-transparent-256.png";
    private static readonly WIZARD_2_KEY = "WIN_WIZARD_2";
    private static readonly WIZARD_2_PATH = "game_assets/spritesheets/wizard-win-2-transparent-256.png";
    private static readonly CONTINUE_LOCK_FRAMES = 12;
    private winner: 1 | 2 = 1;
    private continueLockFrames = WinScene.CONTINUE_LOCK_FRAMES;

    public constructor(viewport: Viewport, sceneManager: SceneManager, renderingManager: RenderingManager, options: Record<string, any>) {
        super(viewport, sceneManager, renderingManager, options);
    }

    public initScene(init: Record<string, any>): void {
        this.winner = init?.winner === 2 ? 2 : 1;
        this.continueLockFrames = WinScene.CONTINUE_LOCK_FRAMES;
    }

    public loadScene(): void {
        this.load.image(WinScene.TROPHY_KEY, WinScene.TROPHY_PATH);
        this.load.image(WinScene.WIZARD_1_KEY, WinScene.WIZARD_1_PATH);
        this.load.image(WinScene.WIZARD_2_KEY, WinScene.WIZARD_2_PATH);
    }

    public startScene(): void {
        Input.enableInput();
        this.addLayer(WinLayers.MAIN);
        this.addUILayer(WinLayers.UI);

        const size = this.viewport.getHalfSize();
        this.viewport.setFocus(size);
        this.viewport.setZoomLevel(1);

        const background = this.add.graphic(GraphicType.RECT, WinLayers.MAIN, {
            position: size.clone(),
            size: size.scaled(2)
        });
        background.color = new Color(216, 224, 238);

        const title = <Label>this.add.uiElement(UIElementType.LABEL, WinLayers.UI, {
            position: new Vec2(size.x, size.y - 190),
            text: `Player ${this.winner} Wins!`
        });
        title.font = "PixelSimple";
        title.fontSize = 56;
        title.textColor = Color.BLACK;
        title.backgroundColor = Color.TRANSPARENT;
        title.borderColor = Color.TRANSPARENT;

        const trophy = <Sprite>this.add.sprite(WinScene.TROPHY_KEY, WinLayers.UI);
        trophy.position.copy(new Vec2(size.x + 125, size.y - 10));
        trophy.scale.set(1.5, 1.5);

        const wizard = <Sprite>this.add.sprite(this.winner === 2 ? WinScene.WIZARD_2_KEY : WinScene.WIZARD_1_KEY, WinLayers.UI);
        wizard.position.copy(new Vec2(size.x - 135, size.y + 18));
        wizard.scale.set(1.5, 1.5);

        const prompt = <Label>this.add.uiElement(UIElementType.LABEL, WinLayers.UI, {
            position: new Vec2(size.x, size.y + 210),
            text: "Click any button to continue"
        });
        prompt.font = "PixelSimple";
        prompt.fontSize = 30;
        prompt.textColor = Color.BLACK;
        prompt.backgroundColor = Color.TRANSPARENT;
        prompt.borderColor = Color.TRANSPARENT;
    }

    public updateScene(): void {
        if (this.continueLockFrames > 0) {
            this.continueLockFrames -= 1;
            return;
        }

        if (Input.getKeysJustPressed().length > 0 || Input.isMouseJustPressed()) {
            this.sceneManager.changeToScene(MainMenu);
        }
    }
}
