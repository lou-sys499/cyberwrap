import { supabase } from "../core/supabase";

type AuthMode = "signup" | "signin";

const PHONE_PATTERN = /^\d{1,12}$/;

function getElement<T extends HTMLElement>(id: string): T | null {
  return document.getElementById(id) as T | null;
}

function setVisible(modal: HTMLDivElement, visible: boolean): void {
  modal.classList.toggle("visible", visible);
  modal.setAttribute("aria-hidden", String(!visible));
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
  const phone = getElement<HTMLInputElement>("cyberwrap-auth-phone");
  const password = getElement<HTMLInputElement>("cyberwrap-auth-password");
  const close = getElement<HTMLButtonElement>("cyberwrap-auth-close");
  const create = getElement<HTMLButtonElement>("cyberwrap-create-account");
  const signIn = getElement<HTMLButtonElement>("cyberwrap-sign-in");

  if (
    !modal ||
    !form ||
    !title ||
    !submit ||
    !message ||
    !name ||
    !phone ||
    !password ||
    !close ||
    !create ||
    !signIn
  ) {
    return;
  }

  let mode: AuthMode = "signup";

  const open = (nextMode: AuthMode): void => {
    mode = nextMode;
    const isSignup = mode === "signup";

    title.textContent = isSignup ? "CREATE ACCOUNT" : "SIGN IN";
    submit.textContent = isSignup ? "CREATE ACCOUNT" : "SIGN IN";
    name.hidden = !isSignup;
    name.required = isSignup;
    name.value = isSignup ? name.value : "";
    password.autocomplete = isSignup ? "new-password" : "current-password";
    message.textContent = "";
    setVisible(modal, true);

    (isSignup ? name : phone).focus();
  };

  create.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    open("signup");
  });

  signIn.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    open("signin");
  });

  close.addEventListener("click", () => setVisible(modal, false));

  modal.addEventListener("click", (event) => {
    if (event.target === modal) {
      setVisible(modal, false);
    }
  });

  form.addEventListener("submit", async (event) => {
    event.preventDefault();

    const normalizedPhone = phone.value.trim();

    if (!PHONE_PATTERN.test(normalizedPhone)) {
      message.textContent = "Use 1 to 12 digits only, with no spaces or symbols.";
      return;
    }

    submit.disabled = true;
    message.textContent = "Connecting securely...";

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          phone: `+${normalizedPhone}`,
          password: password.value,
          options: {
            data: {
              name: name.value.trim(),
            },
          },
        });

        if (error) {
          throw error;
        }

        message.textContent = data.session
          ? "Account created. You can now start AR."
          : "Account created. Check your phone for the verification code.";
        form.reset();

        if (data.session) {
          await refreshRewardStatus();
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          phone: `+${normalizedPhone}`,
          password: password.value,
        });

        if (error) {
          throw error;
        }

        message.textContent = "Signed in. You can now start AR.";
        password.value = "";
        await refreshRewardStatus();
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "";

      message.textContent = /already registered|already exists|user exists/i.test(
        errorMessage,
      )
        ? "An account already exists with this phone number. Please sign in instead."
        : errorMessage || "Authentication failed.";

      if (/already registered|already exists|user exists/i.test(errorMessage)) {
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
