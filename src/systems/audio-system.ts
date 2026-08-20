import * as ecs from "@8thwall/ecs";

import countdownAudio from "../assets/audio/countdown.mp3";
import pickupAudio from "../assets/audio/pickup.mp3";
import deliveryAudio from "../assets/audio/delivery.mp3";
import lowTimeAudio from "../assets/audio/low-time.mp3";
import gameoverAudio from "../assets/audio/gameover.mp3";
import musicAudio from "../assets/audio/backgroundmusic.mp3";

// --------------------------------------------------
// CyberWrap Audio System
// --------------------------------------------------
//
// Audio:
// - countdown.mp3
// - pickup.mp3
// - delivery.mp3
// - low-time.mp3
// - gameover.mp3
// - backgroundmusic.mp3
//
// Mobile audio is unlocked from the first real
// user interaction.
// --------------------------------------------------

const AUDIO_FILES = {
  countdown: countdownAudio,
  pickup: pickupAudio,
  delivery: deliveryAudio,
  lowTime: lowTimeAudio,
  gameover: gameoverAudio,
  music: musicAudio,
};

type AudioName = keyof typeof AUDIO_FILES;

type SoundName = "countdown" | "pickup" | "delivery" | "lowTime" | "gameover";

// --------------------------------------------------
// Audio Cache
// --------------------------------------------------

const audioCache = new Map<AudioName, HTMLAudioElement>();

// --------------------------------------------------
// Volume
// --------------------------------------------------

let masterVolume = 0.8;

let effectsVolume = 0.8;

let musicVolume = 0.175;

// --------------------------------------------------
// Audio State
// --------------------------------------------------

let audioUnlocked = false;

let unlockInProgress = false;

let musicPlaying = false;

let lowTimePlayed = false;

// --------------------------------------------------
// Get / Create Audio
// --------------------------------------------------

function getAudio(name: AudioName): HTMLAudioElement | null {
  const existing = audioCache.get(name);

  if (existing) {
    return existing;
  }

  const src = AUDIO_FILES[name];

  if (!src) {
    return null;
  }

  const audio = new Audio();

  audio.src = src;

  audio.preload = "auto";

  audio.controls = false;

  audio.setAttribute("playsinline", "");

  audioCache.set(name, audio);

  return audio;
}

// --------------------------------------------------
// Preload Audio
// --------------------------------------------------

function preloadAllAudio() {
  (Object.keys(AUDIO_FILES) as AudioName[]).forEach((name) => {
    const audio = getAudio(name);

    if (!audio) {
      return;
    }

    try {
      audio.load();
    } catch {
      // Ignore preload failures.
    }
  });
}

// --------------------------------------------------
// Unlock Audio
//
// Must be triggered by a real user gesture.
// --------------------------------------------------

export function unlockAudio(): void {
  if (audioUnlocked || unlockInProgress) {
    return;
  }

  unlockInProgress = true;

  const unlockPromises: Promise<unknown>[] = [];

  (Object.keys(AUDIO_FILES) as AudioName[]).forEach((name) => {
    const audio = getAudio(name);

    if (!audio) {
      return;
    }

    try {
      // --------------------------------------------
      // Temporarily mute playback
      // --------------------------------------------

      audio.muted = true;

      audio.volume = 0;

      audio.currentTime = 0;

      // --------------------------------------------
      // Playback initiated from user gesture
      // --------------------------------------------

      const promise = audio.play();

      if (promise) {
        unlockPromises.push(
          promise
            .then(() => {
              audio.pause();

              audio.currentTime = 0;

              audio.muted = false;

              audio.volume =
                name === "music"
                  ? masterVolume * musicVolume
                  : masterVolume * effectsVolume;
            })
            .catch(() => {
              // Some browsers may reject
              // individual audio elements.
            }),
        );
      }
    } catch {
      // Ignore individual unlock failures.
    }
  });

  Promise.all(unlockPromises)
    .then(() => {
      audioUnlocked = true;
    })
    .finally(() => {
      unlockInProgress = false;
    });
}

// --------------------------------------------------
// First User Interaction
//
// This is especially important for:
// - iOS Safari
// - Android Chrome
// - mobile WebAR browsers
// --------------------------------------------------

function setupFirstInteractionUnlock() {
  const unlockFromGesture = () => {
    unlockAudio();

    window.removeEventListener("pointerdown", unlockFromGesture);

    window.removeEventListener("touchstart", unlockFromGesture);

    window.removeEventListener("click", unlockFromGesture);
  };

  window.addEventListener("pointerdown", unlockFromGesture, {
    passive: true,
    once: true,
  });

  window.addEventListener("touchstart", unlockFromGesture, {
    passive: true,
    once: true,
  });

  window.addEventListener("click", unlockFromGesture, {
    passive: true,
    once: true,
  });
}

// --------------------------------------------------
// Play Sound Effect
// --------------------------------------------------

export function playSound(name: SoundName): void {
  if (!audioUnlocked) {
    return;
  }

  const audio = getAudio(name);

  if (!audio) {
    return;
  }

  try {
    audio.pause();

    audio.currentTime = 0;

    audio.muted = false;

    audio.volume = masterVolume * effectsVolume;

    const promise = audio.play();

    if (promise) {
      promise.catch(() => {
        // Ignore browser playback rejection.
      });
    }
  } catch {
    // Ignore playback errors.
  }
}

// --------------------------------------------------
// Start Background Music
// --------------------------------------------------

export function startMusic(): void {
  if (!audioUnlocked) {
    return;
  }

  if (musicPlaying) {
    return;
  }

  const music = getAudio("music");

  if (!music) {
    return;
  }

  try {
    music.loop = true;

    music.muted = false;

    music.volume = masterVolume * musicVolume;

    music.currentTime = 0;

    const promise = music.play();

    if (promise) {
      promise
        .then(() => {
          musicPlaying = true;
        })
        .catch(() => {
          musicPlaying = false;
        });
    } else {
      musicPlaying = true;
    }
  } catch {
    musicPlaying = false;
  }
}

// --------------------------------------------------
// Stop Background Music
// --------------------------------------------------

export function stopMusic(): void {
  const music = audioCache.get("music");

  if (!music) {
    musicPlaying = false;

    return;
  }

  try {
    music.pause();

    music.currentTime = 0;
  } catch {
    // Ignore stop errors.
  }

  musicPlaying = false;
}

// --------------------------------------------------
// Reset Audio For New Round
// --------------------------------------------------

export function resetAudioRound(): void {
  lowTimePlayed = false;

  stopMusic();
}

// --------------------------------------------------
// Low-Time Warning
// --------------------------------------------------

export function checkLowTime(timeLeft: number): void {
  if (lowTimePlayed) {
    return;
  }

  if (timeLeft <= 10 && timeLeft > 0) {
    lowTimePlayed = true;

    playSound("lowTime");
  }
}

// --------------------------------------------------
// Master Volume
// --------------------------------------------------

export function setMasterVolume(volume: number): void {
  masterVolume = Math.max(0, Math.min(1, volume));

  updateVolumes();
}

// --------------------------------------------------
// Music Volume
// --------------------------------------------------

export function setMusicVolume(volume: number): void {
  musicVolume = Math.max(0, Math.min(1, volume));

  updateVolumes();
}

// --------------------------------------------------
// Effects Volume
// --------------------------------------------------

export function setEffectsVolume(volume: number): void {
  effectsVolume = Math.max(0, Math.min(1, volume));

  updateVolumes();
}

// --------------------------------------------------
// Update Volumes
// --------------------------------------------------

function updateVolumes(): void {
  const music = audioCache.get("music");

  if (music) {
    music.volume = masterVolume * musicVolume;
  }

  audioCache.forEach((audio, name) => {
    if (name === "music") {
      return;
    }

    audio.volume = masterVolume * effectsVolume;
  });
}

// --------------------------------------------------
// Stop Everything
// --------------------------------------------------

export function stopAllSounds(): void {
  audioCache.forEach((audio) => {
    try {
      audio.pause();

      audio.currentTime = 0;
    } catch {
      // Ignore stop errors.
    }
  });

  musicPlaying = false;

  lowTimePlayed = false;
}

// --------------------------------------------------
// ECS Component
// --------------------------------------------------

ecs.registerComponent({
  name: "audio-system",

  schema: {},

  stateMachine: ({ defineState }) => {
    defineState("ready")
      .initial()

      .onEnter(() => {
        preloadAllAudio();

        setupFirstInteractionUnlock();
      });
  },
});
