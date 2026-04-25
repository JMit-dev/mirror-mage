import Sprite from "../../Wolfie2D/Nodes/Sprites/Sprite";

export type MirrorOwner = 1 | 2;

type MirrorCollisionTarget = {
    playerNum: MirrorOwner;
    mirror?: Sprite;
    active: boolean;
};

export function getHitMirrorOwner(spell: Sprite, targets: ReadonlyArray<MirrorCollisionTarget>): MirrorOwner | null {
    for (const target of targets) {
        if (!target.active || target.mirror === undefined) {
            continue;
        }

        if (spell.boundary.overlapArea(target.mirror.boundary) > 0) {
            return target.playerNum;
        }
    }

    return null;
}

export function consumeMirrorDurability(hitsRemaining: number): number {
    return Math.max(0, hitsRemaining - 1);
}
