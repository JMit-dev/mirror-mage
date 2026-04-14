import StateMachineAI from "../../Wolfie2D/AI/StateMachineAI";
import Vec2 from "../../Wolfie2D/DataTypes/Vec2";
import OrthogonalTilemap from "../../Wolfie2D/Nodes/Tilemaps/OrthogonalTilemap";

import Fall from "./PlayerStates/Fall";
import Idle from "./PlayerStates/Idle";
import Jump from "./PlayerStates/Jump";
import Walk from "./PlayerStates/Walk";

import PlayerWeapon from "./PlayerWeapon";
import Input from "../../Wolfie2D/Input/Input";

import { MBControls } from "../MBControls";
import MBAnimatedSprite from "../Nodes/MBAnimatedSprite";
import MathUtils from "../../Wolfie2D/Utils/MathUtils";
import { MBEvents } from "../MBEvents";
import Dead from "./PlayerStates/Dead";
import FirebaseManager from "../Firebase/FirebaseManager";

/**
 * Animation keys for the player spritesheet
 */
export const PlayerAnimations = {
    IDLE: "IDLE",
    // Use right-facing variants; left-facing is handled by invertX in PlayerState.update()
    WALK: "WALK_RIGHT",
    JUMP: "JUMP_RIGHT",
    ATTACK: "ATTACK_RIGHT",
    TAKE_DAMAGE_LEFT: "TAKE_DAMAGE_LEFT",
    TAKE_DAMAGE_RIGHT: "TAKE_DAMAGE_RIGHT",
    DYING: "DYING",
    DEAD: "DEAD",
} as const

/**
 * Tween animations the player can player.
 */
export const PlayerTweens = {
    FLIP: "FLIP",
    DEATH: "DEATH"
} as const

/**
 * Keys for the states the PlayerController can be in.
 */
export const PlayerStates = {
    IDLE: "IDLE",
    WALK: "WALK",
	JUMP: "JUMP",
    FALL: "FALL",
    DEAD: "DEAD",
} as const

/**
 * The controller that controls the player.
 */
export default class PlayerController extends StateMachineAI {
    public readonly MAX_SPEED: number = 200;
    public readonly MIN_SPEED: number = 100;

    /** Health and max health for the player */
    protected _health: number;
    protected _maxHealth: number;

    /** The players game node */
    protected owner: MBAnimatedSprite;

    protected _velocity: Vec2;
	protected _speed: number;

    protected tilemap: OrthogonalTilemap;
    protected weapon: PlayerWeapon;
    protected _isDead: boolean;
    protected _playerNumber: 1 | 2 = 1;
    protected _isLocalPlayer: boolean = true;

    public initializeAI(owner: MBAnimatedSprite, options: Record<string, any>){
        this.owner = owner;

        this._playerNumber = options.playerNumber === 2 ? 2 : 1;
        this._isLocalPlayer = options.isLocalPlayer ?? (FirebaseManager.state.mySlot === 0 ? true : FirebaseManager.state.mySlot === this._playerNumber);
        this.weapon = options.weaponSystem;

        this.tilemap = this.owner.getScene().getTilemap(options.tilemap) as OrthogonalTilemap;
        this.speed = 400;
        this.velocity = Vec2.ZERO;
        this.isDead = false;

        this.maxHealth = 1;
        this.health = 1;

        // Add the different states the player can be in to the PlayerController 
		this.addState(PlayerStates.IDLE, new Idle(this, this.owner));
		this.addState(PlayerStates.WALK, new Walk(this, this.owner));
        this.addState(PlayerStates.JUMP, new Jump(this, this.owner));
        this.addState(PlayerStates.FALL, new Fall(this, this.owner));
        this.addState(PlayerStates.DEAD, new Dead(this, this.owner));
        
        // Start the player in the Idle state
        this.initialize(PlayerStates.IDLE);
    }

    /**
     * Get the inputs from the keyboard, or Vec2.Zero if nothing is being pressed
     */
    public get inputDir(): Vec2 {
        let direction = Vec2.ZERO;
        if (this._isLocalPlayer) {
            direction.x = (Input.isPressed(MBControls.MOVE_LEFT) ? -1 : 0) + (Input.isPressed(MBControls.MOVE_RIGHT) ? 1 : 0);
            direction.y = (Input.isJustPressed(MBControls.JUMP) ? -1 : 0);
        } else if (FirebaseManager.state.mySlot === 0 && this._playerNumber === 2) {
            direction.x = (Input.isPressed(MBControls.P2_MOVE_LEFT) ? -1 : 0) + (Input.isPressed(MBControls.P2_MOVE_RIGHT) ? 1 : 0);
            direction.y = (Input.isJustPressed(MBControls.P2_JUMP) ? -1 : 0);
        }
        return direction;
    }

    /** Returns true the frame the jump key was first pressed for this player */
    public get jumpJustPressed(): boolean {
        if (this._isLocalPlayer) {
            return Input.isJustPressed(MBControls.JUMP);
        }
        return FirebaseManager.state.mySlot === 0 && this._playerNumber === 2
            ? Input.isJustPressed(MBControls.P2_JUMP)
            : false;
    }

    public get playerNumber(): 1 | 2 { return this._playerNumber; }
    public get isLocalPlayer(): boolean { return this._isLocalPlayer; }

    public update(deltaT: number): void {
        super.update(deltaT);

        if (this.isDead) {
            return;
        }

        const fired = this._isLocalPlayer
            ? (Input.isMouseJustPressed(0) || Input.isJustPressed(MBControls.ATTACK)) && this.weapon.tryFire(this.owner.position, this.owner.boundary.halfSize.x, this.owner.invertX)
            : FirebaseManager.state.mySlot === 0 && this._playerNumber === 2
                ? Input.isJustPressed(MBControls.P2_ATTACK) && this.weapon.tryFire(this.owner.position, this.owner.boundary.halfSize.x, this.owner.invertX)
                : false;

        if (fired) {
            this.owner.animation.play(PlayerAnimations.ATTACK, false);
        }
    }

    public get velocity(): Vec2 { return this._velocity; }
    public set velocity(velocity: Vec2) { this._velocity = velocity; }

    public get speed(): number { return this._speed; }
    public set speed(speed: number) { this._speed = speed; }

    public get isDead(): boolean { return this._isDead; }
    public set isDead(isDead: boolean) { this._isDead = isDead; }

    public get maxHealth(): number { return this._maxHealth; }
    public set maxHealth(maxHealth: number) {
        this._maxHealth = maxHealth;
        this.emitter.fireEvent(MBEvents.HEALTH_CHANGE, {curhp: this.health, maxhp: this.maxHealth, playerNum: this._playerNumber});
    }

    public get health(): number { return this._health; }
    public set health(health: number) {
        this._health = MathUtils.clamp(health, 0, this.maxHealth);
        this.emitter.fireEvent(MBEvents.HEALTH_CHANGE, {curhp: this.health, maxhp: this.maxHealth, playerNum: this._playerNumber});
        // If the health hit 0, change the state of the player
        if (this.health === 0 && !this.isDead) {
            this.isDead = true;
            this.changeState(PlayerStates.DEAD);
        }
    }

    public respawn(position: Vec2): void {
        this.isDead = false;
        this.velocity = Vec2.ZERO;
        this.owner.position.copy(position);
        this.owner.rotation = 0;
        this.owner.animation.stop();
        this.health = this.maxHealth;
        this.changeState(PlayerStates.IDLE);
    }
}
