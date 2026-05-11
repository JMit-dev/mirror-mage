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
    ICE_PICKUP: "ICE_PICKUP",
    LIGHTNING_PROJECTILE: "LIGHTNING_PROJECTILE",
    LIGHTNING_PICKUP: "LIGHTNING_PICKUP",
} as const;

export const SpellSpritePath = {
    BASIC_PROJECTILE: "game_assets/spritesheets/base spell.png",
    FIRE_PROJECTILE: "game_assets/spritesheets/fire.png",
    FIRE_PICKUP: "game_assets/spritesheets/fire.png",
    ICE_PROJECTILE: "game_assets/spritesheets/ice.png",
    ICE_PICKUP: "game_assets/spritesheets/ice.png",
    LIGHTNING_PROJECTILE: "game_assets/spritesheets/lighting.png",
    LIGHTNING_PICKUP: "game_assets/spritesheets/lighting.png",
} as const;

export interface SpellSpec {
    projectileSpriteKey: string;
    projectileSpeed: number;
}

export const SpellSpecs: Record<SpellType, SpellSpec> = {
    [SpellType.BASIC]: {
        projectileSpriteKey: SpellSpriteKey.BASIC_PROJECTILE,
        projectileSpeed: 250
    },
    [SpellType.FIRE]: {
        projectileSpriteKey: SpellSpriteKey.FIRE_PROJECTILE,
        projectileSpeed: 250
    },
    [SpellType.ICE]: {
        projectileSpriteKey: SpellSpriteKey.ICE_PROJECTILE,
        projectileSpeed: 160
    },
    [SpellType.LIGHTNING]: {
        projectileSpriteKey: SpellSpriteKey.LIGHTNING_PROJECTILE,
        projectileSpeed: 520
    }
};
