import * as ecs from "@8thwall/ecs";

let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];

let expanded = false;
let countdownTimer: number | null = null;
let renderFrame: number | null = null;

ecs.registerComponent({
  name: "record-button",

  stateMachine: ({ defineState }) => {
    defineState("ready")
      .initial()

      .onEnter(() => {
        // -----------------------------------------
        // Floating record dock
        // -----------------------------------------

        const dock = document.createElement("div");

        dock.style.cssText = `
          position:fixed;
          top:20px;
          right:16px;
          z-index:99999;

          display:flex;
          align-items:center;
          justify-content:center;

          background:rgba(0,0,0,.75);
          border-radius:28px;
          padding:10px;

          backdrop-filter:blur(10px);

          box-shadow:0 4px 12px rgba(0,0,0,.35);

          font-family:Arial,sans-serif;

          transition:all .25s ease;

          cursor:pointer;
          user-select:none;

          touch-action:manipulation;
        `;

        const icon = document.createElement("span");

        icon.innerHTML = "🎥";

        icon.style.cssText = `
          font-size:22px;
          line-height:1;
        `;

        const label = document.createElement("span");

        label.innerHTML = " Record 20s";

        label.style.cssText = `
          overflow:hidden;
          white-space:nowrap;

          max-width:0;
          opacity:0;

          color:white;
          font-size:15px;
          font-weight:bold;

          transition:all .25s ease;
        `;

        dock.appendChild(icon);
        dock.appendChild(label);

        document.body.appendChild(dock);

        // -----------------------------------------
        // Button interaction
        // -----------------------------------------

        dock.onclick = () => {
          // Already recording
          if (recorder?.state === "recording") {
            return;
          }

          // First tap expands button
          if (!expanded) {
            expanded = true;

            label.style.maxWidth = "150px";
            label.style.opacity = "1";

            return;
          }

          // Second tap starts recording
          startRecording(label);
        };
      });
  },
});

// ==================================================
// START RECORDING
// ==================================================

function startRecording(label: HTMLSpanElement) {
  const sourceCanvas = document.querySelector(
    "canvas",
  ) as HTMLCanvasElement | null;

  if (!sourceCanvas) {
    console.warn("[Recorder] No canvas found.");
    return;
  }

  // -----------------------------------------
  // Recording resolution
  // -----------------------------------------

  const width = sourceCanvas.width;
  const height = sourceCanvas.height;

  // -----------------------------------------
  // Create recording canvas
  //
  // This is what actually gets recorded.
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
  // Find supported video format
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
    console.warn("[Recorder] WebM recording not supported.");
    recordingCanvas.remove();
    return;
  }

  chunks = [];

  recorder = new MediaRecorder(stream, {
    mimeType: supportedMimeType,
  });

  // -----------------------------------------
  // Capture frame + watermark
  // -----------------------------------------

  const drawRecordingFrame = () => {
    if (recorder?.state !== "recording") {
      return;
    }

    // Clear previous frame
    ctx.clearRect(0, 0, width, height);

    // Draw CyberWrap game
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

    // Measure text
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

    ctx.fillStyle = "rgba(0, 0, 0, 0.58)";

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

    ctx.fillStyle = "rgba(255,255,255,0.92)";

    ctx.fillText(watermarkText, x - boxPaddingX, y - boxPaddingY);

    // -----------------------------------------
    // Continue recording frames
    // -----------------------------------------

    renderFrame = requestAnimationFrame(drawRecordingFrame);
  };

  // -----------------------------------------
  // Collect recording data
  // -----------------------------------------

  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  // -----------------------------------------
  // Recording finished
  // -----------------------------------------

  recorder.onstop = async () => {
    // Stop frame rendering
    if (renderFrame !== null) {
      cancelAnimationFrame(renderFrame);
      renderFrame = null;
    }

    // Stop countdown
    if (countdownTimer !== null) {
      clearInterval(countdownTimer);
      countdownTimer = null;
    }

    // -----------------------------------------
    // Create final video
    // -----------------------------------------

    const blob = new Blob(chunks, {
      type: supportedMimeType,
    });

    const file = new File([blob], "dailybread-cyberwrap-run.webm", {
      type: supportedMimeType,
    });

    console.log(
      "[Recorder] Recording complete:",
      Math.round(blob.size / 1024),
      "KB",
    );

    // -----------------------------------------
    // Share on supported devices
    // -----------------------------------------

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
        // User cancelled sharing.
        // Fall through to download.
        downloadRecording(blob);
      }
    } else {
      // -----------------------------------------
      // Direct download
      // -----------------------------------------

      downloadRecording(blob);
    }

    // -----------------------------------------
    // Cleanup
    // -----------------------------------------

    recordingCanvas.remove();

    recorder = null;

    expanded = false;

    label.innerHTML = " Record 20s";

    label.style.maxWidth = "0";
    label.style.opacity = "0";
  };

  // -----------------------------------------
  // Start recording
  // -----------------------------------------

  recorder.start();

  console.log("[Recorder] Recording started.");

  // Start drawing frames
  drawRecordingFrame();

  // -----------------------------------------
  // Countdown
  // -----------------------------------------

  let seconds = 20;

  label.innerHTML = ` 🔴 ${seconds}s`;

  countdownTimer = window.setInterval(() => {
    seconds--;

    if (seconds > 0) {
      label.innerHTML = ` 🔴 ${seconds}s`;
    }

    if (seconds <= 0) {
      if (countdownTimer !== null) {
        clearInterval(countdownTimer);
        countdownTimer = null;
      }
    }
  }, 1000);

  // -----------------------------------------
  // Automatic 20 second stop
  // -----------------------------------------

  setTimeout(() => {
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
