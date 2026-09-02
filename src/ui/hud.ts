import * as ecs from "@8thwall/ecs";

import { GAME_CONFIG } from "../core/constants";
import { gameData } from "../core/game-data";
import {
  loadAnonymousCoupons,
  loadAnonymousRewardProgress,
  type RewardCoupon,
  type RewardProgress,
} from "../core/anonymous-rewards";
import { renderCityMinimap } from "../world/city-minimap";

const CHASE_CAMERA_INFO = {
  name: "3D CHASE CAMERA",
  badge: "3D CHASE CAMERA",
  subtext: "Third-Person Gameplay Follow",
};

// -----------------------------------------------------
// HUD DOM REFERENCES
// -----------------------------------------------------

let hudRoot: HTMLDivElement | null = null;
let dashboard: HTMLDivElement | null = null;
let topCenterButtons: HTMLDivElement | null = null;
let rulesButton: HTMLButtonElement | null = null;
let couponButton: HTMLButtonElement | null = null;
let cameraButton: HTMLButtonElement | null = null;
let cameraToast: HTMLDivElement | null = null;
let cameraToastTimer: number | null = null;
let rulesOverlay: HTMLDivElement | null = null;
let rulesPanel: HTMLDivElement | null = null;
let couponsPanel: HTMLDivElement | null = null;
let couponOverlay: HTMLDivElement | null = null;
let rewardOverlay: HTMLDivElement | null = null;
let rewardCard: HTMLDivElement | null = null;
let scorePopup: HTMLDivElement | null = null;
let minimapContainer: HTMLDivElement | null = null;
let minimapCanvas: HTMLCanvasElement | null = null;
let pickupFlashElem: HTMLDivElement | null = null;
let pickupFlashTimeout: number | null = null;
let floatingScoresContainer: HTMLDivElement | null = null;
let confettiCanvas: HTMLCanvasElement | null = null;

let timeValue: HTMLSpanElement | null = null;
let scoreValue: HTMLSpanElement | null = null;
let rewardScoreValue: HTMLSpanElement | null = null;

let hudWorld: ecs.World | null = null;
let previousScore = 0;
let previousSeconds = 60;
let hudAnimationFrame = 0;

let latestRewardProgress: RewardProgress | null = null;
let latestCoupons: RewardCoupon[] = [];

// -----------------------------------------------------
// FONT INJECTION
// -----------------------------------------------------

function injectFont(): void {
  if (document.getElementById("cw-font")) {
    return;
  }

  const link = document.createElement("link");
  link.id = "cw-font";
  link.rel = "stylesheet";
  link.href =
    "https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;600;700;800;900&family=Rajdhani:wght@500;600;700&display=swap";
  document.head.appendChild(link);
}

// -----------------------------------------------------
// CSS STYLES INJECTION
// -----------------------------------------------------

function injectStyles(): void {
  if (document.getElementById("cw-hud-styles")) {
    return;
  }

  const style = document.createElement("style");
  style.id = "cw-hud-styles";
  style.textContent = `
    /* =====================================================
       CYBERWRAP HUD ROOT & SAFE AREAS
    ===================================================== */
    #cw-root {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      font-family: 'Orbitron', 'Rajdhani', -apple-system, sans-serif;
      z-index: 999999;
      padding: env(safe-area-inset-top, 12px) env(safe-area-inset-right, 12px) env(safe-area-inset-bottom, 12px) env(safe-area-inset-left, 12px);
      box-sizing: border-box;
      user-select: none;
      -webkit-user-select: none;
    }

    /* =====================================================
       PASS A: SCREEN PICKUP FLASH & FLOATING SCORES
    ===================================================== */
    #cw-pickup-flash {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      background: radial-gradient(circle at center, rgba(0, 240, 255, 0.25) 0%, rgba(255, 215, 0, 0.14) 45%, transparent 75%);
      opacity: 0;
      z-index: 999998;
      transition: opacity 0.08s ease-out;
    }

    #cw-pickup-flash.cw-flash-active {
      opacity: 1;
    }

    #cw-floating-scores {
      position: fixed;
      inset: 0;
      pointer-events: none;
      z-index: 1000004;
      overflow: hidden;
    }

    .cw-float-score {
      position: absolute;
      top: 48%;
      left: 50%;
      font-family: 'Orbitron', sans-serif;
      font-weight: 900;
      font-size: clamp(22px, 4.5vw, 36px);
      letter-spacing: 1.5px;
      pointer-events: none;
      animation: cwFloatScoreUp 0.85s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }

    .cw-float-score.cw-pickup {
      color: #00f0ff;
      text-shadow: 0 0 10px #00f0ff, 0 0 22px rgba(0, 240, 255, 0.7), 0 2px 6px rgba(0,0,0,0.8);
    }

    .cw-float-score.cw-delivery {
      color: #ffd166;
      text-shadow: 0 0 14px #ffd166, 0 0 28px rgba(255, 209, 102, 0.8), 0 2px 6px rgba(0,0,0,0.8);
    }

    @keyframes cwFloatScoreUp {
      0% {
        opacity: 0;
        transform: translate(-50%, -30%) scale(0.65);
      }
      20% {
        opacity: 1;
        transform: translate(-50%, -50%) scale(1.22);
      }
      45% {
        transform: translate(-50%, -75%) scale(1.0);
      }
      100% {
        opacity: 0;
        transform: translate(-50%, -130%) scale(0.9);
      }
    }

    /* =====================================================
       TOP-LEFT HUD DASHBOARD (Time, Score, Reward)
    ===================================================== */
    #cw-dashboard {
      position: fixed;
      top: max(8px, env(safe-area-inset-top, 8px));
      left: max(10px, env(safe-area-inset-left, 10px));
      width: clamp(140px, 16vw, 175px);
      padding: clamp(6px, 1.2vh, 9px) clamp(8px, 1.2vw, 13px);
      border-radius: 12px;
      background: rgba(6, 15, 25, 0.84);
      border: 1px solid rgba(0, 240, 255, 0.45);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.55), 0 0 14px rgba(0, 240, 255, 0.2), inset 0 0 10px rgba(0, 240, 255, 0.05);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: #ffffff;
      pointer-events: auto;
      z-index: 1000000;
      box-sizing: border-box;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
    }

    /* PASS C: LAST 10 SECONDS PANIC STATE */
    #cw-dashboard.cw-panic-mode {
      border-color: rgba(255, 40, 60, 0.85);
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7), 0 0 18px rgba(255, 40, 60, 0.4), inset 0 0 12px rgba(255, 40, 60, 0.15);
      animation: cwDashboardPanic 0.6s infinite alternate ease-in-out;
    }

    @keyframes cwDashboardPanic {
      from {
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7), 0 0 12px rgba(255, 40, 60, 0.3);
      }
      to {
        box-shadow: 0 4px 25px rgba(0, 0, 0, 0.85), 0 0 22px rgba(255, 40, 60, 0.65), inset 0 0 14px rgba(255, 40, 60, 0.2);
      }
    }

    .cw-header-badge {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 4px;
      padding-bottom: 4px;
      border-bottom: 1px solid rgba(0, 240, 255, 0.22);
    }

    .cw-header-left {
      display: flex;
      align-items: center;
      gap: 5px;
    }

    .cw-header-dot {
      width: 6px;
      height: 6px;
      border-radius: 50%;
      background: #00f0ff;
      box-shadow: 0 0 8px #00f0ff, 0 0 12px #00f0ff;
      animation: cwPulseDot 1.8s infinite ease-in-out;
    }

    @keyframes cwPulseDot {
      0%, 100% { opacity: 0.7; transform: scale(0.9); }
      50% { opacity: 1; transform: scale(1.25); }
    }

    .cw-header-title {
      font-size: clamp(9.5px, 1.2vw, 11px);
      font-weight: 900;
      letter-spacing: 1.6px;
      color: #00f0ff;
      text-shadow: 0 0 8px rgba(0, 240, 255, 0.6);
      text-transform: uppercase;
    }

    .cw-live-tag {
      font-size: 7.5px;
      font-weight: 800;
      color: rgba(0, 240, 255, 0.75);
      letter-spacing: 0.8px;
    }

    .cw-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 3px;
      font-size: clamp(9px, 1.1vw, 10.5px);
      font-weight: 600;
      color: rgba(220, 245, 255, 0.85);
    }

    .cw-row-label {
      font-size: clamp(8.5px, 1vw, 9.5px);
      font-weight: 700;
      color: rgba(170, 215, 235, 0.75);
      letter-spacing: 1px;
      text-transform: uppercase;
    }

    .cw-value {
      font-size: clamp(12px, 1.4vw, 14px);
      font-weight: 800;
      letter-spacing: 0.5px;
      color: #ffffff;
      text-shadow: 0 0 8px rgba(255, 255, 255, 0.3);
      font-variant-numeric: tabular-nums;
    }

    .cw-reward-val {
      font-size: clamp(9.5px, 1.1vw, 11px);
      font-weight: 700;
      color: rgba(235, 245, 255, 0.95);
      letter-spacing: 0.3px;
    }

    #cw-time.lowTime {
      color: #ff3344;
      font-weight: 900;
      text-shadow: 0 0 10px #ff0033, 0 0 20px rgba(255, 0, 50, 0.85);
      animation: cwTimeUrgent 0.5s infinite alternate ease-in-out;
    }

    .cw-timer-shake {
      animation: cwTimerShake 0.45s ease-out !important;
    }

    @keyframes cwTimerShake {
      0%, 100% { transform: translateX(0); }
      20% { transform: translateX(-4px) scale(1.15); }
      40% { transform: translateX(4px) scale(1.2); }
      60% { transform: translateX(-3px) scale(1.15); }
      80% { transform: translateX(2px) scale(1.08); }
    }

    @keyframes cwTimeUrgent {
      from { transform: scale(1); filter: brightness(1); }
      to { transform: scale(1.2); filter: brightness(1.4); }
    }

    .scoreFlash {
      animation: cwScorePop 0.35s ease-out;
    }

    @keyframes cwScorePop {
      0% { color: #00f0ff; transform: scale(1.25); text-shadow: 0 0 14px #00ffff, 0 0 20px #00f0ff; }
      50% { color: #ffd166; transform: scale(1.1); }
      100% { color: #ffffff; transform: scale(1); }
    }

    /* =====================================================
       TOP-CENTER ACTION BUTTONS (Rules, Coupons, Camera)
    ===================================================== */
    #cw-top-center-buttons {
      position: fixed;
      top: max(8px, env(safe-area-inset-top, 8px));
      left: 50%;
      transform: translateX(-50%);
      display: flex;
      align-items: center;
      gap: clamp(5px, 1vw, 8px);
      pointer-events: auto;
      z-index: 1000000;
    }

    .cw-action-btn {
      position: relative;
      display: flex;
      align-items: center;
      justify-content: center;
      width: clamp(38px, 4.8vw, 44px);
      height: clamp(38px, 4.8vw, 44px);
      padding: 0;
      border-radius: clamp(8px, 1.2vw, 10px);
      background: rgba(6, 15, 25, 0.84);
      border: 1px solid rgba(0, 240, 255, 0.45);
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.5), 0 0 12px rgba(0, 240, 255, 0.15), inset 0 0 8px rgba(0, 240, 255, 0.05);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: #00f0ff;
      cursor: pointer;
      touch-action: manipulation;
      transition: all 0.18s cubic-bezier(0.4, 0, 0.2, 1);
      outline: none;
      box-sizing: border-box;
    }

    .cw-action-btn:hover {
      border-color: #00f0ff;
      background: rgba(0, 240, 255, 0.18);
      box-shadow: 0 0 18px rgba(0, 240, 255, 0.45), inset 0 0 10px rgba(0, 240, 255, 0.2);
      transform: translateY(-2px);
      color: #ffffff;
    }

    .cw-action-btn:active {
      transform: translateY(1px) scale(0.94);
      box-shadow: 0 0 8px rgba(0, 240, 255, 0.3);
      filter: brightness(1.2);
    }

    .cw-action-icon {
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      filter: drop-shadow(0 0 5px rgba(0, 240, 255, 0.6));
      transition: transform 0.15s ease;
    }

    .cw-action-icon svg {
      width: clamp(18px, 2.2vw, 21px);
      height: clamp(18px, 2.2vw, 21px);
    }

    .cw-action-btn:hover .cw-action-icon {
      transform: scale(1.1);
    }

    /* Desktop Tooltip */
    .cw-action-btn[data-tooltip]::after {
      content: attr(data-tooltip);
      position: absolute;
      bottom: -26px;
      left: 50%;
      transform: translateX(-50%) translateY(4px);
      background: rgba(4, 12, 20, 0.95);
      color: #00f0ff;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.8px;
      padding: 3px 8px;
      border-radius: 4px;
      border: 1px solid rgba(0, 240, 255, 0.5);
      white-space: nowrap;
      pointer-events: none;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.7);
      opacity: 0;
      transition: opacity 0.15s ease, transform 0.15s ease;
      z-index: 1000005;
    }

    .cw-action-btn[data-tooltip]:hover::after {
      opacity: 1;
      transform: translateX(-50%) translateY(0);
    }

    /* Camera Mode Toast Notification Pill */
    #cw-camera-toast {
      position: fixed;
      top: max(56px, calc(env(safe-area-inset-top, 8px) + 48px));
      left: 50%;
      transform: translateX(-50%) translateY(-8px) scale(0.94);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      padding: 6px 14px;
      border-radius: 20px;
      background: rgba(6, 16, 26, 0.95);
      border: 1.5px solid #00f0ff;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7), 0 0 16px rgba(0, 240, 255, 0.35);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      color: #ffffff;
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.2s ease, transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
      z-index: 1000008;
      white-space: nowrap;
    }

    #cw-camera-toast.cw-toast-visible {
      opacity: 1;
      transform: translateX(-50%) translateY(0) scale(1);
    }

    .cw-cam-badge {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(10.5px, 1.3vw, 12px);
      font-weight: 900;
      letter-spacing: 1.2px;
      color: #00f0ff;
      text-shadow: 0 0 8px rgba(0, 240, 255, 0.6);
    }

    .cw-cam-subtext {
      font-size: clamp(8.5px, 1.1vw, 9.5px);
      font-weight: 600;
      color: rgba(220, 240, 255, 0.85);
      letter-spacing: 0.4px;
    }

    /* =====================================================
       TOP-RIGHT RADAR MINIMAP
    ===================================================== */
    #cw-minimap-container {
      position: fixed;
      top: max(8px, env(safe-area-inset-top, 8px));
      right: max(10px, env(safe-area-inset-right, 10px));
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      pointer-events: auto;
      z-index: 1000000;
    }

    #cw-minimap-frame {
      position: relative;
      width: clamp(84px, 11vw, 108px);
      height: clamp(84px, 11vw, 108px);
      border-radius: 50%;
      padding: 2px;
      background: radial-gradient(circle, rgba(0, 240, 255, 0.15) 0%, rgba(6, 15, 25, 0.95) 80%);
      border: 1.5px solid rgba(0, 240, 255, 0.65);
      box-shadow: 0 4px 18px rgba(0, 0, 0, 0.6), 0 0 14px rgba(0, 240, 255, 0.25), inset 0 0 12px rgba(0, 240, 255, 0.15);
      overflow: hidden;
      box-sizing: border-box;
    }

    #cw-minimap {
      width: 100%;
      height: 100%;
      border-radius: 50%;
      display: block;
      background: #06121d;
    }

    .cw-delivery-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 2px 7px;
      border-radius: 10px;
      background: rgba(6, 15, 25, 0.85);
      border: 1px solid rgba(0, 240, 255, 0.45);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.4), 0 0 8px rgba(0, 240, 255, 0.15);
      color: #00f0ff;
      font-size: clamp(7.5px, 0.9vw, 8px);
      font-weight: 800;
      letter-spacing: 0.8px;
      text-shadow: 0 0 6px rgba(0, 240, 255, 0.5);
      white-space: nowrap;
    }

    .cw-delivery-badge-icon {
      width: 9px;
      height: 9px;
      fill: #00f0ff;
    }

    /* =====================================================
       DELIVERY SCORE FLOATING POPUP
    ===================================================== */
    #cw-score-popup {
      position: fixed;
      top: 40%;
      left: 50%;
      transform: translate(-50%, -50%) scale(0.5);
      color: #ffd166;
      font-size: clamp(28px, 6vw, 44px);
      font-weight: 900;
      text-shadow: 0 0 16px #ffd166, 0 0 30px rgba(255, 209, 102, 0.8), 0 4px 8px rgba(0,0,0,0.8);
      pointer-events: none;
      opacity: 0;
      z-index: 1000003;
      transition: all 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }

    #cw-score-popup.cw-show {
      opacity: 1;
      transform: translate(-50%, -85%) scale(1.15);
    }

    /* =====================================================
       RULES MODAL OVERLAY & CARD
    ===================================================== */
    #cw-rules-overlay {
      position: fixed;
      inset: 0;
      background: rgba(3, 8, 14, 0.76);
      backdrop-filter: blur(8px);
      -webkit-backdrop-filter: blur(8px);
      display: none;
      align-items: center;
      justify-content: center;
      padding: clamp(10px, 2.5vw, 20px);
      pointer-events: auto;
      z-index: 1000010;
      opacity: 0;
      transition: opacity 0.22s ease;
    }

    #cw-rules-overlay.cw-open {
      display: flex;
      opacity: 1;
    }

    #cw-rules {
      position: relative;
      width: min(460px, 100%);
      max-height: calc(100dvh - 28px);
      overflow-y: auto;
      box-sizing: border-box;
      padding: clamp(16px, 3vh, 24px) clamp(16px, 3vw, 24px);
      border-radius: 16px;
      background: rgba(6, 16, 26, 0.94);
      border: 1.5px solid rgba(0, 240, 255, 0.65);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7), 0 0 28px rgba(0, 240, 255, 0.25), inset 0 0 20px rgba(0, 240, 255, 0.08);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      color: #ffffff;
      transform: scale(0.95);
      transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    #cw-rules-overlay.cw-open #cw-rules {
      transform: scale(1);
    }

    .cw-modal-header {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      margin-bottom: 14px;
      padding-bottom: 12px;
      border-bottom: 1px solid rgba(0, 240, 255, 0.25);
    }

    .cw-modal-close-x {
      position: absolute;
      top: -4px;
      right: -4px;
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 8px;
      background: rgba(0, 240, 255, 0.1);
      border: 1px solid rgba(0, 240, 255, 0.4);
      color: #00f0ff;
      font-size: 16px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.15s ease;
      outline: none;
    }

    .cw-modal-close-x:hover {
      background: rgba(0, 240, 255, 0.3);
      box-shadow: 0 0 12px rgba(0, 240, 255, 0.5);
      transform: scale(1.05);
    }

    .cw-rules-title {
      margin: 0;
      color: #00f0ff;
      font-size: clamp(16px, 2.4vw, 20px);
      font-weight: 900;
      letter-spacing: 2px;
      text-align: center;
      text-shadow: 0 0 12px rgba(0, 240, 255, 0.6);
      text-transform: uppercase;
    }

    .cw-rules-badge {
      display: inline-block;
      margin-top: 5px;
      padding: 3px 10px;
      border-radius: 20px;
      background: rgba(0, 240, 255, 0.15);
      border: 1px solid rgba(0, 240, 255, 0.5);
      color: #ffffff;
      font-size: clamp(9.5px, 1.2vw, 11px);
      font-weight: 800;
      letter-spacing: 1.2px;
      text-transform: uppercase;
    }

    .cw-rule-section {
      margin-bottom: 10px;
      padding: 10px 12px;
      background: rgba(0, 240, 255, 0.05);
      border-left: 3px solid #00f0ff;
      border-radius: 0 8px 8px 0;
      font-size: clamp(11.5px, 1.3vw, 12.5px);
      line-height: 1.5;
      color: rgba(225, 245, 255, 0.92);
    }

    .cw-rule-section strong {
      color: #00f0ff;
      font-weight: 800;
      letter-spacing: 0.5px;
    }

    .cw-controls-list {
      margin: 6px 0 0 0;
      padding-left: 18px;
      line-height: 1.6;
    }

    .cw-controls-list li {
      margin-bottom: 2px;
    }

    .cw-controls-list strong {
      color: #00f0ff;
    }

    .cw-desktop-hint {
      margin-top: 5px;
      font-size: 10.5px;
      color: rgba(180, 220, 240, 0.75);
    }

    .cw-close-btn {
      width: 100%;
      margin-top: 14px;
      padding: clamp(9px, 1.6vh, 12px);
      border-radius: 10px;
      background: linear-gradient(135deg, rgba(0, 240, 255, 0.3) 0%, rgba(0, 160, 220, 0.2) 100%);
      border: 1px solid #00f0ff;
      color: #ffffff;
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(11px, 1.4vw, 12px);
      font-weight: 800;
      letter-spacing: 1px;
      cursor: pointer;
      transition: all 0.15s ease;
      outline: none;
    }

    .cw-close-btn:hover {
      background: rgba(0, 240, 255, 0.45);
      box-shadow: 0 0 16px rgba(0, 240, 255, 0.45);
    }

    .cw-close-btn:active {
      transform: scale(0.98);
    }

    /* =====================================================
       COUPONS & REWARD OVERLAY MODALS
    ===================================================== */
    #cw-coupon-overlay, #cw-reward-overlay {
      position: fixed;
      inset: 0;
      background: rgba(3, 8, 14, 0.78);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      display: none;
      align-items: center;
      justify-content: center;
      padding: clamp(10px, 2.5vw, 20px);
      pointer-events: auto;
      z-index: 1000010;
      opacity: 0;
      transition: opacity 0.22s ease;
    }

    #cw-coupon-overlay.cw-open, #cw-reward-overlay.cw-open {
      display: flex;
      opacity: 1;
    }

    #cw-coupon-card, #cw-reward-card {
      position: relative;
      width: min(460px, 100%);
      max-height: calc(100dvh - 28px);
      overflow-y: auto;
      box-sizing: border-box;
      padding: clamp(18px, 3vh, 26px) clamp(16px, 3vw, 24px);
      border-radius: 18px;
      background: rgba(6, 16, 26, 0.95);
      border: 1.5px solid rgba(0, 240, 255, 0.65);
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.7), 0 0 28px rgba(0, 240, 255, 0.25), inset 0 0 20px rgba(0, 240, 255, 0.08);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      color: #ffffff;
      transform: scale(0.95);
      transition: transform 0.22s cubic-bezier(0.34, 1.56, 0.64, 1);
    }

    #cw-coupon-overlay.cw-open #cw-coupon-card, #cw-reward-overlay.cw-open #cw-reward-card {
      transform: scale(1);
    }

    /* PASS D: HOLOGRAPHIC REWARD CARD STYLING */
    #cw-reward-card {
      background: linear-gradient(135deg, rgba(8, 22, 38, 0.96) 0%, rgba(22, 14, 38, 0.96) 50%, rgba(6, 28, 38, 0.96) 100%);
      border: 1.5px solid rgba(0, 240, 255, 0.85);
      box-shadow: 0 10px 40px rgba(0, 0, 0, 0.8), 0 0 35px rgba(0, 240, 255, 0.35), 0 0 60px rgba(255, 0, 128, 0.2), inset 0 0 25px rgba(0, 240, 255, 0.15);
      text-align: center;
      perspective: 1000px;
    }

    .cw-holo-shimmer {
      position: absolute;
      inset: 0;
      border-radius: 18px;
      background: linear-gradient(105deg, transparent 20%, rgba(0, 240, 255, 0.12) 35%, rgba(255, 0, 128, 0.1) 50%, rgba(255, 215, 0, 0.14) 65%, transparent 80%);
      background-size: 200% 200%;
      animation: cwHoloShimmer 4s infinite linear;
      pointer-events: none;
    }

    @keyframes cwHoloShimmer {
      0% { background-position: -100% -100%; }
      100% { background-position: 200% 200%; }
    }

    #cw-confetti-canvas {
      position: fixed;
      inset: 0;
      width: 100vw;
      height: 100vh;
      pointer-events: none;
      z-index: 1000009;
    }

    /* Cumulative Progress Box */
    .cw-reward-progress-box {
      margin-bottom: 14px;
      padding: 12px 14px;
      border-radius: 10px;
      background: rgba(0, 240, 255, 0.06);
      border: 1px solid rgba(0, 240, 255, 0.35);
      box-shadow: inset 0 0 12px rgba(0, 240, 255, 0.04);
    }

    .cw-progress-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .cw-progress-label {
      font-size: clamp(10px, 1.2vw, 11px);
      font-weight: 700;
      letter-spacing: 0.8px;
      color: rgba(220, 240, 255, 0.85);
      text-transform: uppercase;
    }

    .cw-progress-score {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(12px, 1.5vw, 14px);
      font-weight: 900;
      color: #ffd166;
      text-shadow: 0 0 8px rgba(255, 209, 102, 0.5);
    }

    .cw-progress-bar-bg {
      width: 100%;
      height: 8px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.1);
      overflow: hidden;
      margin-bottom: 6px;
      box-shadow: inset 0 1px 3px rgba(0, 0, 0, 0.4);
    }

    .cw-progress-bar-fill {
      height: 100%;
      border-radius: 4px;
      background: linear-gradient(90deg, #00f0ff 0%, #34d399 100%);
      box-shadow: 0 0 8px rgba(0, 240, 255, 0.7);
      transition: width 0.3s ease;
    }

    .cw-progress-subtext {
      font-size: 10.5px;
      color: rgba(180, 220, 240, 0.75);
      text-align: left;
      line-height: 1.4;
    }

    /* Section Header */
    .cw-coupons-section-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(11px, 1.3vw, 12px);
      font-weight: 800;
      letter-spacing: 1px;
      color: #00f0ff;
      margin-bottom: 8px;
      padding-bottom: 4px;
      border-bottom: 1px solid rgba(0, 240, 255, 0.2);
    }

    /* Coupon Item */
    .cw-coupon-item {
      margin-bottom: 10px;
      padding: 12px 14px;
      border-radius: 10px;
      background: rgba(0, 240, 255, 0.05);
      border: 1.2px dashed rgba(0, 240, 255, 0.4);
      text-align: left;
      transition: all 0.15s ease;
    }

    .cw-coupon-item:hover {
      background: rgba(0, 240, 255, 0.08);
      border-color: rgba(0, 240, 255, 0.7);
    }

    .cw-coupon-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .cw-coupon-discount {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(12px, 1.5vw, 13.5px);
      font-weight: 900;
      color: #ffd166;
      text-shadow: 0 0 6px rgba(255, 209, 102, 0.4);
    }

    .cw-status-badge {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 12px;
      font-family: 'Orbitron', sans-serif;
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.8px;
      text-transform: uppercase;
    }

    .cw-status-active {
      background: rgba(52, 211, 153, 0.18);
      border: 1px solid rgba(52, 211, 153, 0.7);
      color: #34d399;
      box-shadow: 0 0 6px rgba(52, 211, 153, 0.3);
    }

    .cw-status-redeemed {
      background: rgba(251, 191, 36, 0.18);
      border: 1px solid rgba(251, 191, 36, 0.7);
      color: #fbbf24;
    }

    .cw-status-expired {
      background: rgba(156, 163, 175, 0.18);
      border: 1px solid rgba(156, 163, 175, 0.5);
      color: #9ca3af;
    }

    .cw-coupon-code-row {
      display: flex;
      align-items: center;
      gap: 8px;
      margin: 8px 0;
    }

    .cw-coupon-code {
      flex: 1;
      padding: 8px 12px;
      border-radius: 8px;
      background: rgba(0, 240, 255, 0.15);
      border: 1px solid rgba(0, 240, 255, 0.8);
      color: #ffffff;
      font-family: 'Orbitron', monospace;
      font-size: clamp(13px, 1.6vw, 15px);
      font-weight: 900;
      letter-spacing: 2px;
      text-align: center;
      text-shadow: 0 0 8px rgba(0, 240, 255, 0.6);
      user-select: all;
    }

    .cw-coupon-details {
      font-size: 11px;
      color: rgba(210, 235, 250, 0.8);
      margin-bottom: 8px;
      display: flex;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 4px;
    }

    .cw-coupon-actions {
      display: flex;
      gap: 8px;
      margin-top: 6px;
    }

    .cw-coupon-btn {
      flex: 1;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 5px;
      padding: 7px 10px;
      border-radius: 6px;
      border: 1px solid rgba(0, 240, 255, 0.6);
      background: rgba(0, 240, 255, 0.15);
      color: #ffffff;
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(9px, 1.2vw, 10.5px);
      font-weight: 700;
      letter-spacing: 0.5px;
      text-align: center;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.15s ease;
      outline: none;
      box-sizing: border-box;
    }

    .cw-coupon-btn:hover {
      background: rgba(0, 240, 255, 0.35);
      box-shadow: 0 0 8px rgba(0, 240, 255, 0.4);
      transform: translateY(-1px);
    }

    .cw-coupon-btn:active {
      transform: translateY(0);
    }

    .cw-redeem-btn {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.3) 0%, rgba(4, 120, 87, 0.3) 100%);
      border-color: rgba(52, 211, 153, 0.7);
    }

    .cw-redeem-btn:hover {
      background: linear-gradient(135deg, rgba(16, 185, 129, 0.5) 0%, rgba(4, 120, 87, 0.5) 100%);
      box-shadow: 0 0 10px rgba(52, 211, 153, 0.5);
    }

    /* Empty State */
    .cw-coupons-empty {
      padding: 18px 14px;
      border-radius: 10px;
      background: rgba(0, 240, 255, 0.03);
      border: 1px solid rgba(0, 240, 255, 0.2);
      text-align: center;
      margin-bottom: 6px;
    }

    .cw-empty-icon {
      font-size: 26px;
      margin-bottom: 6px;
      filter: drop-shadow(0 0 8px rgba(0, 240, 255, 0.5));
    }

    .cw-empty-title {
      font-family: 'Orbitron', sans-serif;
      font-size: clamp(11.5px, 1.4vw, 13px);
      font-weight: 800;
      letter-spacing: 1px;
      color: #00f0ff;
      margin-bottom: 6px;
    }

    .cw-empty-desc {
      font-size: 11px;
      line-height: 1.5;
      color: rgba(220, 240, 255, 0.85);
      margin-bottom: 12px;
    }

    .cw-empty-desc strong {
      color: #ffd166;
    }

    .cw-store-visit-btn {
      display: inline-block;
      padding: 7px 14px;
      border-radius: 6px;
      background: rgba(0, 240, 255, 0.12);
      border: 1px solid rgba(0, 240, 255, 0.5);
      color: #ffffff;
      font-family: 'Orbitron', sans-serif;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-decoration: none;
      transition: all 0.15s ease;
    }

    .cw-store-visit-btn:hover {
      background: rgba(0, 240, 255, 0.3);
      box-shadow: 0 0 10px rgba(0, 240, 255, 0.4);
    }

    .cw-reward-discount {
      font-size: 34px;
      font-weight: 900;
      color: #ffd166;
      text-shadow: 0 0 16px rgba(255, 209, 102, 0.7);
      margin: 10px 0;
    }

    .cw-reward-action {
      width: 100%;
      margin-top: 10px;
      padding: 12px;
      border-radius: 10px;
      border: 1px solid #00f0ff;
      background: linear-gradient(135deg, rgba(0, 240, 255, 0.3) 0%, rgba(0, 160, 220, 0.2) 100%);
      color: #ffffff;
      font-family: 'Orbitron', sans-serif;
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 1px;
      cursor: pointer;
      transition: all 0.15s ease;
    }

    .cw-reward-action:hover {
      background: rgba(0, 240, 255, 0.45);
      box-shadow: 0 0 12px rgba(0, 240, 255, 0.4);
    }

    /* Custom Scrollbar for HUD Modals */
    #cw-rules::-webkit-scrollbar, #cw-coupon-card::-webkit-scrollbar {
      width: 5px;
    }
    #cw-rules::-webkit-scrollbar-track, #cw-coupon-card::-webkit-scrollbar-track {
      background: rgba(0, 20, 30, 0.5);
      border-radius: 10px;
    }
    #cw-rules::-webkit-scrollbar-thumb, #cw-coupon-card::-webkit-scrollbar-thumb {
      background: rgba(0, 240, 255, 0.5);
      border-radius: 10px;
    }

    /* =====================================================
       RESPONSIVE ADAPTATIONS ACROSS VIEWPORT ARCHETYPES
    ===================================================== */
    @media (max-height: 460px) {
      #cw-dashboard {
        width: 142px;
        padding: 5px 9px;
      }
      .cw-header-badge {
        margin-bottom: 2px;
        padding-bottom: 2px;
      }
      .cw-header-title {
        font-size: 9.5px;
      }
      .cw-row {
        margin-top: 2px;
        font-size: 9px;
      }
      .cw-row-label {
        font-size: 8px;
      }
      .cw-value {
        font-size: 11.5px;
      }
      .cw-reward-val {
        font-size: 9px;
      }
      .cw-action-btn {
        width: 36px;
        height: 36px;
      }
      #cw-minimap-frame {
        width: 82px;
        height: 82px;
      }
      .cw-delivery-badge {
        padding: 1.5px 5px;
        font-size: 7px;
      }
      #cw-rules {
        max-height: calc(100dvh - 16px);
        padding: 10px 14px;
      }
      .cw-modal-header {
        margin-bottom: 8px;
        padding-bottom: 6px;
      }
      .cw-rules-title {
        font-size: 14px;
      }
      .cw-rules-badge {
        font-size: 8.5px;
        padding: 2px 7px;
      }
      .cw-rule-section {
        margin-bottom: 6px;
        padding: 6px 9px;
        font-size: 10.5px;
      }
      .cw-controls-list {
        margin: 3px 0 0 0;
        padding-left: 14px;
        font-size: 10px;
      }
      .cw-desktop-hint {
        font-size: 9px;
      }
      .cw-modal-close-x {
        width: 26px;
        height: 26px;
        font-size: 13px;
      }
      .cw-close-btn {
        margin-top: 8px;
        padding: 6px 10px;
        font-size: 10px;
      }
      #cw-coupon-card, #cw-reward-card {
        max-height: calc(100dvh - 16px);
        padding: 10px 14px;
      }
      .cw-reward-progress-box {
        margin-bottom: 8px;
        padding: 6px 10px;
      }
      .cw-progress-header {
        margin-bottom: 3px;
      }
      .cw-progress-label {
        font-size: 9px;
      }
      .cw-progress-score {
        font-size: 11px;
      }
      .cw-progress-bar-bg {
        height: 6px;
        margin-bottom: 3px;
      }
      .cw-progress-subtext {
        font-size: 9px;
      }
      .cw-coupons-section-header {
        font-size: 10px;
        margin-bottom: 4px;
      }
      .cw-coupon-item {
        margin-bottom: 6px;
        padding: 7px 10px;
      }
      .cw-coupon-code {
        font-size: 11.5px;
        padding: 3px 6px;
      }
      .cw-coupon-discount {
        font-size: 11px;
      }
      .cw-coupon-btn {
        padding: 4px 6px;
        font-size: 8.5px;
      }
      .cw-coupons-empty {
        padding: 10px 12px;
      }
      .cw-empty-icon {
        font-size: 18px;
        margin-bottom: 2px;
      }
      .cw-empty-title {
        font-size: 10.5px;
        margin-bottom: 3px;
      }
      .cw-empty-desc {
        font-size: 9.5px;
        margin-bottom: 6px;
      }
      .cw-store-visit-btn {
        padding: 4px 8px;
        font-size: 8.5px;
      }
    }

    @media (max-width: 680px) {
      #cw-dashboard {
        width: clamp(130px, 20vw, 150px);
      }
      .cw-action-btn {
        width: 38px;
        height: 38px;
      }
      #cw-minimap-frame {
        width: clamp(80px, 12vw, 92px);
        height: clamp(80px, 12vw, 92px);
      }
    }
  `;

  document.head.appendChild(style);
}

// -----------------------------------------------------
// PASS A: TRIGGER SCREEN PICKUP FLASH
// -----------------------------------------------------

export function triggerPickupFlash(): void {
  if (!pickupFlashElem) {
    pickupFlashElem = document.getElementById("cw-pickup-flash") as HTMLDivElement | null;
  }
  if (!pickupFlashElem) return;

  pickupFlashElem.classList.remove("cw-flash-active");
  void pickupFlashElem.offsetWidth; // Force reflow
  pickupFlashElem.classList.add("cw-flash-active");

  if (pickupFlashTimeout) {
    window.clearTimeout(pickupFlashTimeout);
  }
  pickupFlashTimeout = window.setTimeout(() => {
    pickupFlashElem?.classList.remove("cw-flash-active");
    pickupFlashTimeout = null;
  }, 110);
}

// -----------------------------------------------------
// PASS A: FLOATING SCORE TEXT
// -----------------------------------------------------

export function showFloatingScore(
  amount: number,
  type: "pickup" | "delivery" = "pickup"
): void {
  if (!floatingScoresContainer) {
    floatingScoresContainer = document.getElementById(
      "cw-floating-scores"
    ) as HTMLDivElement | null;
  }
  if (!floatingScoresContainer) return;

  const elem = document.createElement("div");
  elem.className = `cw-float-score ${type === "delivery" ? "cw-delivery" : "cw-pickup"}`;
  elem.textContent = `+${amount}`;

  // Random slight horizontal jitter around screen center
  const jitterX = (Math.random() - 0.5) * 80;
  const jitterY = (Math.random() - 0.5) * 40;
  elem.style.left = `calc(50% + ${jitterX}px)`;
  elem.style.top = `calc(48% + ${jitterY}px)`;

  floatingScoresContainer.appendChild(elem);

  setTimeout(() => {
    elem.remove();
  }, 900);
}

// -----------------------------------------------------
// PASS D: CONFETTI CELEBRATION
// -----------------------------------------------------

interface ConfettiPiece {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  alpha: number;
}

function triggerConfettiCelebration(): void {
  if (!confettiCanvas) {
    confettiCanvas = document.createElement("canvas");
    confettiCanvas.id = "cw-confetti-canvas";
    document.body.appendChild(confettiCanvas);
  }

  confettiCanvas.width = window.innerWidth;
  confettiCanvas.height = window.innerHeight;
  const ctx = confettiCanvas.getContext("2d");
  if (!ctx) return;

  const colors = ["#00f0ff", "#ffd166", "#ff007f", "#34d399", "#a78bfa"];
  const pieces: ConfettiPiece[] = [];
  const pieceCount = 70;

  for (let i = 0; i < pieceCount; i++) {
    pieces.push({
      x: window.innerWidth * 0.5 + (Math.random() - 0.5) * 150,
      y: window.innerHeight * 0.45 + (Math.random() - 0.5) * 80,
      vx: (Math.random() - 0.5) * 12,
      vy: -(Math.random() * 10 + 4),
      size: Math.random() * 8 + 6,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * Math.PI * 2,
      rotationSpeed: (Math.random() - 0.5) * 0.2,
      alpha: 1,
    });
  }

  const startTime = performance.now();

  function renderConfetti(currentTime: number): void {
    if (!ctx || !confettiCanvas) return;
    const elapsed = (currentTime - startTime) * 0.001;
    ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);

    let activeCount = 0;
    for (const p of pieces) {
      p.vy += 0.25; // Gravity
      p.x += p.vx;
      p.y += p.vy;
      p.rotation += p.rotationSpeed;
      if (elapsed > 1.8) {
        p.alpha = Math.max(0, 1 - (elapsed - 1.8) / 1.2);
      }

      if (p.alpha > 0 && p.y < window.innerHeight + 50) {
        activeCount++;
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;
        ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
        ctx.restore();
      }
    }

    if (activeCount > 0 && elapsed < 3.2) {
      requestAnimationFrame(renderConfetti);
    } else {
      ctx.clearRect(0, 0, confettiCanvas.width, confettiCanvas.height);
      confettiCanvas.remove();
      confettiCanvas = null;
    }
  }

  requestAnimationFrame(renderConfetti);
}

// -----------------------------------------------------
// MINIMAP COMPONENT (Top-Right Circular Radar)
// -----------------------------------------------------

function createMinimap(): void {
  minimapContainer = document.createElement("div");
  minimapContainer.id = "cw-minimap-container";

  const frame = document.createElement("div");
  frame.id = "cw-minimap-frame";

  minimapCanvas = document.createElement("canvas");
  minimapCanvas.id = "cw-minimap";
  minimapCanvas.width = 160;
  minimapCanvas.height = 160;

  frame.appendChild(minimapCanvas);
  minimapContainer.appendChild(frame);

  const deliveryBadge = document.createElement("div");
  deliveryBadge.className = "cw-delivery-badge";
  deliveryBadge.innerHTML = `
    <svg class="cw-delivery-badge-icon" viewBox="0 0 24 24">
      <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
    </svg>
    <span>DELIVERY ZONE</span>
  `;
  minimapContainer.appendChild(deliveryBadge);

  hudRoot?.appendChild(minimapContainer);
}

function updateMinimap(): void {
  if (!minimapCanvas || !hudWorld) {
    return;
  }
  renderCityMinimap(minimapCanvas, hudWorld);
}

// -----------------------------------------------------
// CREATE HUD PRESENTATION LAYER
// -----------------------------------------------------

function createHUD(): void {
  if (document.getElementById("cw-root")) {
    return;
  }

  injectFont();
  injectStyles();

  previousScore = gameData.score;
  previousSeconds = 60;

  hudRoot = document.createElement("div");
  hudRoot.id = "cw-root";

  // PASS A: Pickup flash element
  pickupFlashElem = document.createElement("div");
  pickupFlashElem.id = "cw-pickup-flash";
  document.body.appendChild(pickupFlashElem);

  // PASS A: Floating scores container
  floatingScoresContainer = document.createElement("div");
  floatingScoresContainer.id = "cw-floating-scores";
  document.body.appendChild(floatingScoresContainer);

  // ------------------------------------
  // 1. TOP-LEFT DASHBOARD
  // ------------------------------------
  dashboard = document.createElement("div");
  dashboard.id = "cw-dashboard";
  dashboard.innerHTML = `
    <div class="cw-header-badge">
      <div class="cw-header-left">
        <div class="cw-header-dot"></div>
        <span class="cw-header-title">CYBERWRAP</span>
      </div>
      <span class="cw-live-tag">LIVE</span>
    </div>

    <div class="cw-row">
      <span class="cw-row-label">TIME</span>
      <span id="cw-time" class="cw-value">60</span>
    </div>

    <div class="cw-row">
      <span class="cw-row-label">SCORE</span>
      <span id="cw-score" class="cw-value">0</span>
    </div>

    <div class="cw-row">
      <span class="cw-row-label">REWARD</span>
      <span id="cw-reward-score" class="cw-value cw-reward-val">0 / 2,000</span>
    </div>
  `;
  hudRoot.appendChild(dashboard);

  // ------------------------------------
  // 2. TOP-CENTER ACTION BUTTONS
  // ------------------------------------
  topCenterButtons = document.createElement("div");
  topCenterButtons.id = "cw-top-center-buttons";

  // Rules Button [ RULES ]
  rulesButton = document.createElement("button");
  rulesButton.className = "cw-action-btn";
  rulesButton.id = "cw-btn-rules";
  rulesButton.setAttribute("data-tooltip", "RULES");
  rulesButton.setAttribute("aria-label", "RULES");
  rulesButton.setAttribute("type", "button");
  rulesButton.innerHTML = `
    <div class="cw-action-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
      </svg>
    </div>
  `;

  // Coupons Button [ COUPON ]
  couponButton = document.createElement("button");
  couponButton.className = "cw-action-btn";
  couponButton.id = "cw-btn-coupons";
  couponButton.setAttribute("data-tooltip", "COUPON");
  couponButton.setAttribute("aria-label", "COUPON");
  couponButton.setAttribute("type", "button");
  couponButton.innerHTML = `
    <div class="cw-action-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82z"></path>
        <line x1="7" y1="7" x2="7.01" y2="7"></line>
      </svg>
    </div>
  `;

  // Camera Indicator Button [ CAMERA ]
  cameraButton = document.createElement("button");
  cameraButton.className = "cw-action-btn";
  cameraButton.id = "cw-btn-camera";
  cameraButton.setAttribute("data-tooltip", CHASE_CAMERA_INFO.name);
  cameraButton.setAttribute("aria-label", CHASE_CAMERA_INFO.name);
  cameraButton.setAttribute("type", "button");
  cameraButton.innerHTML = `
    <div class="cw-action-icon">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
        <circle cx="12" cy="13" r="4"></circle>
      </svg>
    </div>
  `;

  topCenterButtons.appendChild(rulesButton);
  topCenterButtons.appendChild(couponButton);
  topCenterButtons.appendChild(cameraButton);
  hudRoot.appendChild(topCenterButtons);

  // Camera Mode Toast Notification Pill
  cameraToast = document.createElement("div");
  cameraToast.id = "cw-camera-toast";
  hudRoot.appendChild(cameraToast);

  // ------------------------------------
  // 3. TOP-RIGHT RADAR MINIMAP
  // ------------------------------------
  createMinimap();

  // ------------------------------------
  // 4. FLOATING DELIVERY SCORE POPUP
  // ------------------------------------
  scorePopup = document.createElement("div");
  scorePopup.id = "cw-score-popup";
  scorePopup.textContent = "+0";
  hudRoot.appendChild(scorePopup);

  // ------------------------------------
  // 5. RULES OVERLAY MODAL
  // ------------------------------------
  rulesOverlay = document.createElement("div");
  rulesOverlay.id = "cw-rules-overlay";
  rulesOverlay.innerHTML = `
    <div id="cw-rules" role="dialog" aria-modal="true" aria-labelledby="cw-rules-title">
      <div class="cw-modal-header">
        <button class="cw-modal-close-x" id="cw-rules-close-x" type="button" aria-label="Close Rules">✕</button>
        <h2 class="cw-rules-title" id="cw-rules-title">CYBERWRAP</h2>
        <div class="cw-rules-badge">${GAME_CONFIG.ROUND_TIME}-SECOND DELIVERY CHALLENGE</div>
      </div>
      
      <div class="cw-rule-section">
        Drive around the city and collect as many food items as possible.
      </div>

      <div class="cw-rule-section">
        <strong>COLLECTIBLES</strong><br>
        Collectibles give points. Return collected items to the <strong>DailyBread Shawarma Hub</strong> to score them.
      </div>

      <div class="cw-rule-section">
        <strong>REWARDS</strong><br>
        Reach <strong>2,000 cumulative points</strong> to progress toward an exclusive discount coupon.
      </div>

      <div class="cw-rule-section">
        <strong>USE:</strong>
        <ul class="cw-controls-list">
          <li><strong>Steering</strong> to control the truck</li>
          <li><strong>GAS</strong> to accelerate</li>
          <li><strong>REV</strong> to reverse</li>
        </ul>
        <div class="cw-desktop-hint">Desktop: <strong>W/S</strong> or <strong>↑/↓</strong> for throttle, <strong>A/D</strong> or <strong>←/→</strong> for steering, <strong>Space</strong> for brake</div>
      </div>

      <button class="cw-close-btn" id="cw-rules-close" type="button">CLOSE</button>
    </div>
  `;
  hudRoot.appendChild(rulesOverlay);
  rulesPanel = rulesOverlay.querySelector("#cw-rules");

  // ------------------------------------
  // 6. COUPONS MODAL
  // ------------------------------------
  couponOverlay = document.createElement("div");
  couponOverlay.id = "cw-coupon-overlay";
  couponOverlay.innerHTML = `
    <div id="cw-coupon-card" role="dialog" aria-modal="true" aria-labelledby="cw-coupons-title">
      <div class="cw-modal-header">
        <button class="cw-modal-close-x" id="cw-coupons-close-x" type="button" aria-label="Close Rewards">✕</button>
        <h2 class="cw-rules-title" id="cw-coupons-title">CYBERWRAP REWARDS</h2>
        <div class="cw-rules-badge">DAILY BREAD SHAWARMA</div>
      </div>

      <!-- Cumulative Progress Section -->
      <div class="cw-reward-progress-box">
        <div class="cw-progress-header">
          <span class="cw-progress-label">CURRENT CUMULATIVE PROGRESS</span>
          <span class="cw-progress-score" id="cw-coupons-cumulative-score">0 / 2,000</span>
        </div>
        <div class="cw-progress-bar-bg">
          <div class="cw-progress-bar-fill" id="cw-coupons-progress-fill" style="width: 0%;"></div>
        </div>
        <div class="cw-progress-subtext">
          Reach <strong>2,000 cumulative points</strong> to unlock a <strong>20% discount coupon</strong> for dailybreadshawarma.store.
        </div>
      </div>

      <!-- Available Coupons Section -->
      <div class="cw-coupons-section-header">
        <span>AVAILABLE COUPONS</span>
        <span id="cw-coupons-count-badge" style="font-size: 9.5px; opacity: 0.85;">0 UNLOCKED</span>
      </div>

      <div id="cw-coupons-content">
        <div style="padding: 14px; color: rgba(220, 240, 255, 0.75); font-size: 11px; text-align: center;">Loading reward records...</div>
      </div>

      <button class="cw-close-btn" id="cw-coupons-close" type="button">CLOSE</button>
    </div>
  `;
  hudRoot.appendChild(couponOverlay);
  couponsPanel = couponOverlay.querySelector("#cw-coupons-content");

  // ------------------------------------
  // 7. PASS D: HOLOGRAPHIC REWARD EARNED MODAL
  // ------------------------------------
  rewardOverlay = document.createElement("div");
  rewardOverlay.id = "cw-reward-overlay";
  rewardOverlay.innerHTML = `
    <div id="cw-reward-card" role="dialog" aria-modal="true" aria-labelledby="cw-reward-title">
      <div class="cw-holo-shimmer"></div>
      <div style="position: relative; z-index: 2;">
        <div style="font-size: 11px; letter-spacing: 2px; font-weight: 800; color: #00f0ff; margin-bottom: 4px; text-transform: uppercase;">
          ★ 2,000 PTS THRESHOLD ACHIEVED ★
        </div>
        <h2 class="cw-rules-title" id="cw-reward-title" style="font-size: 22px; color: #ffffff; text-shadow: 0 0 15px rgba(0, 240, 255, 0.8);">
          REWARD UNLOCKED!
        </h2>
        <div class="cw-reward-discount" id="cw-reward-discount">20% OFF</div>
        <div style="font-size: 11.5px; letter-spacing: 1px; color: rgba(220, 245, 255, 0.85); margin-bottom: 8px;">
          DAILY BREAD SHAWARMA EXCLUSIVE COUPON
        </div>
        <div class="cw-coupon-code-row" style="margin: 12px 0;">
          <div class="cw-coupon-code" id="cw-reward-code">CW-REWARD-20</div>
        </div>
        <div id="cw-reward-expiry" style="font-size: 11px; color: rgba(220, 245, 255, 0.75); margin-bottom: 14px;"></div>
        <div style="display: flex; gap: 8px; margin-bottom: 10px;">
          <button class="cw-reward-action" id="cw-reward-copy" type="button" style="margin-top: 0;">📋 COPY CODE</button>
          <a href="https://dailybreadshawarma.store" target="_blank" rel="noopener noreferrer" class="cw-coupon-btn cw-redeem-btn" style="flex: 1; padding: 12px; font-size: 11px; border-radius: 10px;">
            REDEEM ONLINE ↗
          </a>
        </div>
        <button class="cw-close-btn" id="cw-reward-close" type="button" style="margin-top: 4px;">CONTINUE PLAYING</button>
      </div>
    </div>
  `;
  hudRoot.appendChild(rewardOverlay);
  rewardCard = rewardOverlay.querySelector("#cw-reward-card");

  // Holographic 3D card tilt effect
  if (rewardCard) {
    rewardCard.addEventListener("mousemove", (e) => {
      const rect = rewardCard!.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      const rotY = (x / (rect.width / 2)) * 12;
      const rotX = -(y / (rect.height / 2)) * 12;
      rewardCard!.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(1.02)`;
    });

    rewardCard.addEventListener("mouseleave", () => {
      rewardCard!.style.transform = "perspective(800px) rotateX(0deg) rotateY(0deg) scale(1)";
    });
  }

  // Attach HUD to DOM
  document.body.appendChild(hudRoot);

  // Cache text element references
  timeValue = document.getElementById("cw-time") as HTMLSpanElement;
  scoreValue = document.getElementById("cw-score") as HTMLSpanElement;
  rewardScoreValue = document.getElementById("cw-reward-score") as HTMLSpanElement;

  // ------------------------------------
  // BUTTON & MODAL EVENT BINDINGS
  // ------------------------------------
  document.getElementById("cw-rules-close")?.addEventListener("click", () => {
    rulesOverlay?.classList.remove("cw-open");
  });

  document.getElementById("cw-rules-close-x")?.addEventListener("click", () => {
    rulesOverlay?.classList.remove("cw-open");
  });

  rulesOverlay?.addEventListener("click", (e) => {
    if (e.target === rulesOverlay) {
      rulesOverlay.classList.remove("cw-open");
    }
  });

  document.getElementById("cw-coupons-close")?.addEventListener("click", () => {
    couponOverlay?.classList.remove("cw-open");
  });

  document.getElementById("cw-coupons-close-x")?.addEventListener("click", () => {
    couponOverlay?.classList.remove("cw-open");
  });

  couponOverlay?.addEventListener("click", (e) => {
    if (e.target === couponOverlay) {
      couponOverlay.classList.remove("cw-open");
    }
  });

  document.getElementById("cw-reward-close")?.addEventListener("click", () => {
    rewardOverlay?.classList.remove("cw-open");
  });

  rulesButton.onclick = () => {
    couponOverlay?.classList.remove("cw-open");
    rulesOverlay?.classList.toggle("cw-open");
  };

  couponButton.onclick = () => {
    rulesOverlay?.classList.remove("cw-open");
    couponOverlay?.classList.toggle("cw-open");
    if (couponOverlay?.classList.contains("cw-open")) {
      updateCouponsModalContent(latestCoupons, latestRewardProgress);
      void loadAnonymousRewardProgress();
      void loadAnonymousCoupons();
    }
  };

  cameraButton.onclick = () => {
    showCameraModeToast(CHASE_CAMERA_INFO);
  };

  // Copy Reward Code
  document.getElementById("cw-reward-copy")?.addEventListener("click", async () => {
    const btn = document.getElementById("cw-reward-copy") as HTMLButtonElement;
    const code = document.getElementById("cw-reward-code")?.textContent ?? "";
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      }
      btn.textContent = "COPIED ✓";
      setTimeout(() => {
        btn.textContent = "📋 COPY CODE";
      }, 1800);
    } catch {
      btn.textContent = "COPIED ✓";
    }
  });

  // Reward Updated Event
  window.addEventListener("cyberwrap-reward-updated", (event) => {
    latestRewardProgress = (event as CustomEvent<RewardProgress>).detail;
    if (rewardScoreValue && latestRewardProgress) {
      rewardScoreValue.textContent = `${latestRewardProgress.cumulative_score.toLocaleString()} / 2,000`;
    }
    updateCouponsModalContent(latestCoupons, latestRewardProgress);
  });

  // Coupons List Updated Event
  window.addEventListener("cyberwrap-coupons-updated", (event) => {
    latestCoupons = (event as CustomEvent<RewardCoupon[]>).detail;
    updateCouponsModalContent(latestCoupons, latestRewardProgress);
  });

  // Initial update and background prefetch
  updateCouponsModalContent(latestCoupons, latestRewardProgress);
  void loadAnonymousRewardProgress();
  void loadAnonymousCoupons();

  // PASS D: Reward Earned Celebration Event
  window.addEventListener("cyberwrap-reward-earned", (event) => {
    const coupon = (event as CustomEvent<RewardCoupon>).detail;
    const discount = document.getElementById("cw-reward-discount");
    const code = document.getElementById("cw-reward-code");
    const expiry = document.getElementById("cw-reward-expiry");

    if (!rewardOverlay || !discount || !code || !expiry) return;

    discount.textContent = `${coupon.discount_percent}% OFF`;
    code.textContent = coupon.code;
    expiry.textContent = `Valid until: ${new Date(coupon.expires_at).toLocaleDateString()}`;
    
    // Trigger confetti burst & open holographic reward card
    triggerConfettiCelebration();
    rewardOverlay.classList.add("cw-open");
  });
}

// -----------------------------------------------------
// COUPON CONTENT RENDERER
// -----------------------------------------------------

function updateCouponsModalContent(
  coupons: RewardCoupon[],
  progress: RewardProgress | null,
): void {
  const cumulativeScoreElem = document.getElementById("cw-coupons-cumulative-score");
  const progressFillElem = document.getElementById("cw-coupons-progress-fill");
  const countBadgeElem = document.getElementById("cw-coupons-count-badge");

  const score = progress ? progress.cumulative_score : 0;
  if (cumulativeScoreElem) {
    cumulativeScoreElem.textContent = `${score.toLocaleString()} / 2,000`;
  }
  if (progressFillElem) {
    const percent = Math.min(100, Math.max(0, (score / 2000) * 100));
    progressFillElem.style.width = `${percent}%`;
  }
  if (countBadgeElem) {
    countBadgeElem.textContent = `${coupons.length} ${coupons.length === 1 ? "COUPON" : "COUPONS"}`;
  }

  if (!couponsPanel) return;

  if (coupons.length > 0) {
    couponsPanel.innerHTML = coupons
      .map((c) => {
        const statusClass =
          c.status === "active"
            ? "cw-status-active"
            : c.status === "redeemed"
              ? "cw-status-redeemed"
              : "cw-status-expired";

        let formattedExpiry = c.expires_at;
        try {
          const expDate = new Date(c.expires_at);
          if (!isNaN(expDate.getTime())) {
            formattedExpiry = expDate.toLocaleString(undefined, {
              year: "numeric",
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            });
          }
        } catch {
          // fallback
        }

        return `
          <div class="cw-coupon-item">
            <div class="cw-coupon-meta">
              <span class="cw-coupon-discount">${c.discount_percent}% DISCOUNT</span>
              <span class="cw-status-badge ${statusClass}">${c.status.toUpperCase()}</span>
            </div>
            <div class="cw-coupon-code-row">
              <div class="cw-coupon-code">${c.code}</div>
            </div>
            <div class="cw-coupon-details">
              <span>Expires: <strong>${formattedExpiry}</strong></span>
              <span>Status: <strong style="text-transform: capitalize;">${c.status}</strong></span>
            </div>
            <div class="cw-coupon-actions">
              <button type="button" class="cw-coupon-btn" data-copy-code="${c.code}">📋 COPY CODE</button>
              <a href="https://dailybreadshawarma.store" target="_blank" rel="noopener noreferrer" class="cw-coupon-btn cw-redeem-btn">REDEEM ONLINE ↗</a>
            </div>
          </div>
        `;
      })
      .join("");

    couponsPanel.querySelectorAll<HTMLButtonElement>("[data-copy-code]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const code = btn.dataset.copyCode ?? "";
        try {
          if (navigator.clipboard?.writeText) {
            await navigator.clipboard.writeText(code);
          }
          btn.textContent = "COPIED ✓";
          setTimeout(() => {
            btn.textContent = "📋 COPY CODE";
          }, 1500);
        } catch {
          btn.textContent = "COPIED ✓";
        }
      });
    });
  } else {
    couponsPanel.innerHTML = `
      <div class="cw-coupons-empty">
        <div class="cw-empty-icon">🎁</div>
        <div class="cw-empty-title">NO AVAILABLE COUPONS</div>
        <div class="cw-empty-desc">
          Deliver shawarma food items across your rounds and reach <strong>2,000 cumulative points</strong> to earn an exclusive <strong>20% discount coupon</strong> for Daily Bread Shawarma!
        </div>
        <a href="https://dailybreadshawarma.store" target="_blank" rel="noopener noreferrer" class="cw-store-visit-btn">
          VISIT DAILYBREADSHAWARMA.STORE ↗
        </a>
      </div>
    `;
  }
}

// -----------------------------------------------------
// CAMERA MODE TOAST NOTIFICATION
// -----------------------------------------------------

export function showCameraModeToast(modeInfo: { name: string; badge: string; subtext: string } = CHASE_CAMERA_INFO): void {
  if (!cameraToast) return;

  cameraToast.innerHTML = `
    <span class="cw-cam-badge">${modeInfo.badge}</span>
    <span class="cw-cam-subtext">${modeInfo.subtext}</span>
  `;
  cameraToast.classList.remove("cw-toast-visible");
  void cameraToast.offsetWidth; // Force reflow
  cameraToast.classList.add("cw-toast-visible");

  if (cameraButton) {
    cameraButton.setAttribute("data-tooltip", modeInfo.name);
    cameraButton.setAttribute("aria-label", modeInfo.name);
  }

  if (cameraToastTimer) {
    window.clearTimeout(cameraToastTimer);
  }
  cameraToastTimer = window.setTimeout(() => {
    cameraToast?.classList.remove("cw-toast-visible");
    cameraToastTimer = null;
  }, 2200);
}

// -----------------------------------------------------
// DELIVERY SCORE POPUP
// -----------------------------------------------------

export function showDeliveryScore(amount: number): void {
  if (!scorePopup) return;

  scorePopup.textContent = `+${amount}`;
  scorePopup.classList.remove("cw-show");
  void scorePopup.offsetWidth; // Force reflow
  scorePopup.classList.add("cw-show");

  setTimeout(() => {
    scorePopup?.classList.remove("cw-show");
  }, 1200);
}

// -----------------------------------------------------
// HUD UPDATE LOOP
// -----------------------------------------------------

function updateHUD(): void {
  if (!timeValue || !scoreValue) {
    hudAnimationFrame = requestAnimationFrame(updateHUD);
    return;
  }

  // Update Time
  const seconds = Math.max(0, Math.ceil(gameData.timeLeft));
  timeValue.textContent = seconds.toString();

  // PASS C: Last 10 seconds urgency
  if (seconds <= 10 && seconds > 0) {
    timeValue.classList.add("lowTime");
    dashboard?.classList.add("cw-panic-mode");

    // Trigger timer shake on exact 10s entry
    if (seconds === 10 && previousSeconds > 10) {
      timeValue.classList.remove("cw-timer-shake");
      void timeValue.offsetWidth;
      timeValue.classList.add("cw-timer-shake");
    }
  } else {
    timeValue.classList.remove("lowTime");
    dashboard?.classList.remove("cw-panic-mode");
  }
  previousSeconds = seconds;

  // Update Score
  if (gameData.score !== previousScore) {
    scoreValue.classList.remove("scoreFlash");
    void scoreValue.offsetWidth;
    scoreValue.classList.add("scoreFlash");
    previousScore = gameData.score;
  }
  scoreValue.textContent = gameData.score.toString();

  // Update Minimap Radar
  updateMinimap();

  hudAnimationFrame = requestAnimationFrame(updateHUD);
}

// -----------------------------------------------------
// CLEANUP HUD
// -----------------------------------------------------

function destroyHUD(): void {
  if (hudAnimationFrame) {
    cancelAnimationFrame(hudAnimationFrame);
    hudAnimationFrame = 0;
  }

  if (hudRoot) {
    hudRoot.remove();
    hudRoot = null;
  }

  if (pickupFlashElem) {
    pickupFlashElem.remove();
    pickupFlashElem = null;
  }

  if (floatingScoresContainer) {
    floatingScoresContainer.remove();
    floatingScoresContainer = null;
  }

  if (confettiCanvas) {
    confettiCanvas.remove();
    confettiCanvas = null;
  }

  dashboard = null;
  topCenterButtons = null;
  rulesOverlay = null;
  rulesPanel = null;
  couponsPanel = null;
  couponOverlay = null;
  rewardOverlay = null;
  rewardCard = null;
  if (cameraToastTimer) {
    window.clearTimeout(cameraToastTimer);
    cameraToastTimer = null;
  }
  cameraToast = null;
  rulesButton = null;
  couponButton = null;
  cameraButton = null;
  timeValue = null;
  scoreValue = null;
  rewardScoreValue = null;
  scorePopup = null;
  minimapContainer = null;
  minimapCanvas = null;
  hudWorld = null;
}

// -----------------------------------------------------
// ECS HUD COMPONENT REGISTRATION
// -----------------------------------------------------

ecs.registerComponent({
  name: "hud",

  stateMachine: ({ world, defineState }) => {
    defineState("ready")
      .initial()
      .onEnter(() => {
        hudWorld = world;
        createHUD();
        hudAnimationFrame = requestAnimationFrame(updateHUD);
      })
      .onExit(() => {
        destroyHUD();
      });
  },
});
