// =====================================================
// CyberWrap - Main Application Entry
// 8th Wall ECS v3.1.0
// =====================================================

// =====================================================
// Core Utilities
// =====================================================

import "./hide-on-ready";
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

// =====================================================
// ECS Components / Systems
// =====================================================

// Animation
import "./systems/collectible-effects-system";

import "./systems/collectible-manager";

// Placement
import "./systems/placement-system";

// Spawn truck + drivezone
import "./systems/spawn-system";

// Truck physics
import "./systems/driving-system";

// Truck initialization
import "./systems/truck-controller";

// Collectible spawning component
import "./systems/collectible-spawn-system";

// Timer component
import "./systems/timer-system";

// =====================================================
// Startup
// =====================================================

console.log("CYBERWRAP APP LOADED");

// =====================================================
// XR Initialization
// =====================================================

const onxrloaded = () => {
  if (window.LandingPage) {
    XR8.addCameraPipelineModule(window.LandingPage.pipelineModule());

    window.LandingPage.configure({
      mediaSrc: "./assets/preview.jpg",
    });
  }
};

if (window.XR8) {
  onxrloaded();
} else {
  window.addEventListener("xrloaded", onxrloaded);
}
