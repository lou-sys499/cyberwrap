import * as ecs from "@8thwall/ecs";
import { trackEvent } from "../core/analytics";

// ==================================================
// RECORDER STATE
// ==================================================

let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];

let countdownTimer: number | null = null;
let renderFrame: number | null = null;
let stopTimer: number | null = null;

let recordingCanvas: HTMLCanvasElement | null = null;

// Recording HUD
let recordingHUD: HTMLDivElement | null = null;
let recordingTimeElement: HTMLSpanElement | null = null;

// ==================================================
// RECORD EVENT
// ==================================================

function handleRecordRequest() {
  if (recorder?.state === "recording") {
    return;
  }

  startRecording();
}

// ==================================================
// START LISTENER
// ==================================================

function setupRecordingListener() {
  window.removeEventListener("cyberwrap-record", handleRecordRequest);

  window.addEventListener("cyberwrap-record", handleRecordRequest);
}

// ==================================================
// RECORDING HUD
// ==================================================

function createRecordingHUD(): void {
  if (recordingHUD) {
    return;
  }

  const styleId = "cyberwrap-recording-hud-styles";

  if (!document.getElementById(styleId)) {
    const style = document.createElement("style");

    style.id = styleId;

    style.textContent = `
      #cyberwrap-recording-hud {
        position: fixed;

        top: max(14px, env(safe-area-inset-top));

        left: 50%;

        transform:
          translateX(-50%)
          translateY(-10px);

        display: flex;

        align-items: center;

        gap: 9px;

        padding: 8px 14px;

        border:
          1px solid
          rgba(255,70,70,.45);

        border-radius: 999px;

        background:
          rgba(8,8,12,.88);

        box-shadow:
          0 0 18px
          rgba(255,50,50,.18);

        backdrop-filter:
          blur(10px);

        -webkit-backdrop-filter:
          blur(10px);

        color: white;

        font-family:
          Arial,
          sans-serif;

        font-size: 12px;

        font-weight: 800;

        letter-spacing: 1px;

        z-index: 2000000;

        pointer-events: none;

        opacity: 0;

        transition:
          opacity .2s ease,
          transform .2s ease;
      }

      #cyberwrap-recording-hud.cw-recording-visible {
        opacity: 1;

        transform:
          translateX(-50%)
          translateY(0);
      }

      #cyberwrap-recording-dot {
        width: 9px;

        height: 9px;

        border-radius: 50%;

        background: #ff3b3b;

        box-shadow:
          0 0 8px
          rgba(255,60,60,.9);

        animation:
          cyberwrap-recording-pulse
          1s ease-in-out infinite;
      }

      #cyberwrap-recording-label {
        color:
          rgba(255,255,255,.95);
      }

      #cyberwrap-recording-time {
        min-width: 22px;

        text-align: center;

        color:
          #ff7070;
      }

      @keyframes cyberwrap-recording-pulse {

        0%,
        100% {
          opacity: 1;

          transform: scale(1);
        }

        50% {
          opacity: .35;

          transform: scale(.72);
        }

      }

      @media (max-width: 600px) {

        #cyberwrap-recording-hud {
          top:
            max(10px, env(safe-area-inset-top));

          padding:
            7px 12px;

          font-size: 11px;
        }

        #cyberwrap-recording-dot {
          width: 8px;
          height: 8px;
        }

      }
    `;

    document.head.appendChild(style);
  }

  recordingHUD = document.createElement("div");

  recordingHUD.id = "cyberwrap-recording-hud";

  recordingHUD.innerHTML = `
    <span id="cyberwrap-recording-dot"></span>

    <span id="cyberwrap-recording-label">
      REC
    </span>

    <span id="cyberwrap-recording-time">
      20
    </span>
  `;

  document.body.appendChild(recordingHUD);

  recordingTimeElement = recordingHUD.querySelector(
    "#cyberwrap-recording-time",
  ) as HTMLSpanElement | null;
}

// ==================================================
// SHOW RECORDING HUD
// ==================================================

function showRecordingHUD(): void {
  createRecordingHUD();

  if (!recordingHUD) {
    return;
  }

  if (recordingTimeElement) {
    recordingTimeElement.textContent = "20";
  }

  requestAnimationFrame(() => {
    recordingHUD?.classList.add("cw-recording-visible");
  });
}

// ==================================================
// UPDATE RECORDING HUD
// ==================================================

function updateRecordingHUD(seconds: number): void {
  if (!recordingTimeElement) {
    return;
  }

  recordingTimeElement.textContent = Math.max(0, seconds).toString();
}

// ==================================================
// HIDE RECORDING HUD
// ==================================================

function hideRecordingHUD(): void {
  if (!recordingHUD) {
    return;
  }

  recordingHUD.classList.remove("cw-recording-visible");
}

// ==================================================
// START RECORDING
// ==================================================

function startRecording() {
  trackEvent("recording_requested");

  // --------------------------------------------------
  // Find WebGL canvas
  // --------------------------------------------------

  const sourceCanvas = document.querySelector(
    "canvas",
  ) as HTMLCanvasElement | null;

  if (!sourceCanvas) {
    return;
  }

  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  if (width <= 0 || height <= 0) {
    return;
  }

  // --------------------------------------------------
  // Create recording canvas
  // --------------------------------------------------

  recordingCanvas = document.createElement("canvas");

  recordingCanvas.width = width;
  recordingCanvas.height = height;

  recordingCanvas.style.display = "none";

  document.body.appendChild(recordingCanvas);

  const ctx = recordingCanvas.getContext("2d");

  if (!ctx) {
    recordingCanvas.remove();

    recordingCanvas = null;

    return;
  }

  // --------------------------------------------------
  // Capture stream
  // --------------------------------------------------

  let stream: MediaStream;

  try {
    stream = recordingCanvas.captureStream(30);
  } catch {
    recordingCanvas.remove();

    recordingCanvas = null;

    return;
  }

  // --------------------------------------------------
  // Supported video format
  // --------------------------------------------------

  const mimeTypes = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];

  const supportedMimeType = mimeTypes.find((type) =>
    MediaRecorder.isTypeSupported(type),
  );

  if (!supportedMimeType) {
    recordingCanvas.remove();

    recordingCanvas = null;

    stream.getTracks().forEach((track) => {
      track.stop();
    });

    return;
  }

  // --------------------------------------------------
  // Reset chunks
  // --------------------------------------------------

  chunks = [];

  // --------------------------------------------------
  // Create recorder
  // --------------------------------------------------

  try {
    recorder = new MediaRecorder(stream, {
      mimeType: supportedMimeType,
    });
  } catch {
    recordingCanvas.remove();

    recordingCanvas = null;

    stream.getTracks().forEach((track) => {
      track.stop();
    });

    recorder = null;

    return;
  }

  // ==================================================
  // DATA AVAILABLE
  // ==================================================

  recorder.ondataavailable = (event) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  // ==================================================
  // DRAW FRAME
  // ==================================================

  const drawRecordingFrame = () => {
    if (recorder?.state !== "recording") {
      return;
    }

    ctx.clearRect(0, 0, width, height);

    ctx.drawImage(sourceCanvas, 0, 0, width, height);

    // ------------------------------------------------
    // Watermark
    // ------------------------------------------------

    const watermarkText = "DailyBread Shawarma - CyberWrap";

    const fontSize = Math.max(16, Math.round(width * 0.025));

    const padding = Math.max(12, Math.round(width * 0.025));

    ctx.font = `600 ${fontSize}px Arial, sans-serif`;

    ctx.textAlign = "right";

    ctx.textBaseline = "bottom";

    const metrics = ctx.measureText(watermarkText);

    const textWidth = metrics.width;

    const boxPaddingX = fontSize * 0.55;

    const boxPaddingY = fontSize * 0.35;

    const boxWidth = textWidth + boxPaddingX * 2;

    const boxHeight = fontSize + boxPaddingY * 2;

    const x = width - padding;

    const y = height - padding;

    // Watermark background

    ctx.fillStyle = "rgba(0,0,0,.58)";

    ctx.beginPath();

    ctx.roundRect(
      x - boxWidth,
      y - boxHeight,
      boxWidth,
      boxHeight,
      fontSize * 0.35,
    );

    ctx.fill();

    // Watermark text

    ctx.fillStyle = "rgba(255,255,255,.92)";

    ctx.fillText(watermarkText, x - boxPaddingX, y - boxPaddingY);

    renderFrame = requestAnimationFrame(drawRecordingFrame);
  };

  // ==================================================
  // RECORDING FINISHED
  // ==================================================

  recorder.onstop = async () => {
    // Stop animation

    if (renderFrame !== null) {
      cancelAnimationFrame(renderFrame);

      renderFrame = null;
    }

    // Stop countdown

    if (countdownTimer !== null) {
      clearInterval(countdownTimer);

      countdownTimer = null;
    }

    // Stop automatic timer

    if (stopTimer !== null) {
      clearTimeout(stopTimer);

      stopTimer = null;
    }

    // Update UI

    updateRecordingHUD(0);

    hideRecordingHUD();

    // Stop stream

    stream.getTracks().forEach((track) => {
      track.stop();
    });

    // ------------------------------------------------
    // Create video
    // ------------------------------------------------

    const blob = new Blob(chunks, {
      type: supportedMimeType,
    });

    if (blob.size === 0) {
      recordingCanvas?.remove();

      recordingCanvas = null;

      recorder = null;

      chunks = [];

      return;
    }

    const file = new File([blob], "dailybread-cyberwrap-run.webm", {
      type: supportedMimeType,
    });

    // ------------------------------------------------
    // Mobile share
    // ------------------------------------------------

    if (
      navigator.canShare &&
      navigator.canShare({
        files: [file],
      })
    ) {
      try {
        await navigator.share({
          files: [file],

          title: "DailyBread Shawarma - CyberWrap",

          text: "Check out my CyberWrap run!",
        });
      } catch {
        downloadRecording(blob);
      }
    } else {
      downloadRecording(blob);
    }

    // ------------------------------------------------
    // Cleanup
    // ------------------------------------------------

    recordingCanvas?.remove();

    recordingCanvas = null;

    recorder = null;

    chunks = [];
  };

  // ==================================================
  // START
  // ==================================================

  try {
    recorder.start();
  } catch {
    recordingCanvas.remove();

    recordingCanvas = null;

    stream.getTracks().forEach((track) => {
      track.stop();
    });

    recorder = null;

    return;
  }

  // --------------------------------------------------
  // Show recording indicator
  // --------------------------------------------------

  showRecordingHUD();

  // Start drawing

  drawRecordingFrame();

  // ==================================================
  // 20 SECOND COUNTDOWN
  // ==================================================

  let seconds = 20;

  updateRecordingHUD(seconds);

  countdownTimer = window.setInterval(() => {
    seconds--;

    updateRecordingHUD(seconds);

    if (seconds <= 0) {
      if (countdownTimer !== null) {
        clearInterval(countdownTimer);

        countdownTimer = null;
      }
    }
  }, 1000);

  // ==================================================
  // AUTOMATIC STOP
  // ==================================================

  stopTimer = window.setTimeout(() => {
    if (recorder?.state === "recording") {
      recorder.stop();
    }
  }, 20000);
}

// ==================================================
// DOWNLOAD
// ==================================================

function downloadRecording(blob: Blob) {
  const url = URL.createObjectURL(blob);

  const a = document.createElement("a");

  a.href = url;

  a.download = "dailybread-cyberwrap-run.webm";

  document.body.appendChild(a);

  a.click();

  a.remove();

  setTimeout(() => {
    URL.revokeObjectURL(url);
  }, 1000);
}

// ==================================================
// ECS COMPONENT
// ==================================================

ecs.registerComponent({
  name: "record-button",

  stateMachine: ({ defineState }) => {
    defineState("ready")
      .initial()

      .onEnter(() => {
        setupRecordingListener();
      });
  },
});
