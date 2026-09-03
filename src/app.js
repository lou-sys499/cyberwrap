// =====================================================
// CyberWrap - Main Application Entry
// 8th Wall ECS v3.1.0
// =====================================================

// =====================================================
// Core Utilities
// =====================================================

import "./hide-on-ready";

console.log("[CyberWrap] hide-on-ready module loaded");

import "./reset-button";

// =====================================================
// Components
// =====================================================

import "./components/truck";

import "./components/collectible";

import "./components/drivezone";

import "./components/collision-handler";

// =====================================================
// UI Components
// =====================================================

import "./ui/joystick";

import "./ui/hud";

import "./ui/countdown";

import "./ui/game-over";

import "./ui/timeout-continue";

import "./ui/daily-run-ui";


// =====================================================
// ECS Components / Systems
// =====================================================

// Animation
import "./systems/collectible-effects-system";

// Collectible management
import "./systems/collectible-manager";

// Placement
import "./systems/placement-system";

// Spawn truck + DriveZone
import "./systems/spawn-system";

// Truck physics
import "./systems/driving-system";

// Driving Juice & Particle Effects (Pass B)
import "./systems/driving-juice-system";

// 3D Gameplay Chase Camera System
import "./systems/chase-camera";

// Driving Forensics Telemetry System
import "./systems/driving-telemetry";

// 3D DriveZone Environment System
import "./systems/drivezone-environment-system";

// Truck initialization
import "./systems/truck-controller";

// Collectible spawning
import "./systems/collectible-spawn-system";

// Timer
import "./systems/timer-system";

// =====================================================
// Analytics
// =====================================================

import { trackEvent } from "./core/analytics";

