export const SpellType = {
    BASIC: "BASIC",
    FIRE: "FIRE",
} as const;

export type SpellType = typeof SpellType[keyof typeof SpellType];

export const SpellSpriteKey = {
    BASIC_PROJECTILE: "PLAYER_PROJECTILE",
    FIRE_PROJECTILE: "FIRE_PROJECTILE",
    FIRE_PICKUP: "FIRE_PICKUP",
} as const;

export const SpellSpritePath = {
    BASIC_PROJECTILE: "game_assets/spritesheets/projectile temp.png",
    FIRE_PROJECTILE: "game_assets/spritesheets/fire.png",
    FIRE_PICKUP: "game_assets/spritesheets/fire.png",
} as const;

export interface SpellSpec {
    projectileSpriteKey: string;
}

export const SpellSpecs: Record<SpellType, SpellSpec> = {
    [SpellType.BASIC]: {
        projectileSpriteKey: SpellSpriteKey.BASIC_PROJECTILE
    },
    [SpellType.FIRE]: {
        projectileSpriteKey: SpellSpriteKey.FIRE_PROJECTILE
    }
};
