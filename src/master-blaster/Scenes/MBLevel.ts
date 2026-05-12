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
import PlayerController, { PlayerAnimations, PlayerTweens } from "../Player/PlayerController";
import PlayerWeapon, { ProjectileData } from "../Player/PlayerWeapon";

import { MBEvents } from "../MBEvents";
import { MBControls } from "../MBControls";
import { MBPhysicsGroups } from "../MBPhysicsGroups";
import MBFactoryManager from "../Factory/MBFactoryManager";
import MainMenu from "./MainMenu";
import AudioManager, { AudioChannelType } from "../../Wolfie2D/Sound/AudioManager";
import Sprite from "../../Wolfie2D/Nodes/Sprites/Sprite";
import { isDevTestingMode, isLocalCoopTestingMode } from "../config/RuntimeMode";
import { consumeMirrorDurability, getHitMirrorOwner } from "../Spells/MirrorSpellUtils";
import P2PManager from "../Network/P2PManager";
import { PacketType, EventId, StatePacket, decodeState, encodeState, encodeEvent, decodeEvent, encodeSpellType, decodeSpellType } from "../Network/NetPacket";
import { SpellSpecs, SpellType } from "../Spells/SpellTypes";

type SpellPowerup = {
    sprite: Sprite;
    spellType: SpellType;
    spawnPosition: Vec2;
};

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
    public static readonly MIRROR_SPRITE_KEY = "PLAYER_MIRROR";
    public static readonly MIRROR_SPRITE_PATH = "game_assets/spritesheets/mirror temp.png";
    public static readonly STOCK_ICON_P1_KEY = "STOCK_ICON_P1";
    public static readonly STOCK_ICON_P1_PATH = "game_assets/ui/Life (1) transparent 256x256.png";
    public static readonly STOCK_ICON_P2_KEY = "STOCK_ICON_P2";
    public static readonly STOCK_ICON_P2_PATH = "game_assets/ui/Life (2) transparent 256x256.png";
    protected static readonly MIRROR_SCALE = 2;
    protected static readonly MIRROR_PADDING = 10;
    protected static readonly MIRROR_HITS_TO_BREAK = 3;
    protected static readonly STOCK_COUNT = 3;
    protected static readonly STOCK_ICON_SCALE = 0.125;
    protected static readonly STOCK_ICON_START_P1 = new Vec2(24, 24);
    protected static readonly STOCK_ICON_START_P2 = new Vec2(1104, 24);
    protected static readonly STOCK_ICON_SPACING = 36;
    protected static readonly POWERUP_MAX_ACTIVE = 3;
    protected static readonly POWERUP_RESPAWN_INTERVAL = 15;
    protected static readonly POWERUP_SCALE = 0.12;
    protected static readonly POWERUP_PLATFORM_Y_OFFSET = 16;
    protected static readonly POWERUP_TYPES = [SpellType.FIRE, SpellType.ICE, SpellType.LIGHTNING];
    protected static readonly FALL_DEATH_BLOCKS_BELOW_VIEW = 10;

    /** Overrride the factory manager */
    public add: MBFactoryManager;

    /** The particle system used for the player's weapon */
    protected playerWeaponSystem!: PlayerWeapon;
    protected player2WeaponSystem!: PlayerWeapon;
    /** The key for the player's animated sprite */
    protected playerSpriteKey!: string;
    /** The key for player two's animated sprite */
    protected player2SpriteKey!: string;
    /** The animated sprites for both players */
    protected player!: AnimatedSprite;
    protected player2!: AnimatedSprite;
    /** Spawn positions */
    protected playerSpawn!: Vec2;
    protected player2Spawn!: Vec2;
    /** Arc mirrors orbiting each player */
    protected mirror!: Sprite;
    protected mirror2!: Sprite;
    protected mirrorDirection: Vec2 = Vec2.RIGHT;
    protected mirror2Direction: Vec2 = Vec2.RIGHT;
    protected mirrorHitsRemaining: number = MBLevel.MIRROR_HITS_TO_BREAK;
    protected mirror2HitsRemaining: number = MBLevel.MIRROR_HITS_TO_BREAK;

    /** Stock/life system */
    protected stockIcons!: Array<Sprite>;
    protected stocksRemaining: number = 0;
    protected stockIcons2!: Array<Sprite>;
    protected stocksRemaining2: number = 0;
    protected respawnPosition!: Vec2;
    protected player2RespawnPosition!: Vec2;
    protected networkPublishCooldown: number = 0;
    protected lastRemotePlayer1Position: Vec2;
    protected lastRemotePlayer2Position: Vec2;
    protected readonly devTestingMode: boolean;
    protected readonly localCoopTestingMode: boolean;

    // Latest state packets received from the remote peer via WebRTC
    protected remoteStateP1: StatePacket | null = null;
    protected remoteStateP2: StatePacket | null = null;

    /** The end of level stuff */

    protected levelEndPosition!: Vec2;
    protected levelEndHalfSize!: Vec2;

    protected levelEndArea!: Rect;
    protected nextLevel!: new (...args: any) => Scene;
    protected levelEndTimer!: Timer;
    protected levelEndLabel!: Label;

    // Level end transition timer and graphic
    protected levelTransitionTimer!: Timer;
    protected levelTransitionScreen!: Rect;

    /** The keys to the tilemap and different tilemap layers */
    protected tilemapKey!: string;
    protected destructibleLayerKey!: string;
    protected wallsLayerKey!: string;
    /** The scale for the tilemap */
    protected tilemapScale!: Vec2;
    /** The destrubtable layer of the tilemap */
    protected destructable!: OrthogonalTilemap;
    /** The wall layer of the tilemap */
    protected walls!: OrthogonalTilemap;

    protected powerupSpawnPoints: Array<Vec2> = [];
    protected activePowerups: Array<SpellPowerup> = [];
    protected powerupRespawnTimer: number = MBLevel.POWERUP_RESPAWN_INTERVAL;
    protected powerupResyncTimer: number = 3; // P1 rebroadcasts all active powerup positions every 3s

    /** Sound and music */
    protected levelMusicKey!: string;
    protected levelMusicVolume: number = 1;
    protected jumpAudioKey!: string;
    protected tileDestroyedAudioKey!: string;
    protected deathAudioKey!: string;

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
        this.stocksRemaining = MBLevel.STOCK_COUNT;
        this.stocksRemaining2 = MBLevel.STOCK_COUNT;
        this.lastRemotePlayer1Position = Vec2.ZERO;
        this.lastRemotePlayer2Position = Vec2.ZERO;
        this.devTestingMode = isDevTestingMode();
        this.localCoopTestingMode = isLocalCoopTestingMode();
    }

    public startScene(): void {
        // Initialize the layers
        this.initLayers();

        // Initialize the tilemaps
        this.initializeTilemap();

        // Initialize weapon systems
        this.initializeWeaponSystem();
        this.initializeWeaponSystem2();

        this.initializeUI();

        // Initialize players and mirrors
        this.initializePlayer(this.playerSpriteKey);
        this.initializeMirror();
        if ((this.localCoopTestingMode || !this.devTestingMode) && this.player2Spawn !== undefined) {
            this.initializePlayer2(this.player2SpriteKey);
            this.initializeMirror2();
        }

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

        // Wire up P2P message handler (connection established in LobbyScene)
        if (!this.devTestingMode && !this.localCoopTestingMode && P2PManager.mySlot !== 0) {
            P2PManager.onMessage((data: ArrayBuffer) => this._handleNetPacket(data));
        }

        AudioManager.setVolume(AudioChannelType.MUSIC, this.levelMusicVolume);
        // Start playing the level music for the game level
        this.emitter.fireEvent(GameEventType.PLAY_SOUND, {key: this.levelMusicKey, loop: true, holdReference: true, channel: AudioChannelType.MUSIC});
    }

    /* Update method for the scene */

    public updateScene(deltaT: number) {
        this.updateMirrorPosition();
        this.playerWeaponSystem.update(deltaT);
        this.updateWeaponProjectiles(this.playerWeaponSystem, 1);

        if (this.player2 !== undefined) {
            this.updateMirror2Position();
            this.player2WeaponSystem.update(deltaT);
            this.updateWeaponProjectiles(this.player2WeaponSystem, 2);
        }

        this.updateFallDeaths();
        this.updatePowerups(deltaT);
        this.syncMultiplayerState(deltaT);

        // Handle all game events
        while (this.receiver.hasNextEvent()) {
            this.handleEvent(this.receiver.getNextEvent());
        }
    }

    protected updateFallDeaths(): void {
        const killY = this.getFallDeathY();

        if (this.player !== undefined && this.player.boundary.top > killY) {
            this.playDeathSound();
            this.handlePlayerDeath(1);
        }

        if (this.player2 !== undefined && this.player2.boundary.top > killY) {
            this.playDeathSound();
            this.handlePlayerDeath(2);
        }
    }

    protected playDeathSound(): void {
        this.emitter.fireEvent(GameEventType.PLAY_SOUND, {key: this.deathAudioKey, loop: false, holdReference: false});
    }

    protected getFallDeathY(): number {
        const view = this.viewport.getView();
        const tileHeight = this.walls !== undefined
            ? this.walls.getTileSize().y
            : 32;

        return view.bottom + tileHeight * MBLevel.FALL_DEATH_BLOCKS_BELOW_VIEW;
    }

    protected initializePowerups(): void {
        this.powerupSpawnPoints = this.generatePlatformPowerupSpawnPoints();
        this.activePowerups = [];
        this.powerupRespawnTimer = MBLevel.POWERUP_RESPAWN_INTERVAL;

        for (let i = 0; i < MBLevel.POWERUP_MAX_ACTIVE; i++) {
            this.spawnRandomPowerup();
        }
    }

    protected updatePowerups(deltaT: number): void {
        const isOnline = !this.devTestingMode && !this.localCoopTestingMode && P2PManager.mySlot !== 0;

        for (let i = this.activePowerups.length - 1; i >= 0; i--) {
            const powerup = this.activePowerups[i];

            let pickedUpPlayer: 1 | 2 | null = null;
            if (isOnline) {
                // Online: only the local player can pick up on their machine
                const localPlayer = P2PManager.mySlot === 1 ? this.player : this.player2;
                if (localPlayer !== undefined && powerup.sprite.boundary.overlapArea(localPlayer.boundary) > 0) {
                    pickedUpPlayer = P2PManager.mySlot as 1 | 2;
                }
            } else {
                // Local: either player can pick up
                if (this.player !== undefined && powerup.sprite.boundary.overlapArea(this.player.boundary) > 0) {
                    pickedUpPlayer = 1;
                } else if (this.player2 !== undefined && powerup.sprite.boundary.overlapArea(this.player2.boundary) > 0) {
                    pickedUpPlayer = 2;
                }
            }

            if (pickedUpPlayer === null) continue;

            const playerSprite = pickedUpPlayer === 1 ? this.player : this.player2;
            if (playerSprite !== undefined && playerSprite.ai) {
                (playerSprite.ai as PlayerController).equipSpell(powerup.spellType);
            }

            // Find spawn index so the peer can remove the same powerup
            const spawnIdx = this.powerupSpawnPoints.findIndex(p =>
                p.distanceSqTo(powerup.spawnPosition) < 1
            );
            powerup.sprite.destroy();
            this.activePowerups.splice(i, 1);

            // Tell the peer to remove this powerup
            if (isOnline && spawnIdx >= 0) {
                this._sendPowerupRemove(spawnIdx);
            }
        }

        // P2 waits for P1's spawn packets — don't run the respawn timer on P2
        if (isOnline && P2PManager.mySlot !== 1) return;

        // Periodic resync: re-broadcast all active powerups so P2 never misses them
        this.powerupResyncTimer -= deltaT;
        if (this.powerupResyncTimer <= 0 && isOnline && P2PManager.isConnected) {
            this.powerupResyncTimer = 5;
            for (const pu of this.activePowerups) {
                const idx = this.powerupSpawnPoints.findIndex(p => p.distanceSqTo(pu.spawnPosition) < 1);
                if (idx >= 0) this._sendPowerupSpawn(idx, pu.spellType);
            }
        }

        if (this.activePowerups.length >= MBLevel.POWERUP_MAX_ACTIVE) {
            this.powerupRespawnTimer = MBLevel.POWERUP_RESPAWN_INTERVAL;
            return;
        }

        this.powerupRespawnTimer -= deltaT;
        if (this.powerupRespawnTimer <= 0) {
            this.spawnRandomPowerup();
            this.powerupRespawnTimer = MBLevel.POWERUP_RESPAWN_INTERVAL;
        }
    }

    protected generatePlatformPowerupSpawnPoints(): Array<Vec2> {
        if (this.walls === undefined) {
            return [];
        }

        const spawnPoints: Array<Vec2> = [];
        const dimensions = this.walls.getDimensions();
        const tileSize = this.walls.getTileSize();

        for (let row = 1; row < dimensions.y; row++) {
            for (let col = 0; col < dimensions.x; col++) {
                const hasFloor = this.walls.isTileCollidable(col, row);
                const hasAirAbove = !this.walls.isTileCollidable(col, row - 1);
                const hasHeadroom = row < 2 || !this.walls.isTileCollidable(col, row - 2);

                if (hasFloor && hasAirAbove && hasHeadroom) {
                    spawnPoints.push(new Vec2(
                        col * tileSize.x + tileSize.x / 2,
                        row * tileSize.y - MBLevel.POWERUP_PLATFORM_Y_OFFSET
                    ));
                }
            }
        }

        return spawnPoints;
    }

    protected spawnRandomPowerup(): boolean {
        const isOnline = !this.devTestingMode && !this.localCoopTestingMode && P2PManager.mySlot !== 0;
        // P2 never spawns independently — waits for P1's POWERUP_SPAWN packets
        if (isOnline && P2PManager.mySlot !== 1) return false;

        const availableSpawnPoints = this.powerupSpawnPoints.filter(point =>
            this.activePowerups.every(powerup => powerup.spawnPosition.distanceSqTo(point) > 1)
        );
        if (availableSpawnPoints.length === 0) return false;

        const availableSpellTypes = MBLevel.POWERUP_TYPES.filter(spellType =>
            this.activePowerups.every(powerup => powerup.spellType !== spellType)
        );
        if (availableSpellTypes.length === 0) return false;

        const spellType = availableSpellTypes[Math.floor(Math.random() * availableSpellTypes.length)];
        const spriteKey = SpellSpecs[spellType].pickupSpriteKey;
        if (spriteKey === undefined) return false;

        const spawnPosition = availableSpawnPoints[Math.floor(Math.random() * availableSpawnPoints.length)];

        // Broadcast to P2 before spawning locally so both screens stay in sync
        if (isOnline) {
            const spawnIdx = this.powerupSpawnPoints.findIndex(p => p.distanceSqTo(spawnPosition) < 1);
            if (spawnIdx >= 0) this._sendPowerupSpawn(spawnIdx, spellType);
        }

        return this._spawnPowerupAt(spawnPosition, spellType);
    }

    private _spawnPowerupAt(spawnPosition: Vec2, spellType: SpellType): boolean {
        const spriteKey = SpellSpecs[spellType].pickupSpriteKey;
        if (spriteKey === undefined) return false;
        const sprite = this.add.sprite(spriteKey, MBLayers.PRIMARY);
        sprite.scale.set(MBLevel.POWERUP_SCALE, MBLevel.POWERUP_SCALE);
        sprite.position.copy(spawnPosition);
        this.activePowerups.push({ sprite, spellType, spawnPosition: spawnPosition.clone() });
        return true;
    }

    /** Send a 0xf6 packet so the peer spawns the projectile directly. */
    private _sendSpellFiredPacket(playerNum: 1 | 2, spellType: SpellType, pos: Vec2, dir: Vec2): void {
        if (!P2PManager.isConnected) return;
        const buf = new ArrayBuffer(19);
        const v = new DataView(buf);
        v.setUint8(0, 0xf6);
        v.setUint8(1, playerNum);
        v.setUint8(2, encodeSpellType(spellType));
        v.setFloat32(3,  pos.x, true);
        v.setFloat32(7,  pos.y, true);
        v.setFloat32(11, dir.x, true);
        v.setFloat32(15, dir.y, true);
        P2PManager.send(buf);
    }

    private _sendPowerupSpawn(spawnIdx: number, spellType: SpellType): void {
        if (!P2PManager.isConnected) return;
        const buf = new ArrayBuffer(4);
        const v = new DataView(buf);
        v.setUint8(0, 0xf8);
        v.setUint16(1, spawnIdx, true);
        v.setUint8(3, encodeSpellType(spellType));
        P2PManager.send(buf);
    }

    private _sendPowerupRemove(spawnIdx: number): void {
        if (!P2PManager.isConnected) return;
        const buf = new ArrayBuffer(3);
        const v = new DataView(buf);
        v.setUint8(0, 0xf7);
        v.setUint16(1, spawnIdx, true);
        P2PManager.send(buf);
    }

    private _handlePowerupSpawn(spawnIdx: number, spellType: SpellType): void {
        if (spawnIdx >= this.powerupSpawnPoints.length) return;
        const pos = this.powerupSpawnPoints[spawnIdx];
        // Dedup: ignore if a powerup already exists at this position (e.g. resend after LEVEL_START)
        if (this.activePowerups.some(p => p.spawnPosition.distanceSqTo(pos) < 1)) return;
        this._spawnPowerupAt(pos, spellType);
    }

    private _handlePowerupRemove(spawnIdx: number): void {
        if (spawnIdx >= this.powerupSpawnPoints.length) return;
        const pos = this.powerupSpawnPoints[spawnIdx];
        const idx = this.activePowerups.findIndex(p => p.spawnPosition.distanceSqTo(pos) < 1);
        if (idx >= 0) {
            this.activePowerups[idx].sprite.destroy();
            this.activePowerups.splice(idx, 1);
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
                // P1 re-broadcasts active powerups so P2 receives them after its
                // onMessage handler is registered (avoids the race at scene start)
                if (!this.devTestingMode && !this.localCoopTestingMode && P2PManager.mySlot === 1 && P2PManager.isConnected) {
                    for (const pu of this.activePowerups) {
                        const spawnIdx = this.powerupSpawnPoints.findIndex(p => p.distanceSqTo(pu.spawnPosition) < 1);
                        if (spawnIdx >= 0) this._sendPowerupSpawn(spawnIdx, pu.spellType);
                    }
                }
                break;
            }
            // When the level ends, change the scene to the next level
            case MBEvents.LEVEL_END: {
                this.sceneManager.changeToScene(this.nextLevel);
                break;
            }
            case MBEvents.PLAYER_DEAD: {
                this.handlePlayerDeath(event.data.get("playerNum") ?? 1);
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
     * Handle projectile hit events
     * @param projectileId the id of the projectile
     */
    protected updateWeaponProjectiles(weaponSystem: PlayerWeapon, ownerPlayerNum: 1 | 2): void {
        const isOnline = !this.devTestingMode && !this.localCoopTestingMode && P2PManager.mySlot !== 0;

        for (const projectile of weaponSystem.getProjectiles()) {
            if (!projectile.active) {
                continue;
            }

            // Send dedicated SPELL_FIRED packet the frame a local projectile is spawned
            if (isOnline && ownerPlayerNum === P2PManager.mySlot && projectile.firedThisFrame) {
                this._sendSpellFiredPacket(ownerPlayerNum, projectile.spellType,
                    projectile.sprite.position, projectile.direction);
            }

            // Deactivate once off-screen
            if (this.isProjectileOffScreen(projectile.sprite.position)) {
                weaponSystem.deactivateById(projectile.sprite.id);
                continue;
            }

            const projectileOwnerPlayerNum = projectile.reflectedOwnerPlayerNum ?? ownerPlayerNum;
            const hitMirrorPlayer = this.getMirrorHitPlayer(projectile.sprite, projectileOwnerPlayerNum);
            if (hitMirrorPlayer !== null) {
                this.damageMirror(hitMirrorPlayer);
                this.sendNetEvent(EventId.MIRROR_HIT, hitMirrorPlayer);
                weaponSystem.reflectById(projectile.sprite.id, hitMirrorPlayer);
                continue;
            }

            const hitPlayer = this.getHitPlayer(projectile.sprite, projectileOwnerPlayerNum);
            if (hitPlayer !== null) {
                this.damagePlayer(hitPlayer);
                weaponSystem.deactivateById(projectile.sprite.id);
                continue;
            }

            if (projectile.sprite.collidedWithTilemap) {
                this.handleProjectileTileHit(weaponSystem, projectile);
            }
        }
    }

    protected isProjectileOffScreen(position: Vec2): boolean {
        const view = this.viewport.getView();
        const margin = 80;
        return position.x < view.left - margin || position.x > view.right + margin ||
               position.y < view.top - margin || position.y > view.bottom + margin;
    }

    protected handleProjectileTileHit(weaponSystem: PlayerWeapon, projectile: Readonly<ProjectileData>): void {
        // Try to destroy a destructible tile on contact
        const sprite = projectile.sprite;
        const min = new Vec2(sprite.sweptRect.left, sprite.sweptRect.top);
        const max = new Vec2(sprite.sweptRect.right, sprite.sweptRect.bottom);
        const minIndex = this.destructable.getColRowAt(min);
        const maxIndex = this.destructable.getColRowAt(max);

        for (let col = minIndex.x; col <= maxIndex.x; col++) {
            for (let row = minIndex.y; row <= maxIndex.y; row++) {
                if (this.destructable.isTileCollidable(col, row) && this.projectileHitTile(this.destructable, sprite, col, row)) {
                    this.emitter.fireEvent(GameEventType.PLAY_SOUND, { key: this.tileDestroyedAudioKey, loop: false, holdReference: false });
                    this.destructable.setTileAtRowCol(new Vec2(col, row), 0);
                    break;
                }
            }
        }

        // Bounce with chaotic angle instead of deactivating
        const dir = projectile.direction;
        let newDir: Vec2;
        if (Math.abs(dir.x) >= Math.abs(dir.y)) {
            // Vertical wall — guaranteed to send away from wall, wild Y component
            newDir = new Vec2(
                -Math.sign(dir.x) * (0.4 + Math.random() * 0.6),
                (Math.random() - 0.5) * 2.2
            );
        } else {
            // Floor or ceiling — guaranteed to send away from surface, wild X component
            newDir = new Vec2(
                (Math.random() - 0.5) * 2.2,
                -Math.sign(dir.y) * (0.4 + Math.random() * 0.6)
            );
        }
        const len = Math.sqrt(newDir.x * newDir.x + newDir.y * newDir.y);
        weaponSystem.setBounceDirection(projectile.sprite.id, newDir.scaled(1 / len));
    }

    /**
     * Checks if a projectile hit the tile at the (col, row) coordinates in the tilemap.
     */
    protected projectileHitTile(tilemap: OrthogonalTilemap, projectile: Sprite, col: number, row: number): boolean {
        const tileSize = tilemap.getTileSize();
        const tileCenter = new Vec2(col * tileSize.x + tileSize.x/2, row * tileSize.y + tileSize.y/2);
        const tileCollider = new AABB(tileCenter, tileSize.scaled(1/2));
        return projectile.sweptRect.overlapArea(tileCollider) > 0;
    }

    /**
     * Handle the event when the player enters the level end area.
     */
    protected handleEnteredLevelEnd(): void {
        // If the timer hasn't run yet, start the end level animation
        if (!this.levelEndTimer.hasRun() && this.levelEndTimer.isStopped()) {
            this.levelEndLabel.visible = true;
            this.levelEndTimer.start();
            this.levelEndLabel.tweens.play("slideIn");
        }
    }

    /**
     * Handle a player death — decrement that player's stocks and respawn,
     * or go to MainMenu if they've run out.
     */
    protected handlePlayerDeath(playerNum: 1 | 2 = 1): void {
        const isOnline = !this.devTestingMode && !this.localCoopTestingMode && P2PManager.mySlot !== 0;
        // In online mode, only the owning client decrements stocks and broadcasts the respawn
        const isAuthority = !isOnline || P2PManager.mySlot === playerNum;

        if (playerNum === 2 && this.player2 !== undefined) {
            const pc = this.player2.ai as PlayerController;
            const respawnTarget = this.getRespawnPosition(2);
            if (isAuthority) {
                this.stocksRemaining2 -= 1;
                this.updateStockDisplay();
                if (this.stocksRemaining2 <= 0) {
                    this.sceneManager.changeToScene(MainMenu);
                    return;
                }
                // Tell peer: P2 died and respawned here (peer decrements their stock display)
                this.sendNetEvent(EventId.PLAYER_RESPAWN, 2, respawnTarget.x, respawnTarget.y);
            }
            pc.respawn(respawnTarget);
            this.restoreMirror(2);
            this.updateMirror2Position();
        } else {
            const pc = this.player.ai as PlayerController;
            const respawnTarget = this.getRespawnPosition(1);
            if (isAuthority) {
                this.stocksRemaining -= 1;
                this.updateStockDisplay();
                if (this.stocksRemaining <= 0) {
                    this.sceneManager.changeToScene(MainMenu);
                    return;
                }
                this.sendNetEvent(EventId.PLAYER_RESPAWN, 1, respawnTarget.x, respawnTarget.y);
            }
            pc.respawn(respawnTarget);
            this.restoreMirror(1);
            this.updateMirrorPosition();
        }
        Input.enableInput();
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
        this.receiver.subscribe(MBEvents.PLAYER_DEAD);
    }
    /**
     * Adds in any necessary UI to the game
     */
    protected initializeUI(): void {
        this.initializeStocks();

        // End of level label (start off screen)
        this.levelEndLabel = <Label>this.add.uiElement(UIElementType.LABEL, MBLayers.UI, { position: new Vec2(-300, 100), text: "Level Complete" });
        this.levelEndLabel.size.set(1200, 60);
        this.levelEndLabel.borderRadius = 0;
        this.levelEndLabel.backgroundColor = new Color(34, 32, 52);
        this.levelEndLabel.textColor = Color.WHITE;
        this.levelEndLabel.fontSize = 48;
        this.levelEndLabel.font = "PixelSimple";
        this.levelEndLabel.visible = false;

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
    protected initializeWeaponSystem(): void {
        this.playerWeaponSystem = new PlayerWeapon();
        this.playerWeaponSystem.initializePool(this, MBLayers.PRIMARY);
        for (const projectile of this.playerWeaponSystem.getProjectiles()) {
            projectile.sprite.setGroup(MBPhysicsGroups.PLAYER_WEAPON);
        }
    }

    protected initializeWeaponSystem2(): void {
        this.player2WeaponSystem = new PlayerWeapon();
        this.player2WeaponSystem.initializePool(this, MBLayers.PRIMARY);
        for (const projectile of this.player2WeaponSystem.getProjectiles()) {
            projectile.sprite.setGroup(MBPhysicsGroups.PLAYER_WEAPON);
        }
    }
    /**
     * Initializes the player, setting the player's initial position to the given position.
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
        const scale = targetSize / this.player.size.y;
        this.player.scale.set(scale, scale);
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
            tilemap: "Destructable",
            isLocalPlayer: P2PManager.mySlot === 0 || P2PManager.mySlot === 1
        });
        if (!(this.player.ai as PlayerController).isLocalPlayer) {
            this.player.setAIActive(false, {});
        }

    }
    protected initializeViewport(): void {
        // Fixed viewport showing the full arena — no camera follow for 2-player same-screen
        this.viewport.setZoomLevel(1);
        this.viewport.setBounds(0, 0, 1200, 800);
        this.viewport.setFocus(new Vec2(256, 256));
    }

    protected initializeMirror(): void {
        this.mirror = this.add.sprite(MBLevel.MIRROR_SPRITE_KEY, MBLayers.PRIMARY);
        this.mirror.scale.set(MBLevel.MIRROR_SCALE, MBLevel.MIRROR_SCALE);
        this.restoreMirror(1);
        this.updateMirrorPosition();
    }

    protected initializeMirror2(): void {
        this.mirror2 = this.add.sprite(MBLevel.MIRROR_SPRITE_KEY, MBLayers.PRIMARY);
        this.mirror2.scale.set(MBLevel.MIRROR_SCALE, MBLevel.MIRROR_SCALE);
        this.restoreMirror(2);
        this.updateMirror2Position();
    }

    protected initializeStocks(): void {
        // P1 stocks — top-left
        this.stockIcons = [];
        for (let i = 0; i < MBLevel.STOCK_COUNT; i++) {
            const icon = this.add.sprite(MBLevel.STOCK_ICON_P1_KEY, MBLayers.UI);
            icon.scale.set(MBLevel.STOCK_ICON_SCALE, MBLevel.STOCK_ICON_SCALE);
            icon.position.copy(new Vec2(
                MBLevel.STOCK_ICON_START_P1.x + i * MBLevel.STOCK_ICON_SPACING,
                MBLevel.STOCK_ICON_START_P1.y
            ));
            this.stockIcons.push(icon);
        }

        // P2 stocks — top-right (icons go right-to-left so the rightmost is lost first)
        this.stockIcons2 = [];
        if (this.devTestingMode) {
            return;
        }

        for (let i = 0; i < MBLevel.STOCK_COUNT; i++) {
            const icon = this.add.sprite(MBLevel.STOCK_ICON_P2_KEY, MBLayers.UI);
            icon.scale.set(MBLevel.STOCK_ICON_SCALE, MBLevel.STOCK_ICON_SCALE);
            icon.position.copy(new Vec2(
                MBLevel.STOCK_ICON_START_P2.x - i * MBLevel.STOCK_ICON_SPACING,
                MBLevel.STOCK_ICON_START_P2.y
            ));
            this.stockIcons2.push(icon);
        }

        this.updateStockDisplay();
    }

    protected updateStockDisplay(): void {
        for (let i = 0; i < this.stockIcons.length; i++) {
            this.stockIcons[i].visible = i < this.stocksRemaining;
        }
        for (let i = 0; i < this.stockIcons2.length; i++) {
            this.stockIcons2[i].visible = i < this.stocksRemaining2;
        }
    }

    protected updateMirrorPosition(): void {
        if (this.player === undefined || this.mirror === undefined) return;
        if (!this.isMirrorActive(1)) {
            this.mirror.visible = false;
            return;
        }

        this.mirror.visible = true;
        const playerController = this.player.ai as PlayerController;
        if (this.localCoopTestingMode) {
            this.mirrorDirection = new Vec2(this.player.invertX ? -1 : 1, 0);
        } else if (playerController.isLocalPlayer) {
            const mousePosition = Input.getGlobalMousePosition();
            const mouseDirection = this.player.position.dirTo(mousePosition);
            if (!mouseDirection.isZero()) {
                this.mirrorDirection = mouseDirection;
            }
        } else if (P2PManager.isConnected) {
            const angle = playerController.remoteMirrorAngle;
            this.mirrorDirection = new Vec2(Math.cos(angle), Math.sin(angle));
        } else {
            this.mirrorDirection = new Vec2(this.player.invertX ? -1 : 1, 0);
        }
        const orbitRadius = this.player.boundary.halfSize.x + this.mirror.boundary.halfSize.x + MBLevel.MIRROR_PADDING;
        this.mirror.position.copy(this.player.position.clone().add(this.mirrorDirection.scaled(orbitRadius)));
        this.mirror.rotation = Math.atan2(-this.mirrorDirection.y, this.mirrorDirection.x);
    }

    protected updateMirror2Position(): void {
        if (this.player2 === undefined || this.mirror2 === undefined) return;
        if (!this.isMirrorActive(2)) {
            this.mirror2.visible = false;
            return;
        }

        this.mirror2.visible = true;
        const player2Controller = this.player2.ai as PlayerController;
        // Use mySlot to determine authority — more reliable than isLocalPlayer at scene init time
        const p2IsLocal = P2PManager.mySlot === 2 || P2PManager.mySlot === 0;

        if (this.localCoopTestingMode) {
            this.mirror2Direction = new Vec2(this.player2.invertX ? -1 : 1, 0);
        } else if (p2IsLocal) {
            const mousePosition = Input.getGlobalMousePosition();
            const mouseDirection = this.player2.position.dirTo(mousePosition);
            if (!mouseDirection.isZero()) {
                this.mirror2Direction = mouseDirection;
            }
        } else if (P2PManager.isConnected) {
            const angle = player2Controller.remoteMirrorAngle;
            this.mirror2Direction = new Vec2(Math.cos(angle), Math.sin(angle));
        } else {
            this.mirror2Direction = new Vec2(this.player2.invertX ? -1 : 1, 0);
        }

        const orbitRadius = this.player2.boundary.halfSize.x + this.mirror2.boundary.halfSize.x + MBLevel.MIRROR_PADDING;
        this.mirror2.position.copy(this.player2.position.clone().add(this.mirror2Direction.scaled(orbitRadius)));
        this.mirror2.rotation = Math.atan2(-this.mirror2Direction.y, this.mirror2Direction.x);
    }

    protected isMirrorActive(playerNum: 1 | 2): boolean {
        return playerNum === 1
            ? this.mirrorHitsRemaining > 0
            : this.mirror2HitsRemaining > 0;
    }

    protected getMirrorHitPlayer(spell: Sprite, excludedPlayerNum?: 1 | 2): 1 | 2 | null {
        return getHitMirrorOwner(spell, [
            {
                playerNum: 1,
                mirror: excludedPlayerNum === 1 ? undefined : this.mirror,
                active: excludedPlayerNum !== 1 && this.isMirrorActive(1)
            },
            {
                playerNum: 2,
                mirror: excludedPlayerNum === 2 ? undefined : this.mirror2,
                active: this.player2 !== undefined && excludedPlayerNum !== 2 && this.isMirrorActive(2)
            }
        ]);
    }

    protected getHitPlayer(spell: Sprite, excludedPlayerNum?: 1 | 2): 1 | 2 | null {
        if (excludedPlayerNum !== 1 && this.player.boundary.overlapArea(spell.boundary) > 0) {
            return 1;
        }

        if (excludedPlayerNum !== 2 && this.player2 !== undefined && this.player2.boundary.overlapArea(spell.boundary) > 0) {
            return 2;
        }

        return null;
    }

    protected damagePlayer(playerNum: 1 | 2): void {
        const target = playerNum === 2 ? this.player2 : this.player;
        if (target === undefined) {
            return;
        }

        const controller = target.ai as PlayerController;
        if (!controller.isDead) {
            controller.health -= 1;
            // Tell the remote peer that this player was hit (we are the authority since our projectile caused it)
            this.sendNetEvent(EventId.PLAYER_HIT, playerNum);
        }
    }

    protected getRespawnPosition(playerNum: 1 | 2): Vec2 {
        if (playerNum === 2 && this.player2RespawnPosition !== undefined) {
            return this.player2RespawnPosition;
        }

        if (this.respawnPosition !== undefined) {
            return this.respawnPosition;
        }

        return playerNum === 2 && this.player2Spawn !== undefined
            ? this.player2Spawn
            : this.playerSpawn;
    }

    protected damageMirror(playerNum: 1 | 2): boolean {
        if (!this.isMirrorActive(playerNum)) {
            return false;
        }

        if (playerNum === 1) {
            this.mirrorHitsRemaining = consumeMirrorDurability(this.mirrorHitsRemaining);
            if (this.mirrorHitsRemaining <= 0 && this.mirror !== undefined) {
                this.mirror.visible = false;
            }
        } else {
            this.mirror2HitsRemaining = consumeMirrorDurability(this.mirror2HitsRemaining);
            if (this.mirror2HitsRemaining <= 0 && this.mirror2 !== undefined) {
                this.mirror2.visible = false;
            }
        }

        return this.isMirrorActive(playerNum);
    }

    protected restoreMirror(playerNum: 1 | 2): void {
        if (playerNum === 1) {
            this.mirrorHitsRemaining = MBLevel.MIRROR_HITS_TO_BREAK;
            if (this.mirror !== undefined) {
                this.mirror.visible = true;
            }
        } else {
            this.mirror2HitsRemaining = MBLevel.MIRROR_HITS_TO_BREAK;
            if (this.mirror2 !== undefined) {
                this.mirror2.visible = true;
            }
        }
    }

    protected initializePlayer2(key: string): void {
        if (this.player2WeaponSystem === undefined) {
            throw new Error("Player 2 weapon system must be initialized before initializing player 2!");
        }
        this.player2 = this.add.animatedSprite(key, MBLayers.PRIMARY);
        const targetSize = MBLevel.PLAYER_TARGET_FRAME_SIZE;
        const scale = targetSize / this.player2.size.y;
        this.player2.scale.set(scale, scale);
        this.player2.position.copy(this.player2Spawn);

        this.player2.addPhysics(new AABB(this.player2.position.clone(), this.player2.boundary.getHalfSize().clone()));
        this.player2.setGroup(MBPhysicsGroups.PLAYER);

        this.player2.tweens.add(PlayerTweens.FLIP, {
            startDelay: 0,
            duration: 300,
            effects: [{
                property: TweenableProperties.rotation,
                resetOnComplete: true,
                start: 0,
                end: 2 * Math.PI,
                ease: EaseFunctionType.IN_OUT_SINE
            }]
        });

        this.player2.addAI(PlayerController, {
            weaponSystem: this.player2WeaponSystem,
            tilemap: "Destructable",
            playerNumber: 2,
            isLocalPlayer: P2PManager.mySlot === 2,
        });
        if (!(this.player2.ai as PlayerController).isLocalPlayer && !this.localCoopTestingMode) {
            this.player2.setAIActive(false, {});
        }
    }

    protected syncMultiplayerState(_deltaT: number): void {
        if (this.devTestingMode || P2PManager.mySlot === 0) {
            return;
        }

        if (P2PManager.isConnected) {
            this._sendLocalStateP2P();
            this._applyRemoteStateP2P();
        }
        // No fallback — only P2P. Game data waits until the DataChannel is open.
    }

    // -------------------------------------------------------------------------
    // WebRTC P2P networking
    // -------------------------------------------------------------------------

    /** Called by P2PManager whenever a packet arrives from the remote peer. */
    private _handleNetPacket(data: ArrayBuffer): void {
        if (data.byteLength < 1) return;
        const type = new DataView(data).getUint8(0);

        if (type === PacketType.STATE) {
            const pkt = decodeState(data);
            const remoteSlot = P2PManager.mySlot === 1 ? 2 : 1;
            if (remoteSlot === 1) this.remoteStateP1 = pkt;
            else                  this.remoteStateP2 = pkt;
        } else if (type === PacketType.EVENT) {
            this._handleNetEvent(decodeEvent(data));
        } else if (type === 0xf8 && data.byteLength >= 4) {
            const v = new DataView(data);
            const spellType = decodeSpellType(v.getUint8(3));
            if (spellType !== null) this._handlePowerupSpawn(v.getUint16(1, true), spellType);
        } else if (type === 0xf7 && data.byteLength >= 3) {
            this._handlePowerupRemove(new DataView(data).getUint16(1, true));
        } else if (type === 0xf6 && data.byteLength >= 19) {
            const v = new DataView(data);
            const playerNum = v.getUint8(1) as 1 | 2;
            const spellType = decodeSpellType(v.getUint8(2));
            if (spellType !== null) {
                const pos = new Vec2(v.getFloat32(3, true), v.getFloat32(7, true));
                const dir = new Vec2(v.getFloat32(11, true), v.getFloat32(15, true));
                const remoteWeapon = playerNum === 1 ? this.playerWeaponSystem : this.player2WeaponSystem;
                remoteWeapon.fireAtPosition(pos, dir, spellType);
            }
        }
    }

    private _handleNetEvent(evt: ReturnType<typeof decodeEvent>): void {
        if (evt.eventId === EventId.PLAYER_HIT) {
            // Remote peer authoritatively says this player was hit
            this._applyPlayerHit(evt.playerNum);
        } else if (evt.eventId === EventId.MIRROR_HIT) {
            this._applyMirrorHit(evt.playerNum);
        } else if (evt.eventId === EventId.PLAYER_RESPAWN) {
            // Owning client already handled their own stock — we just sync our display
            if (evt.playerNum === 2) {
                this.stocksRemaining2 = Math.max(0, this.stocksRemaining2 - 1);
                this.updateStockDisplay();
                if (this.stocksRemaining2 <= 0) { this.sceneManager.changeToScene(MainMenu); return; }
            } else {
                this.stocksRemaining = Math.max(0, this.stocksRemaining - 1);
                this.updateStockDisplay();
                if (this.stocksRemaining <= 0) { this.sceneManager.changeToScene(MainMenu); return; }
            }
            const target = evt.playerNum === 2 ? this.player2 : this.player;
            if (target !== undefined) {
                const pc = target.ai as PlayerController;
                pc.respawn(new Vec2(evt.respawnX ?? 0, evt.respawnY ?? 0));
                if (evt.playerNum === 1) this.restoreMirror(1);
                else this.restoreMirror(2);
            }
        }
    }

    /** Build and send the local player's state packet over WebRTC. */
    private _sendLocalStateP2P(): void {
        const mySlot = P2PManager.mySlot as 1 | 2;
        const localPlayer = mySlot === 1 ? this.player : this.player2;
        if (localPlayer === undefined) return;

        const pc = localPlayer.ai as PlayerController;
        // Send aim direction as the mirror angle so P2 can replicate projectile direction
        const mirrorAngle = Math.atan2(pc.aimDirection.y, pc.aimDirection.x);
        const attackJustPressed = Input.isMouseJustPressed(0) || Input.isJustPressed(mySlot === 1 ? MBControls.ATTACK : MBControls.P2_ATTACK);

        const pkt: StatePacket = {
            left:              Input.isPressed(mySlot === 1 ? MBControls.MOVE_LEFT  : MBControls.P2_MOVE_LEFT),
            right:             Input.isPressed(mySlot === 1 ? MBControls.MOVE_RIGHT : MBControls.P2_MOVE_RIGHT),
            jumpJustPressed:   Input.isJustPressed(mySlot === 1 ? MBControls.JUMP   : MBControls.P2_JUMP),
            attackJustPressed,
            invertX:           localPlayer.invertX,
            mirrorAngle,
            posX:              localPlayer.position.x,
            posY:              localPlayer.position.y,
            // lastFiredSpell is set the frame the attack fires (before currentSpell is cleared)
            spellType:         encodeSpellType(attackJustPressed ? pc.lastFiredSpell : pc.currentSpell),
        };
        P2PManager.send(encodeState(pkt));
    }

    /** Apply the latest received state packet for the remote player. */
    private _applyRemoteStateP2P(): void {
        const remoteSlot = P2PManager.mySlot === 1 ? 2 : 1;
        const pkt = remoteSlot === 1 ? this.remoteStateP1 : this.remoteStateP2;
        const remotePlayer = remoteSlot === 1 ? this.player : this.player2;
        if (pkt === null || remotePlayer === undefined) return;

        const pc = remotePlayer.ai as PlayerController;
        pc.remoteMirrorAngle = pkt.mirrorAngle;

        const dx = pkt.posX - remotePlayer.position.x;
        const dy = pkt.posY - remotePlayer.position.y;
        const moved = dx * dx + dy * dy > 4;

        remotePlayer.position.set(pkt.posX, pkt.posY);
        remotePlayer.invertX = pkt.invertX;

        if (!pc.isDead) {
            if (dy < -2) {
                remotePlayer.animation.playIfNotAlready(PlayerAnimations.JUMP);
            } else if (moved) {
                remotePlayer.animation.playIfNotAlready(PlayerAnimations.WALK);
            } else {
                remotePlayer.animation.playIfNotAlready(PlayerAnimations.IDLE);
            }
        }
    }

    /** Send a game event to the remote peer (authoritative — shooter calls this). */
    protected sendNetEvent(eventId: number, playerNum: 1 | 2, respawnX?: number, respawnY?: number): void {
        if (!P2PManager.isConnected) return;
        P2PManager.send(encodeEvent({ eventId, playerNum, respawnX, respawnY }));
    }

    // -------------------------------------------------------------------------
    // Authoritative hit helpers — called locally and echoed to peer
    // -------------------------------------------------------------------------

    private _applyPlayerHit(playerNum: 1 | 2): void {
        const target = playerNum === 2 ? this.player2 : this.player;
        if (target === undefined) return;
        const controller = target.ai as PlayerController;
        if (!controller.isDead) {
            controller.health -= 1;
        }
    }

    private _applyMirrorHit(playerNum: 1 | 2): void {
        // Directly reduce durability — calling damageMirror would re-send MIRROR_HIT causing an infinite loop
        if (playerNum === 1) {
            this.mirrorHitsRemaining = consumeMirrorDurability(this.mirrorHitsRemaining);
            if (this.mirrorHitsRemaining <= 0 && this.mirror !== undefined) this.mirror.visible = false;
        } else {
            this.mirror2HitsRemaining = consumeMirrorDurability(this.mirror2HitsRemaining);
            if (this.mirror2HitsRemaining <= 0 && this.mirror2 !== undefined) this.mirror2.visible = false;
        }
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
        this.levelEndArea.setTrigger(MBPhysicsGroups.PLAYER, MBEvents.PLAYER_ENTERED_LEVEL_END, "");
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
