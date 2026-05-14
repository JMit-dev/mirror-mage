import Vec2 from "../../Wolfie2D/DataTypes/Vec2";
import Input from "../../Wolfie2D/Input/Input";
import { GraphicType } from "../../Wolfie2D/Nodes/Graphics/GraphicTypes";
import Label from "../../Wolfie2D/Nodes/UIElements/Label";
import { UIElementType } from "../../Wolfie2D/Nodes/UIElements/UIElementTypes";
import RenderingManager from "../../Wolfie2D/Rendering/RenderingManager";
import Scene from "../../Wolfie2D/Scene/Scene";
import SceneManager from "../../Wolfie2D/Scene/SceneManager";
import Viewport from "../../Wolfie2D/SceneGraph/Viewport";
import Color from "../../Wolfie2D/Utils/Color";
import MainMenu from "./MainMenu";

const HowToLayers = {
    MAIN: "MAIN",
    UI: "UI"
} as const;

export default class HowToScene extends Scene {
    public constructor(viewport: Viewport, sceneManager: SceneManager, renderingManager: RenderingManager, options: Record<string, any>) {
        super(viewport, sceneManager, renderingManager, options);
    }

    public startScene(): void {
        Input.enableInput();
        this.addLayer(HowToLayers.MAIN);
        this.addUILayer(HowToLayers.UI);

        const size = this.viewport.getHalfSize();
        this.viewport.setFocus(size);
        this.viewport.setZoomLevel(1);

        const background = this.add.graphic(GraphicType.RECT, HowToLayers.MAIN, {
            position: size.clone(),
            size: size.scaled(2)
        });
        background.color = new Color(216, 224, 238);

        const title = <Label>this.add.uiElement(UIElementType.LABEL, HowToLayers.UI, {
            position: new Vec2(size.x, 90),
            text: "How to"
        });
        title.font = "PixelSimple";
        title.fontSize = 56;
        title.textColor = Color.BLACK;
        title.backgroundColor = Color.TRANSPARENT;
        title.borderColor = Color.TRANSPARENT;

        const body = <Label>this.add.uiElement(UIElementType.LABEL, HowToLayers.UI, {
            position: new Vec2(size.x, 180),
            text: "Edit this page later."
        });
        body.font = "PixelSimple";
        body.fontSize = 28;
        body.textColor = Color.BLACK;
        body.backgroundColor = Color.TRANSPARENT;
        body.borderColor = Color.TRANSPARENT;
    }

    public updateScene(): void {
        if (Input.getKeysJustPressed().length > 0 || Input.isMouseJustPressed()) {
            this.sceneManager.changeToScene(MainMenu);
        }
    }
}
