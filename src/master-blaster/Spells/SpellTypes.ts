export const SpellType = {
    BASIC: "BASIC",
    FIRE: "FIRE",
    ICE: "ICE",
    LIGHTNING: "LIGHTNING",
} as const;

export type SpellType = typeof SpellType[keyof typeof SpellType];

export const SpellSpriteKey = {
    BASIC_PROJECTILE: "PLAYER_PROJECTILE",
    FIRE_PROJECTILE: "FIRE_PROJECTILE",
    FIRE_PICKUP: "FIRE_PICKUP",
    ICE_PROJECTILE: "ICE_PROJECTILE",
    ICE_SHARD_PROJECTILE: "ICE_SHARD_PROJECTILE",
    ICE_PICKUP: "ICE_PICKUP",
    LIGHTNING_PROJECTILE: "LIGHTNING_PROJECTILE",
    LIGHTNING_PICKUP: "LIGHTNING_PICKUP",
} as const;

export const SpellSpritePath = {
    BASIC_PROJECTILE: "game_assets/spritesheets/base spell.png",
    FIRE_PROJECTILE: "game_assets/spritesheets/fire_projectile.png",
    FIRE_PICKUP: "game_assets/spritesheets/fire_power_up_256x256.png",
    ICE_PROJECTILE: "game_assets/spritesheets/ice_projectile.png",
    ICE_SHARD_PROJECTILE: "game_assets/spritesheets/ice shard 256x256.png",
    ICE_PICKUP: "game_assets/spritesheets/ice_power_up_256x256.png",
    LIGHTNING_PROJECTILE: "game_assets/spritesheets/lightning_projectile.png",
    LIGHTNING_PICKUP: "game_assets/spritesheets/lightning_power_up_256x256.png",
} as const;

export type ProjectileFrame = {
    x: number;
    y: number;
    width: number;
    height: number;
};

export interface SpellSpec {
    projectileSpriteKey: string;
    pickupSpriteKey?: string;
    projectileFrames?: ReadonlyArray<ProjectileFrame>;
    projectileSpeed: number;
}

export const SpellSpecs: Record<SpellType, SpellSpec> = {
    [SpellType.BASIC]: {
        projectileSpriteKey: SpellSpriteKey.BASIC_PROJECTILE,
        projectileSpeed: 250
    },
    [SpellType.FIRE]: {
        projectileSpriteKey: SpellSpriteKey.FIRE_PROJECTILE,
        pickupSpriteKey: SpellSpriteKey.FIRE_PICKUP,
        projectileFrames: [
            { x: 11, y: 106, width: 134, height: 148 },
            { x: 154, y: 106, width: 135, height: 148 },
            { x: 298, y: 106, width: 134, height: 148 },
            { x: 441, y: 106, width: 136, height: 148 },
            { x: 586, y: 106, width: 136, height: 148 },
        ],
        projectileSpeed: 250
    },
    [SpellType.ICE]: {
        projectileSpriteKey: SpellSpriteKey.ICE_PROJECTILE,
        pickupSpriteKey: SpellSpriteKey.ICE_PICKUP,
        projectileFrames: [
            { x: 10, y: 115, width: 136, height: 139 },
            { x: 153, y: 115, width: 137, height: 139 },
            { x: 298, y: 115, width: 136, height: 139 },
            { x: 441, y: 115, width: 138, height: 139 },
            { x: 586, y: 115, width: 137, height: 139 },
        ],
        projectileSpeed: 160
    },
    [SpellType.LIGHTNING]: {
        projectileSpriteKey: SpellSpriteKey.LIGHTNING_PROJECTILE,
        pickupSpriteKey: SpellSpriteKey.LIGHTNING_PICKUP,
        projectileFrames: [
            { x: 9, y: 95, width: 139, height: 159 },
            { x: 157, y: 95, width: 138, height: 159 },
            { x: 304, y: 95, width: 139, height: 159 },
            { x: 452, y: 95, width: 139, height: 159 },
            { x: 600, y: 95, width: 138, height: 159 },
        ],
        projectileSpeed: 520
    }
};
