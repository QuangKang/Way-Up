# 🧗 Vertical Climb - 4-Player Real-Time Mobile Game

A cross-platform real-time multiplayer vertical climbing mobile game built with **React Native (Expo)**, a **Node.js + Express + Socket.IO** backend, and shared TypeScript contracts with a deterministic **Mulberry32 PRNG** engine.

---

## 🏗 Repository Structure

This repository uses an **npm workspaces** TypeScript monorepo layout:

```text
.
├── apps/
│   ├── mobile/              # React Native mobile client (Expo SDK, TypeScript)
│   │   ├── src/
│   │   │   ├── components/  # Lobby, PRNG obstacle viewer, SQLite records UI
│   │   │   ├── db/          # expo-sqlite (device_identity & local_records)
│   │   │   ├── haptics/     # expo-haptics tactile feedback service
│   │   │   └── hooks/       # useMultiplayerLobby Socket.IO client hook
│   │   ├── App.tsx          # Main Expo mobile application entry
│   │   ├── app.json         # Expo project configuration
│   │   ├── metro.config.js  # Monorepo-compatible Metro bundler configuration
│   │   └── tsconfig.json    # Strict TypeScript configuration
│   │
│   └── server/              # Node.js backend (Express + Socket.IO, TypeScript)
│       ├── src/
│       │   ├── config.ts    # Server port, CORS, and lobby constants
│       │   ├── index.ts     # HTTP server and WebSocket initializer
│       │   ├── rooms/       # 4-character room codes & 2–4 player lobby manager
│       │   └── socket/      # Typed Socket.IO event handlers (JOIN_ROOM, ROOM_START)
│       └── tsconfig.json    # Strict TypeScript configuration
│
├── packages/
│   └── shared/              # Shared types, PRNG, and level generation
│       ├── src/
│       │   ├── generator/   # Deterministic obstacle generator
│       │   ├── prng/        # Mulberry32 32-bit PRNG utility
│       │   ├── types/       # WebSocket payload contracts & game data models
│       │   └── index.ts     # Package barrel export
│       └── tsconfig.json    # Strict TypeScript configuration
│
├── .gitignore               # Comprehensive Node.js, Expo, OS & build outputs ignore
├── package.json             # Root monorepo workspace configuration & scripts
├── tsconfig.base.json       # Base strict TypeScript settings ("strict": true, no any)
└── README.md                # Project documentation and setup guide
```

---

## 🌟 Architecture & Key Features

### 1. Low-Latency 4-Player Room Management (`apps/server`)
- **4-Character Room Codes**: Generated without ambiguous characters (`0`, `O`, `1`, `I`) for rapid mobile typing (e.g., `K7B9`).
- **2–4 Player Lobbies**: Enforces min 2 and max 4 climbers per match.
- **WebSocket Protocol**: Fully typed event contracts for `JOIN_ROOM`, `SET_READY`, `ROOM_START`, `ROOM_UPDATED`, and `LEAVE_ROOM`.
- **Automatic Host Migration**: Seamlessly reassigns the host role if the room creator disconnects.
- **Health & Monitoring**: Includes `/health` and `/api/rooms` HTTP endpoints.

### 2. Deterministic Mulberry32 PRNG (`packages/shared`)
- **32-Bit Seed Synchronization**: When the host triggers `ROOM_START`, the server generates a 32-bit seed (`seed >>> 0`) and broadcasts it to all connected room members.
- **Client-Side Generation**: Each mobile client runs `generateObstaclePattern({ seed })` locally using `Mulberry32`, producing identical platforms, crumbling ledges, moving spikes, and wind zones without saturating network bandwidth.

### 3. Local Storage with SQLite (`apps/mobile`)
- **`device_identity`**: Automatically provisions and caches an RFC 4122 UUIDv4 guest identity with last active timestamps using `expo-sqlite` and `expo-crypto`.
- **`local_records`**: Stores offline climbing runs, best scores, peak heights, and duration for later synchronization.
- **WAL Mode**: SQLite configured with Write-Ahead Logging (`PRAGMA journal_mode = WAL`) for fast mobile performance.

### 4. Tactile Haptic Feedback (`apps/mobile`)
- Integrated with `expo-haptics` to deliver contextual feedback:
  - **Light Impact**: Jump execution & platform landings.
  - **Medium Impact**: Spring boost triggers.
  - **Heavy Impact**: Collision with hazards.
  - **Success / Warning / Error**: Match countdowns, victories, and ledge crumbles.

### 5. Strict TypeScript Enforced
- All workspaces extend `tsconfig.base.json` with `"strict": true`, `"noImplicitAny": true`, `"noUncheckedIndexedAccess": true`, and zero `any` types.

---

## 🚀 Getting Started

### Prerequisites
- **Node.js**: v18.0.0 or later (v20+ recommended)
- **npm**: v9.0.0 or later
- **Expo Go App**: (Optional for physical mobile testing) Available on [iOS App Store](https://apps.apple.com/app/expo-go/id982107779) and [Google Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent).

---

### Step 1: Install Dependencies

From the repository root, run:

```bash
# On macOS / Linux
npm install

# On Windows (PowerShell or Command Prompt)
npm install
```

This installs dependencies across the root and all workspaces (`apps/mobile`, `apps/server`, `packages/shared`).

---

### Step 2: Build Shared Packages

Compile the shared TypeScript package so build artifacts are ready:

```bash
# Build packages/shared and apps/server
npm run build
```

---

### Step 3: Run the Backend Server

Start the Node.js server with live-reloading:

```bash
npm run dev:server
```

The server will launch on port `3001`:
- **WebSocket Gateway**: `ws://localhost:3001`
- **Health Check**: [http://localhost:3001/health](http://localhost:3001/health)
- **Active Rooms Query**: [http://localhost:3001/api/rooms](http://localhost:3001/api/rooms)

---

### Step 4: Run the Mobile Application

In a separate terminal window:

```bash
npm run dev:mobile
```

This starts the Expo Metro development bundler. You can now press:
- `a` to open Android emulator
- `i` to open iOS simulator (macOS only)
- `w` to preview in your web browser
- Or scan the displayed QR code with your phone using **Expo Go**.

> **Note for Physical Device Testing:**
> If testing on physical mobile phones over Wi-Fi, update `serverUrl` in `apps/mobile/src/hooks/useMultiplayerLobby.ts` to your machine's local network IP address (e.g. `http://192.168.1.100:3001`) instead of `localhost`.

---

## 📜 Monorepo Scripts Reference

| Command | Description |
| :--- | :--- |
| `npm run build` | Builds `@climb/shared` and `@climb/server` TypeScript projects. |
| `npm run build:shared` | Compiles `@climb/shared` to `dist/`. |
| `npm run build:server` | Compiles `@climb/server` to `dist/`. |
| `npm run dev:server` | Starts the server in development mode using `tsx watch`. |
| `npm run dev:mobile` | Starts the Expo Metro development server for the mobile app. |
| `npm run typecheck` | Runs `tsc --noEmit` across all monorepo packages. |
| `npm run clean` | Removes build directories and temporary caches. |

---

## 📡 WebSocket Event Contracts

### Client to Server Events

| Event | Payload | Purpose |
| :--- | :--- | :--- |
| `JOIN_ROOM` | `{ roomCode?, playerName, playerId }` | Joins an existing 4-character room or creates a new one. |
| `SET_READY` | `{ roomCode, playerId, isReady }` | Toggles player readiness state in lobby. |
| `ROOM_START` | `{ roomCode, playerId }` | Host requests match start (validates 2–4 players ready). |
| `LEAVE_ROOM` | `{ roomCode, playerId }` | Leaves lobby; triggers host transfer if host left. |
| `PLAYER_INPUT` | `{ roomCode, playerId, action, x, y, timestamp, sequenceNumber }` | Client climbing inputs and movements. |
| `PING` | `{ clientTimestamp }` | Round-trip latency calculation. |

### Server to Client Events

| Event | Payload | Purpose |
| :--- | :--- | :--- |
| `ROOM_JOINED` | `{ room, selfPlayerId, assignedColor }` | Acknowledges player joined room with assigned slot. |
| `ROOM_UPDATED` | `{ room, changeReason }` | Broadcasts lobby state changes to all players in the room. |
| `ROOM_START` | `{ roomCode, seed, countdownDurationMs, gameStartTime, climbGoalHeight }` | Broadcasts match start with deterministic 32-bit seed. |
| `GAME_TICK` | `{ tick, timestamp, players }` | Authoritative server state update. |
| `GAME_OVER` | `{ roomCode, winnerId, finalScores, seed, durationMs }` | Match outcome summary. |
| `ERROR` | `{ code, message }` | Transmits error details to client. |
| `PONG` | `{ clientTimestamp, serverTimestamp }` | Pong reply with latency timestamps. |

---

## 🗄 SQLite Database Schema (`apps/mobile`)

```sql
-- Guest identity persistent authentication
CREATE TABLE IF NOT EXISTS device_identity (
  id TEXT PRIMARY KEY NOT NULL,
  guest_uuid TEXT NOT NULL UNIQUE,
  nickname TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_active_at INTEGER NOT NULL
);

-- Offline gameplay scores and records
CREATE TABLE IF NOT EXISTS local_records (
  id TEXT PRIMARY KEY NOT NULL,
  player_id TEXT NOT NULL,
  score INTEGER NOT NULL,
  height REAL NOT NULL,
  seed INTEGER NOT NULL,
  duration_ms INTEGER NOT NULL,
  recorded_at INTEGER NOT NULL,
  sync_status TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_records_score ON local_records(score DESC);
CREATE INDEX IF NOT EXISTS idx_records_sync ON local_records(sync_status);
```

---

## 🧪 Deterministic Obstacle Verification

To verify that two clients with the same 32-bit seed generate 100% identical levels:

```typescript
import { generateObstaclePattern } from '@climb/shared';

const seed = 0x5F3759DF;
const obstaclesClientA = generateObstaclePattern({ seed });
const obstaclesClientB = generateObstaclePattern({ seed });

console.assert(
  JSON.stringify(obstaclesClientA) === JSON.stringify(obstaclesClientB),
  'Obstacle patterns match deterministically!'
);
```

---

## 📄 License

UNLICENSED (Proprietary)
