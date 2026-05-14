import Vec2 from "../../Wolfie2D/DataTypes/Vec2";
import Input from "../../Wolfie2D/Input/Input";
import CanvasNode from "../../Wolfie2D/Nodes/CanvasNode";
import { GraphicType } from "../../Wolfie2D/Nodes/Graphics/GraphicTypes";
import Button from "../../Wolfie2D/Nodes/UIElements/Button";
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
    private static readonly MAGE_1_KEY = "HOW_TO_MAGE_1";
    private static readonly MAGE_1_PATH = "game_assets/spritesheets/mage1.json";
    private static readonly MAGE_2_KEY = "HOW_TO_MAGE_2";
    private static readonly MAGE_2_PATH = "game_assets/spritesheets/mage2.json";
    private static readonly FIRE_POWERUP_KEY = "HOW_TO_FIRE_POWERUP";
    private static readonly FIRE_POWERUP_PATH = "game_assets/spritesheets/fire_power_up_256x256.png";
    private static readonly ICE_POWERUP_KEY = "HOW_TO_ICE_POWERUP";
    private static readonly ICE_POWERUP_PATH = "game_assets/spritesheets/ice_power_up_256x256.png";
    private static readonly LIGHTNING_POWERUP_KEY = "HOW_TO_LIGHTNING_POWERUP";
    private static readonly LIGHTNING_POWERUP_PATH = "game_assets/spritesheets/lightning_power_up_256x256.png";
    private static readonly SPELL_COUNTER_KEY = "HOW_TO_SPELL_COUNTER";
    private static readonly SPELL_COUNTER_PATH = "game_assets/spritesheets/Spell Counter Transparent 256.png";
    private static readonly MIRROR_KEY = "HOW_TO_MIRROR";
    private static readonly MIRROR_PATH = "game_assets/spritesheets/Mirror Square 256x256.png";
    private static readonly TROPHY_KEY = "HOW_TO_TROPHY";
    private static readonly TROPHY_PATH = "game_assets/spritesheets/trophy-transparent-256.png";
    private static readonly SCROLL_STEP = 48;
    private static readonly MAX_SCROLL = 1900;

    private scrollOffset = 0;
    private scrollContent: Array<{ node: CanvasNode, y: number }> = [];

    public constructor(viewport: Viewport, sceneManager: SceneManager, renderingManager: RenderingManager, options: Record<string, any>) {
        super(viewport, sceneManager, renderingManager, options);
    }

    public loadScene(): void {
        this.load.spritesheet(HowToScene.MAGE_1_KEY, HowToScene.MAGE_1_PATH);
        this.load.spritesheet(HowToScene.MAGE_2_KEY, HowToScene.MAGE_2_PATH);
        this.load.image(HowToScene.FIRE_POWERUP_KEY, HowToScene.FIRE_POWERUP_PATH);
        this.load.image(HowToScene.ICE_POWERUP_KEY, HowToScene.ICE_POWERUP_PATH);
        this.load.image(HowToScene.LIGHTNING_POWERUP_KEY, HowToScene.LIGHTNING_POWERUP_PATH);
        this.load.image(HowToScene.SPELL_COUNTER_KEY, HowToScene.SPELL_COUNTER_PATH);
        this.load.image(HowToScene.MIRROR_KEY, HowToScene.MIRROR_PATH);
        this.load.image(HowToScene.TROPHY_KEY, HowToScene.TROPHY_PATH);
    }

    public startScene(): void {
        Input.enableInput();
        this.scrollOffset = 0;
        this.scrollContent = [];

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

        const backButton = <Button>this.add.uiElement(UIElementType.BUTTON, HowToLayers.UI, {
            position: new Vec2(80, 42),
            text: "Back"
        });
        backButton.backgroundColor = new Color(88, 72, 142);
        backButton.borderColor = new Color(38, 32, 70);
        backButton.borderRadius = 0;
        backButton.borderWidth = 2;
        backButton.textColor = Color.WHITE;
        backButton.setPadding(new Vec2(28, 10));
        backButton.font = "PixelSimple";
        backButton.fontSize = 24;
        backButton.onClick = () => {
            this.sceneManager.changeToScene(MainMenu);
        };

        const title = <Label>this.add.uiElement(UIElementType.LABEL, HowToLayers.UI, {
            position: new Vec2(size.x, 90),
            text: "How to"
        });
        title.font = "PixelSimple";
        title.fontSize = 56;
        title.textColor = Color.BLACK;
        title.backgroundColor = Color.TRANSPARENT;
        title.borderColor = Color.TRANSPARENT;

        const mageOne = this.add.animatedSprite(HowToScene.MAGE_1_KEY, HowToLayers.UI);
        mageOne.position.copy(new Vec2(size.x - 150, 230));
        mageOne.scale.set(0.9, 0.9);
        mageOne.invertX = false;
        mageOne.animation.play("IDLE");

        const mageTwo = this.add.animatedSprite(HowToScene.MAGE_2_KEY, HowToLayers.UI);
        mageTwo.position.copy(new Vec2(size.x + 150, 230));
        mageTwo.scale.set(0.9, 0.9);
        mageTwo.invertX = true;
        mageTwo.animation.play("IDLE");

        const playerOneLabel = <Label>this.add.uiElement(UIElementType.LABEL, HowToLayers.UI, {
            position: new Vec2(size.x - 150, 365),
            text: "Player 1"
        });
        playerOneLabel.font = "PixelSimple";
        playerOneLabel.fontSize = 30;
        playerOneLabel.textColor = Color.BLACK;
        playerOneLabel.backgroundColor = Color.TRANSPARENT;
        playerOneLabel.borderColor = Color.TRANSPARENT;

        const playerTwoLabel = <Label>this.add.uiElement(UIElementType.LABEL, HowToLayers.UI, {
            position: new Vec2(size.x + 150, 365),
            text: "Player 2"
        });
        playerTwoLabel.font = "PixelSimple";
        playerTwoLabel.fontSize = 30;
        playerTwoLabel.textColor = Color.BLACK;
        playerTwoLabel.backgroundColor = Color.TRANSPARENT;
        playerTwoLabel.borderColor = Color.TRANSPARENT;

        const body = <Label>this.add.uiElement(UIElementType.LABEL, HowToLayers.UI, {
            position: new Vec2(size.x, 435),
            text: "Reflect spells back at your rival."
        });
        body.font = "PixelSimple";
        body.fontSize = 24;
        body.textColor = Color.BLACK;
        body.backgroundColor = Color.TRANSPARENT;
        body.borderColor = Color.TRANSPARENT;

        const controls = <Label>this.add.uiElement(UIElementType.LABEL, HowToLayers.UI, {
            position: new Vec2(size.x, 485),
            text: "Player 1 uses WASD to move, W to jump, and E or Space to cast. Player 2 uses IJKL to move, I to jump, and U or Enter to cast"
        });
        controls.font = "PixelSimple";
        controls.fontSize = 20;
        controls.textColor = Color.BLACK;
        controls.backgroundColor = Color.TRANSPARENT;
        controls.borderColor = Color.TRANSPARENT;

        const spellTitle = <Label>this.add.uiElement(UIElementType.LABEL, HowToLayers.UI, {
            position: new Vec2(size.x, 575),
            text: "Spells"
        });
        spellTitle.font = "PixelSimple";
        spellTitle.fontSize = 34;
        spellTitle.textColor = Color.BLACK;
        spellTitle.backgroundColor = Color.TRANSPARENT;
        spellTitle.borderColor = Color.TRANSPARENT;

        const firePowerup = this.add.sprite(HowToScene.FIRE_POWERUP_KEY, HowToLayers.UI);
        firePowerup.position.copy(new Vec2(size.x + 330, 650));
        firePowerup.scale.set(0.32, 0.32);

        const fireText = <Label>this.add.uiElement(UIElementType.LABEL, HowToLayers.UI, {
            position: new Vec2(size.x - 80, 650),
            text: "Fire: fast shots that pressure rivals."
        });
        fireText.font = "PixelSimple";
        fireText.fontSize = 22;
        fireText.textColor = Color.BLACK;
        fireText.backgroundColor = Color.TRANSPARENT;
        fireText.borderColor = Color.TRANSPARENT;

        const icePowerup = this.add.sprite(HowToScene.ICE_POWERUP_KEY, HowToLayers.UI);
        icePowerup.position.copy(new Vec2(size.x + 330, 740));
        icePowerup.scale.set(0.32, 0.32);

        const iceText = <Label>this.add.uiElement(UIElementType.LABEL, HowToLayers.UI, {
            position: new Vec2(size.x - 80, 740),
            text: "Ice: sharp shards for direct hits."
        });
        iceText.font = "PixelSimple";
        iceText.fontSize = 22;
        iceText.textColor = Color.BLACK;
        iceText.backgroundColor = Color.TRANSPARENT;
        iceText.borderColor = Color.TRANSPARENT;

        const lightningPowerup = this.add.sprite(HowToScene.LIGHTNING_POWERUP_KEY, HowToLayers.UI);
        lightningPowerup.position.copy(new Vec2(size.x + 330, 830));
        lightningPowerup.scale.set(0.32, 0.32);

        const lightningText = <Label>this.add.uiElement(UIElementType.LABEL, HowToLayers.UI, {
            position: new Vec2(size.x - 80, 830),
            text: "Lightning: quick bolts for sudden strikes."
        });
        lightningText.font = "PixelSimple";
        lightningText.fontSize = 22;
        lightningText.textColor = Color.BLACK;
        lightningText.backgroundColor = Color.TRANSPARENT;
        lightningText.borderColor = Color.TRANSPARENT;

        const counterTitle = <Label>this.add.uiElement(UIElementType.LABEL, HowToLayers.UI, {
            position: new Vec2(size.x, 1115),
            text: "Spell Counter"
        });
        counterTitle.font = "PixelSimple";
        counterTitle.fontSize = 34;
        counterTitle.textColor = Color.BLACK;
        counterTitle.backgroundColor = Color.TRANSPARENT;
        counterTitle.borderColor = Color.TRANSPARENT;

        const spellCounterTopLeft = this.add.sprite(HowToScene.SPELL_COUNTER_KEY, HowToLayers.UI);
        spellCounterTopLeft.position.copy(new Vec2(size.x + 185, 1195));
        spellCounterTopLeft.scale.set(0.28, 0.28);

        const spellCounterTopMiddle = this.add.sprite(HowToScene.SPELL_COUNTER_KEY, HowToLayers.UI);
        spellCounterTopMiddle.position.copy(new Vec2(size.x + 290, 1195));
        spellCounterTopMiddle.scale.set(0.28, 0.28);

        const spellCounterTopRight = this.add.sprite(HowToScene.SPELL_COUNTER_KEY, HowToLayers.UI);
        spellCounterTopRight.position.copy(new Vec2(size.x + 395, 1195));
        spellCounterTopRight.scale.set(0.28, 0.28);

        const counterTextLine1 = <Label>this.add.uiElement(UIElementType.LABEL, HowToLayers.UI, {
            position: new Vec2(size.x - 250, 1170),
            text: "This is your spell counter."
        });
        counterTextLine1.font = "PixelSimple";
        counterTextLine1.fontSize = 20;
        counterTextLine1.textColor = Color.BLACK;
        counterTextLine1.backgroundColor = Color.TRANSPARENT;
        counterTextLine1.borderColor = Color.TRANSPARENT;

        const counterTextLine2 = <Label>this.add.uiElement(UIElementType.LABEL, HowToLayers.UI, {
            position: new Vec2(size.x - 250, 1220),
            text: "It changes color based on your spell"
        });
        counterTextLine2.font = "PixelSimple";
        counterTextLine2.fontSize = 20;
        counterTextLine2.textColor = Color.BLACK;
        counterTextLine2.backgroundColor = Color.TRANSPARENT;
        counterTextLine2.borderColor = Color.TRANSPARENT;

        const counterTextLine3 = <Label>this.add.uiElement(UIElementType.LABEL, HowToLayers.UI, {
            position: new Vec2(size.x - 250, 1270),
            text: "and depleats as you use charges."
        });
        counterTextLine3.font = "PixelSimple";
        counterTextLine3.fontSize = 20;
        counterTextLine3.textColor = Color.BLACK;
        counterTextLine3.backgroundColor = Color.TRANSPARENT;
        counterTextLine3.borderColor = Color.TRANSPARENT;

        const counterTextLine4 = <Label>this.add.uiElement(UIElementType.LABEL, HowToLayers.UI, {
            position: new Vec2(size.x - 250, 1320),
            text: "You get 3 uses. Use wisely."
        });
        counterTextLine4.font = "PixelSimple";
        counterTextLine4.fontSize = 20;
        counterTextLine4.textColor = Color.BLACK;
        counterTextLine4.backgroundColor = Color.TRANSPARENT;
        counterTextLine4.borderColor = Color.TRANSPARENT;

        const mirrorTitle = <Label>this.add.uiElement(UIElementType.LABEL, HowToLayers.UI, {
            position: new Vec2(size.x, 1460),
            text: "Mage's Mirror"
        });
        mirrorTitle.font = "PixelSimple";
        mirrorTitle.fontSize = 34;
        mirrorTitle.textColor = Color.BLACK;
        mirrorTitle.backgroundColor = Color.TRANSPARENT;
        mirrorTitle.borderColor = Color.TRANSPARENT;

        const mirrorTextLine1 = <Label>this.add.uiElement(UIElementType.LABEL, HowToLayers.UI, {
            position: new Vec2(size.x - 255, 1530),
            text: "This is your Mage's Mirror."
        });
        mirrorTextLine1.font = "PixelSimple";
        mirrorTextLine1.fontSize = 20;
        mirrorTextLine1.textColor = Color.BLACK;
        mirrorTextLine1.backgroundColor = Color.TRANSPARENT;
        mirrorTextLine1.borderColor = Color.TRANSPARENT;

        const mirrorTextLine2 = <Label>this.add.uiElement(UIElementType.LABEL, HowToLayers.UI, {
            position: new Vec2(size.x - 255, 1580),
            text: "It can be used to reflect spells"
        });
        mirrorTextLine2.font = "PixelSimple";
        mirrorTextLine2.fontSize = 20;
        mirrorTextLine2.textColor = Color.BLACK;
        mirrorTextLine2.backgroundColor = Color.TRANSPARENT;
        mirrorTextLine2.borderColor = Color.TRANSPARENT;

        const mirrorTextLine3 = <Label>this.add.uiElement(UIElementType.LABEL, HowToLayers.UI, {
            position: new Vec2(size.x - 255, 1630),
            text: "back at your enemy, but careful:"
        });
        mirrorTextLine3.font = "PixelSimple";
        mirrorTextLine3.fontSize = 20;
        mirrorTextLine3.textColor = Color.BLACK;
        mirrorTextLine3.backgroundColor = Color.TRANSPARENT;
        mirrorTextLine3.borderColor = Color.TRANSPARENT;

        const mirrorTextLine4 = <Label>this.add.uiElement(UIElementType.LABEL, HowToLayers.UI, {
            position: new Vec2(size.x - 255, 1680),
            text: "you can only use it 3 times."
        });
        mirrorTextLine4.font = "PixelSimple";
        mirrorTextLine4.fontSize = 20;
        mirrorTextLine4.textColor = Color.BLACK;
        mirrorTextLine4.backgroundColor = Color.TRANSPARENT;
        mirrorTextLine4.borderColor = Color.TRANSPARENT;

        const mirror = this.add.sprite(HowToScene.MIRROR_KEY, HowToLayers.UI);
        mirror.position.copy(new Vec2(size.x + 300, 1605));
        mirror.scale.set(0.6, 0.6);

        const goalTextLine1 = <Label>this.add.uiElement(UIElementType.LABEL, HowToLayers.UI, {
            position: new Vec2(size.x, 1840),
            text: "Your goal is to best your fellow mage"
        });
        goalTextLine1.font = "PixelSimple";
        goalTextLine1.fontSize = 26;
        goalTextLine1.textColor = Color.BLACK;
        goalTextLine1.backgroundColor = Color.TRANSPARENT;
        goalTextLine1.borderColor = Color.TRANSPARENT;

        const goalTextLine2 = <Label>this.add.uiElement(UIElementType.LABEL, HowToLayers.UI, {
            position: new Vec2(size.x, 1890),
            text: "in combat and win."
        });
        goalTextLine2.font = "PixelSimple";
        goalTextLine2.fontSize = 26;
        goalTextLine2.textColor = Color.BLACK;
        goalTextLine2.backgroundColor = Color.TRANSPARENT;
        goalTextLine2.borderColor = Color.TRANSPARENT;

        const trophy = this.add.sprite(HowToScene.TROPHY_KEY, HowToLayers.UI);
        trophy.position.copy(new Vec2(size.x, 2010));
        trophy.scale.set(1.1, 1.1);

        this.registerScrollContent(
            title, mageOne, mageTwo, playerOneLabel, playerTwoLabel, body, controls,
            spellTitle, firePowerup, fireText, icePowerup, iceText, lightningPowerup, lightningText,
            counterTitle, spellCounterTopLeft, spellCounterTopMiddle, spellCounterTopRight,
            counterTextLine1, counterTextLine2, counterTextLine3, counterTextLine4,
            mirrorTitle, mirrorTextLine1, mirrorTextLine2, mirrorTextLine3, mirrorTextLine4, mirror,
            goalTextLine1, goalTextLine2, trophy
        );
    }

    public updateScene(): void {
        let scrollDelta = 0;

        if (Input.didJustScroll()) {
            scrollDelta += Input.getScrollDirection() * HowToScene.SCROLL_STEP;
        }

        if (Input.isKeyPressed("arrowdown") || Input.isKeyPressed("s")) {
            scrollDelta += HowToScene.SCROLL_STEP / 6;
        }

        if (Input.isKeyPressed("arrowup") || Input.isKeyPressed("w")) {
            scrollDelta -= HowToScene.SCROLL_STEP / 6;
        }

        if (scrollDelta !== 0) {
            this.setScrollOffset(this.scrollOffset + scrollDelta);
        }

    }

    private registerScrollContent(...nodes: CanvasNode[]): void {
        this.scrollContent = nodes.map(node => ({ node, y: node.position.y }));
        this.applyScrollOffset();
    }

    private setScrollOffset(offset: number): void {
        this.scrollOffset = Math.max(0, Math.min(HowToScene.MAX_SCROLL, offset));
        this.applyScrollOffset();
    }

    private applyScrollOffset(): void {
        this.scrollContent.forEach(item => {
            item.node.position.y = item.y - this.scrollOffset;
        });
    }
}
