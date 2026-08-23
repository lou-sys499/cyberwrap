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

import "./ui/account-auth";

import "./ui/guest-mode";

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

// =====================================================
// XR Initialization
// =====================================================

const onxrloaded = () => {
  console.log("[CyberWrap] XR8 loaded");

  if (window.LandingPage) {
    console.log("[CyberWrap] Adding LandingPage pipeline");

    XR8.addCameraPipelineModule(window.LandingPage.pipelineModule());
  } else {
    console.warn("[CyberWrap] LandingPage not available");
  }
};

if (window.XR8) {
  onxrloaded();
} else {
  window.addEventListener("xrloaded", onxrloaded);
}
