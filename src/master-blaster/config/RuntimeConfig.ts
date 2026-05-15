export const TurnModeValue = {
    P2P_THEN_TURN: 0,
    TURN_ONLY: 1
} as const;

export type TurnMode = typeof TurnModeValue[keyof typeof TurnModeValue];

export interface RuntimeConfigShape {
    network: {
        turnMode: TurnMode;
        p2pConnectTimeoutMs: number;
        roomMetaPollMs: number;
        relayRetryMs: number;
        stunUrls: string[];
        turnUrls: string[];
        turnUsername: string;
        turnCredential: string;
    };
}

const defaultConfig: RuntimeConfigShape = {
    network: {
        turnMode: TurnModeValue.P2P_THEN_TURN,
        p2pConnectTimeoutMs: 7000,
        roomMetaPollMs: 1000,
        relayRetryMs: 1500,
        stunUrls: [],
        turnUrls: [],
        turnUsername: "",
        turnCredential: ""
    }
};

let runtimeConfig: RuntimeConfigShape = cloneConfig(defaultConfig);

export async function loadRuntimeConfig(): Promise<void> {
    try {
        const response = await fetch("runtime-config.json?t=" + Date.now(), {
            cache: "no-store",
            headers: { "Cache-Control": "no-cache" }
        });

        if (!response.ok) {
            throw new Error("HTTP " + response.status);
        }

        const loaded = await response.json();
        runtimeConfig = mergeConfig(loaded);
    } catch (error) {
        runtimeConfig = cloneConfig(defaultConfig);
        console.warn("[RuntimeConfig] Falling back to defaults:", error);
    }
}

export function getRuntimeConfig(): Readonly<RuntimeConfigShape> {
    return runtimeConfig;
}

function mergeConfig(loaded: any): RuntimeConfigShape {
    const merged = cloneConfig(defaultConfig);
    const network = loaded?.network ?? {};

    merged.network.turnMode = Number(network.turnMode) === TurnModeValue.TURN_ONLY
        ? TurnModeValue.TURN_ONLY
        : TurnModeValue.P2P_THEN_TURN;
    merged.network.p2pConnectTimeoutMs = coercePositiveNumber(network.p2pConnectTimeoutMs, defaultConfig.network.p2pConnectTimeoutMs);
    merged.network.roomMetaPollMs = coercePositiveNumber(network.roomMetaPollMs, defaultConfig.network.roomMetaPollMs);
    merged.network.relayRetryMs = coercePositiveNumber(network.relayRetryMs, defaultConfig.network.relayRetryMs);
    merged.network.stunUrls = sanitizeStringArray(network.stunUrls);
    merged.network.turnUrls = sanitizeStringArray(network.turnUrls);
    merged.network.turnUsername = typeof network.turnUsername === "string" ? network.turnUsername : "";
    merged.network.turnCredential = typeof network.turnCredential === "string" ? network.turnCredential : "";

    return merged;
}

function cloneConfig(config: RuntimeConfigShape): RuntimeConfigShape {
    return {
        network: {
            turnMode: config.network.turnMode,
            p2pConnectTimeoutMs: config.network.p2pConnectTimeoutMs,
            roomMetaPollMs: config.network.roomMetaPollMs,
            relayRetryMs: config.network.relayRetryMs,
            stunUrls: config.network.stunUrls.slice(),
            turnUrls: config.network.turnUrls.slice(),
            turnUsername: config.network.turnUsername,
            turnCredential: config.network.turnCredential
        }
    };
}

function sanitizeStringArray(value: unknown): string[] {
    if (!Array.isArray(value)) {
        return [];
    }

    return value.filter((item): item is string => typeof item === "string")
        .map(item => item.trim())
        .filter(item => item.length > 0);
}

function coercePositiveNumber(value: unknown, fallback: number): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}
