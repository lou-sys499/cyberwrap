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

// ==================================================
// RECORD BUTTON EVENT
// ==================================================

function setupRecordingListener() {
  // Prevent duplicate listeners during hot reload.

  window.removeEventListener("cyberwrap-record", handleRecordRequest);

  window.addEventListener("cyberwrap-record", handleRecordRequest);
}

// ==================================================
// RECORD REQUEST
// ==================================================

function handleRecordRequest() {
  // Already recording.

  if (recorder?.state === "recording") {
    console.log("[Recorder] Already recording.");

    return;
  }

  console.log("[Recorder] Recording requested.");

  startRecording();
}

// ==================================================
// START RECORDING
// ==================================================

function startRecording() {
  trackEvent("recording_requested");

  // -----------------------------------------
  // Find WebGL canvas
  // -----------------------------------------

  const sourceCanvas = document.querySelector(
    "canvas",
  ) as HTMLCanvasElement | null;

  if (!sourceCanvas) {
    console.warn("[Recorder] No canvas found.");

    return;
  }

  console.log(
    "[Recorder] Source canvas:",
    sourceCanvas.width,
    "x",
    sourceCanvas.height,
  );

  // -----------------------------------------
  // Recording resolution
  // -----------------------------------------

  const width = sourceCanvas.width;

  const height = sourceCanvas.height;

  if (width <= 0 || height <= 0) {
    console.warn("[Recorder] Canvas has invalid dimensions.");

    return;
  }

  // -----------------------------------------
  // Create recording canvas
  // -----------------------------------------

  const recordingCanvas = document.createElement("canvas");

  recordingCanvas.width = width;

  recordingCanvas.height = height;

  recordingCanvas.style.display = "none";

  document.body.appendChild(recordingCanvas);

  const ctx = recordingCanvas.getContext("2d");

  if (!ctx) {
    console.warn("[Recorder] Could not create 2D context.");

    recordingCanvas.remove();

    return;
  }

  // -----------------------------------------
  // Recording stream
  // -----------------------------------------

  const stream = recordingCanvas.captureStream(30);

  // -----------------------------------------
  // Find supported format
  // -----------------------------------------

  const mimeTypes = [
    "video/webm;codecs=vp9",
    "video/webm;codecs=vp8",
    "video/webm",
  ];

  const supportedMimeType = mimeTypes.find((type) =>
    MediaRecorder.isTypeSupported(type),
  );

  if (!supportedMimeType) {
    console.warn("[Recorder] WebM recording is not supported.");

    recordingCanvas.remove();

    return;
  }

  console.log("[Recorder] Using:", supportedMimeType);

  // -----------------------------------------
  // Reset chunks
  // -----------------------------------------

  chunks = [];

  // -----------------------------------------
  // Create MediaRecorder
  // -----------------------------------------

  try {
    recorder = new MediaRecorder(stream, {
      mimeType: supportedMimeType,
    });
  } catch (error) {
    console.error("[Recorder] Could not create MediaRecorder:", error);

    recordingCanvas.remove();

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
  // DRAW RECORDING FRAME
  // ==================================================

  const drawRecordingFrame = () => {
    if (recorder?.state !== "recording") {
      return;
    }

    // -----------------------------------------
    // Clear previous frame
    // -----------------------------------------

    ctx.clearRect(0, 0, width, height);

    // -----------------------------------------
    // Draw CyberWrap
    // -----------------------------------------

    ctx.drawImage(sourceCanvas, 0, 0, width, height);

    // -----------------------------------------
    // Watermark
    // -----------------------------------------

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

    // -----------------------------------------
    // Watermark background
    // -----------------------------------------

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

    // -----------------------------------------
    // Watermark text
    // -----------------------------------------

    ctx.fillStyle = "rgba(255,255,255,.92)";

    ctx.fillText(watermarkText, x - boxPaddingX, y - boxPaddingY);

    // -----------------------------------------
    // Continue frames
    // -----------------------------------------

    renderFrame = requestAnimationFrame(drawRecordingFrame);
  };

  // ==================================================
  // RECORDING FINISHED
  // ==================================================

  recorder.onstop = async () => {
    console.log("[Recorder] Recording stopped.");

    // -----------------------------------------
    // Stop frame rendering
    // -----------------------------------------

    if (renderFrame !== null) {
      cancelAnimationFrame(renderFrame);

      renderFrame = null;
    }

    // -----------------------------------------
    // Stop countdown
    // -----------------------------------------

    if (countdownTimer !== null) {
      clearInterval(countdownTimer);

      countdownTimer = null;
    }

    // -----------------------------------------
    // Stop automatic timer
    // -----------------------------------------

    if (stopTimer !== null) {
      clearTimeout(stopTimer);

      stopTimer = null;
    }

    // -----------------------------------------
    // Create video
    // -----------------------------------------

    const blob = new Blob(chunks, {
      type: supportedMimeType,
    });

    console.log("[Recorder] Video size:", blob.size);

    if (blob.size === 0) {
      console.warn("[Recorder] Recording produced an empty video.");

      recordingCanvas.remove();

      recorder = null;

      return;
    }

    const file = new File([blob], "dailybread-cyberwrap-run.webm", {
      type: supportedMimeType,
    });

    // -----------------------------------------
    // Share on mobile
    // -----------------------------------------

    if (
      navigator.canShare &&
      navigator.canShare({
        files: [file],
      })
    ) {
      try {
        console.log("[Recorder] Opening share sheet...");

        await navigator.share({
          files: [file],

          title: "DailyBread Shawarma - CyberWrap",

          text: "Check out my CyberWrap run!",
        });

        console.log("[Recorder] Share complete.");
      } catch (error) {
        console.log("[Recorder] Share cancelled or failed.", error);

        downloadRecording(blob);
      }
    } else {
      // -----------------------------------------
      // Desktop / unsupported share
      // -----------------------------------------

      downloadRecording(blob);
    }

    // -----------------------------------------
    // Cleanup
    // -----------------------------------------

    recordingCanvas.remove();

    recorder = null;

    chunks = [];
  };

  // ==================================================
  // START
  // ==================================================

  try {
    recorder.start();

    console.log("[Recorder] Started 20 second recording.");
  } catch (error) {
    console.error("[Recorder] Failed to start:", error);

    recordingCanvas.remove();

    recorder = null;

    return;
  }

  // -----------------------------------------
  // Start frame rendering
  // -----------------------------------------

  drawRecordingFrame();

  // -----------------------------------------
  // 20 second timer
  // -----------------------------------------

  let seconds = 20;

  console.log(`[Recorder] ${seconds}s`);

  countdownTimer = window.setInterval(() => {
    seconds--;

    console.log(`[Recorder] ${seconds}s remaining`);

    if (seconds <= 0) {
      if (countdownTimer !== null) {
        clearInterval(countdownTimer);

        countdownTimer = null;
      }
    }
  }, 1000);

  // -----------------------------------------
  // Automatic stop
  // -----------------------------------------

  stopTimer = window.setTimeout(() => {
    if (recorder?.state === "recording") {
      console.log("[Recorder] 20 seconds reached.");

      recorder.stop();
    }
  }, 20000);
}

// ==================================================
// DOWNLOAD RECORDING
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
        console.log("[Recorder] Ready");

        setupRecordingListener();
      });
  },
});
