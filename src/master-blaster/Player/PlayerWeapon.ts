import AABB from "../../Wolfie2D/DataTypes/Shapes/AABB";
import Vec2 from "../../Wolfie2D/DataTypes/Vec2";
import Sprite from "../../Wolfie2D/Nodes/Sprites/Sprite";
import Scene from "../../Wolfie2D/Scene/Scene";
import ResourceManager from "../../Wolfie2D/ResourceManager/ResourceManager";
import { SpellSpecs, SpellType } from "../Spells/SpellTypes";

type ProjectileData = {
    sprite: Sprite;
    direction: Vec2;
    lifetimeRemaining: number;
    active: boolean;
    spellType: SpellType;
    reflectedOwnerPlayerNum: 1 | 2 | null;
};

/**
 * A simple projectile pool for the player's attack.
 */
export default class PlayerWeapon {
    public static readonly PROJECTILE_SPRITE_KEY = "PLAYER_PROJECTILE";
    public static readonly PROJECTILE_SPRITE_PATH = "game_assets/spritesheets/base spell.png";

    protected static readonly PROJECTILE_LIFETIME = 3;
    protected static readonly PROJECTILE_COOLDOWN = 2;
    protected static readonly PROJECTILE_TARGET_SIZE = 16;
    protected static readonly PROJECTILE_POOL_SIZE = 3;
    protected static readonly PROJECTILE_SPAWN_PADDING = 8;

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
                reflectedOwnerPlayerNum: null
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

            projectile.sprite.move(projectile.direction.scaled(SpellSpecs[projectile.spellType].projectileSpeed * deltaT));
        }
    }

    public tryFire(playerPosition: Vec2, playerHalfWidth: number, facingLeft: boolean, spellType: SpellType | null): boolean {
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

        const direction = new Vec2(facingLeft ? -1 : 1, 0);
        const xOffset = playerHalfWidth + projectile.sprite.boundary.halfSize.x + PlayerWeapon.PROJECTILE_SPAWN_PADDING;
        const spawnPosition = playerPosition.clone().add(new Vec2(direction.x * xOffset, 0));

        projectile.direction = direction;
        projectile.spellType = spellType;
        projectile.reflectedOwnerPlayerNum = null;
        projectile.lifetimeRemaining = PlayerWeapon.PROJECTILE_LIFETIME;
        projectile.active = true;
        this.applyProjectileAppearance(projectile.sprite, SpellSpecs[spellType].projectileSpriteKey);
        projectile.sprite.position.copy(spawnPosition);
        projectile.sprite.invertX = facingLeft;
        projectile.sprite.visible = true;
        projectile.sprite.enablePhysics();
        projectile.sprite._velocity.zero();
        projectile.sprite.collidedWithTilemap = false;

        this.cooldownRemaining = PlayerWeapon.PROJECTILE_COOLDOWN;
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

        projectile.direction = projectile.direction.scaled(-1);
        projectile.reflectedOwnerPlayerNum = reflectedOwnerPlayerNum;
        projectile.sprite.invertX = projectile.direction.x < 0;
        projectile.sprite.position.add(projectile.direction.scaled(projectile.sprite.boundary.halfSize.x + PlayerWeapon.PROJECTILE_SPAWN_PADDING));
        projectile.sprite._velocity.zero();
        projectile.sprite.collidedWithTilemap = false;
        return true;
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
        projectile.sprite.visible = false;
        projectile.sprite.disablePhysics();
        projectile.sprite._velocity.zero();
    }

    protected applyProjectileAppearance(sprite: Sprite, imageId: string): void {
        const image = ResourceManager.getInstance().getImage(imageId);
        sprite.imageId = imageId;
        sprite.size.set(image.width, image.height);
        sprite.scale.set(
            PlayerWeapon.PROJECTILE_TARGET_SIZE / image.width,
            PlayerWeapon.PROJECTILE_TARGET_SIZE / image.height
        );

        if (sprite.hasPhysics) {
            sprite.setCollisionShape(sprite.boundary.clone());
        }
    }
}
