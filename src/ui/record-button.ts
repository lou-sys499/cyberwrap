import * as ecs from "@8thwall/ecs";

let recorder: MediaRecorder | null = null;
let chunks: Blob[] = [];

let expanded = false;
let countdownTimer: number | null = null;

ecs.registerComponent({
  name: "record-button",

  stateMachine: ({ defineState }) => {
    defineState("ready")
      .initial()

      .onEnter(() => {
        // Floating dock
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
`;

        const icon = document.createElement("span");

        icon.innerHTML = "🎥";

        icon.style.cssText = `
font-size:22px;
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

        dock.onclick = () => {
          // Already recording
          if (recorder?.state === "recording") {
            return;
          }

          // First tap expands
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

function startRecording(label: HTMLSpanElement) {
  const canvas = document.querySelector("canvas") as HTMLCanvasElement | null;

  if (!canvas) return;

  const stream = canvas.captureStream(30);

  chunks = [];

  recorder = new MediaRecorder(stream, {
    mimeType: "video/webm",
  });

  recorder.ondataavailable = (e) => {
    chunks.push(e.data);
  };

  recorder.onstop = async () => {
    if (countdownTimer) {
      clearInterval(countdownTimer);
    }

    const blob = new Blob(chunks, {
      type: "video/webm",
    });

    const file = new File([blob], "shawarma-dash-run.webm", {
      type: "video/webm",
    });

    // Share if supported
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({
          files: [file],
          title: "Shawarma Dash",
          text: "Check out my run!",
        });
      } catch {
        // User cancelled; fall through to download
      }
    } else {
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");

      a.href = url;
      a.download = file.name;
      a.click();

      URL.revokeObjectURL(url);
    }

    expanded = false;

    label.innerHTML = " Record 20s";
    label.style.maxWidth = "0";
    label.style.opacity = "0";
  };

  recorder.start();

  let seconds = 20;

  label.innerHTML = ` 🔴 ${seconds}s`;

  countdownTimer = window.setInterval(() => {
    seconds--;

    label.innerHTML = ` 🔴 ${seconds}s`;

    if (seconds <= 0 && countdownTimer) {
      clearInterval(countdownTimer);
    }
  }, 1000);

  setTimeout(() => {
    if (recorder?.state === "recording") {
      recorder.stop();
    }
  }, 20000);
}
