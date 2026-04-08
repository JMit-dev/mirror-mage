import AABB from "../../Wolfie2D/DataTypes/Shapes/AABB";
import Vec2 from "../../Wolfie2D/DataTypes/Vec2";
import GameEvent from "../../Wolfie2D/Events/GameEvent";
import { GameEventType } from "../../Wolfie2D/Events/GameEventType";
import Input from "../../Wolfie2D/Input/Input";
import { TweenableProperties } from "../../Wolfie2D/Nodes/GameNode";
import { GraphicType } from "../../Wolfie2D/Nodes/Graphics/GraphicTypes";
import Rect from "../../Wolfie2D/Nodes/Graphics/Rect";
import AnimatedSprite from "../../Wolfie2D/Nodes/Sprites/AnimatedSprite";
import OrthogonalTilemap from "../../Wolfie2D/Nodes/Tilemaps/OrthogonalTilemap";
import Label from "../../Wolfie2D/Nodes/UIElements/Label";
import { UIElementType } from "../../Wolfie2D/Nodes/UIElements/UIElementTypes";
import RenderingManager from "../../Wolfie2D/Rendering/RenderingManager";
import Scene from "../../Wolfie2D/Scene/Scene";
import SceneManager from "../../Wolfie2D/Scene/SceneManager";
import Viewport from "../../Wolfie2D/SceneGraph/Viewport";
import Timer from "../../Wolfie2D/Timing/Timer";
import Color from "../../Wolfie2D/Utils/Color";
import { EaseFunctionType } from "../../Wolfie2D/Utils/EaseFunctions";
import PlayerController, { PlayerTweens } from "../Player/PlayerController";
import PlayerWeapon from "../Player/PlayerWeapon";

import { MBEvents } from "../MBEvents";
import { MBPhysicsGroups } from "../MBPhysicsGroups";
import MBFactoryManager from "../Factory/MBFactoryManager";
import MainMenu from "./MainMenu";
import Particle from "../../Wolfie2D/Nodes/Graphics/Particle";

/**
 * A const object for the layer names
 */
export const MBLayers = {
    // The primary layer
    PRIMARY: "PRIMARY",
    // The UI layer
    UI: "UI"
} as const;

// The layers as a type
export type MBLayer = typeof MBLayers[keyof typeof MBLayers]

/**
 * An abstract Master Blaster scene class combining all the things
 * all levels in the game will need.
 */
export default abstract class MBLevel extends Scene {
    /** Target frame size in world units to preserve original player on-screen size */
    protected static readonly PLAYER_TARGET_FRAME_SIZE = 32;

    /** Overrride the factory manager */
    public add: MBFactoryManager;

    /** The particle system used for the player's weapon */
    protected playerWeaponSystem: PlayerWeapon
    /** The key for the player's animated sprite */
    protected playerSpriteKey: string;
    /** The animated sprite that is the player */
    protected player: AnimatedSprite;
    /** The player's spawn position */
    protected playerSpawn: Vec2;

    private healthLabel: Label;
	private healthBar: Label;
	private healthBarBg: Label;


    /** The end of level stuff */

    protected levelEndPosition: Vec2;
    protected levelEndHalfSize: Vec2;

    protected levelEndArea: Rect;
    protected nextLevel: new (...args: any) => Scene;
    protected levelEndTimer: Timer;
    protected levelEndLabel: Label;

    // Level end transition timer and graphic
    protected levelTransitionTimer: Timer;
    protected levelTransitionScreen: Rect;

    /** The keys to the tilemap and different tilemap layers */
    protected tilemapKey: string;
    protected destructibleLayerKey: string;
    protected wallsLayerKey: string;
    /** The scale for the tilemap */
    protected tilemapScale: Vec2;
    /** The destrubtable layer of the tilemap */
    protected destructable: OrthogonalTilemap;
    /** The wall layer of the tilemap */
    protected walls: OrthogonalTilemap;

    /** Sound and music */
    protected levelMusicKey: string;
    protected jumpAudioKey: string;
    protected tileDestroyedAudioKey: string;
    protected deathAudioKey: string;

    public constructor(viewport: Viewport, sceneManager: SceneManager, renderingManager: RenderingManager, options: Record<string, any>) {
        super(viewport, sceneManager, renderingManager, {...options, physics: {
            groupNames: [
                MBPhysicsGroups.GROUND,
                MBPhysicsGroups.PLAYER,
                MBPhysicsGroups.PLAYER_WEAPON,
                MBPhysicsGroups.DESTRUCTABLE
            ],
            collisions: [
                [0, 1, 1, 0], // Ground
                [1, 0, 0, 1], // Player
                [1, 0, 0, 1], // Weapon
                [0, 1, 1, 0], // Destructable
            ]
        }});
        this.add = new MBFactoryManager(this, this.tilemaps);
    }

    public startScene(): void {
        // Initialize the layers
        this.initLayers();

        // Initialize the tilemaps
        this.initializeTilemap();

        // Initialize the sprite and particle system for the players weapon 
        this.initializeWeaponSystem();

        this.initializeUI();

        // Initialize the player 
        this.initializePlayer(this.playerSpriteKey);

        // Initialize the viewport - this must come after the player has been initialized
        this.initializeViewport();
        this.subscribeToEvents();
        

        // Initialize the ends of the levels - must be initialized after the primary layer has been added
        this.initializeLevelEnds();

        this.levelTransitionTimer = new Timer(500);
        this.levelEndTimer = new Timer(3000, () => {
            // After the level end timer ends, fade to black and then go to the next scene
            this.levelTransitionScreen.tweens.play("fadeIn");
        });

        // Initially disable player movement
        Input.disableInput();

        // Start the black screen fade out
        this.levelTransitionScreen.tweens.play("fadeOut");

        // Start playing the level music for the game level
        this.emitter.fireEvent(GameEventType.PLAY_SOUND, {key: this.levelMusicKey, loop: true, holdReference: true});
    }

    /* Update method for the scene */

    public updateScene(deltaT: number) {
        // Check active weapon particles for tile hits after physics has updated.
        for (const particle of this.playerWeaponSystem.getPool()) {
            if (particle.inUse && particle.collidedWithTilemap) {
                this.handleParticleHit(particle.id);
            }
        }

        // Handle all game events
        while (this.receiver.hasNextEvent()) {
            this.handleEvent(this.receiver.getNextEvent());
        }
    }

    /**
     * Handle game events. 
     * @param event the game event
     */
    protected handleEvent(event: GameEvent): void {
        switch (event.type) {
            case MBEvents.PLAYER_ENTERED_LEVEL_END: {
                this.handleEnteredLevelEnd();
                break;
            }
            // When the level starts, reenable user input
            case MBEvents.LEVEL_START: {
                Input.enableInput();
                break;
            }
            // When the level ends, change the scene to the next level
            case MBEvents.LEVEL_END: {
                this.sceneManager.changeToScene(this.nextLevel);
                break;
            }
            case MBEvents.HEALTH_CHANGE: {
                this.handleHealthChange(event.data.get("curhp"), event.data.get("maxhp"));
                break;
            }
            case MBEvents.PLAYER_DEAD: {
                this.sceneManager.changeToScene(MainMenu);
                break;
            }
            // Default: Throw an error! No unhandled events allowed.
            default: {
                throw new Error(`Unhandled event caught in scene with type ${event.type}`)
            }
        }
    }

    /* Handlers for the different events the scene is subscribed to */

    /**
     * Handle particle hit events
     * @param particleId the id of the particle
     */
    protected handleParticleHit(particleId: number): void {
        let particles = this.playerWeaponSystem.getPool();

        let particle = particles.find(particle => particle.id === particleId);
        if (particle !== undefined) {
            // Get the destructable tilemap
            let tilemap = this.destructable;

            let min = new Vec2(particle.sweptRect.left, particle.sweptRect.top);
            let max = new Vec2(particle.sweptRect.right, particle.sweptRect.bottom);

            // Convert the min/max x/y to the min and max row/col in the tilemap array
            let minIndex = tilemap.getColRowAt(min);
            let maxIndex = tilemap.getColRowAt(max);

            // Loop over all possible tiles the particle could be colliding with 
            for(let col = minIndex.x; col <= maxIndex.x; col++){
                for(let row = minIndex.y; row <= maxIndex.y; row++){
                    // If the tile is collideable -> check if this particle is colliding with the tile
                    if(tilemap.isTileCollidable(col, row) && this.particleHitTile(tilemap, particle, col, row)){
                        this.emitter.fireEvent(GameEventType.PLAY_SOUND, { key: this.tileDestroyedAudioKey, loop: false, holdReference: false });
                        tilemap.setTileAtRowCol(new Vec2(col, row), 0);
                        particle.setParticleInactive();
                        return;
                    }
                }
            }
        }
    }

    /**
     * Checks if a particle hit the tile at the (col, row) coordinates in the tilemap.
     * 
     * @param tilemap the tilemap
     * @param particle the particle
     * @param col the column the 
     * @param row the row 
     * @returns true of the particle hit the tile; false otherwise
     */
    protected particleHitTile(tilemap: OrthogonalTilemap, particle: Particle, col: number, row: number): boolean {
        const tileSize = tilemap.getTileSize();
        const tileCenter = new Vec2(col * tileSize.x + tileSize.x/2, row * tileSize.y + tileSize.y/2);
        const tileCollider = new AABB(tileCenter, tileSize.scaled(1/2));
        return particle.sweptRect.overlapArea(tileCollider) > 0;
    }

    /**
     * Handle the event when the player enters the level end area.
     */
    protected handleEnteredLevelEnd(): void {
        // If the timer hasn't run yet, start the end level animation
        if (!this.levelEndTimer.hasRun() && this.levelEndTimer.isStopped()) {
            this.levelEndTimer.start();
            this.levelEndLabel.tweens.play("slideIn");
        }
    }
    /**
     * This is the same healthbar found in The Yellow Submarine. I've adapted it slightly to account for the zoom factor. Other than that, the
     * code is basically the same.
     * 
     * @param currentHealth the current health of the player
     * @param maxHealth the maximum health of the player
     */
    protected handleHealthChange(currentHealth: number, maxHealth: number): void {
		let unit = this.healthBarBg.size.x / maxHealth;
        
		this.healthBar.size.set(this.healthBarBg.size.x - unit * (maxHealth - currentHealth), this.healthBarBg.size.y);
		this.healthBar.position.set(this.healthBarBg.position.x - (unit / 2 / this.getViewScale()) * (maxHealth - currentHealth), this.healthBarBg.position.y);

		this.healthBar.backgroundColor = currentHealth < maxHealth * 1/4 ? Color.RED: currentHealth < maxHealth * 3/4 ? Color.YELLOW : Color.GREEN;
	}

    /* Initialization methods for everything in the scene */

    /**
     * Initialzes the layers
     */
    protected initLayers(): void {
        // Add a layer for UI
        this.addUILayer(MBLayers.UI);
        // Add a layer for players and enemies
        this.addLayer(MBLayers.PRIMARY);
    }
    /**
     * Initializes the tilemaps
     * @param key the key for the tilemap data
     * @param scale the scale factor for the tilemap
     */
    protected initializeTilemap(): void {
        if (this.tilemapKey === undefined || this.tilemapScale === undefined) {
            throw new Error("Cannot add the homework 4 tilemap unless the tilemap key and scale are set.");
        }
        // Add the tilemap to the scene
        this.add.tilemap(this.tilemapKey, this.tilemapScale);

        if (this.destructibleLayerKey === undefined || this.wallsLayerKey === undefined) {
            throw new Error("Make sure the keys for the destuctible layer and wall layer are both set");
        }

        // Get the wall and destructible layers 
        this.walls = this.getTilemap(this.wallsLayerKey) as OrthogonalTilemap;
        this.destructable = this.getTilemap(this.destructibleLayerKey) as OrthogonalTilemap;

        // Add physicss to the wall layer
        this.walls.addPhysics();
        // Add physics to the destructible layer of the tilemap
        this.destructable.addPhysics();
    }
    /**
     * Handles all subscriptions to events
     */
    protected subscribeToEvents(): void {
        this.receiver.subscribe(MBEvents.PLAYER_ENTERED_LEVEL_END);
        this.receiver.subscribe(MBEvents.LEVEL_START);
        this.receiver.subscribe(MBEvents.LEVEL_END);
        this.receiver.subscribe(MBEvents.HEALTH_CHANGE);
        this.receiver.subscribe(MBEvents.PLAYER_DEAD);
    }
    /**
     * Adds in any necessary UI to the game
     */
    protected initializeUI(): void {

        // HP Label
		this.healthLabel = <Label>this.add.uiElement(UIElementType.LABEL, MBLayers.UI, {position: new Vec2(205, 20), text: "HP "});
		this.healthLabel.size.set(300, 30);
		this.healthLabel.fontSize = 24;
		this.healthLabel.font = "Courier";

        // HealthBar
		this.healthBar = <Label>this.add.uiElement(UIElementType.LABEL, MBLayers.UI, {position: new Vec2(250, 20), text: ""});
		this.healthBar.size = new Vec2(300, 25);
		this.healthBar.backgroundColor = Color.GREEN;

        // HealthBar Border
		this.healthBarBg = <Label>this.add.uiElement(UIElementType.LABEL, MBLayers.UI, {position: new Vec2(250, 20), text: ""});
		this.healthBarBg.size = new Vec2(300, 25);
		this.healthBarBg.borderColor = Color.BLACK;

        // End of level label (start off screen)
        this.levelEndLabel = <Label>this.add.uiElement(UIElementType.LABEL, MBLayers.UI, { position: new Vec2(-300, 100), text: "Level Complete" });
        this.levelEndLabel.size.set(1200, 60);
        this.levelEndLabel.borderRadius = 0;
        this.levelEndLabel.backgroundColor = new Color(34, 32, 52);
        this.levelEndLabel.textColor = Color.WHITE;
        this.levelEndLabel.fontSize = 48;
        this.levelEndLabel.font = "PixelSimple";

        // Add a tween to move the label on screen
        this.levelEndLabel.tweens.add("slideIn", {
            startDelay: 0,
            duration: 1000,
            effects: [
                {
                    property: TweenableProperties.posX,
                    start: -300,
                    end: 300,
                    ease: EaseFunctionType.OUT_SINE
                }
            ]
        });

        this.levelTransitionScreen = <Rect>this.add.graphic(GraphicType.RECT, MBLayers.UI, { position: new Vec2(300, 200), size: new Vec2(600, 400) });
        this.levelTransitionScreen.color = new Color(34, 32, 52);
        this.levelTransitionScreen.alpha = 1;

        this.levelTransitionScreen.tweens.add("fadeIn", {
            startDelay: 0,
            duration: 1000,
            effects: [
                {
                    property: TweenableProperties.alpha,
                    start: 0,
                    end: 1,
                    ease: EaseFunctionType.IN_OUT_QUAD
                }
            ],
            onEnd: MBEvents.LEVEL_END
        });

        /*
             Adds a tween to fade in the start of the level. After the tween has
             finished playing, a level start event gets sent to the EventQueue.
        */
        this.levelTransitionScreen.tweens.add("fadeOut", {
            startDelay: 0,
            duration: 1000,
            effects: [
                {
                    property: TweenableProperties.alpha,
                    start: 1,
                    end: 0,
                    ease: EaseFunctionType.IN_OUT_QUAD
                }
            ],
            onEnd: MBEvents.LEVEL_START
        });
    }
    /**
     * Initializes the particles system used by the player's weapon.
     */
    protected initializeWeaponSystem(): void {
        this.playerWeaponSystem = new PlayerWeapon(50, Vec2.ZERO, 1000, 3, 0, 50);
        this.playerWeaponSystem.initializePool(this, MBLayers.PRIMARY);
        for (const particle of this.playerWeaponSystem.getPool()) {
            particle.setGroup(MBPhysicsGroups.PLAYER_WEAPON);
        }
    }
    /**
     * Initializes the player, setting the player's initial position to the given position.
     * @param position the player's spawn position
     */
    protected initializePlayer(key: string): void {
        if (this.playerWeaponSystem === undefined) {
            throw new Error("Player weapon system must be initialized before initializing the player!");
        }
        if (this.playerSpawn === undefined) {
            throw new Error("Player spawn must be set before initializing the player!");
        }

        // Add the player to the scene
        this.player = this.add.animatedSprite(key, MBLayers.PRIMARY);
        const targetSize = MBLevel.PLAYER_TARGET_FRAME_SIZE;
        const scaleX = targetSize / this.player.size.x;
        const scaleY = targetSize / this.player.size.y;
        this.player.scale.set(scaleX, scaleY);
        this.player.position.copy(this.playerSpawn);
        
        // Give the player physics
        this.player.addPhysics(new AABB(this.player.position.clone(), this.player.boundary.getHalfSize().clone()));
        this.player.setGroup(MBPhysicsGroups.PLAYER);

        // Give the player a flip animation for jumping
        this.player.tweens.add(PlayerTweens.FLIP, {
            startDelay: 0,
            duration: 300,
            effects: [
                {
                    property: TweenableProperties.rotation,
                    resetOnComplete: true,
                    start: 0,
                    end: 2 * Math.PI,
                    ease: EaseFunctionType.IN_OUT_SINE
                }
            ]
        });

        // Give the player it's AI
        this.player.addAI(PlayerController, { 
            weaponSystem: this.playerWeaponSystem, 
            tilemap: "Destructable" 
        });
    }
    /**
     * Initializes the viewport
     */
    protected initializeViewport(): void {
        if (this.player === undefined) {
            throw new Error("Player must be initialized before setting the viewport to folow the player");
        }
        this.viewport.follow(this.player);
        this.viewport.setZoomLevel(2);
        this.viewport.setBounds(0, 0, 512, 512);
    }
    /**
     * Initializes the level end area
     */
    protected initializeLevelEnds(): void {
        if (!this.layers.has(MBLayers.PRIMARY)) {
            throw new Error("Can't initialize the level ends until the primary layer has been added to the scene!");
        }
        
        this.levelEndArea = <Rect>this.add.graphic(GraphicType.RECT, MBLayers.PRIMARY, { position: this.levelEndPosition, size: this.levelEndHalfSize });
        this.levelEndArea.addPhysics(undefined, undefined, false, true);
        this.levelEndArea.setTrigger(MBPhysicsGroups.PLAYER, MBEvents.PLAYER_ENTERED_LEVEL_END, null);
        this.levelEndArea.color = new Color(255, 0, 255, .20);
        
    }

    /* Misc methods */

    // Get the key of the player's jump audio file
    public getJumpAudioKey(): string {
        return this.jumpAudioKey
    }

    // Get the key of the player's death audio file
    public getDeathAudioKey(): string {
        return this.deathAudioKey;
    }
}
