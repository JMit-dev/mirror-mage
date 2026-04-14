import Vec2 from "../../Wolfie2D/DataTypes/Vec2";
import Input from "../../Wolfie2D/Input/Input";
import Button from "../../Wolfie2D/Nodes/UIElements/Button";
import Label from "../../Wolfie2D/Nodes/UIElements/Label";
import { UIElementType } from "../../Wolfie2D/Nodes/UIElements/UIElementTypes";
import Scene from "../../Wolfie2D/Scene/Scene";
import Color from "../../Wolfie2D/Utils/Color";
import FirebaseManager from "../Firebase/FirebaseManager";
import Level1 from "./MBLevel1";
import Level2 from "./MBLevel2";


// Layers for the main menu scene
export const MenuLayers = {
    MAIN: "MAIN"
} as const;

export default class MainMenu extends Scene {
    private levelLaunchRequested: boolean = false;

    public startScene(): void {
        Input.enableInput();
        this.addUILayer(MenuLayers.MAIN);

        // Center the viewport
        let size = this.viewport.getHalfSize();
        this.viewport.setFocus(size);
        this.viewport.setZoomLevel(1);

        const title = <Label>this.add.uiElement(UIElementType.LABEL, MenuLayers.MAIN, {position: new Vec2(size.x, size.y - 180), text: "Mirror Mage"});
        title.font = "PixelSimple";
        title.fontSize = 72;
        title.textColor = Color.WHITE;
        title.backgroundColor = Color.TRANSPARENT;
        title.borderColor = Color.TRANSPARENT;

        const subtitle = <Label>this.add.uiElement(UIElementType.LABEL, MenuLayers.MAIN, {position: new Vec2(size.x, size.y - 110), text: "Choose a level to start"});
        subtitle.font = "PixelSimple";
        subtitle.fontSize = 28;
        subtitle.textColor = Color.WHITE;
        subtitle.backgroundColor = Color.TRANSPARENT;
        subtitle.borderColor = Color.TRANSPARENT;

        const level1Button = this.createLevelButton(new Vec2(size.x, size.y), "Level 1");
        level1Button.onClick = () => {
            if (FirebaseManager.state.mySlot === 1 && !this.levelLaunchRequested) {
                this.levelLaunchRequested = true;
                FirebaseManager.selectLevel("level1").catch(() => {
                    this.levelLaunchRequested = false;
                });
            }
        };

        const level2Button = this.createLevelButton(new Vec2(size.x, size.y + 90), "Level 2");
        level2Button.onClick = () => {
            if (FirebaseManager.state.mySlot === 1 && !this.levelLaunchRequested) {
                this.levelLaunchRequested = true;
                FirebaseManager.selectLevel("level2").catch(() => {
                    this.levelLaunchRequested = false;
                });
            }
        };
    }

    public updateScene(): void {
        switch (FirebaseManager.state.selectedLevel) {
            case "level1":
                this.sceneManager.changeToScene(Level1);
                break;
            case "level2":
                this.sceneManager.changeToScene(Level2);
                break;
        }
    }

    protected createLevelButton(position: Vec2, text: string): Button {
        const button = <Button>this.add.uiElement(UIElementType.BUTTON, MenuLayers.MAIN, {position, text});
        button.backgroundColor = new Color(34, 32, 52);
        button.borderColor = Color.WHITE;
        button.borderRadius = 0;
        button.borderWidth = 2;
        button.textColor = Color.WHITE;
        button.setPadding(new Vec2(60, 14));
        button.font = "PixelSimple";
        button.fontSize = 32;
        return button;
    }
}
