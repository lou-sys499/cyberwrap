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
// --------------------------------------------------

const AUDIO_FILES = {
  countdown: countdownAudio,
  pickup: pickupAudio,
  delivery: deliveryAudio,
  lowTime: lowTimeAudio,
  gameover: gameoverAudio,
  music: musicAudio,
};

type SoundName = "countdown" | "pickup" | "delivery" | "lowTime" | "gameover";

// --------------------------------------------------
// Audio cache
// --------------------------------------------------

const audioCache = new Map<string, HTMLAudioElement>();

// --------------------------------------------------
// Volume
// --------------------------------------------------

let masterVolume = 0.8;

let effectsVolume = 0.8;

// Background music = half of previous 0.35
let musicVolume = 0.175;

// --------------------------------------------------
// Audio state
// --------------------------------------------------

let audioUnlocked = false;

let musicPlaying = false;

// Prevent low-time sound from repeating
let lowTimePlayed = false;

// --------------------------------------------------
// Get / create audio
// --------------------------------------------------

function getAudio(name: keyof typeof AUDIO_FILES): HTMLAudioElement | null {
  const existing = audioCache.get(name);

  if (existing) {
    return existing;
  }

  const src = AUDIO_FILES[name];

  if (!src) {
    console.warn("[Audio] Missing audio source:", name);

    return null;
  }

  const audio = new Audio();

  audio.src = src;

  audio.preload = "auto";

  // Prevent the browser from treating these
  // as positional media.
  audio.controls = false;

  audioCache.set(name, audio);

  return audio;
}

// --------------------------------------------------
// Preload all audio
// --------------------------------------------------

function preloadAllAudio() {
  (Object.keys(AUDIO_FILES) as Array<keyof typeof AUDIO_FILES>).forEach(
    (name) => {
      const audio = getAudio(name);

      if (!audio) {
        return;
      }

      try {
        audio.load();
      } catch (error) {
        console.warn(`[Audio] Preload failed: ${name}`, error);
      }
    },
  );
}

// --------------------------------------------------
// UNLOCK AUDIO
//
// IMPORTANT:
//
// This function MUST be called directly from a
// real user interaction such as:
//
// - screen tap
// - button click
//
// Do not call this from a timer or ECS tick.
// --------------------------------------------------

export function unlockAudio() {
  if (audioUnlocked) {
    return;
  }

  const unlockPromises: Promise<unknown>[] = [];

  (Object.keys(AUDIO_FILES) as Array<keyof typeof AUDIO_FILES>).forEach(
    (name) => {
      const audio = getAudio(name);

      if (!audio) {
        return;
      }

      try {
        // Start each element muted.
        //
        // This is only to establish the browser's
        // playback permission from the user gesture.
        audio.muted = true;

        audio.volume = 0;

        audio.currentTime = 0;

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
              .catch((error) => {
                console.warn(`[Audio] Unlock failed for "${name}"`, error);
              }),
          );
        }
      } catch (error) {
        console.warn(`[Audio] Unlock exception for "${name}"`, error);
      }
    },
  );

  // Consider the audio system unlocked once the
  // browser has accepted the playback requests.
  Promise.all(unlockPromises).then(() => {
    audioUnlocked = true;
  });
}

// --------------------------------------------------
// Play sound effect
// --------------------------------------------------

export function playSound(name: SoundName) {
  if (!audioUnlocked) {
    console.warn("[Audio] Sound requested before unlock:", name);

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
      promise.catch((error) => {
        console.warn(`[Audio] Could not play "${name}"`, error);
      });
    }
  } catch (error) {
    console.warn(`[Audio] Playback error "${name}"`, error);
  }
}

// --------------------------------------------------
// Start background music
// --------------------------------------------------

export function startMusic() {
  if (!audioUnlocked) {
    console.warn("[Audio] Music requested before unlock");

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
        .catch((error) => {
          musicPlaying = false;

          console.warn("[Audio] Could not start music:", error);
        });
    } else {
      musicPlaying = true;
    }
  } catch (error) {
    musicPlaying = false;

    console.warn("[Audio] Music playback error:", error);
  }
}

// --------------------------------------------------
// Stop background music
// --------------------------------------------------

export function stopMusic() {
  const music = audioCache.get("music");

  if (!music) {
    musicPlaying = false;

    return;
  }

  try {
    music.pause();

    music.currentTime = 0;
  } catch (error) {
    console.warn("[Audio] Music stop error:", error);
  }

  musicPlaying = false;
}

// --------------------------------------------------
// Reset audio for new round
// --------------------------------------------------

export function resetAudioRound() {
  lowTimePlayed = false;

  // Make sure previous music is not still running.
  stopMusic();
}

// --------------------------------------------------
// Low-time warning
// --------------------------------------------------

export function checkLowTime(timeLeft: number) {
  if (lowTimePlayed) {
    return;
  }

  if (timeLeft <= 10 && timeLeft > 0) {
    lowTimePlayed = true;

    playSound("lowTime");
  }
}

// --------------------------------------------------
// Master volume
// --------------------------------------------------

export function setMasterVolume(volume: number) {
  masterVolume = Math.max(0, Math.min(1, volume));

  updateVolumes();
}

// --------------------------------------------------
// Music volume
// --------------------------------------------------

export function setMusicVolume(volume: number) {
  musicVolume = Math.max(0, Math.min(1, volume));

  updateVolumes();
}

// --------------------------------------------------
// Effects volume
// --------------------------------------------------

export function setEffectsVolume(volume: number) {
  effectsVolume = Math.max(0, Math.min(1, volume));

  updateVolumes();
}

// --------------------------------------------------
// Update volumes
// --------------------------------------------------

function updateVolumes() {
  const music = audioCache.get("music");

  if (music) {
    music.volume = masterVolume * musicVolume;
  }

  for (const [name, audio] of audioCache) {
    if (name === "music") {
      continue;
    }

    audio.volume = masterVolume * effectsVolume;
  }
}

// --------------------------------------------------
// Stop everything
// --------------------------------------------------

export function stopAllSounds() {
  for (const audio of audioCache.values()) {
    try {
      audio.pause();

      audio.currentTime = 0;
    } catch (error) {
      console.warn("[Audio] Failed stopping audio:", error);
    }
  }

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
      });
  },
});
