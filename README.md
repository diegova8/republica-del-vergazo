# Melee Arena

A real-time multiplayer melee combat game built with TypeScript, Phaser 3, and Colyseus.

## Project Structure

```
melee-game/
├── client/          # Phaser 3 game client
│   └── src/
│       ├── entities/    # Player, effects
│       ├── scenes/      # Game scenes
│       └── main.ts      # Entry point
├── server/          # Colyseus game server
│   └── src/
│       ├── rooms/       # Game rooms
│       ├── schemas/     # State schemas
│       └── index.ts     # Entry point
└── shared/          # Shared types & constants
    └── src/
        ├── types/       # TypeScript interfaces
        └── constants/   # Game configuration
```

## Quick Start

### 1. Install dependencies

```bash
npm install
```

### 2. Build shared module

```bash
cd shared && npm run build && cd ..
```

### 3. Start development

In two terminals:

```bash
# Terminal 1 - Server
npm run dev:server

# Terminal 2 - Client
npm run dev:client
```

Or run both:

```bash
npm run dev
```

### 4. Play

- Open `http://localhost:3000` in **two browser tabs**
- Wait for both players to connect
- Fight!

## Controls

| Key | Action |
|-----|--------|
| ← → | Move |
| ↑ | Jump |
| Z | Light Attack |
| X | Heavy Attack |
| C | Block |

## Game Mechanics

- **Light Attack**: Fast, low damage (10), low stamina cost
- **Heavy Attack**: Slow, high damage (25), high stamina cost
- **Block**: Negates damage but drains stamina
- **Stamina**: Regenerates over time, needed for attacks

## Architecture

### Server (Authoritative)
- Handles all game logic
- 60 tick rate
- Validates hits, manages state
- Broadcasts state to clients

### Client (Dumb)
- Renders server state
- Sends inputs to server
- Shows visual effects

## Next Steps

- [ ] Add character sprites
- [ ] Implement rollback netcode
- [ ] Add more attacks/combos
- [ ] Sound effects
- [ ] Match history/rankings
