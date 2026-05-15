import AABB from "../../Wolfie2D/DataTypes/Shapes/AABB";
import Vec2 from "../../Wolfie2D/DataTypes/Vec2";
import MBLevel from "./MBLevel";
import MainMenu from "./MainMenu";
import { GameEventType } from "../../Wolfie2D/Events/GameEventType";

import Viewport from "../../Wolfie2D/SceneGraph/Viewport";
import RenderingManager from "../../Wolfie2D/Rendering/RenderingManager";
import SceneManager from "../../Wolfie2D/Scene/SceneManager";
import PlayerWeapon from "../Player/PlayerWeapon";
import { SpellSpriteKey, SpellSpritePath } from "../Spells/SpellTypes";
import { GraphicType } from "../../Wolfie2D/Nodes/Graphics/GraphicTypes";
import Color from "../../Wolfie2D/Utils/Color";

export default class Level3 extends MBLevel {
    protected static readonly ARENA_BACKGROUND_LAYER_KEY = "Level3ArenaBackground";
    protected static readonly LEVEL_CENTER = new Vec2(600, 300);

    public static readonly PLAYER_SPAWN  = new Vec2(180, 192);
    public static readonly PLAYER2_SPAWN = new Vec2(996, 192);
    public static readonly PLAYER3_SPAWN = new Vec2(132, 408);
    public static readonly PLAYER4_SPAWN = new Vec2(1068, 408);
    public static readonly PLAYER_RESPAWN = Level3.PLAYER_SPAWN;
    public static readonly PLAYER2_RESPAWN = Level3.PLAYER2_SPAWN;
    public static readonly PLAYER3_RESPAWN = Level3.PLAYER3_SPAWN;
    public static readonly PLAYER4_RESPAWN = Level3.PLAYER4_SPAWN;
    public static readonly PLAYER_SPRITE_KEY = "PLAYER1_SPRITE_KEY";
    public static readonly PLAYER_SPRITE_PATH = "game_assets/spritesheets/mage1.json";
    public static readonly PLAYER2_SPRITE_KEY = "PLAYER2_SPRITE_KEY";
    public static readonly PLAYER2_SPRITE_PATH = "game_assets/spritesheets/mage2.json";
    public static readonly PLAYER3_SPRITE_KEY = "PLAYER3_SPRITE_KEY";
    public static readonly PLAYER3_SPRITE_PATH = "game_assets/spritesheets/mage3-height-256-transparent.json";
    public static readonly PLAYER4_SPRITE_KEY = "PLAYER4_SPRITE_KEY";
    public static readonly PLAYER4_SPRITE_PATH = "game_assets/spritesheets/Mage4-height-256-transparent.json";

    public static readonly TILEMAP_KEY = "LEVEL3";
    public static readonly TILEMAP_PATH = "game_assets/tilemaps/MBLevel3.json";
    public static readonly TILEMAP_SCALE = new Vec2(3, 3);
    public static readonly DESTRUCTIBLE_LAYER_KEY = "Destructable";
    public static readonly WALLS_LAYER_KEY = "Main";

    public static readonly LEVEL_MUSIC_KEY = "LEVEL3_MUSIC";
    public static readonly LEVEL_MUSIC_PATH = "game_assets/music/temp song 2.wav";

    public static readonly JUMP_AUDIO_KEY = "PLAYER_JUMP";
    public static readonly JUMP_AUDIO_PATH = "game_assets/sounds/jump.wav";

    public static readonly TILE_DESTROYED_KEY = "TILE_DESTROYED";
    public static readonly TILE_DESTROYED_PATH = "game_assets/sounds/switch.wav";
    public static readonly DEATH_AUDIO_KEY = "PLAYER_DEATH";
    public static readonly DEATH_AUDIO_PATH = "game_assets/sounds/wizard die.mp3";

    public static readonly LEVEL_END = new AABB(new Vec2(224, 232), new Vec2(24, 16));

    public constructor(viewport: Viewport, sceneManager: SceneManager, renderingManager: RenderingManager, options: Record<string, any>) {
        super(viewport, sceneManager, renderingManager, options);

        this.tilemapKey = Level3.TILEMAP_KEY;
        this.tilemapScale = Level3.TILEMAP_SCALE;
        this.destructibleLayerKey = Level3.DESTRUCTIBLE_LAYER_KEY;
        this.wallsLayerKey = Level3.WALLS_LAYER_KEY;

        this.playerSpriteKey = Level3.PLAYER_SPRITE_KEY;
        this.player2SpriteKey = Level3.PLAYER2_SPRITE_KEY;
        this.player3SpriteKey = Level3.PLAYER3_SPRITE_KEY;
        this.player4SpriteKey = Level3.PLAYER4_SPRITE_KEY;

        this.playerSpawn = Level3.PLAYER_SPAWN;
        this.respawnPosition = Level3.PLAYER_RESPAWN.clone();
        this.player2Spawn = Level3.PLAYER2_SPAWN;
        this.player2RespawnPosition = Level3.PLAYER2_RESPAWN.clone();
        this.player3Spawn = Level3.PLAYER3_SPAWN;
        this.player4Spawn = Level3.PLAYER4_SPAWN;
        this.player3RespawnPosition = Level3.PLAYER3_RESPAWN.clone();
        this.player4RespawnPosition = Level3.PLAYER4_RESPAWN.clone();

        this.levelMusicKey = Level3.LEVEL_MUSIC_KEY;
        this.levelMusicVolume = 0.05;
        this.jumpAudioKey = Level3.JUMP_AUDIO_KEY;
        this.tileDestroyedAudioKey = Level3.TILE_DESTROYED_KEY;
        this.deathAudioKey = Level3.DEATH_AUDIO_KEY;

        this.levelEndPosition = new Vec2(104, 192).mult(this.tilemapScale);
        this.levelEndHalfSize = new Vec2(32, 32).mult(this.tilemapScale);
    }

    public loadScene(): void {
        this.load.tilemap(this.tilemapKey, Level3.TILEMAP_PATH);
        this.load.spritesheet(this.playerSpriteKey, Level3.PLAYER_SPRITE_PATH);
        this.load.spritesheet(this.player2SpriteKey, Level3.PLAYER2_SPRITE_PATH);
        this.load.spritesheet(this.player3SpriteKey, Level3.PLAYER3_SPRITE_PATH);
        this.load.spritesheet(this.player4SpriteKey, Level3.PLAYER4_SPRITE_PATH);
        this.load.image(PlayerWeapon.PROJECTILE_SPRITE_KEY, PlayerWeapon.PROJECTILE_SPRITE_PATH);
        this.load.image(SpellSpriteKey.FIRE_PROJECTILE, SpellSpritePath.FIRE_PROJECTILE);
        this.load.image(SpellSpriteKey.FIRE_PICKUP, SpellSpritePath.FIRE_PICKUP);
        this.load.image(SpellSpriteKey.ICE_PROJECTILE, SpellSpritePath.ICE_PROJECTILE);
        this.load.image(SpellSpriteKey.ICE_SHARD_PROJECTILE, SpellSpritePath.ICE_SHARD_PROJECTILE);
        this.load.image(SpellSpriteKey.ICE_PICKUP, SpellSpritePath.ICE_PICKUP);
        this.load.image(SpellSpriteKey.LIGHTNING_PROJECTILE, SpellSpritePath.LIGHTNING_PROJECTILE);
        this.load.image(SpellSpriteKey.LIGHTNING_PICKUP, SpellSpritePath.LIGHTNING_PICKUP);
        this.load.image(MBLevel.MIRROR_SPRITE_KEY, MBLevel.MIRROR_SPRITE_PATH);
        this.load.image(MBLevel.SPELL_COUNTER_KEY, MBLevel.SPELL_COUNTER_PATH);
        this.load.image(MBLevel.SPELL_COUNTER_FIRE_KEY, MBLevel.SPELL_COUNTER_FIRE_PATH);
        this.load.image(MBLevel.SPELL_COUNTER_ICE_KEY, MBLevel.SPELL_COUNTER_ICE_PATH);
        this.load.image(MBLevel.SPELL_COUNTER_LIGHTNING_KEY, MBLevel.SPELL_COUNTER_LIGHTNING_PATH);
        this.load.image(MBLevel.STOCK_ICON_P1_KEY, MBLevel.STOCK_ICON_P1_PATH);
        this.load.image(MBLevel.STOCK_ICON_P2_KEY, MBLevel.STOCK_ICON_P2_PATH);
        this.load.image(MBLevel.STOCK_ICON_P3_KEY, MBLevel.STOCK_ICON_P3_PATH);
        this.load.image(MBLevel.STOCK_ICON_P4_KEY, MBLevel.STOCK_ICON_P4_PATH);
        this.load.image(MBLevel.DEAD_SKULL_KEY, MBLevel.DEAD_SKULL_PATH);
        this.load.audio(this.levelMusicKey, Level3.LEVEL_MUSIC_PATH);
        this.load.audio(this.jumpAudioKey, Level3.JUMP_AUDIO_PATH);
        this.load.audio(this.tileDestroyedAudioKey, Level3.TILE_DESTROYED_PATH);
        this.load.audio(this.deathAudioKey, Level3.DEATH_AUDIO_PATH);
        this.load.audio(PlayerWeapon.PROJECTILE_SHOOT_AUDIO_KEY, PlayerWeapon.PROJECTILE_SHOOT_AUDIO_PATH);
    }

    public unloadScene(): void {
        this.emitter.fireEvent(GameEventType.STOP_SOUND, {key: this.levelMusicKey});
        this.load.keepSpritesheet(this.playerSpriteKey);
        this.load.keepSpritesheet(this.player2SpriteKey);
        this.load.keepImage(PlayerWeapon.PROJECTILE_SPRITE_KEY);
        this.load.keepImage(SpellSpriteKey.FIRE_PROJECTILE);
        this.load.keepImage(SpellSpriteKey.FIRE_PICKUP);
        this.load.keepImage(SpellSpriteKey.ICE_PROJECTILE);
        this.load.keepImage(SpellSpriteKey.ICE_SHARD_PROJECTILE);
        this.load.keepImage(SpellSpriteKey.ICE_PICKUP);
        this.load.keepImage(SpellSpriteKey.LIGHTNING_PROJECTILE);
        this.load.keepImage(SpellSpriteKey.LIGHTNING_PICKUP);
        this.load.keepImage(MBLevel.MIRROR_SPRITE_KEY);
        this.load.keepImage(MBLevel.SPELL_COUNTER_KEY);
        this.load.keepImage(MBLevel.SPELL_COUNTER_FIRE_KEY);
        this.load.keepImage(MBLevel.SPELL_COUNTER_ICE_KEY);
        this.load.keepImage(MBLevel.SPELL_COUNTER_LIGHTNING_KEY);
        this.load.keepImage(MBLevel.STOCK_ICON_P1_KEY);
        this.load.keepImage(MBLevel.STOCK_ICON_P2_KEY);
        this.load.keepImage(MBLevel.STOCK_ICON_P3_KEY);
        this.load.keepImage(MBLevel.STOCK_ICON_P4_KEY);
        this.load.keepImage(MBLevel.DEAD_SKULL_KEY);
        this.load.keepAudio(this.jumpAudioKey);
        this.load.keepAudio(this.tileDestroyedAudioKey);
        this.load.keepAudio(this.deathAudioKey);
        this.load.keepAudio(PlayerWeapon.PROJECTILE_SHOOT_AUDIO_KEY);
    }

    public startScene(): void {
        this.addLayer(Level3.ARENA_BACKGROUND_LAYER_KEY, -10);
        super.startScene();
        this.initializeArenaBackground();
        this.initializePowerups();
        this.nextLevel = MainMenu;
    }

    protected initializeUI(): void {
        super.initializeUI();
        this.levelEndLabel.visible = false;
    }

    protected initializeViewport(): void {
        this.viewport.setZoomLevel(1);
        const viewportHalfSize = this.viewport.getHalfSize();
        this.viewport.setBounds(
            Level3.LEVEL_CENTER.x - viewportHalfSize.x,
            Level3.LEVEL_CENTER.y - viewportHalfSize.y,
            Level3.LEVEL_CENTER.x + viewportHalfSize.x,
            Level3.LEVEL_CENTER.y + viewportHalfSize.y
        );
        this.viewport.setFocus(Level3.LEVEL_CENTER);
    }

    protected initializeArenaBackground(): void {
        const viewportHalfSize = this.viewport.getHalfSize();
        const arenaBackground = this.add.graphic(GraphicType.RECT, Level3.ARENA_BACKGROUND_LAYER_KEY, {
            position: Level3.LEVEL_CENTER.clone(),
            size: viewportHalfSize.scaled(2)
        });

        arenaBackground.color = new Color(24, 24, 24);
    }

    protected initializeLevelEnds(): void {
        // Level 3 is also an arena, so it has no level-complete trigger.
    }
}
