import CanvasNodeFactory from "../../Wolfie2D/Scene/Factories/CanvasNodeFactory";
import MBAnimatedSprite from "../Nodes/MBAnimatedSprite";
import MBLevel from "../Scenes/MBLevel";

/**
 * An extension of Wolfie2ds CanvasNodeFactory. The purpose of the class is to add functionality for adding custom
 * game nodes to MBLevels. 
 */
export default class MBCanvasNodeFactory extends CanvasNodeFactory {

    // Reference to the current Level
    protected scene: MBLevel;
    
    // Overriden to only accept Levels for the Master Blaster game
    public init(scene: MBLevel): void { super.init(scene); }

    // Overriden to return MBAnimatedSprites instead of regular AnimatedSprites
    public addAnimatedSprite = (key: string, layerName: string): MBAnimatedSprite => {
        let layer = this.scene.getLayer(layerName);
		let spritesheet = this.resourceManager.getSpritesheet(key);
		let instance = new MBAnimatedSprite(spritesheet);

		// Add instance fo scene
		instance.setScene(this.scene);
		instance.id = this.scene.generateId();
		
		if(!(this.scene.isParallaxLayer(layerName) || this.scene.isUILayer(layerName))){
			this.scene.getSceneGraph().addNode(instance);
		}

		// Add instance to layer
		layer.addNode(instance);

		return instance;
    }
}