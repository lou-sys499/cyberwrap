# CyberWrap Architecture Diagram

## Overview
CyberWrap is a WebAR delivery driving game built on the 8th Wall ECS (Entity Component System) framework v3.1.0. The game features an arcade-style truck driving experience where players collect food items and deliver them to a kitchen zone.

## System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CYBERWRAP ARCHITECTURE                            │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                              ENTRY POINT                                     │
│                         src/app.js (Main Entry)                              │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    │               │               │
                    ▼               ▼               ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│   Core Utilities │  │   Components     │  │   UI Components  │
│                  │  │                  │  │                  │
│ • hide-on-ready  │  │ • truck          │  │ • joystick       │
│ • reset-button   │  │ • collectible    │  │ • hud            │
│                  │  │ • drivezone      │  │ • countdown      │
│                  │  │ • collision-hdlr │  │ • game-over      │
└──────────────────┘  └──────────────────┘  └──────────────────┘
                                                    │
                    ┌───────────────────────────────┼───────────────────────┐
                    │                               │                       │
                    ▼                               ▼                       ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ECS SYSTEMS LAYER                                   │
└─────────────────────────────────────────────────────────────────────────────┘

┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Placement System │  │   Spawn System   │  │  Driving System  │
│                  │  │                  │  │                  │
│ • DriveZone      │  │ • Truck spawn    │  │ • Physics        │
│   placement      │  │ • Kitchen spawn  │  │ • Steering       │
│ • Audio unlock   │  │ • Positioning    │  │ • Camera follow  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────────────────────┐
│                         GAME STATE MANAGEMENT                                │
│                          src/core/game-data.ts                               │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Collectible Mgr  │  │   Timer System   │  │   Audio System   │
│                  │  │                  │  │                  │
│ • Food collection│  │ • Countdown      │  │ • Sound effects  │
│ • Cargo logic    │  │ • Game timer     │  │ • Background music│
│ • Delivery logic │  │ • State transitions│ │ • Audio unlock   │
└──────────────────┘  └──────────────────┘  └──────────────────┘
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ANALYTICS & REWARDS                                  │
└─────────────────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│ Analytics System │  │ Anonymous Player │  │ Anonymous Rewards│
│                  │  │                  │  │                  │
│ • Event tracking │  │ • Player ID      │  │ • Progress       │
│ • Supabase upload│  │ • Session mgmt   │  │ • Coupon system  │
│ • Consent mgmt   │  │                  │  │                  │
└──────────────────┘  └──────────────────┘  └──────────────────┘
                               │
                               ▼
                    ┌──────────────────┐
                    │     SUPABASE     │
                    │   (Cloud DB)     │
                    └──────────────────┘
```

## Game Flow Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GAME STATE MACHINE                                 │
└─────────────────────────────────────────────────────────────────────────────┘

    START → COUNTDOWN → DRIVING → GAMEOVER
       ↑                ↓           ↓
       └────────────────┴───────────┘
                    (Reset)

┌─────────────────────────────────────────────────────────────────────────────┐
│                           DETAILED GAME FLOW                                 │
└─────────────────────────────────────────────────────────────────────────────┘

1. INITIALIZATION (START State)
   │
   ├─ User taps "PLAY" button → cyberwrap-start event
   ├─ Placement System: Places DriveZone at fixed origin
   ├─ Spawn System: Creates truck and kitchen entities
   ├─ Collectible Spawn System: Places food items
   └─ Timer System: Waits for all entities to be ready

2. COUNTDOWN (3 seconds)
   │
   ├─ Timer System: Counts down from 3
   ├─ UI: Shows countdown overlay
   ├─ Audio: Starts background music
   └─ Analytics: Creates anonymous player ID

3. DRIVING (60 seconds)
   │
   ├─ Input: Joystick (steering wheel + gas/rev buttons)
   ├─ Driving System: Processes input → truck movement
   │   ├─ Steering: -1 (left) to +1 (right)
   │   ├─ Throttle: -1 (gas) to +1 (reverse)
   │   └─ Physics: Acceleration, friction, speed limits
   │
   ├─ Collectible Manager:
   │   ├─ Detects food within collection radius
   │   ├─ Adds food to cargo array
   │   ├─ Plays pickup sound
   │   └─ Spawns replacement collectibles
   │
   ├─ Delivery Logic:
   │   ├─ Detects truck at kitchen dropoff zone
   │   ├─ Calculates score from cargo
   │   ├─ Clears cargo array
   │   └─ Awards points + delivery sound
   │
   ├─ Camera Follow System:
   │   ├─ Tracks truck position
   │   ├─ Smooth camera movement
   │   └─ Arena boundary constraints
   │
   ├─ Timer System: Counts down remaining time
   ├─ Audio System: Low time warning at 10 seconds
   └─ Analytics: Tracks collections and deliveries

4. GAME OVER
   │
   ├─ Timer System: Stops game, triggers game over
   ├─ Audio: Stops music, plays game over sound
   ├─ UI: Shows final score and replay button
   ├─ Analytics: Records game completion
   └─ Reset: Allows game restart
```

## Data Flow Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         CENTRALIZED DATA STORE                               │
│                        src/core/game-data.ts                                 │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                          GAME DATA STRUCTURE                                  │
└─────────────────────────────────────────────────────────────────────────────┘

gameData = {
  // Placement State
  driveZonePlaced: boolean,
  driveZoneEid: ecs.Eid | null,

  // Truck State
  truckEid: ecs.Eid | null,
  truckPlaced: boolean,
  truckSpeed: number,
  truckHeading: number,
  truckInitialHeading: number,

  // Input State
  input: {
    steering: number,    // -1 to +1
    throttle: number,    // -1 (gas) to +1 (reverse)
  },
  steeringValue: number, // Smoothed steering

  // Collectibles State
  collectiblesSpawned: boolean,
  collectibleEids: ecs.Eid[],
  collectibleSpawnPoints: ecs.Eid[],
  collectibleSpawnMap: Map<ecs.Eid, ecs.Eid>,
  maxActiveCollectibles: number,
  totalSpawned: number,
  totalCollectibles: number,
  collectedCount: number,
  deliveriesCompleted: number,

  // Kitchen/Delivery State
  kitchenDropoffEid: ecs.Eid | null,
  kitchenEid: ecs.Eid | null,
  kitchenSpawned: boolean,

  // Cargo System (Multi-item)
  cargo: CargoItem[],      // Array of collected food
  isCarrying: boolean,     // cargo.length > 0

  // Game State
  state: GameState,        // START | COUNTDOWN | DRIVING | GAMEOVER
  score: number,
  timeLeft: number,
  countdownTime: number,
  canDrive: boolean,
  gameStarted: boolean,

  // Session Statistics
  sessionStats: {
    gamesStarted: number,
    collectiblesCollected: number,
    deliveriesCompleted: number,
    highestScore: number,
    gamesCompleted: number,
  },
}
```

## Component Relationships

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         ECS COMPONENT HIERARCHY                               │
└─────────────────────────────────────────────────────────────────────────────┘

ECS Components (Data):
├─ truck: { speed: f32, turnSpeed: f32 }
├─ collectible: { type: ui8, value: i32, collected: boolean }
├─ drivezone: (AR placement marker)
└─ collision-handler: (physics interactions)

ECS Systems (Logic):
├─ placement-system: Fixed startup, AR placement
├─ spawn-system: Entity instantiation
├─ driving-system: Vehicle physics
├─ collectible-manager: Collection/delivery logic
├─ collectible-spawn-system: Food spawning
├─ timer-system: Game timing
├─ audio-system: Sound management
├─ analytics-system: Telemetry
├─ score-system: Point calculation
└─ collectible-effects-system: Visual effects
```

## Input/Output Flow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INPUT FLOW                                          │
└─────────────────────────────────────────────────────────────────────────────┘

User Input (Touch/Pointer)
    │
    ▼
Joystick Component (src/ui/joystick.ts)
    │
    ├─ Steering Wheel: Touch → angle → steering value (-1 to +1)
    ├─ GAS Button: Touch → throttle = -1
    └─ REV Button: Touch → throttle = +1
    │
    ▼
gameData.input (Global State)
    │
    ▼
Driving System (src/systems/driving-system.ts)
    │
    ├─ Reads gameData.input.steering
    ├─ Reads gameData.input.throttle
    ├─ Applies physics calculations
    └─ Updates truck position/rotation
    │
    ▼
Visual Output (8th Wall ECS Rendering)
```

## Event System

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EVENT FLOW                                          │
└─────────────────────────────────────────────────────────────────────────────┘

Browser Events:
├─ cyberwrap-start → Triggers DriveZone placement
├─ pointerdown/move/up → Joystick input
└─ visibilitychange/pagehide → Analytics flush

ECS Events:
├─ object-placed → Notifies spawn system
└─ Global event bus for system communication

Analytics Events (with consent):
├─ session_started
├─ game_started
├─ collectible_collected
├─ delivery_completed
├─ game_completed
├─ game_over
└─ reward_earned
```

## External Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         DEPENDENCY GRAPH                                     │
└─────────────────────────────────────────────────────────────────────────────┘

Core Framework:
└─ @8thwall/ecs (v3.2.0)
   ├─ Entity Component System
   ├─ 3D rendering
   ├─ AR/VR support
   └─ Physics engine

Backend Services:
└─ @supabase/supabase-js (v2.109.0)
   ├─ Analytics storage
   ├─ Player data
   └─ Reward system

Build Tools:
├─ Webpack 5 (bundling)
├─ TypeScript 5.4.5 (type safety)
├─ ts-loader (TS compilation)
└─ webpack-dev-server (development)
```

## File Structure

```
CyberWrap/
├── src/
│   ├── app.js                          # Main entry point
│   ├── index.html                      # HTML template
│   │
│   ├── core/                           # Core game logic
│   │   ├── constants.ts                # Game configuration
│   │   ├── game-data.ts                # Global state management
│   │   ├── game-state.ts               # State enum
│   │   ├── analytics.ts                # Analytics system
│   │   ├── analytics-consent.ts        # Privacy consent
│   │   ├── anonymous-player.ts         # Player identification
│   │   ├── anonymous-rewards.ts        # Reward system
│   │   └── supabase.ts                 # Database client
│   │
│   ├── components/                     # ECS components
│   │   ├── truck.ts
│   │   ├── collectible.ts
│   │   ├── drivezone.ts
│   │   ├── collision-handler.ts
│   │   └── collectible-spawn-container.ts
│   │
│   ├── systems/                        # ECS systems
│   │   ├── placement-system.ts
│   │   ├── spawn-system.ts
│   │   ├── driving-system.ts
│   │   ├── collectible-manager.ts
│   │   ├── collectible-spawn-system.ts
│   │   ├── timer-system.ts
│   │   ├── audio-system.ts
│   │   ├── analytics-system.ts
│   │   ├── score-system.ts
│   │   ├── truck-controller.ts
│   │   ├── collectible-effects-system.ts
│   │   └── collision-system.ts
│   │
│   ├── ui/                             # User interface
│   │   ├── joystick.ts                 # Steering wheel + pedals
│   │   ├── hud.ts                      # Score display
│   │   ├── countdown.ts                # Countdown overlay
│   │   ├── game-over.ts                # Game over screen
│   │   ├── cw-consent-footer.ts        # Analytics consent
│   │   ├── record-button.ts            # Recording controls
│   │   └── vehicle-controls.ts         # Alternative controls
│   │
│   ├── hide-on-ready.ts                # Startup utilities
│   └── reset-button.ts                 # Game reset functionality
│
├── config/                             # Build configuration
│   ├── webpack.config.js               # Webpack setup
│   ├── asset-loader.js                 # Asset processing
│   ├── entry-plugin.js                 # Virtual entry points
│   ├── dev8-plugin.js                  # 8th Wall dev tools
│   └── types/                          # TypeScript definitions
│
├── supabase/                           # Database schemas
│   ├── analytics_events.sql
│   └── cyberwrap_rewards.sql
│
├── package.json                        # Dependencies
├── tsconfig.json                       # TypeScript config
└── ARCHITECTURE.md                     # This file
```

## Key Design Patterns

1. **Entity Component System (ECS)**
   - Separation of data (components) and logic (systems)
   - Efficient game loop processing
   - Modular architecture

2. **Centralized State Management**
   - Single `gameData` object for all game state
   - Global accessibility across systems
   - Simplified debugging and state tracking

3. **State Machine Pattern**
   - Clear game state transitions
   - State-specific behavior
   - Prevents invalid state combinations

4. **Event-Driven Architecture**
   - Decoupled system communication
   - Analytics event tracking
   - Browser event handling

5. **Privacy-First Analytics**
   - Explicit consent required
   - Anonymous player identification
   - No personal data collection
   - Local event queue with batch uploads

## Performance Considerations

1. **Frame Rate Optimization**
   - Delta time clamping (max 0.05s)
   - Squared distance calculations (avoid sqrt)
   - Efficient spatial queries

2. **Memory Management**
   - Entity pooling for collectibles
   - Event queue size limits
   - Batched analytics uploads

3. **Mobile Optimization**
   - Touch-action: none for controls
   - Pointer events for unified input
   - Visibility change handling for iOS
   - Reduced motion support

## Security & Privacy

1. **Analytics Privacy**
   - No personal identifiers
   - Explicit consent system
   - Data anonymization
   - Consent withdrawal clears data

2. **Input Safety**
   - Pointer capture for controls
   - Context menu prevention
   - Drag prevention
   - Touch highlight suppression

This architecture provides a solid foundation for the CyberWrap WebAR experience, balancing performance, maintainability, and user privacy.