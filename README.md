# TODO
1. Add a lava arena.
2. Add new music for lava.
3. Tighten online join/start security if more issues appear.

# Mirror Mage
Mirror Mage is a local and online PvP arena game about mages fighting with spells and enchanted mirrors. Players move through side-view battle arenas, cast elemental attacks, and reflect incoming projectiles back at opponents with timed mirror positioning.

## About The Game
The game is built in TypeScript on top of Wolfie2D. It supports:
- Local play for 2 players on one machine
- Online play for up to 4 players
- Multiple arenas
- Spell pickups and limited spell charges
- Mirror-based projectile reflection
- Stock-based lives and respawns

The goal is to outplay the other mage by controlling space, choosing the right spell, and using the mirror well.

## Controls
Player 1:
- `A` move left
- `D` move right
- `W` jump
- `E` or `Space` cast

Player 2:
- `J` move left
- `L` move right
- `I` jump
- `U` or `Enter` cast

## Spell Types
- Fire
  Fast standard projectile with limited bounce behavior.
- Ice
  Slower projectile that breaks into smaller shards.
- Lightning
  Faster projectile with stronger bounce behavior.

Players collect spell pickups, and each spell has limited charges tracked by the spell counter UI.

## Game Modes
- Local
  2-player same-device play.
- Online
  Up to 4-player network play through the online lobby.

## Networking
Online play uses a PeerJS/WebRTC peer-to-peer model for gameplay traffic.

Room discovery and room metadata are coordinated through Firebase Realtime Database. The lobby tracks room creation, player counts, and transport mode.

TURN support is included for stricter networks. The runtime config can either:
- try direct P2P first and switch the room to TURN if needed
- force TURN from the start for testing

In the current Firebase Hosting setup, TURN credentials are delivered to the client through runtime config because there is no backend secret layer in use.

## Implementation Notes
### Movement
Player movement is handled through the player controller/state logic in the `Player` module. Each player has movement, jumping, aiming, spell use, death, and respawn behavior coordinated through scene and controller code.

### Spells
Spells are implemented through projectile systems and spell type definitions. Different spell behaviors are handled with separate projectile rules such as bounce counts, shard spawning, and spell-specific visuals.

### Mirror
Each mage has a mirror sprite that follows the player and can intercept projectiles. Mirror durability is tracked separately from player health, and mirrors can break and later be restored on respawn.

## Architecture
The project is split between the Wolfie2D engine code and the game-specific `master-blaster` code.

Important pieces:
- Scene-based level and menu flow
- Player controller and weapon systems
- Peer-to-peer networking manager
- Firebase-backed lobby metadata
- Runtime config for TURN mode selection

## File Structure
```text
.
├── README.md
├── firebase.json
├── gulpfile.js
├── package.json
├── src
│   ├── main.ts
│   ├── index.html
│   ├── Wolfie2D
│   └── master-blaster
│       ├── config
│       ├── Factory
│       ├── Firebase
│       ├── Network
│       ├── Nodes
│       ├── Player
│       ├── Scenes
│       ├── Spells
│       ├── MBControls.ts
│       ├── MBEvents.ts
│       └── MBPhysicsGroups.ts
└── dist
```
