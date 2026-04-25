import runtimeModeConfig from "./runtime-mode.json";

export const RuntimeModeValue = {
    DEFAULT: 0,
    DEV_TESTING: 1,
    LOCAL_COOP_TESTING: 2
} as const;

type RuntimeMode = typeof RuntimeModeValue[keyof typeof RuntimeModeValue];

interface RuntimeModeConfig {
    mode?: number;
}

export function getConfiguredMode(): RuntimeMode {
    const config = runtimeModeConfig as RuntimeModeConfig;
    switch (config.mode) {
        case RuntimeModeValue.DEV_TESTING:
            return RuntimeModeValue.DEV_TESTING;
        case RuntimeModeValue.LOCAL_COOP_TESTING:
            return RuntimeModeValue.LOCAL_COOP_TESTING;
        default:
            return RuntimeModeValue.DEFAULT;
    }
}

export function isDevTestingMode(): boolean {
    return getConfiguredMode() === RuntimeModeValue.DEV_TESTING;
}

export function isLocalCoopTestingMode(): boolean {
    return getConfiguredMode() === RuntimeModeValue.LOCAL_COOP_TESTING;
}

export function isTestingMode(): boolean {
    return getConfiguredMode() !== RuntimeModeValue.DEFAULT;
}
