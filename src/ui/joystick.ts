import * as ecs from "@8thwall/ecs";
import { gameData } from "../core/game-data";
import steeringImage from "../assets/steering.png";
import { activateNitro, NITRO_UPDATED_EVENT } from "../core/nitro";
import {
  runtimeVehicleConfig,
  VEHICLE_CONFIG_UPDATED_EVENT,
} from "../core/vehicle-config";

// --------------------------------------------------
// Remove old controls
// --------------------------------------------------

function clearControls(): void {
  document.querySelectorAll(".cyberwrap-control").forEach((el) => el.remove());
}

// --------------------------------------------------
// Component: Virtual Steering Wheel + Nitro + Compact Pedals
// --------------------------------------------------

ecs.registerComponent({
  name: "joystick",

  stateMachine: ({ defineState }) => {
    defineState("ready")
      .initial()
      .onEnter(() => {
        clearControls();

        // Ensure keyframe animation for Nitro pulse exists
        if (!document.getElementById("cw-nitro-anim-styles")) {
          const style = document.createElement("style");
          style.id = "cw-nitro-anim-styles";
          style.textContent = `
            @keyframes cwNitroPulse {
              0%, 100% {
                box-shadow: 0 3px 14px rgba(0, 0, 0, 0.6), 0 0 16px rgba(37, 99, 235, 0.85), 0 0 24px rgba(96, 165, 250, 0.5), inset 0 0 8px rgba(255, 255, 255, 0.35);
                border-color: #60a5fa;
                transform: scale(1);
              }
              50% {
                box-shadow: 0 4px 20px rgba(0, 0, 0, 0.7), 0 0 24px rgba(37, 99, 235, 1), 0 0 32px rgba(96, 165, 250, 0.85), inset 0 0 12px rgba(255, 255, 255, 0.55);
                border-color: #93c5fd;
                transform: scale(1.03);
              }
            }
          `;
          document.head.appendChild(style);
        }

        let touchSteering = 0;
        let touchThrottle = 0;

        let keyGas = false;
        let keyRev = false;
        let keyLeft = false;
        let keyRight = false;

        let btnLeftEl: HTMLButtonElement | null = null;
        let btnRightEl: HTMLButtonElement | null = null;
        let leftPressed = false;
        let rightPressed = false;

        function setSteerBtnActive(btn: HTMLButtonElement | null, active: boolean): void {
          if (!btn) return;
          if (active) {
            btn.style.background = "linear-gradient(180deg, #00f0ff 0%, #0088cc 100%)";
            btn.style.borderColor = "#ffffff";
            btn.style.color = "#030a12";
            btn.style.boxShadow =
              "0 0 22px rgba(0, 240, 255, 0.95), inset 0 0 10px rgba(255, 255, 255, 0.8)";
            btn.style.transform = "scale(0.93)";
          } else {
            btn.style.background = "linear-gradient(180deg, #0d263e 0%, #051320 100%)";
            btn.style.borderColor = "rgba(0, 240, 255, 0.7)";
            btn.style.color = "#00f0ff";
            btn.style.boxShadow =
              "0 4px 16px rgba(0, 0, 0, 0.75), 0 0 12px rgba(0, 240, 255, 0.3), inset 0 0 8px rgba(0, 240, 255, 0.1)";
            btn.style.transform = "scale(1)";
          }
        }

        function updateInput(): void {
          let s = touchSteering;
          let t = touchThrottle;

          // Keyboard overrides / blends
          if (keyLeft && !keyRight) {
            s = -1;
          } else if (keyRight && !keyLeft) {
            s = 1;
          }

          if (keyGas && !keyRev) {
            t = 1;
          } else if (keyRev && !keyGas) {
            t = -1;
          }

          gameData.input.steering = s;
          gameData.input.throttle = t;

          // Visual rotation when controlled by keyboard
          if (!dragging && wheel) {
            if (s !== 0) {
              wheel.style.transform = `rotate(${s * 60}deg)`;
            } else {
              wheel.style.transform = "rotate(0deg)";
            }
          }

          // Visual button feedback for keyboard & touch
          if (btnLeftEl && btnRightEl) {
            setSteerBtnActive(btnLeftEl, leftPressed || (keyLeft && !keyRight));
            setSteerBtnActive(btnRightEl, rightPressed || (keyRight && !keyLeft));
          }
        }

        // ==================================================
        // BOTTOM-LEFT: VIRTUAL STEERING WHEEL (PNG ASSET)
        // ==================================================

        const wheelContainer = document.createElement("div");
        wheelContainer.className = "cyberwrap-control";
        wheelContainer.id = "cw-steering-container";
        wheelContainer.style.cssText = `
          position: fixed;
          left: max(10px, env(safe-area-inset-left, 10px));
          bottom: max(10px, env(safe-area-inset-bottom, 10px));
          width: min(clamp(90px, 14.5vw, 132px), 28vh);
          height: min(clamp(90px, 14.5vw, 132px), 28vh);
          z-index: 1000001;
          pointer-events: auto;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
          display: flex;
          align-items: center;
          justify-content: center;
        `;

        const resolvedSteeringUrl =
          steeringImage && !steeringImage.startsWith("/") && !steeringImage.startsWith("http")
            ? `/${steeringImage}`
            : steeringImage;

        const wheel = document.createElement("div");
        wheel.id = "cw-steering-wheel";
        wheel.setAttribute("draggable", "false");
        wheel.style.cssText = `
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background-image: url("${resolvedSteeringUrl}");
          background-size: contain;
          background-position: center;
          background-repeat: no-repeat;
          filter: drop-shadow(0 4px 14px rgba(0, 0, 0, 0.8)) drop-shadow(0 0 10px rgba(0, 240, 255, 0.35));
          transition: transform 0.05s ease-out;
          cursor: grab;
          position: relative;
          will-change: transform;
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
        `;
        wheel.addEventListener("dragstart", (e) => e.preventDefault());

        // Center CyberWrap neon hub badge
        const centerBadge = document.createElement("div");
        centerBadge.id = "cw-steering-hub";
        centerBadge.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 28%;
          height: 28%;
          border-radius: 50%;
          background: radial-gradient(circle, #0d263e 0%, #051320 100%);
          border: 1.5px solid #00f0ff;
          box-shadow: 0 0 8px rgba(0, 240, 255, 0.6), inset 0 0 5px rgba(0, 240, 255, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #00f0ff;
          font-family: 'Orbitron', sans-serif;
          font-size: clamp(8px, 1.2vw, 10px);
          font-weight: 900;
          letter-spacing: 0.5px;
          pointer-events: none;
          text-shadow: 0 0 5px #00f0ff;
        `;
        centerBadge.textContent = "CW";
        wheel.appendChild(centerBadge);

        wheelContainer.appendChild(wheel);
        document.body.appendChild(wheelContainer);

        // ==================================================
        // STEERING WHEEL TOUCH / MOUSE DRAG INTERACTION
        // ==================================================

        let dragging = false;
        let wheelRotation = 0;
        let startWheelRotation = 0;
        let startTouchAngle = 0;

        function getTouchAngle(e: PointerEvent): number {
          const rect = wheel.getBoundingClientRect();
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;
          return Math.atan2(e.clientY - centerY, e.clientX - centerX);
        }

        function updateWheel(e: PointerEvent): void {
          const currentAngle = getTouchAngle(e);
          let delta = ((currentAngle - startTouchAngle) * 180) / Math.PI;

          if (delta > 180) delta -= 360;
          if (delta < -180) delta += 360;

          wheelRotation = startWheelRotation + delta;
          wheelRotation = Math.max(-80, Math.min(80, wheelRotation));
          wheel.style.transform = `rotate(${wheelRotation}deg)`;

          touchSteering = wheelRotation / 80;
          if (Math.abs(touchSteering) < 0.06) {
            touchSteering = 0;
          }

          updateInput();
        }

        wheelContainer.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          dragging = true;
          wheel.style.cursor = "grabbing";
          wheelContainer.setPointerCapture(e.pointerId);
          startTouchAngle = getTouchAngle(e);
          startWheelRotation = wheelRotation;
          updateWheel(e);
        });

        wheelContainer.addEventListener("pointermove", (e) => {
          if (!dragging) return;
          updateWheel(e);
        });

        function releaseWheel(): void {
          dragging = false;
          wheel.style.cursor = "grab";
          touchSteering = 0;
          wheelRotation = 0;
          wheel.style.transform = "rotate(0deg)";
          updateInput();
        }

        wheelContainer.addEventListener("pointerup", releaseWheel);
        wheelContainer.addEventListener("pointercancel", releaseWheel);
        wheelContainer.addEventListener("lostpointercapture", releaseWheel);

        // ==================================================
        // BOTTOM-LEFT: ALTERNATIVE LEFT / RIGHT STEERING BUTTONS
        // ==================================================

        const buttonsContainer = document.createElement("div");
        buttonsContainer.className = "cyberwrap-control";
        buttonsContainer.id = "cw-steering-buttons-container";
        buttonsContainer.style.cssText = `
          position: fixed;
          left: max(12px, env(safe-area-inset-left, 12px));
          bottom: max(12px, env(safe-area-inset-bottom, 12px));
          display: flex;
          align-items: center;
          gap: clamp(10px, 1.8vw, 16px);
          z-index: 1000001;
          pointer-events: auto;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
        `;

        const btnLeft = document.createElement("button");
        btnLeft.id = "cw-btn-steer-left";
        btnLeft.className = "cw-steer-btn";
        btnLeft.setAttribute("type", "button");
        btnLeft.setAttribute("aria-label", "Steer Left");
        btnLeft.setAttribute("draggable", "false");
        btnLeft.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; pointer-events: none; gap: 3px;">
            <span style="font-size: clamp(18px, 2.8vw, 24px); line-height: 1; text-shadow: 0 0 8px currentColor;">◀</span>
            <span style="font-size: clamp(8.5px, 1.2vw, 11px); font-weight: 900; letter-spacing: 0.8px;">LEFT</span>
          </div>
        `;

        const btnRight = document.createElement("button");
        btnRight.id = "cw-btn-steer-right";
        btnRight.className = "cw-steer-btn";
        btnRight.setAttribute("type", "button");
        btnRight.setAttribute("aria-label", "Steer Right");
        btnRight.setAttribute("draggable", "false");
        btnRight.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; pointer-events: none; gap: 3px;">
            <span style="font-size: clamp(18px, 2.8vw, 24px); line-height: 1; text-shadow: 0 0 8px currentColor;">▶</span>
            <span style="font-size: clamp(8.5px, 1.2vw, 11px); font-weight: 900; letter-spacing: 0.8px;">RIGHT</span>
          </div>
        `;

        const steerButtonBaseCss = `
          min-width: 52px;
          min-height: 52px;
          width: min(clamp(62px, 9.5vw, 82px), 18vh);
          height: min(clamp(62px, 9.5vw, 82px), 18vh);
          border-radius: 14px;
          background: linear-gradient(180deg, #0d263e 0%, #051320 100%);
          border: 1.8px solid rgba(0, 240, 255, 0.7);
          color: #00f0ff;
          font-family: 'Orbitron', sans-serif;
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.75), 0 0 14px rgba(0, 240, 255, 0.3), inset 0 0 8px rgba(0, 240, 255, 0.1);
          cursor: pointer;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
          outline: none;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: transform 0.06s ease, background 0.1s ease, border-color 0.1s ease, box-shadow 0.1s ease;
          box-sizing: border-box;
        `;
        btnLeft.style.cssText = steerButtonBaseCss;
        btnRight.style.cssText = steerButtonBaseCss;

        btnLeftEl = btnLeft;
        btnRightEl = btnRight;

        function updateButtonSteering(): void {
          if (leftPressed && !rightPressed) {
            touchSteering = -1;
          } else if (rightPressed && !leftPressed) {
            touchSteering = 1;
          } else {
            touchSteering = 0;
          }
          updateInput();
        }

        btnLeft.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          try {
            btnLeft.setPointerCapture(e.pointerId);
          } catch {}
          leftPressed = true;
          setSteerBtnActive(btnLeft, true);
          updateButtonSteering();
        });

        const stopLeft = (e: PointerEvent) => {
          if (leftPressed) {
            leftPressed = false;
            setSteerBtnActive(btnLeft, false);
            try {
              btnLeft.releasePointerCapture(e.pointerId);
            } catch {}
            updateButtonSteering();
          }
        };
        btnLeft.addEventListener("pointerup", stopLeft);
        btnLeft.addEventListener("pointercancel", stopLeft);
        btnLeft.addEventListener("lostpointercapture", stopLeft);

        btnRight.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          try {
            btnRight.setPointerCapture(e.pointerId);
          } catch {}
          rightPressed = true;
          setSteerBtnActive(btnRight, true);
          updateButtonSteering();
        });

        const stopRight = (e: PointerEvent) => {
          if (rightPressed) {
            rightPressed = false;
            setSteerBtnActive(btnRight, false);
            try {
              btnRight.releasePointerCapture(e.pointerId);
            } catch {}
            updateButtonSteering();
          }
        };
        btnRight.addEventListener("pointerup", stopRight);
        btnRight.addEventListener("pointercancel", stopRight);
        btnRight.addEventListener("lostpointercapture", stopRight);

        btnLeft.addEventListener("contextmenu", (e) => e.preventDefault());
        btnRight.addEventListener("contextmenu", (e) => e.preventDefault());

        buttonsContainer.appendChild(btnLeft);
        buttonsContainer.appendChild(btnRight);
        document.body.appendChild(buttonsContainer);

        function applySteeringMode(): void {
          if (runtimeVehicleConfig.controlMode === "joystick") {
            wheelContainer.style.display = "flex";
            buttonsContainer.style.display = "none";
          } else {
            wheelContainer.style.display = "none";
            buttonsContainer.style.display = "flex";
          }
        }
        applySteeringMode();

        // ==================================================
        // BOTTOM-RIGHT: CONTROLS CONTAINER (NITRO + PEDALS)
        // ==================================================

        const rightControlsContainer = document.createElement("div");
        rightControlsContainer.className = "cyberwrap-control";
        rightControlsContainer.id = "cw-right-controls";
        rightControlsContainer.style.cssText = `
          position: fixed;
          right: max(10px, env(safe-area-inset-right, 10px));
          bottom: max(10px, env(safe-area-inset-bottom, 10px));
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: clamp(6px, 1vw, 8px);
          z-index: 1000001;
          pointer-events: auto;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
        `;

        // --------------------------------------------------
        // NITRO BUTTON
        // --------------------------------------------------
        const nitroBtn = document.createElement("button");
        nitroBtn.id = "cw-btn-nitro";
        nitroBtn.className = "cw-nitro-btn";
        nitroBtn.setAttribute("type", "button");
        nitroBtn.setAttribute("aria-label", "Nitro Boost");
        nitroBtn.setAttribute("draggable", "false");
        nitroBtn.style.cssText = `
          min-width: 44px;
          min-height: 38px;
          width: min(clamp(70px, 10vw, 86px), 18vh);
          height: min(clamp(38px, 5.4vw, 44px), 10.5vh);
          border-radius: 10px;
          font-family: 'Orbitron', sans-serif;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 2px 6px;
          outline: none;
          box-sizing: border-box;
          transition: transform 0.08s ease, box-shadow 0.15s ease, background 0.15s ease, border-color 0.15s ease;
        `;

        function updateNitroUI(): void {
          if (!nitroBtn) return;

          if (gameData.nitroActive) {
            // STATE 3: ACTIVE
            nitroBtn.style.background = "linear-gradient(180deg, #1d4ed8 0%, #1e3a8a 100%)";
            nitroBtn.style.border = "1.8px solid #93c5fd";
            nitroBtn.style.boxShadow =
              "0 0 20px rgba(59, 130, 246, 0.95), 0 0 32px rgba(147, 197, 253, 0.7), inset 0 0 10px rgba(255, 255, 255, 0.5)";
            nitroBtn.style.opacity = "1";
            nitroBtn.style.cursor = "default";
            nitroBtn.style.animation = "none";
            const seconds = Math.max(0, gameData.nitroTimeRemaining).toFixed(1);
            nitroBtn.innerHTML = `
              <div style="display: flex; flex-direction: column; align-items: center; line-height: 1.1; pointer-events: none;">
                <div style="display: flex; align-items: center; gap: 3px;">
                  <span style="font-size: 11px; color: #93c5fd; filter: drop-shadow(0 0 4px #60a5fa);">⚡</span>
                  <span style="font-size: clamp(9.5px, 1.4vw, 11px); font-weight: 900; letter-spacing: 1px; color: #ffffff; text-shadow: 0 0 8px #93c5fd;">NITRO</span>
                </div>
                <span style="font-size: clamp(9px, 1.3vw, 10.5px); font-weight: 800; letter-spacing: 0.8px; color: #bfdbfe; text-shadow: 0 0 6px #60a5fa;">${seconds}s</span>
              </div>
            `;
          } else if (gameData.nitroAvailable) {
            // STATE 2: READY
            nitroBtn.style.background = "linear-gradient(180deg, #2563eb 0%, #1d4ed8 100%)";
            nitroBtn.style.border = "1.8px solid #60a5fa";
            nitroBtn.style.boxShadow =
              "0 3px 14px rgba(0, 0, 0, 0.6), 0 0 16px rgba(37, 99, 235, 0.85), 0 0 24px rgba(96, 165, 250, 0.5), inset 0 0 8px rgba(255, 255, 255, 0.35)";
            nitroBtn.style.opacity = "1";
            nitroBtn.style.cursor = "pointer";
            nitroBtn.style.animation = "cwNitroPulse 1.2s infinite ease-in-out";
            nitroBtn.innerHTML = `
              <div style="display: flex; flex-direction: column; align-items: center; line-height: 1.1; pointer-events: none;">
                <div style="display: flex; align-items: center; gap: 3px;">
                  <span style="font-size: 11px; color: #bfdbfe; filter: drop-shadow(0 0 5px #93c5fd);">⚡</span>
                  <span style="font-size: clamp(10px, 1.5vw, 11.5px); font-weight: 900; letter-spacing: 1px; color: #ffffff; text-shadow: 0 0 8px #93c5fd;">NITRO</span>
                </div>
                <span style="font-size: clamp(8px, 1.1vw, 9.5px); font-weight: 800; letter-spacing: 1.5px; color: #dbeafe; text-shadow: 0 0 6px #60a5fa;">READY</span>
              </div>
            `;
          } else {
            // STATE 1: EMPTY / UNCHARGED
            nitroBtn.style.background =
              "linear-gradient(180deg, rgba(8, 28, 44, 0.75) 0%, rgba(4, 16, 26, 0.85) 100%)";
            nitroBtn.style.border = "1.2px solid rgba(0, 240, 255, 0.3)";
            nitroBtn.style.boxShadow =
              "0 2px 8px rgba(0, 0, 0, 0.45), 0 0 6px rgba(0, 240, 255, 0.12), inset 0 0 4px rgba(0, 240, 255, 0.08)";
            nitroBtn.style.opacity = "0.7";
            nitroBtn.style.cursor = "default";
            nitroBtn.style.animation = "none";
            nitroBtn.innerHTML = `
              <div style="display: flex; align-items: center; gap: 3px; pointer-events: none; opacity: 0.75;">
                <span style="font-size: 10px; color: rgba(0, 240, 255, 0.6);">⚡</span>
                <span style="font-size: clamp(9px, 1.3vw, 10.5px); font-weight: 800; letter-spacing: 1px; color: rgba(0, 240, 255, 0.75); text-shadow: 0 0 4px rgba(0, 240, 255, 0.3);">NITRO</span>
              </div>
            `;
          }
        }

        // Initial Nitro UI setup
        updateNitroUI();

        nitroBtn.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          activateNitro();
        });
        nitroBtn.addEventListener("contextmenu", (e) => e.preventDefault());

        // --------------------------------------------------
        // PEDALS ROW (REV + GAS)
        // --------------------------------------------------
        const pedalsRow = document.createElement("div");
        pedalsRow.id = "cw-pedals-row";
        pedalsRow.style.cssText = `
          display: flex;
          align-items: flex-end;
          gap: clamp(6px, 1.2vw, 9px);
          touch-action: none;
        `;

        // --------------------------------------------------
        // REV BUTTON (Reverse - Secondary Compact Red Pedal)
        // --------------------------------------------------
        const revBtn = document.createElement("button");
        revBtn.id = "cw-btn-rev";
        revBtn.className = "cw-pedal-btn";
        revBtn.setAttribute("type", "button");
        revBtn.setAttribute("aria-label", "Reverse");
        revBtn.style.cssText = `
          min-width: 44px;
          min-height: 44px;
          width: min(clamp(44px, 6.2vw, 54px), 14vh);
          height: min(clamp(46px, 7.2vw, 58px), 15vh);
          border-radius: 10px;
          background: linear-gradient(180deg, rgba(160, 32, 40, 0.9) 0%, rgba(90, 18, 24, 0.95) 100%);
          border: 1.2px solid rgba(248, 113, 113, 0.6);
          box-shadow: 0 3px 12px rgba(0, 0, 0, 0.5), 0 0 10px rgba(220, 38, 38, 0.3), inset 0 0 6px rgba(255, 255, 255, 0.12);
          color: #ffffff;
          font-family: 'Orbitron', sans-serif;
          cursor: pointer;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          padding: 3px 0;
          transition: transform 0.06s ease, box-shadow 0.06s ease, filter 0.06s ease;
          outline: none;
          box-sizing: border-box;
        `;
        revBtn.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; line-height: 0.5; color: #fca5a5; font-size: 10px; font-weight: 900; pointer-events: none;">
            <span>▼</span>
            <span>▼</span>
          </div>
          <span style="font-size: clamp(9px, 1.3vw, 10.5px); font-weight: 800; letter-spacing: 0.7px; color: #ffffff; text-shadow: 0 0 5px rgba(255, 100, 100, 0.7); pointer-events: none;">REV</span>
        `;

        // --------------------------------------------------
        // GAS BUTTON (Forward - Primary Prominent Emerald Green Pedal)
        // --------------------------------------------------
        const gasBtn = document.createElement("button");
        gasBtn.id = "cw-btn-gas";
        gasBtn.className = "cw-pedal-btn";
        gasBtn.setAttribute("type", "button");
        gasBtn.setAttribute("aria-label", "Accelerate");
        gasBtn.style.cssText = `
          min-width: 48px;
          min-height: 48px;
          width: min(clamp(50px, 7.5vw, 62px), 16vh);
          height: min(clamp(58px, 9.2vw, 72px), 18vh);
          border-radius: 12px;
          background: linear-gradient(180deg, rgba(16, 185, 129, 0.95) 0%, rgba(4, 120, 87, 0.95) 100%);
          border: 1.5px solid rgba(52, 211, 153, 0.85);
          box-shadow: 0 4px 16px rgba(0, 0, 0, 0.55), 0 0 14px rgba(16, 185, 129, 0.45), inset 0 0 8px rgba(255, 255, 255, 0.22);
          color: #ffffff;
          font-family: 'Orbitron', sans-serif;
          cursor: pointer;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          gap: 2px;
          padding: 5px 0;
          transition: transform 0.06s ease, box-shadow 0.06s ease, filter 0.06s ease;
          outline: none;
          box-sizing: border-box;
        `;
        gasBtn.innerHTML = `
          <div style="display: flex; flex-direction: column; align-items: center; line-height: 0.5; color: #a7f3d0; font-size: 12px; font-weight: 900; pointer-events: none;">
            <span>▲</span>
            <span>▲</span>
          </div>
          <span style="font-size: clamp(10.5px, 1.6vw, 12.5px); font-weight: 900; letter-spacing: 0.8px; color: #ffffff; text-shadow: 0 0 7px rgba(52, 211, 153, 0.9); pointer-events: none;">GAS</span>
        `;

        pedalsRow.appendChild(revBtn);
        pedalsRow.appendChild(gasBtn);

        rightControlsContainer.appendChild(nitroBtn);
        rightControlsContainer.appendChild(pedalsRow);
        document.body.appendChild(rightControlsContainer);

        // Prevent browser context menu on all touch controls
        wheelContainer.addEventListener("contextmenu", (e) => e.preventDefault());
        rightControlsContainer.addEventListener("contextmenu", (e) => e.preventDefault());
        revBtn.addEventListener("contextmenu", (e) => e.preventDefault());
        gasBtn.addEventListener("contextmenu", (e) => e.preventDefault());

        // Pedal Press / Release Visual Feedback
        function pressPedal(btn: HTMLButtonElement, isGas: boolean): void {
          btn.style.transform = "translateY(3px) scale(0.95)";
          btn.style.filter = "brightness(1.3)";
          btn.style.boxShadow = isGas
            ? "0 1px 6px rgba(0,0,0,0.6), 0 0 16px rgba(16, 185, 129, 0.8), inset 0 0 12px rgba(255,255,255,0.35)"
            : "0 1px 6px rgba(0,0,0,0.6), 0 0 14px rgba(239, 68, 68, 0.8), inset 0 0 10px rgba(255,255,255,0.3)";
        }

        function releasePedal(btn: HTMLButtonElement): void {
          btn.style.transform = "translateY(0px) scale(1)";
          btn.style.filter = "brightness(1)";
          btn.style.boxShadow = "";
        }

        // Pointer event listeners for GAS
        gasBtn.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          gasBtn.setPointerCapture(e.pointerId);
          pressPedal(gasBtn, true);
          touchThrottle = 1;
          updateInput();
        });

        // Pointer event listeners for REV
        revBtn.addEventListener("pointerdown", (e) => {
          e.preventDefault();
          revBtn.setPointerCapture(e.pointerId);
          pressPedal(revBtn, false);
          touchThrottle = -1;
          updateInput();
        });

        function stopThrottle(): void {
          touchThrottle = 0;
          updateInput();
          releasePedal(gasBtn);
          releasePedal(revBtn);
        }

        gasBtn.addEventListener("pointerup", stopThrottle);
        revBtn.addEventListener("pointerup", stopThrottle);
        gasBtn.addEventListener("pointercancel", stopThrottle);
        revBtn.addEventListener("pointercancel", stopThrottle);
        gasBtn.addEventListener("lostpointercapture", stopThrottle);
        revBtn.addEventListener("lostpointercapture", stopThrottle);

        // ==================================================
        // DESKTOP KEYBOARD CONTROLS (W/S/A/D, Arrows, Shift/N for Nitro)
        // ==================================================

        const handleKeyDown = (e: KeyboardEvent): void => {
          if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
            return;
          }

          const code = e.code;
          if (code === "KeyW" || code === "ArrowUp") {
            keyGas = true;
            pressPedal(gasBtn, true);
          } else if (code === "KeyS" || code === "ArrowDown") {
            keyRev = true;
            pressPedal(revBtn, false);
          } else if (code === "KeyA" || code === "ArrowLeft") {
            keyLeft = true;
          } else if (code === "KeyD" || code === "ArrowRight") {
            keyRight = true;
          } else if (code === "Space") {
            // Handbrake / throttle release
            keyGas = false;
            keyRev = false;
            touchThrottle = 0;
            releasePedal(gasBtn);
            releasePedal(revBtn);
          } else if (code === "ShiftLeft" || code === "ShiftRight" || code === "KeyN") {
            // Dedicated Nitro activation keys for keyboard players
            activateNitro();
          }
          updateInput();
        };

        const handleKeyUp = (e: KeyboardEvent): void => {
          const code = e.code;
          if (code === "KeyW" || code === "ArrowUp") {
            keyGas = false;
            releasePedal(gasBtn);
          } else if (code === "KeyS" || code === "ArrowDown") {
            keyRev = false;
            releasePedal(revBtn);
          } else if (code === "KeyA" || code === "ArrowLeft") {
            keyLeft = false;
          } else if (code === "KeyD" || code === "ArrowRight") {
            keyRight = false;
          }
          updateInput();
        };

        window.addEventListener("keydown", handleKeyDown);
        window.addEventListener("keyup", handleKeyUp);

        // ==================================================
        // NITRO EVENT LISTENER & CONFIG UPDATES
        // ==================================================

        const onNitroUpdated = () => {
          updateNitroUI();
        };
        window.addEventListener(NITRO_UPDATED_EVENT, onNitroUpdated);

        const onConfigUpdated = () => {
          touchSteering = 0;
          wheelRotation = 0;
          wheel.style.transform = "rotate(0deg)";
          leftPressed = false;
          rightPressed = false;
          setSteerBtnActive(btnLeft, false);
          setSteerBtnActive(btnRight, false);
          updateInput();
          applySteeringMode();
        };
        window.addEventListener(VEHICLE_CONFIG_UPDATED_EVENT, onConfigUpdated);

        // ==================================================
        // SAFETY RESET ON BLUR / VISIBILITY CHANGE
        // (Preserves charged Nitro state!)
        // ==================================================

        function resetAll(): void {
          touchSteering = 0;
          touchThrottle = 0;
          leftPressed = false;
          rightPressed = false;
          setSteerBtnActive(btnLeft, false);
          setSteerBtnActive(btnRight, false);
          keyGas = false;
          keyRev = false;
          keyLeft = false;
          keyRight = false;
          wheelRotation = 0;
          wheel.style.transform = "rotate(0deg)";
          releasePedal(gasBtn);
          releasePedal(revBtn);
          updateInput();
        }

        window.addEventListener("blur", resetAll);
        document.addEventListener("visibilitychange", () => {
          if (document.hidden) resetAll();
        });

        // Store references for cleanup
        (wheelContainer as any)._cleanup = () => {
          window.removeEventListener("keydown", handleKeyDown);
          window.removeEventListener("keyup", handleKeyUp);
          window.removeEventListener(NITRO_UPDATED_EVENT, onNitroUpdated);
          window.removeEventListener(VEHICLE_CONFIG_UPDATED_EVENT, onConfigUpdated);
          window.removeEventListener("blur", resetAll);
        };
      })
      .onExit(() => {
        const c = document.getElementById("cw-steering-container");
        if (c && (c as any)._cleanup) {
          (c as any)._cleanup();
        }
        clearControls();
      });
  },
});
