import AABB from "../../Wolfie2D/DataTypes/Shapes/AABB";
import Vec2 from "../../Wolfie2D/DataTypes/Vec2";
import MBLevel from "./MBLevel";
import { MBLayers } from "./MBLevel";
import RenderingManager from "../../Wolfie2D/Rendering/RenderingManager";
import SceneManager from "../../Wolfie2D/Scene/SceneManager";
import Viewport from "../../Wolfie2D/SceneGraph/Viewport";
import MBLevel2 from "./MBLevel2";
import { GameEventType } from "../../Wolfie2D/Events/GameEventType";
import PlayerWeapon from "../Player/PlayerWeapon";
import Sprite from "../../Wolfie2D/Nodes/Sprites/Sprite";
import OrthogonalTilemap from "../../Wolfie2D/Nodes/Tilemaps/OrthogonalTilemap";
import { GraphicType } from "../../Wolfie2D/Nodes/Graphics/GraphicTypes";
import Color from "../../Wolfie2D/Utils/Color";
import { SpellSpriteKey, SpellSpritePath } from "../Spells/SpellTypes";

/**
 * The first level for Master Blaster - should be the one with the grass and the clouds.
 */
export default class Level1 extends MBLevel {

    protected static readonly SKY_LAYER_KEY = "Level1Sky";
    protected static readonly GROUND_BACKGROUND_LAYER_KEY = "Level1GroundBackground";
    protected static readonly LEVEL_CENTER = new Vec2(600, 304);

    public static readonly PLAYER_SPAWN = new Vec2(454, 320);
    public static readonly PLAYER2_SPAWN = new Vec2(730, 320);
    public static readonly PLAYER_SPRITE_KEY = "PLAYER_SPRITE_KEY";
    public static readonly PLAYER_SPRITE_PATH = "game_assets/spritesheets/temp wizard.json";
    public static readonly ENEMY_SPRITE_KEY = "LEVEL1_ENEMY_SPRITE";
    public static readonly ENEMY_SPRITE_PATH = "game_assets/spritesheets/temp player 2.png";
    public static readonly ENEMY_SPELL_SPRITE_KEY = "LEVEL1_ENEMY_SPELL";
    public static readonly ENEMY_SPELL_SPRITE_PATH = "game_assets/spritesheets/projectile temp.png";

    public static readonly TILEMAP_KEY = "LEVEL1";
    public static readonly TILEMAP_PATH = "game_assets/tilemaps/MBLevel1.json";
    public static readonly TILEMAP_SCALE = new Vec2(2, 2);
    public static readonly DESTRUCTIBLE_LAYER_KEY = "Destructable";
    public static readonly WALLS_LAYER_KEY = "Main";

    public static readonly LEVEL_MUSIC_KEY = "LEVEL_MUSIC";
    public static readonly LEVEL_MUSIC_PATH = "game_assets/music/song1.wav";

    public static readonly JUMP_AUDIO_KEY = "PLAYER_JUMP";
    public static readonly JUMP_AUDIO_PATH = "game_assets/sounds/jump.wav";

    public static readonly TILE_DESTROYED_KEY = "TILE_DESTROYED";
    public static readonly TILE_DESTROYED_PATH = "game_assets/sounds/switch.wav";
    public static readonly DEATH_AUDIO_KEY = "PLAYER_DEATH";
    public static readonly DEATH_AUDIO_PATH = "game_assets/sounds/wizard die.mp3";

    public static readonly LEVEL_END = new AABB(new Vec2(560, 280), new Vec2(24, 16));
    protected static readonly ENEMY_POSITION = new Vec2(792, 320);
    protected static readonly ENEMY_SCALE = 4;
    protected static readonly ENEMY_SPELL_SCALE = 2;
    protected static readonly ENEMY_SPELL_SPEED = 120;
    protected static readonly ENEMY_SPELL_LIFETIME = 4;
    protected static readonly ENEMY_FIRE_COOLDOWN = 2;
    protected static readonly ENEMY_SPELL_SPAWN_OFFSET = new Vec2(-20, 0);
    protected static readonly ENEMY_SPELL_BOUNCE_COOLDOWN = 0.15;
    protected enemy!: Sprite;
    protected enemySpell!: Sprite;
    protected enemySpellActive: boolean = false;
    protected enemySpellLifetimeRemaining: number = 0;
    protected enemyFireCooldownRemaining: number = 0;
    protected enemySpellDirection: Vec2 = Vec2.LEFT;
    protected enemySpellBounceCooldownRemaining: number = 0;

    public constructor(viewport: Viewport, sceneManager: SceneManager, renderingManager: RenderingManager, options: Record<string, any>) {
        super(viewport, sceneManager, renderingManager, options);

        // Set the keys for the different layers of the tilemap
        this.tilemapKey = Level1.TILEMAP_KEY;
        this.tilemapScale = Level1.TILEMAP_SCALE;
        this.destructibleLayerKey = Level1.DESTRUCTIBLE_LAYER_KEY;
        this.wallsLayerKey = Level1.WALLS_LAYER_KEY;

        // Set the key for the player's sprite
        this.playerSpriteKey = Level1.PLAYER_SPRITE_KEY;
        // Set spawn positions
        this.playerSpawn = Level1.PLAYER_SPAWN;
        this.respawnPosition = new Vec2(592, 192);
        this.player2Spawn = Level1.PLAYER2_SPAWN;

        // Music and sound
        this.levelMusicKey = Level1.LEVEL_MUSIC_KEY
        this.levelMusicVolume = 0.5;
        this.jumpAudioKey = Level1.JUMP_AUDIO_KEY;
        this.tileDestroyedAudioKey = Level1.TILE_DESTROYED_KEY;
        this.deathAudioKey = Level1.DEATH_AUDIO_KEY;

        // Level end size and position
        this.levelEndPosition = new Vec2(264, 256).mult(this.tilemapScale);
        this.levelEndHalfSize = new Vec2(32, 32).mult(this.tilemapScale);
    }

    /**
     * Load in our resources for level 1
     */
    public loadScene(): void {
        // Load in the tilemap
        this.load.tilemap(this.tilemapKey, Level1.TILEMAP_PATH);
        // Load in the player's sprite
        this.load.spritesheet(this.playerSpriteKey, Level1.PLAYER_SPRITE_PATH);
        this.load.image(PlayerWeapon.PROJECTILE_SPRITE_KEY, PlayerWeapon.PROJECTILE_SPRITE_PATH);
        this.load.image(SpellSpriteKey.FIRE_PROJECTILE, SpellSpritePath.FIRE_PROJECTILE);
        this.load.image(SpellSpriteKey.FIRE_PICKUP, SpellSpritePath.FIRE_PICKUP);
        this.load.image(SpellSpriteKey.ICE_PROJECTILE, SpellSpritePath.ICE_PROJECTILE);
        this.load.image(SpellSpriteKey.ICE_PICKUP, SpellSpritePath.ICE_PICKUP);
        this.load.image(SpellSpriteKey.LIGHTNING_PROJECTILE, SpellSpritePath.LIGHTNING_PROJECTILE);
        this.load.image(SpellSpriteKey.LIGHTNING_PICKUP, SpellSpritePath.LIGHTNING_PICKUP);
        this.load.image(MBLevel.MIRROR_SPRITE_KEY, MBLevel.MIRROR_SPRITE_PATH);
        this.load.image(MBLevel.STOCK_ICON_P1_KEY, MBLevel.STOCK_ICON_P1_PATH);
        this.load.image(MBLevel.STOCK_ICON_P2_KEY, MBLevel.STOCK_ICON_P2_PATH);
        this.load.image(Level1.ENEMY_SPRITE_KEY, Level1.ENEMY_SPRITE_PATH);
        this.load.image(Level1.ENEMY_SPELL_SPRITE_KEY, Level1.ENEMY_SPELL_SPRITE_PATH);
        // Audio and music
        this.load.audio(this.levelMusicKey, Level1.LEVEL_MUSIC_PATH);
        this.load.audio(this.jumpAudioKey, Level1.JUMP_AUDIO_PATH);
        this.load.audio(this.tileDestroyedAudioKey, Level1.TILE_DESTROYED_PATH);
        this.load.audio(this.deathAudioKey, Level1.DEATH_AUDIO_PATH);
        this.load.audio(PlayerWeapon.PROJECTILE_SHOOT_AUDIO_KEY, PlayerWeapon.PROJECTILE_SHOOT_AUDIO_PATH);
    }

    /**
     * Unload resources for level 1
     */
    public unloadScene(): void {
        this.emitter.fireEvent(GameEventType.STOP_SOUND, {key: this.levelMusicKey});
        this.load.keepSpritesheet(this.playerSpriteKey);
        this.load.keepImage(PlayerWeapon.PROJECTILE_SPRITE_KEY);
        this.load.keepImage(SpellSpriteKey.FIRE_PROJECTILE);
        this.load.keepImage(SpellSpriteKey.FIRE_PICKUP);
        this.load.keepImage(SpellSpriteKey.ICE_PROJECTILE);
        this.load.keepImage(SpellSpriteKey.ICE_PICKUP);
        this.load.keepImage(SpellSpriteKey.LIGHTNING_PROJECTILE);
        this.load.keepImage(SpellSpriteKey.LIGHTNING_PICKUP);
        this.load.keepImage(MBLevel.MIRROR_SPRITE_KEY);
        this.load.keepImage(MBLevel.STOCK_ICON_P1_KEY);
        this.load.keepImage(MBLevel.STOCK_ICON_P2_KEY);
        this.load.keepImage(Level1.ENEMY_SPRITE_KEY);
        this.load.keepImage(Level1.ENEMY_SPELL_SPRITE_KEY);
        this.load.keepAudio(this.jumpAudioKey);
        this.load.keepAudio(this.tileDestroyedAudioKey);
        this.load.keepAudio(this.deathAudioKey);
        this.load.keepAudio(PlayerWeapon.PROJECTILE_SHOOT_AUDIO_KEY);
    }

    public startScene(): void {
        this.addLayer(Level1.SKY_LAYER_KEY, -10);
        this.addLayer(Level1.GROUND_BACKGROUND_LAYER_KEY, -9);
        super.startScene();
        this.initializeSkyBackground();
        this.initializeGroundBackground();
        this.initializePowerups();
        if (this.devTestingMode) {
            this.initializeEnemy();
        }
        // Set the next level to be Level2
        this.nextLevel = MBLevel2;
    }

    public updateScene(deltaT: number): void {
        super.updateScene(deltaT);
        this.updateEnemy(deltaT);
    }

    protected initializeEnemy(): void {
        this.enemy = this.add.sprite(Level1.ENEMY_SPRITE_KEY, MBLayers.PRIMARY);
        this.enemy.scale.set(Level1.ENEMY_SCALE, Level1.ENEMY_SCALE);
        this.enemy.position.copy(Level1.ENEMY_POSITION);
        this.enemy.invertX = true;

        this.enemySpell = this.add.sprite(Level1.ENEMY_SPELL_SPRITE_KEY, MBLayers.PRIMARY);
        this.enemySpell.scale.set(Level1.ENEMY_SPELL_SCALE, Level1.ENEMY_SPELL_SCALE);
        this.enemySpell.visible = false;
    }

    protected initializeViewport(): void {
        this.viewport.setZoomLevel(1);

        const viewportHalfSize = this.viewport.getHalfSize();
        this.viewport.setBounds(
            Level1.LEVEL_CENTER.x - viewportHalfSize.x,
            Level1.LEVEL_CENTER.y - viewportHalfSize.y,
            Level1.LEVEL_CENTER.x + viewportHalfSize.x,
            Level1.LEVEL_CENTER.y + viewportHalfSize.y
        );
        this.viewport.setFocus(Level1.LEVEL_CENTER);
    }

    protected initializeLevelEnds(): void {
        // Level 1 no longer uses an end-of-level trigger area.
    }

    protected initializeSkyBackground(): void {
        const viewportHalfSize = this.viewport.getHalfSize();
        const sky = this.add.graphic(GraphicType.RECT, Level1.SKY_LAYER_KEY, {
            position: Level1.LEVEL_CENTER.clone(),
            size: viewportHalfSize.scaled(2)
        });

        sky.color = new Color(91, 190, 255);
    }

    protected initializeGroundBackground(): void {
        const viewportHalfSize = this.viewport.getHalfSize();
        const groundBackground = this.add.graphic(GraphicType.RECT, Level1.GROUND_BACKGROUND_LAYER_KEY, {
            position: new Vec2(Level1.LEVEL_CENTER.x, Level1.LEVEL_CENTER.y + viewportHalfSize.y / 2),
            size: new Vec2(viewportHalfSize.x * 2, viewportHalfSize.y)
        });

        groundBackground.color = new Color(28, 96, 43);
    }

    protected updateEnemy(deltaT: number): void {
        if (!this.devTestingMode || this.enemy === undefined || this.enemySpell === undefined) {
            return;
        }

        this.enemyFireCooldownRemaining = Math.max(0, this.enemyFireCooldownRemaining - deltaT);
        this.enemySpellBounceCooldownRemaining = Math.max(0, this.enemySpellBounceCooldownRemaining - deltaT);

        if (!this.enemySpellActive && this.enemyFireCooldownRemaining === 0) {
            this.fireEnemySpell();
        }

        if (!this.enemySpellActive) {
            return;
        }

        this.enemySpellLifetimeRemaining -= deltaT;
        this.enemySpell.position.add(this.enemySpellDirection.scaled(Level1.ENEMY_SPELL_SPEED * deltaT));

        if (this.enemySpellBounceCooldownRemaining === 0) {
            const hitMirrorPlayer = this.getMirrorHitPlayer(this.enemySpell);
            if (hitMirrorPlayer !== null) {
                this.damageMirror(hitMirrorPlayer);
                this.bounceEnemySpellOffMirror();
            }
        }

        if (this.enemySpellLifetimeRemaining <= 0 || this.enemySpellHitTile(this.walls) || this.enemySpellHitTile(this.destructable)) {
            this.deactivateEnemySpell();
            return;
        }

        const hitPlayer = this.getHitPlayer(this.enemySpell);
        if (hitPlayer !== null) {
            this.damagePlayer(hitPlayer);
            this.deactivateEnemySpell();
        }
    }

    protected fireEnemySpell(): void {
        this.enemySpellActive = true;
        this.enemySpellLifetimeRemaining = Level1.ENEMY_SPELL_LIFETIME;
        this.enemyFireCooldownRemaining = Level1.ENEMY_FIRE_COOLDOWN;
        this.enemySpellDirection = Vec2.LEFT;
        this.enemySpellBounceCooldownRemaining = 0;
        this.enemySpell.visible = true;
        this.enemySpell.invertX = true;
        this.enemySpell.position.copy(this.enemy.position.clone().add(Level1.ENEMY_SPELL_SPAWN_OFFSET));
    }

    protected deactivateEnemySpell(): void {
        this.enemySpellActive = false;
        this.enemySpellLifetimeRemaining = 0;
        this.enemySpell.visible = false;
        this.enemySpellBounceCooldownRemaining = 0;
    }

    protected bounceEnemySpellOffMirror(): void {
        const bounceDirection = this.enemySpell.position.x < this.enemy.position.x ? Vec2.RIGHT : Vec2.LEFT;
        this.enemySpellDirection = bounceDirection;
        this.enemySpell.invertX = bounceDirection.x < 0;
        this.enemySpellBounceCooldownRemaining = Level1.ENEMY_SPELL_BOUNCE_COOLDOWN;
        this.enemySpell.position.add(bounceDirection.scaled(this.enemySpell.boundary.halfSize.x + 2));
    }

    protected enemySpellHitTile(tilemap: OrthogonalTilemap): boolean {
        const min = new Vec2(this.enemySpell.boundary.left, this.enemySpell.boundary.top);
        const max = new Vec2(this.enemySpell.boundary.right, this.enemySpell.boundary.bottom);
        const minIndex = tilemap.getColRowAt(min);
        const maxIndex = tilemap.getColRowAt(max);

        for (let col = minIndex.x; col <= maxIndex.x; col++) {
            for (let row = minIndex.y; row <= maxIndex.y; row++) {
                if (tilemap.isTileCollidable(col, row)) {
                    const tileSize = tilemap.getTileSize();
                    const tileCenter = new Vec2(col * tileSize.x + tileSize.x/2, row * tileSize.y + tileSize.y/2);
                    const tileCollider = new AABB(tileCenter, tileSize.scaled(1/2));
                    if (this.enemySpell.boundary.overlapArea(tileCollider) > 0) {
                        return true;
                    }
                }
            }
        }

        return false;
    }

}
