import StateMachineAI from "../../Wolfie2D/AI/StateMachineAI";
import Vec2 from "../../Wolfie2D/DataTypes/Vec2";
import OrthogonalTilemap from "../../Wolfie2D/Nodes/Tilemaps/OrthogonalTilemap";

import Fall from "./PlayerStates/Fall";
import Idle from "./PlayerStates/Idle";
import Jump from "./PlayerStates/Jump";
import Walk from "./PlayerStates/Walk";

import PlayerWeapon from "./PlayerWeapon";
import Input from "../../Wolfie2D/Input/Input";
import { GameEventType } from "../../Wolfie2D/Events/GameEventType";

import { MBControls } from "../MBControls";
import MBAnimatedSprite from "../Nodes/MBAnimatedSprite";
import MathUtils from "../../Wolfie2D/Utils/MathUtils";
import { MBEvents } from "../MBEvents";
import Dead from "./PlayerStates/Dead";
import FirebaseManager from "../Firebase/FirebaseManager";
import { SpellType } from "../Spells/SpellTypes";

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
    public readonly MAX_SPEED: number = 280;
    public readonly MIN_SPEED: number = 160;

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
    protected _currentSpell: SpellType | null;

    // Remote input state — fed by MBLevel when P2P packets arrive
    private _remoteLeft: boolean = false;
    private _remoteRight: boolean = false;
    private _remoteJump: boolean = false;     // consumed after one read
    private _remoteAttack: boolean = false;   // consumed after one read
    public remoteMirrorAngle: number = 0;
    // Current aim direction — Jump state overrides this with wobble; defaults to horizontal
    public aimDirection: Vec2 = new Vec2(1, 0);
    // The spell type used in the most recent fire — valid for one frame so the STATE packet can read it
    public lastFiredSpell: SpellType | null = null;

    public initializeAI(owner: MBAnimatedSprite, options: Record<string, any>){
        this.owner = owner;

        this._playerNumber = options.playerNumber === 2 ? 2 : 1;
        this._isLocalPlayer = options.isLocalPlayer ?? (FirebaseManager.state.mySlot === 0 ? true : FirebaseManager.state.mySlot === this._playerNumber);
        this.weapon = options.weaponSystem;

        this.tilemap = this.owner.getScene().getTilemap(options.tilemap) as OrthogonalTilemap;
        this.speed = 400;
        this.velocity = Vec2.ZERO;
        this.isDead = false;
        this._currentSpell = null;

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

    /** Inject a received network input for a remote player (called by MBLevel each frame). */
    public setRemoteInput(left: boolean, right: boolean, jump: boolean, attack: boolean): void {
        this._remoteLeft  = left;
        this._remoteRight = right;
        if (jump)   this._remoteJump   = true;
        if (attack) this._remoteAttack = true;
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
            // Local co-op / dev mode: P2 uses alternate keys
            direction.x = (Input.isPressed(MBControls.P2_MOVE_LEFT) ? -1 : 0) + (Input.isPressed(MBControls.P2_MOVE_RIGHT) ? 1 : 0);
            direction.y = (Input.isJustPressed(MBControls.P2_JUMP) ? -1 : 0);
        } else {
            // Remote player: use received network inputs
            direction.x = (this._remoteLeft ? -1 : 0) + (this._remoteRight ? 1 : 0);
            if (this._remoteJump) {
                direction.y = -1;
                this._remoteJump = false;
            }
        }
        return direction;
    }

    /** Returns true the frame the jump key was first pressed for this player */
    public get jumpJustPressed(): boolean {
        if (this._isLocalPlayer) {
            return Input.isJustPressed(MBControls.JUMP);
        }
        if (FirebaseManager.state.mySlot === 0 && this._playerNumber === 2) {
            return Input.isJustPressed(MBControls.P2_JUMP);
        }
        // Remote: consume the one-shot flag
        if (this._remoteJump) {
            this._remoteJump = false;
            return true;
        }
        return false;
    }

    /** True when the remote player fired their weapon this frame (one-shot). */
    public consumeRemoteAttack(): boolean {
        if (this._remoteAttack) {
            this._remoteAttack = false;
            return true;
        }
        return false;
    }

    public get playerNumber(): 1 | 2 { return this._playerNumber; }
    public get isLocalPlayer(): boolean { return this._isLocalPlayer; }
    public get currentSpell(): SpellType | null { return this._currentSpell; }

    public update(deltaT: number): void {
        // Default aim: horizontal from facing direction. Jump state overrides this with wobble.
        this.aimDirection = new Vec2(this.owner.invertX ? -1 : 1, 0);
        this.lastFiredSpell = null; // Reset each frame; set below when firing

        super.update(deltaT);

        if (this.isDead) {
            return;
        }

        let fired = false;
        if (this._isLocalPlayer) {
            fired = (Input.isMouseJustPressed(0) || Input.isJustPressed(MBControls.ATTACK))
                && this.weapon.tryFire(this.owner.position, this.owner.boundary.halfSize.x, this.aimDirection, this.currentSpell);
        } else if (FirebaseManager.state.mySlot === 0 && this._playerNumber === 2) {
            // Local co-op / dev mode — P2 also gets wobble aim from aimDirection
            fired = Input.isJustPressed(MBControls.P2_ATTACK)
                && this.weapon.tryFire(this.owner.position, this.owner.boundary.halfSize.x, this.aimDirection, this.currentSpell);
        } else if (this.consumeRemoteAttack()) {
            // Remote player — replicate with horizontal direction (we don't have their wobble angle)
            fired = this.weapon.tryFire(this.owner.position, this.owner.boundary.halfSize.x, new Vec2(this.owner.invertX ? -1 : 1, 0), this.currentSpell);
        }

        if (fired) {
            this.lastFiredSpell = this._currentSpell; // Capture before clearing for the STATE packet
            this._currentSpell = null; // Each spell is single-use — must pick up another
            this.emitter.fireEvent(GameEventType.PLAY_SOUND, {
                key: PlayerWeapon.PROJECTILE_SHOOT_AUDIO_KEY,
                loop: false,
                holdReference: false,
                volume: 0.5
            });
            this.owner.animation.play(PlayerAnimations.ATTACK, false);
        }
    }

    public get velocity(): Vec2 { return this._velocity; }
    public set velocity(velocity: Vec2) { this._velocity = velocity; }

    public get speed(): number { return this._speed; }
    public set speed(speed: number) { this._speed = speed; }

    public equipSpell(spell: SpellType): void {
        this._currentSpell = spell;
    }

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
        this._currentSpell = null;
        this.owner.position.copy(position);
        this.owner.rotation = 0;
        this.owner.animation.stop();
        this.health = this.maxHealth;
        this.changeState(PlayerStates.IDLE);
    }
}
