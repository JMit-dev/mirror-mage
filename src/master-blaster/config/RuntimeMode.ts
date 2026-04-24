import runtimeModeConfig from "./runtime-mode.json";

export const RuntimeModeValue = {
    DEFAULT: 0,
    DEV_TESTING: 1
} as const;

type RuntimeMode = typeof RuntimeModeValue[keyof typeof RuntimeModeValue];

interface RuntimeModeConfig {
    mode?: number;
}

function getConfiguredMode(): RuntimeMode {
    const config = runtimeModeConfig as RuntimeModeConfig;
    return config.mode === RuntimeModeValue.DEV_TESTING
        ? RuntimeModeValue.DEV_TESTING
        : RuntimeModeValue.DEFAULT;
}

export function isDevTestingMode(): boolean {
    return getConfiguredMode() === RuntimeModeValue.DEV_TESTING;
}
