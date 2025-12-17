# Melee Arena - Claude Code Context

## Project Overview

This is a real-time multiplayer melee combat game built with:
- **Client**: Phaser 3 + Vite + TypeScript
- **Server**: Colyseus (WebSocket game framework) + Express + TypeScript  
- **Shared**: Common types and constants used by both

## Architecture

```
melee-game/
├── shared/src/           # Shared between client/server
│   ├── types/index.ts    # PlayerState, PlayerInput, AttackData, etc.
│   └── constants/index.ts # GAME_CONFIG, PLAYER_CONFIG, ATTACKS
├── server/src/
│   ├── schemas/GameState.ts  # Colyseus state (synced to clients)
│   ├── rooms/GameRoom.ts     # Game logic (movement, combat, rounds)
│   └── index.ts              # Express + Colyseus server setup
└── client/src/
    ├── scenes/GameScene.ts   # Main Phaser scene, handles input/rendering
    ├── entities/PlayerEntity.ts # Player visual representation
    └── main.ts               # Phaser game config
```

## Current State

**Working:**
- 2-player matchmaking (auto-start when both join)
- Movement (left/right/jump)
- Light attack (Z) and Heavy attack (X)
- Blocking (C)
- Hitbox collision detection (server-side)
- Health/stamina system with regeneration
- Round system (best of 3)
- Basic UI (health bars, status text)

**Using placeholder graphics:**
- Players are colored rectangles
- No animations or sprites yet

## Key Files to Understand

1. `shared/src/constants/index.ts` - All game balance values (damage, speed, frames)
2. `server/src/rooms/GameRoom.ts` - Core game logic
3. `client/src/scenes/GameScene.ts` - Input handling and rendering

## Running the Project

```bash
npm install
cd shared && npm run build && cd ..
npm run dev  # Runs server (3001) and client (3000)
```

Open localhost:3000 in two browser tabs to test.

## Potential Next Tasks

### Gameplay
- [ ] Add combo system (chain light attacks into heavy)
- [ ] Add dodge/dash mechanic
- [ ] Add special moves (down + attack, etc.)
- [ ] Implement grab/throw
- [ ] Add knockdown/getup states

### Netcode
- [ ] Add client-side prediction for local player movement
- [ ] Implement input buffer for smoother attacks
- [ ] Add rollback netcode (complex but ideal for fighting games)
- [ ] Show ping/latency indicator

### Visuals
- [ ] Replace rectangles with sprite sheets
- [ ] Add attack animations
- [ ] Add particle effects (hit sparks, dust)
- [ ] Add screen shake on heavy hits
- [ ] Improve UI design

### Audio
- [ ] Add hit sound effects
- [ ] Add background music
- [ ] Add announcer voice (Round 1, Fight!, KO)

### Features
- [ ] Add character select screen
- [ ] Add multiple arenas/stages
- [ ] Add training mode (vs dummy)
- [ ] Add rematch system
- [ ] Add matchmaking queue

## Code Conventions

- All game logic runs server-side (authoritative)
- Client only sends inputs, renders state
- Frame data in `ATTACKS` constant defines attack timing
- State machine pattern for player actions (`PlayerActionState`)

## Common Commands

```bash
# Development
npm run dev              # Both server + client
npm run dev:server       # Server only
npm run dev:client       # Client only

# Build
npm run build            # Build all workspaces
```
