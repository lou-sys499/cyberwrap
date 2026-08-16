import * as ecs from "@8thwall/ecs";
import { gameData } from "../core/game-data";

// --------------------------------------------------
// Remove old controls
// --------------------------------------------------

function clearControls() {
  document.querySelectorAll(".cyberwrap-control").forEach((el) => el.remove());
}

// --------------------------------------------------
// Button creator
// --------------------------------------------------

function createButton(text: string, style: string) {
  const button = document.createElement("button");

  button.className = "cyberwrap-control";

  button.innerHTML = text;

  button.style.cssText = `
    ${style}

    touch-action:none;

    user-select:none;
    -webkit-user-select:none;

    -webkit-touch-callout:none;

    -webkit-tap-highlight-color:transparent;

    -webkit-user-drag:none;

    cursor:pointer;
  `;

  // Prevent browser interactions
  button.draggable = false;

  button.oncontextmenu = (e) => {
    e.preventDefault();
    return false;
  };

  button.onselectstart = (e) => {
    e.preventDefault();
    return false;
  };

  button.addEventListener("dragstart", (e) => {
    e.preventDefault();
  });

  button.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });

  document.body.appendChild(button);

  return button;
}

// --------------------------------------------------
// Component
// --------------------------------------------------

ecs.registerComponent({
  name: "joystick",

  stateMachine: ({ defineState }) => {
    defineState("ready")
      .initial()

      .onEnter(() => {
        console.log("[Controls] Initializing");

        clearControls();

        // ==================================================
        // INPUT STATE
        // ==================================================

        let steering = 0;

        let throttle = 0;

        function updateInput() {
          gameData.input.steering = steering;
          gameData.input.throttle = throttle;
        }

        // ==================================================
        // STEERING WHEEL
        // ==================================================

        const wheel = document.createElement("div");

        wheel.className = "cyberwrap-control";
        wheel.style.cssText = `

position:fixed;

left:25px;

bottom:35px;

width:180px;

height:160px;

opacity:1;

z-index:99999;

touch-action:none;

user-select:none;
-webkit-user-select:none;

-webkit-touch-callout:none;

-webkit-tap-highlight-color:transparent;

-webkit-user-drag:none;

pointer-events:auto;  

background-image:url("./assets/steering.png");
  background-size:contain;
  background-position:center;
  background-repeat:no-repeat;

  border-radius:50%;

  filter:drop-shadow(0 5px 10px black);

border-radius:50%;

filter:drop-shadow(0 5px 10px black);

`;

        document.body.appendChild(wheel);

        // True steering wheel state

        let dragging = false;

        // Current visual rotation (degrees)
        let wheelRotation = 0;

        // Rotation when finger first touched
        let startWheelRotation = 0;

        // Finger angle when touch started
        let startTouchAngle = 0;

        function getTouchAngle(e: PointerEvent) {
          const rect = wheel.getBoundingClientRect();

          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;

          return Math.atan2(e.clientY - centerY, e.clientX - centerX);
        }

        function updateWheel(e: PointerEvent) {
          const currentAngle = getTouchAngle(e);

          // Difference from touch start
          let delta = ((currentAngle - startTouchAngle) * 180) / Math.PI;

          // Prevent jumping across ±180°
          if (delta > 180) delta -= 360;
          if (delta < -180) delta += 360;

          wheelRotation = startWheelRotation + delta;

          // Clamp rotation
          wheelRotation = Math.max(-75, Math.min(75, wheelRotation));

          wheel.style.transform = `rotate(${wheelRotation}deg)`;

          // Convert wheel rotation to steering
          steering = -(wheelRotation / 75);

          // Dead zone
          if (Math.abs(steering) < 0.08) {
            steering = 0;
          }

          gameData.input.steering = steering;
        }

        wheel.addEventListener(
          "pointerdown",

          (e) => {
            e.preventDefault();

            dragging = true;

            wheel.setPointerCapture(e.pointerId);

            startTouchAngle = getTouchAngle(e);

            startWheelRotation = wheelRotation;

            updateWheel(e);
          },
        );

        wheel.addEventListener(
          "pointermove",

          (e) => {
            if (!dragging) return;

            updateWheel(e);
          },
        );

        function releaseWheel() {
          dragging = false;

          steering = 0;

          gameData.input.steering = 0;

          wheel.style.transition = "transform 0.12s ease-out";

          wheelRotation = 0;

          wheel.style.transform = "rotate(0deg)";

          setTimeout(() => {
            wheel.style.transition = "";
          }, 120);
        }

        wheel.addEventListener("pointerup", releaseWheel);

        wheel.addEventListener("pointercancel", releaseWheel);

        wheel.addEventListener("lostpointercapture", releaseWheel);

        // ==================================================
        // GAS BUTTON
        // ==================================================

        const gas = createButton(
          "GAS",

          `

position:fixed;

right:30px;

bottom:120px;

width:100px;

height:70px;

border-radius:22px;

background:

rgba(255,90,0,.75);

color:white;

font-size:22px;

font-weight:bold;

border:none;

z-index:99999;

touch-action:none;

box-shadow:
0 8px 18px rgba(0,0,0,.35);

transition:
transform .08s ease,
box-shadow .08s ease,
filter .08s ease,
background .08s ease;

`,
        );

        // ==================================================
        // REV BUTTON
        // ==================================================

        const rev = createButton(
          "REV",

          `

position:fixed;

right:30px;

bottom:35px;

width:100px;

height:60px;

border-radius:22px;

background:

rgba(255,255,255,.2);

color:white;

font-size:20px;

font-weight:bold;

border:none;

z-index:99999;

touch-action:none;

box-shadow:
0 8px 18px rgba(0,0,0,.35);

transition:
transform .08s ease,
box-shadow .08s ease,
filter .08s ease,
background .08s ease;

`,
        );

        function pressPedal(button: HTMLButtonElement) {
          button.style.transform = "translateY(5px) scale(0.95)";

          button.style.boxShadow = "0 2px 6px rgba(0,0,0,.25)";

          button.style.filter = "brightness(1.15)";
        }

        function releasePedal(button: HTMLButtonElement) {
          button.style.transform = "translateY(0px) scale(1)";

          button.style.boxShadow = "0 8px 18px rgba(0,0,0,.35)";

          button.style.filter = "brightness(1)";
        }

        // ==================================================
        // GAS / REV INPUT
        // ==================================================

        gas.addEventListener(
          "pointerdown",

          (e) => {
            e.preventDefault();

            gas.setPointerCapture(e.pointerId);

            pressPedal(gas);

            throttle = 1;

            updateInput();
          },
        );

        rev.addEventListener(
          "pointerdown",

          (e) => {
            e.preventDefault();

            rev.setPointerCapture(e.pointerId);

            pressPedal(rev);

            throttle = -1;

            updateInput();
          },
        );

        function stopThrottle() {
          throttle = 0;

          updateInput();

          releasePedal(gas);

          releasePedal(rev);
        }

        gas.addEventListener("pointerup", stopThrottle);
        rev.addEventListener("pointerup", stopThrottle);

        gas.addEventListener("pointercancel", stopThrottle);
        rev.addEventListener("pointercancel", stopThrottle);

        gas.addEventListener("lostpointercapture", stopThrottle);
        rev.addEventListener("lostpointercapture", stopThrottle);

        // ==================================================
        // SAFETY RESET
        // ==================================================

        function reset() {
          steering = 0;

          throttle = 0;

          gameData.input.steering = 0;

          gameData.input.throttle = 0;

          wheel.style.transform = "rotate(0deg)";
        }

        window.addEventListener("blur", reset);

        document.addEventListener(
          "visibilitychange",

          () => {
            if (document.hidden) reset();
          },
        );

        console.log("[Controls] Ready");
      });
  },
});
