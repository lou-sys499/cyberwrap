import * as ecs from "@8thwall/ecs";
import { gameData } from "../core/game-data";

// --------------------------------------------------
// Remove old controls
// --------------------------------------------------

function clearControls(): void {
  document.querySelectorAll(".cyberwrap-control").forEach((el) => el.remove());
}

// --------------------------------------------------
// Component: Virtual Steering Wheel + Compact Pedals
// --------------------------------------------------

ecs.registerComponent({
  name: "joystick",

  stateMachine: ({ defineState }) => {
    defineState("ready")
      .initial()
      .onEnter(() => {
        clearControls();

        let touchSteering = 0;
        let touchThrottle = 0;

        let keyGas = false;
        let keyRev = false;
        let keyLeft = false;
        let keyRight = false;

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
        }

        // ==================================================
        // BOTTOM-LEFT: VIRTUAL STEERING WHEEL
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

        const wheel = document.createElement("div");
        wheel.id = "cw-steering-wheel";
        wheel.style.cssText = `
          width: 100%;
          height: 100%;
          border-radius: 50%;
          background-image: url("/assets/steering.png");
          background-size: contain;
          background-position: center;
          background-repeat: no-repeat;
          filter: drop-shadow(0 4px 14px rgba(0, 0, 0, 0.8)) drop-shadow(0 0 10px rgba(0, 240, 255, 0.35));
          transition: transform 0.05s ease-out;
          cursor: grab;
          position: relative;
          will-change: transform;
        `;

        // Center CyberWrap neon hub badge
        const centerBadge = document.createElement("div");
        centerBadge.style.cssText = `
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 32%;
          height: 32%;
          border-radius: 50%;
          background: radial-gradient(circle, #0d263e 0%, #051320 100%);
          border: 1.5px solid #00f0ff;
          box-shadow: 0 0 10px rgba(0, 240, 255, 0.65), inset 0 0 6px rgba(0, 240, 255, 0.4);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #00f0ff;
          font-family: 'Orbitron', sans-serif;
          font-size: clamp(8.5px, 1.4vw, 11px);
          font-weight: 900;
          letter-spacing: 0.5px;
          pointer-events: none;
          text-shadow: 0 0 6px #00f0ff;
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
        // BOTTOM-RIGHT: COMPACT PEDALS CONTAINER (REV + GAS)
        // ==================================================

        const pedalsContainer = document.createElement("div");
        pedalsContainer.className = "cyberwrap-control";
        pedalsContainer.id = "cw-pedals-container";
        pedalsContainer.style.cssText = `
          position: fixed;
          right: max(10px, env(safe-area-inset-right, 10px));
          bottom: max(10px, env(safe-area-inset-bottom, 10px));
          display: flex;
          align-items: flex-end;
          gap: clamp(6px, 1.2vw, 9px);
          z-index: 1000001;
          pointer-events: auto;
          touch-action: none;
          user-select: none;
          -webkit-user-select: none;
          -webkit-touch-callout: none;
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

        pedalsContainer.appendChild(revBtn);
        pedalsContainer.appendChild(gasBtn);
        document.body.appendChild(pedalsContainer);

        // Prevent browser context menu on all touch controls
        wheelContainer.addEventListener("contextmenu", (e) => e.preventDefault());
        pedalsContainer.addEventListener("contextmenu", (e) => e.preventDefault());
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
        // DESKTOP KEYBOARD CONTROLS (W/S/A/D & Arrow Keys)
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
            keyGas = false;
            keyRev = false;
            touchThrottle = 0;
            releasePedal(gasBtn);
            releasePedal(revBtn);
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
        // SAFETY RESET ON BLUR / VISIBILITY CHANGE
        // ==================================================

        function resetAll(): void {
          touchSteering = 0;
          touchThrottle = 0;
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
      })
      .onExit(() => {
        clearControls();
      });
  },
});
