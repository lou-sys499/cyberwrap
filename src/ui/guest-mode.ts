const GUEST_SESSION_KEY = "cyberwrap-guest-session";

function setupGuestMode(): void {
  const startButton = document.getElementById("cyberwrap-start-ar");

  if (!startButton) {
    return;
  }

  startButton.addEventListener("click", () => {
    if (!sessionStorage.getItem(GUEST_SESSION_KEY)) {
      sessionStorage.setItem(GUEST_SESSION_KEY, crypto.randomUUID());
    }

    window.dispatchEvent(new CustomEvent("cyberwrap-guest-started"));
  });
}

setupGuestMode();
