import AABB from "../../Wolfie2D/DataTypes/Shapes/AABB";
import Vec2 from "../../Wolfie2D/DataTypes/Vec2";
import Sprite from "../../Wolfie2D/Nodes/Sprites/Sprite";
import Scene from "../../Wolfie2D/Scene/Scene";
import ResourceManager from "../../Wolfie2D/ResourceManager/ResourceManager";
import { ProjectileFrame, SpellSpecs, SpellSpriteKey, SpellType } from "../Spells/SpellTypes";

export type ProjectileData = {
    sprite: Sprite;
    direction: Vec2;
    lifetimeRemaining: number;
    active: boolean;
    spellType: SpellType;
    reflectedOwnerPlayerNum: 1 | 2 | null;
    animationElapsed: number;
    animationFrameIndex: number;
    bounceCount: number;
    splitShardSpawned: boolean;
    isIceShard: boolean;
    iceShardHitCount: number;
    firedThisFrame: boolean; // true only the frame tryFire activated this projectile
};

/**
 * A simple projectile pool for the player's attack.
 */
export default class PlayerWeapon {
    public static readonly PROJECTILE_SPRITE_KEY = "PLAYER_PROJECTILE";
    public static readonly PROJECTILE_SPRITE_PATH = "game_assets/spritesheets/base spell.png";
    public static readonly PROJECTILE_SHOOT_AUDIO_KEY = "PROJECTILE_SHOOT";
    public static readonly PROJECTILE_SHOOT_AUDIO_PATH = "game_assets/sounds/shooting projectile.mp3";

    protected static readonly PROJECTILE_LIFETIME = 12;
    protected static readonly PROJECTILE_COOLDOWN = 0.3;
    protected static readonly PROJECTILE_TARGET_SIZE = 24;
    protected static readonly ICE_SHARD_TARGET_SIZE = 14;
    protected static readonly ICE_SHARD_COUNT = 2;
    protected static readonly ICE_SHARD_MAX_HITS = 6;
    protected static readonly PROJECTILE_POOL_SIZE = 16;
    protected static readonly PROJECTILE_SPAWN_PADDING = 8;
    protected static readonly PROJECTILE_FRAME_DURATION = 0.25;
    public static readonly MAX_BOUNCES = 10;

    protected projectiles: Array<ProjectileData>;
    protected cooldownRemaining: number;

    public constructor() {
        this.projectiles = [];
        this.cooldownRemaining = 0;
    }

    public initializePool(scene: Scene, layer: string): void {
        for (let i = 0; i < PlayerWeapon.PROJECTILE_POOL_SIZE; i++) {
            const sprite = scene.add.sprite(PlayerWeapon.PROJECTILE_SPRITE_KEY, layer);
            this.applyProjectileAppearance(sprite, PlayerWeapon.PROJECTILE_SPRITE_KEY);
            sprite.addPhysics(new AABB(sprite.position.clone(), sprite.boundary.halfSize.clone()));
            sprite.visible = false;
            sprite.disablePhysics();

            this.projectiles.push({
                sprite,
                direction: Vec2.RIGHT,
                lifetimeRemaining: 0,
                active: false,
                spellType: SpellType.BASIC,
                reflectedOwnerPlayerNum: null,
                animationElapsed: 0,
                animationFrameIndex: 0,
                bounceCount: 0,
                splitShardSpawned: false,
                isIceShard: false,
                iceShardHitCount: 0,
                firedThisFrame: false
            });
        }
    }

    public update(deltaT: number): void {
        this.cooldownRemaining = Math.max(0, this.cooldownRemaining - deltaT);

        for (const projectile of this.projectiles) {
            if (!projectile.active) {
                continue;
            }

            projectile.lifetimeRemaining -= deltaT;
            if (projectile.lifetimeRemaining <= 0) {
                this.deactivateProjectile(projectile);
                continue;
            }

            this.updateProjectileAnimation(projectile, deltaT);
            projectile.sprite.move(projectile.direction.scaled(SpellSpecs[projectile.spellType].projectileSpeed * deltaT));
        }
    }

    public tryFire(playerPosition: Vec2, playerHalfWidth: number, aimDirection: Vec2, spellType: SpellType | null): boolean {
        if (spellType === null) {
            return false;
        }

        if (this.cooldownRemaining > 0) {
            return false;
        }

        const projectile = this.projectiles.find(entry => !entry.active);
        if (projectile === undefined) {
            return false;
        }

        const spawnOffset = playerHalfWidth + projectile.sprite.boundary.halfSize.x + PlayerWeapon.PROJECTILE_SPAWN_PADDING;
        const spawnPosition = playerPosition.clone().add(aimDirection.scaled(spawnOffset));

        projectile.direction = aimDirection.clone();
        projectile.spellType = spellType;
        projectile.reflectedOwnerPlayerNum = null;
        projectile.animationElapsed = 0;
        projectile.animationFrameIndex = 0;
        projectile.bounceCount = 0;
        projectile.splitShardSpawned = false;
        projectile.isIceShard = false;
        projectile.iceShardHitCount = 0;
        projectile.firedThisFrame = true;
        projectile.lifetimeRemaining = PlayerWeapon.PROJECTILE_LIFETIME;
        projectile.active = true;
        const spellSpec = SpellSpecs[spellType];
        this.applyProjectileAppearance(projectile.sprite, spellSpec.projectileSpriteKey, spellSpec.projectileFrames?.[0]);
        projectile.sprite.position.copy(spawnPosition);
        projectile.sprite.invertX = aimDirection.x < 0;
        projectile.sprite.visible = true;
        projectile.sprite.enablePhysics();
        projectile.sprite._velocity.zero();
        projectile.sprite.collidedWithTilemap = false;

        this.cooldownRemaining = PlayerWeapon.PROJECTILE_COOLDOWN;
        return true;
    }

    /** Directly spawn a replicated projectile at an exact world position (no cooldown check). */
    public fireAtPosition(spawnPosition: Vec2, direction: Vec2, spellType: SpellType): boolean {
        const spellSpec = SpellSpecs[spellType];
        if (spellSpec === undefined) return false;
        const projectile = this.projectiles.find(p => !p.active);
        if (projectile === undefined) return false;

        projectile.direction = direction.clone();
        projectile.spellType = spellType;
        projectile.reflectedOwnerPlayerNum = null;
        projectile.animationElapsed = 0;
        projectile.animationFrameIndex = 0;
        projectile.bounceCount = 0;
        projectile.splitShardSpawned = false;
        projectile.isIceShard = false;
        projectile.iceShardHitCount = 0;
        projectile.firedThisFrame = false; // Already a replication — don't re-send
        projectile.lifetimeRemaining = PlayerWeapon.PROJECTILE_LIFETIME;
        projectile.active = true;
        this.applyProjectileAppearance(projectile.sprite, spellSpec.projectileSpriteKey, spellSpec.projectileFrames?.[0]);
        projectile.sprite.position.copy(spawnPosition);
        projectile.sprite.invertX = direction.x < 0;
        projectile.sprite.visible = true;
        projectile.sprite.enablePhysics();
        projectile.sprite._velocity.zero();
        projectile.sprite.collidedWithTilemap = false;
        return true;
    }

    public splitIceShardById(id: number): void {
        const source = this.projectiles.find(entry => entry.sprite.id === id);
        if (
            source === undefined ||
            !source.active ||
            source.spellType !== SpellType.ICE ||
            source.isIceShard ||
            source.splitShardSpawned
        ) {
            return;
        }

        source.splitShardSpawned = true;

        for (let i = 0; i < PlayerWeapon.ICE_SHARD_COUNT; i++) {
            const shard = this.projectiles.find(entry => !entry.active);
            if (shard === undefined) {
                return;
            }

            const angle = Math.random() * Math.PI * 2;
            const direction = new Vec2(Math.cos(angle), Math.sin(angle));
            shard.direction = direction;
            shard.spellType = SpellType.ICE;
            shard.reflectedOwnerPlayerNum = source.reflectedOwnerPlayerNum;
            shard.animationElapsed = 0;
            shard.animationFrameIndex = 0;
            shard.bounceCount = 0;
            shard.splitShardSpawned = true;
            shard.isIceShard = true;
            shard.iceShardHitCount = 0;
            shard.firedThisFrame = false;
            shard.lifetimeRemaining = PlayerWeapon.PROJECTILE_LIFETIME;
            shard.active = true;
            this.applyProjectileAppearance(shard.sprite, SpellSpriteKey.ICE_SHARD_PROJECTILE, undefined, PlayerWeapon.ICE_SHARD_TARGET_SIZE);
            shard.sprite.position.copy(source.sprite.position);
            shard.sprite.position.add(direction.scaled(source.sprite.boundary.halfSize.x + PlayerWeapon.PROJECTILE_SPAWN_PADDING));
            shard.sprite.invertX = direction.x < 0;
            shard.sprite.visible = true;
            shard.sprite.enablePhysics();
            shard.sprite._velocity.zero();
            shard.sprite.collidedWithTilemap = false;
        }
    }

    public recordHitById(id: number): boolean {
        const projectile = this.projectiles.find(entry => entry.sprite.id === id);
        if (projectile === undefined || !projectile.active) {
            return false;
        }

        if (projectile.spellType !== SpellType.ICE) {
            return true;
        }

        projectile.iceShardHitCount++;
        if (projectile.iceShardHitCount >= PlayerWeapon.ICE_SHARD_MAX_HITS) {
            this.deactivateProjectile(projectile);
            return false;
        }

        return true;
    }

    public getProjectiles(): Readonly<Array<ProjectileData>> {
        return this.projectiles;
    }

    public reflectById(id: number, reflectedOwnerPlayerNum: 1 | 2): boolean {
        const projectile = this.projectiles.find(entry => entry.sprite.id === id);
        if (projectile === undefined || !projectile.active) {
            return false;
        }

        if (projectile.spellType === SpellType.FIRE) {
            projectile.bounceCount++;
            if (projectile.bounceCount > 1) {
                this.deactivateProjectile(projectile);
                return false;
            }
        }

        projectile.direction = PlayerWeapon.getBounceDirection(projectile.direction);

        projectile.reflectedOwnerPlayerNum = reflectedOwnerPlayerNum;
        projectile.sprite.invertX = projectile.direction.x < 0;
        projectile.sprite.position.add(projectile.direction.scaled(projectile.sprite.boundary.halfSize.x + PlayerWeapon.PROJECTILE_SPAWN_PADDING));
        projectile.sprite._velocity.zero();
        projectile.sprite.collidedWithTilemap = false;
        return true;
    }

    /** Change the projectile's direction after a tile bounce. Deactivates if max bounces exceeded. */
    public setBounceDirection(id: number, newDirection: Vec2): void {
        const projectile = this.projectiles.find(p => p.sprite.id === id);
        if (projectile === undefined || !projectile.active) return;

        projectile.bounceCount++;
        if (projectile.bounceCount > PlayerWeapon.MAX_BOUNCES) {
            this.deactivateProjectile(projectile);
            return;
        }

        projectile.direction = newDirection;
        projectile.sprite.invertX = newDirection.x < 0;
        projectile.sprite._velocity.zero();
        projectile.sprite.collidedWithTilemap = false;
        // Push away from surface so physics doesn't immediately re-trigger the collision
        projectile.sprite.position.add(newDirection.scaled(projectile.sprite.boundary.halfSize.x + 5));
    }

    public static getBounceDirection(direction: Vec2): Vec2 {
        if (Math.random() < 0.7) {
            return direction.scaled(-1).normalize();
        }

        const angle = Math.random() * Math.PI * 2;
        return new Vec2(Math.cos(angle), Math.sin(angle));
    }

    public deactivateById(id: number): void {
        const projectile = this.projectiles.find(entry => entry.sprite.id === id);
        if (projectile !== undefined) {
            this.deactivateProjectile(projectile);
        }
    }

    protected deactivateProjectile(projectile: ProjectileData): void {
        projectile.active = false;
        projectile.lifetimeRemaining = 0;
        projectile.reflectedOwnerPlayerNum = null;
        projectile.animationElapsed = 0;
        projectile.animationFrameIndex = 0;
        projectile.splitShardSpawned = false;
        projectile.isIceShard = false;
        projectile.iceShardHitCount = 0;
        projectile.sprite.visible = false;
        projectile.sprite.disablePhysics();
        projectile.sprite._velocity.zero();
    }

    protected updateProjectileAnimation(projectile: ProjectileData, deltaT: number): void {
        const frames = SpellSpecs[projectile.spellType].projectileFrames;
        if (frames === undefined || frames.length === 0) {
            return;
        }

        projectile.animationElapsed += deltaT;
        const nextFrameIndex = Math.min(
            Math.floor(projectile.animationElapsed / PlayerWeapon.PROJECTILE_FRAME_DURATION),
            frames.length - 1
        );

        if (nextFrameIndex === projectile.animationFrameIndex) {
            return;
        }

        projectile.animationFrameIndex = nextFrameIndex;
        this.applyProjectileAppearance(
            projectile.sprite,
            SpellSpecs[projectile.spellType].projectileSpriteKey,
            frames[nextFrameIndex]
        );
    }

    protected applyProjectileAppearance(sprite: Sprite, imageId: string, frame?: ProjectileFrame, targetSize: number = PlayerWeapon.PROJECTILE_TARGET_SIZE): void {
        const image = ResourceManager.getInstance().getImage(imageId);
        const frameWidth = frame?.width ?? image.width;
        const frameHeight = frame?.height ?? image.height;

        sprite.imageId = imageId;
        sprite.setImageOffset(frame === undefined ? Vec2.ZERO : new Vec2(frame.x, frame.y));
        sprite.size.set(frameWidth, frameHeight);
        sprite.scale.set(
            targetSize / frameWidth,
            targetSize / frameHeight
        );

        if (sprite.hasPhysics) {
            sprite.setCollisionShape(sprite.boundary.clone());
        }
    }
}
