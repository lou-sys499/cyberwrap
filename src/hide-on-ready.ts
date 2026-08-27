import * as ecs from "@8thwall/ecs";

function hideOpener(): void {
  const opener = document.getElementById("cyberwrap-opener");

  if (!opener) {
    return;
  }

  opener.classList.add("hidden");
  document.body.classList.remove("cyberwrap-booting");
  
  // Add mountain background when game starts
  document.body.style.backgroundImage = "url('/assets/mountain-view.jpg')";
  document.body.style.backgroundSize = "cover";
  document.body.style.backgroundPosition = "center";
  document.body.style.backgroundRepeat = "no-repeat";
  document.body.style.backgroundAttachment = "fixed";
}

ecs.registerComponent({
  name: "browser-start-gate",

  stateMachine: ({ defineState }) => {
    defineState("initial")
      .initial()
      .onEnter(() => {
        const startButton = document.getElementById(
          "cyberwrap-start",
        ) as HTMLButtonElement | null;

        if (!startButton) {
          console.error("[CyberWrap] Browser start button not found");
          return;
        }

        startButton.addEventListener("click", () => {
          startButton.disabled = true;
          hideOpener();
          window.dispatchEvent(new Event("cyberwrap-start"));
        });
      });
  },
});
