/**
 * Binary packet encoding for P2P game messages.
 *
 * STATE packet — sent every frame (17 bytes):
 *   [0]     type = 0x01
 *   [1]     playerNum (1-4)
 *   [2]     flags: bit0=left, bit1=right, bit2=jumpJustPressed,
 *                  bit3=attackJustPressed, bit4=invertX
 *   [3-6]   mirrorAngle: float32 LE  (mouse-based, meaningful for P1)
 *   [7-10]  posX: float32 LE
 *   [11-14] posY: float32 LE
 *   [15]    spellType byte (only relevant when attackJustPressed is set)
 *   [16]    spellUsesRemaining byte
 *
 * EVENT packet — sent on significant game events (3–11 bytes):
 *   [0]    type = 0x02
 *   [1]    eventId: 0=PLAYER_HIT, 1=MIRROR_HIT, 2=PLAYER_RESPAWN
 *   [2]    playerNum (1 or 2)
 *   [3-6]  respawnX float32 LE  (PLAYER_RESPAWN only)
 *   [7-10] respawnY float32 LE  (PLAYER_RESPAWN only)
 */

import { SpellType } from "../Spells/SpellTypes";

// -------------------------------------------------------------------------
// SpellType ↔ byte encoding (strings can't be written into binary buffers)
// -------------------------------------------------------------------------
const SPELL_ENCODE: Partial<Record<SpellType, number>> = {
    [SpellType.FIRE]:      1,
    [SpellType.ICE]:       2,
    [SpellType.LIGHTNING]: 3,
    [SpellType.BASIC]:     4,
};
const SPELL_DECODE: Record<number, SpellType> = {
    1: SpellType.FIRE,
    2: SpellType.ICE,
    3: SpellType.LIGHTNING,
    4: SpellType.BASIC,
};
export function encodeSpellType(s: SpellType | null): number {
    return (s !== null ? SPELL_ENCODE[s] : undefined) ?? 0;
}
export function decodeSpellType(b: number): SpellType | null {
    return SPELL_DECODE[b] ?? null;
}

export const PacketType = {
    STATE: 0x01,
    EVENT: 0x02,
} as const;

export const EventId = {
    PLAYER_HIT: 0,
    MIRROR_HIT: 1,
    PLAYER_RESPAWN: 2,
} as const;

// -------------------------------------------------------------------------
// State packet
// -------------------------------------------------------------------------

export interface StatePacket {
    playerNum: 1 | 2 | 3 | 4;
    left: boolean;
    right: boolean;
    jumpJustPressed: boolean;
    attackJustPressed: boolean;
    invertX: boolean;
    mirrorAngle: number;
    posX: number;
    posY: number;
    spellType: number;
    spellUsesRemaining: number;
}

export function encodeState(p: StatePacket): ArrayBuffer {
    const buf = new ArrayBuffer(17);
    const v = new DataView(buf);
    v.setUint8(0, PacketType.STATE);
    v.setUint8(1, p.playerNum);
    const flags =
        (p.left            ? 0x01 : 0) |
        (p.right           ? 0x02 : 0) |
        (p.jumpJustPressed ? 0x04 : 0) |
        (p.attackJustPressed ? 0x08 : 0) |
        (p.invertX         ? 0x10 : 0);
    v.setUint8(2, flags);
    v.setFloat32(3, p.mirrorAngle, true);
    v.setFloat32(7, p.posX, true);
    v.setFloat32(11, p.posY, true);
    v.setUint8(15, p.spellType & 0xff);
    v.setUint8(16, p.spellUsesRemaining & 0xff);
    return buf;
}

export function decodeState(buf: ArrayBuffer): StatePacket {
    const v = new DataView(buf);
    const hasSlot = v.byteLength >= 17;
    const playerNum = hasSlot ? (v.getUint8(1) as 1 | 2 | 3 | 4) : 1;
    const flags = hasSlot ? v.getUint8(2) : v.getUint8(1);
    const spellType = hasSlot ? v.getUint8(15) : v.getUint8(14);
    return {
        playerNum,
        left:              (flags & 0x01) !== 0,
        right:             (flags & 0x02) !== 0,
        jumpJustPressed:   (flags & 0x04) !== 0,
        attackJustPressed: (flags & 0x08) !== 0,
        invertX:           (flags & 0x10) !== 0,
        mirrorAngle:       hasSlot ? v.getFloat32(3, true) : v.getFloat32(2, true),
        posX:              hasSlot ? v.getFloat32(7, true) : v.getFloat32(6, true),
        posY:              hasSlot ? v.getFloat32(11, true) : v.getFloat32(10, true),
        spellType,
        spellUsesRemaining: hasSlot ? v.getUint8(16) : (v.byteLength > 15 ? v.getUint8(15) : (spellType === 0 ? 0 : 1)),
    };
}

// -------------------------------------------------------------------------
// Event packet
// -------------------------------------------------------------------------

export interface EventPacket {
    eventId: number;
    playerNum: 1 | 2 | 3 | 4;
    respawnX?: number;
    respawnY?: number;
}

export function encodeEvent(p: EventPacket): ArrayBuffer {
    const isRespawn = p.eventId === EventId.PLAYER_RESPAWN;
    const buf = new ArrayBuffer(isRespawn ? 11 : 3);
    const v = new DataView(buf);
    v.setUint8(0, PacketType.EVENT);
    v.setUint8(1, p.eventId);
    v.setUint8(2, p.playerNum);
    if (isRespawn) {
        v.setFloat32(3, p.respawnX ?? 0, true);
        v.setFloat32(7, p.respawnY ?? 0, true);
    }
    return buf;
}

export function decodeEvent(buf: ArrayBuffer): EventPacket {
    const v = new DataView(buf);
    const eventId   = v.getUint8(1);
    const playerNum = v.getUint8(2) as 1 | 2 | 3 | 4;
    const isRespawn = eventId === EventId.PLAYER_RESPAWN;
    return {
        eventId,
        playerNum,
        respawnX: isRespawn ? v.getFloat32(3, true) : undefined,
        respawnY: isRespawn ? v.getFloat32(7, true) : undefined,
    };
}
