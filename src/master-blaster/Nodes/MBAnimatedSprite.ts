import AnimatedSprite from "../../Wolfie2D/Nodes/Sprites/AnimatedSprite";
import MBLevel from "../Scenes/MBLevel";

/**
 * An animated sprite in the MBLevel. I have extended the animated sprite to create a more specific sprite
 * with a reference to a MBLevel. One of the things I want to try and show all of you is how to extend
 * Wolfie2d. 
 * 
 * For the MBAnimatedSprite, I've just overriden the type of the scene and the associated getter/setter
 * methods. Without this, you would have to explicitly cast the type of the scene to a MBLevel to get access
 * to the methods associated with MBLevel. 
 * 
 */
export default class MBAnimatedSprite extends AnimatedSprite {

    protected scene: MBLevel;
    
    public setScene(scene: MBLevel): void { this.scene = scene; }
    public getScene(): MBLevel { return this.scene; }
}