import AABB from "../../Wolfie2D/DataTypes/Shapes/AABB";
import Vec2 from "../../Wolfie2D/DataTypes/Vec2";
import MBLevel from "./MBLevel";
import MainMenu from "./MainMenu";
import { GameEventType } from "../../Wolfie2D/Events/GameEventType";

import Viewport from "../../Wolfie2D/SceneGraph/Viewport";
import RenderingManager from "../../Wolfie2D/Rendering/RenderingManager";
import SceneManager from "../../Wolfie2D/Scene/SceneManager";
import PlayerWeapon from "../Player/PlayerWeapon";

/**
 * The second level for the Master Blaster. It should be the goose dungeon / cave.
 */
export default class Level2 extends MBLevel {

    public static readonly PLAYER_SPAWN  = new Vec2(80,  32);
    public static readonly PLAYER2_SPAWN = new Vec2(432, 32);
    public static readonly PLAYER_SPRITE_KEY = "PLAYER_SPRITE_KEY";
    public static readonly PLAYER_SPRITE_PATH = "game_assets/spritesheets/Hero.json";

    public static readonly TILEMAP_KEY = "LEVEL2";
    public static readonly TILEMAP_PATH = "game_assets/tilemaps/MBLevel2.json";
    public static readonly TILEMAP_SCALE = new Vec2(2, 2);
    public static readonly DESTRUCTIBLE_LAYER_KEY = "Destructable";
    public static readonly WALLS_LAYER_KEY = "Main";

    public static readonly LEVEL_MUSIC_KEY = "LEVEL_MUSIC";
    public static readonly LEVEL_MUSIC_PATH = "game_assets/music/temp song 2.wav";

    public static readonly JUMP_AUDIO_KEY = "PLAYER_JUMP";
    public static readonly JUMP_AUDIO_PATH = "game_assets/sounds/jump.wav";

    public static readonly TILE_DESTROYED_KEY = "TILE_DESTROYED";
    public static readonly TILE_DESTROYED_PATH = "game_assets/sounds/switch.wav";
    public static readonly DEATH_AUDIO_KEY = "PLAYER_DEATH";
    public static readonly DEATH_AUDIO_PATH = "game_assets/sounds/death.wav";

    public static readonly LEVEL_END = new AABB(new Vec2(224, 232), new Vec2(24, 16));

    public constructor(viewport: Viewport, sceneManager: SceneManager, renderingManager: RenderingManager, options: Record<string, any>) {
        super(viewport, sceneManager, renderingManager, options);

        // Set the keys for the different layers of the tilemap
        this.tilemapKey = Level2.TILEMAP_KEY;
        this.tilemapScale = Level2.TILEMAP_SCALE;
        this.destructibleLayerKey = Level2.DESTRUCTIBLE_LAYER_KEY;
        this.wallsLayerKey = Level2.WALLS_LAYER_KEY;

        // Set the key for the player's sprite
        this.playerSpriteKey = Level2.PLAYER_SPRITE_KEY;
        // Set spawn positions
        this.playerSpawn = Level2.PLAYER_SPAWN;
        this.respawnPosition = Level2.PLAYER_SPAWN.clone();
        this.player2Spawn = Level2.PLAYER2_SPAWN;

        // Music and sound
        this.levelMusicKey = Level2.LEVEL_MUSIC_KEY
        this.levelMusicVolume = 1;
        this.jumpAudioKey = Level2.JUMP_AUDIO_KEY;
        this.tileDestroyedAudioKey = Level2.TILE_DESTROYED_KEY;
        this.deathAudioKey = Level2.DEATH_AUDIO_KEY;

        // Level end size and position
        this.levelEndPosition = new Vec2(32, 216).mult(this.tilemapScale);
        this.levelEndHalfSize = new Vec2(32, 32).mult(this.tilemapScale);

    }
    /**
     * Load in resources for level 2.
     */
    public loadScene(): void {
        // Load in the tilemap
        this.load.tilemap(this.tilemapKey, Level2.TILEMAP_PATH);
        // Load in the player's sprite
        this.load.spritesheet(this.playerSpriteKey, Level2.PLAYER_SPRITE_PATH);
        this.load.image(PlayerWeapon.PROJECTILE_SPRITE_KEY, PlayerWeapon.PROJECTILE_SPRITE_PATH);
        this.load.image(MBLevel.MIRROR_SPRITE_KEY, MBLevel.MIRROR_SPRITE_PATH);
        this.load.image(MBLevel.STOCK_ICON_KEY, MBLevel.STOCK_ICON_PATH);
        // Level2-specific music
        this.load.audio(this.levelMusicKey, Level2.LEVEL_MUSIC_PATH);
        this.load.audio(this.jumpAudioKey, Level2.JUMP_AUDIO_PATH);
        this.load.audio(this.tileDestroyedAudioKey, Level2.TILE_DESTROYED_PATH);
        this.load.audio(this.deathAudioKey, Level2.DEATH_AUDIO_PATH);
    }

    public unloadScene(): void {
        this.emitter.fireEvent(GameEventType.STOP_SOUND, {key: this.levelMusicKey});
        this.load.keepSpritesheet(this.playerSpriteKey);
        this.load.keepImage(PlayerWeapon.PROJECTILE_SPRITE_KEY);
        this.load.keepImage(MBLevel.MIRROR_SPRITE_KEY);
        this.load.keepImage(MBLevel.STOCK_ICON_KEY);
        this.load.keepAudio(this.jumpAudioKey);
        this.load.keepAudio(this.tileDestroyedAudioKey);
        this.load.keepAudio(this.deathAudioKey);
    }

    public startScene(): void {
        super.startScene();
        this.nextLevel = MainMenu;
    }

}
