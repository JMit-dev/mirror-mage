import Graphic from "../../Wolfie2D/Nodes/Graphic";
import Sprite from "../../Wolfie2D/Nodes/Sprites/Sprite";
import Tilemap from "../../Wolfie2D/Nodes/Tilemap";
import UIElement from "../../Wolfie2D/Nodes/UIElement";
import FactoryManager from "../../Wolfie2D/Scene/Factories/FactoryManager";
import MBAnimatedSprite from "../Nodes/MBAnimatedSprite";
import MBLevel, { MBLayer } from "../Scenes/MBLevel";
import MBCanvasNodeFactory from "./MBCanvasNodeFactory";

/**
 * An extension of Wolfie2ds FactoryManager. I'm creating a more specific factory for my custom MBLevel. If you want to get custom
 * GameNodes into your scenes (with more specific properties) you'll have to extend the factory classes.
 */
export default class MBFactoryManager extends FactoryManager {

    private MBCanvasNodeFactory: MBCanvasNodeFactory;

    public constructor(scene: MBLevel, tilemaps: Tilemap[]) {
        super(scene, tilemaps)
        this.MBCanvasNodeFactory = new MBCanvasNodeFactory();
        this.MBCanvasNodeFactory.init(scene);
    }

    public animatedSprite(key: string, layerName: MBLayer): MBAnimatedSprite {
        return this.MBCanvasNodeFactory.addAnimatedSprite(key, layerName);
    }

    public uiElement(type: string, layerName: MBLayer, options?: Record<string, any>): UIElement {
        return super.uiElement(type, layerName, options);
    }

    public graphic(type: string, layerName: MBLayer, options?: Record<string, any>): Graphic {
        return super.graphic(type, layerName, options);
    }

    public sprite(key: string, layerName: MBLayer): Sprite {
        return super.sprite(key, layerName);
    }
}