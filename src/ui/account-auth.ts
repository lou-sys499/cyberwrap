import { supabase } from "../core/supabase";

type AuthMode = "signup" | "signin";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getElement<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function setVisible(modal: HTMLDivElement, visible: boolean): void {
  modal.classList.toggle("visible", visible);
  modal.setAttribute("aria-hidden", String(!visible));
}

function startAuthenticatedAr(): void {
  setVisible(getElement<HTMLDivElement>("cyberwrap-auth-modal")!, false);

  const startButton = getElement<HTMLButtonElement>("cyberwrap-start-ar");

  if (startButton) {
    startButton.click();
  }
}

async function refreshRewardStatus(): Promise<void> {
  const status = getElement<HTMLDivElement>("cyberwrap-reward-status");
  const cyclePoints = getElement<HTMLSpanElement>("reward-cycle-points");
  const dailyPoints = getElement<HTMLSpanElement>("reward-daily-points");
  const playSeconds = getElement<HTMLSpanElement>("reward-play-seconds");
  const cycleEnds = getElement<HTMLSpanElement>("reward-cycle-ends");

  if (!status || !cyclePoints || !dailyPoints || !playSeconds || !cycleEnds) {
    return;
  }

  const { data, error } = await supabase.rpc("get_my_player_rewards");

  if (error || !data?.[0]) {
    return;
  }

  const reward = data[0];

  cyclePoints.textContent = `${reward.cycle_points} / 5000`;
  dailyPoints.textContent = `${reward.daily_points} / 2000`;
  playSeconds.textContent = `${Math.floor(reward.play_seconds / 60)} / 60 minutes`;
  cycleEnds.textContent = new Date(reward.cycle_ends_at).toLocaleString();
  status.classList.add("visible");
}

function setupAccountAuth(): void {
  const modal = getElement<HTMLDivElement>("cyberwrap-auth-modal");
  const form = getElement<HTMLFormElement>("cyberwrap-auth-panel");
  const title = getElement<HTMLHeadingElement>("cyberwrap-auth-title");
  const submit = getElement<HTMLButtonElement>("cyberwrap-auth-submit");
  const message = getElement<HTMLDivElement>("cyberwrap-auth-message");
  const name = getElement<HTMLInputElement>("cyberwrap-auth-name");
  const email = getElement<HTMLInputElement>("cyberwrap-auth-email");
  const whatsapp = getElement<HTMLInputElement>("cyberwrap-auth-whatsapp");
  const password = getElement<HTMLInputElement>("cyberwrap-auth-password");
  const confirmPassword = getElement<HTMLInputElement>(
    "cyberwrap-auth-confirm-password",
  );
  const close = getElement<HTMLButtonElement>("cyberwrap-auth-close");
  const signIn = getElement<HTMLButtonElement>("cyberwrap-sign-in");
  const switchButton = getElement<HTMLButtonElement>("cyberwrap-auth-switch");

  if (
    !modal ||
    !form ||
    !title ||
    !submit ||
    !message ||
    !name ||
    !email ||
    !whatsapp ||
    !password ||
    !confirmPassword ||
    !close ||
    !signIn ||
    !switchButton
  ) {
    return;
  }

  let mode: AuthMode = "signin";

  const open = (nextMode: AuthMode): void => {
    mode = nextMode;
    const isSignup = mode === "signup";

    title.textContent = isSignup ? "CREATE ACCOUNT" : "SIGN IN";
    submit.textContent = isSignup ? "CREATE ACCOUNT" : "SIGN IN";
    submit.classList.toggle("signin-submit", !isSignup);
    name.hidden = !isSignup;
    name.required = isSignup;
    whatsapp.hidden = !isSignup;
    whatsapp.required = false;
    confirmPassword.hidden = !isSignup;
    confirmPassword.required = isSignup;
    password.autocomplete = isSignup ? "new-password" : "current-password";
    switchButton.textContent = isSignup ? "SIGN-IN INSTEAD" : "CREATE ACCOUNT";
    message.textContent = "";
    message.classList.remove("error");
    setVisible(modal, true);

    (isSignup ? name : email).focus();
  };

  signIn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    open("signin");
  });

  switchButton.addEventListener("click", () => {
    open(mode === "signup" ? "signin" : "signup");
  });

  close.addEventListener("click", () => setVisible(modal, false));

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      setVisible(modal, false);
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const normalizedEmail = email.value.trim().toLowerCase();

    if (mode === "signup" && !name.value.trim()) {
      message.textContent = "Name is required.";
      name.focus();
      return;
    }

    if (mode === "signup" && password.value !== confirmPassword.value) {
      message.textContent = "Passwords do not match.";
      return;
    }

    if (!EMAIL_PATTERN.test(normalizedEmail)) {
      message.textContent = "Enter a valid email address.";
      return;
    }

    submit.disabled = true;
    message.textContent = "Connecting securely...";

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email: normalizedEmail,
          password: password.value,
          options: {
            data: {
              name: name.value.trim(),
              whatsapp_number: whatsapp.value.trim(),
            },
          },
        });

        if (error) {
          throw error;
        }

        message.textContent = data.session
          ? "Account created. You can now start AR."
          : "Account created. Check your email for the verification link.";
        form.reset();

        if (data.session) {
          await refreshRewardStatus();
          startAuthenticatedAr();
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: normalizedEmail,
          password: password.value,
        });

        if (error) {
          throw error;
        }

        message.textContent = "Signed in. You can now start AR.";
        password.value = "";
        await refreshRewardStatus();
        startAuthenticatedAr();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "";
      const isSignInFailure = mode === "signin";
      const isDuplicate = /already registered|already exists|user exists/i.test(
        errorMessage,
      );

      message.textContent = isSignInFailure
        ? "ACCOUNT NOT FOUND"
        : isDuplicate
          ? "An account already exists with this email. Please sign in instead."
          : errorMessage || "Authentication failed.";
      message.classList.toggle("error", isSignInFailure || isDuplicate);

      if (isDuplicate) {
        window.setTimeout(() => open("signin"), 1200);
      }
    } finally {
      submit.disabled = false;
    }
  });

  void supabase.auth.getSession().then(({ data }) => {
    if (data.session) {
      void refreshRewardStatus();
    }
  });
}

setupAccountAuth();
