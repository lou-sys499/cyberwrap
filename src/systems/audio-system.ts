import * as ecs from "@8thwall/ecs";

import countdown3Audio from "../assets/audio/3.mp3";
import countdown2Audio from "../assets/audio/2.mp3";
import countdown1Audio from "../assets/audio/1.mp3";
import goAudio from "../assets/audio/go.mp3";
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
// - 3.mp3
// - 2.mp3
// - 1.mp3
// - go.mp3
// - pickup.mp3
// - delivery.mp3
// - low-time.mp3
// - gameover.mp3
// - backgroundmusic.mp3
//
// Recording:
// - Background music is routed to:
//     1. Phone speakers
//     2. MediaRecorder audio stream
//
// - Microphone is NEVER requested.
// - Game audio continues playing normally.
//
// --------------------------------------------------

const AUDIO_FILES = {
  countdown3: countdown3Audio,
  countdown2: countdown2Audio,
  countdown1: countdown1Audio,
  go: goAudio,
  pickup: pickupAudio,
  delivery: deliveryAudio,
  lowTime: lowTimeAudio,
  gameover: gameoverAudio,
  music: musicAudio,
};

type AudioName = keyof typeof AUDIO_FILES;

type SoundName =
  | "countdown3"
  | "countdown2"
  | "countdown1"
  | "go"
  | "pickup"
  | "delivery"
  | "lowTime"
  | "gameover";

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
// SINGLE WEB AUDIO RECORDING ROUTE
// --------------------------------------------------
//
// IMPORTANT:
//
// There must only be ONE
// MediaElementAudioSourceNode
// for the background music element.
//
// The graph is:
//
// backgroundmusic.mp3
//        |
//        v
// HTMLAudioElement
//        |
//        v
// MediaElementAudioSourceNode
//       / \
//      /   \
//     v     v
// speakers  MediaStreamDestination
//              |
//              v
//         MediaRecorder
//
// --------------------------------------------------

let audioContext: AudioContext | null = null;

let musicSourceNode: MediaElementAudioSourceNode | null = null;

let recordingDestination: MediaStreamAudioDestinationNode | null = null;

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

  audio.setAttribute("webkit-playsinline", "");

  // Required for Web Audio routing in browsers.
  audio.crossOrigin = "anonymous";

  audioCache.set(name, audio);

  return audio;
}

// --------------------------------------------------
// Get / Create AudioContext
// --------------------------------------------------

function getAudioContext(): AudioContext | null {
  if (audioContext) {
    return audioContext;
  }

  try {
    const AudioContextClass =
      window.AudioContext ||
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;

    if (!AudioContextClass) {
      console.warn("[Audio] Web Audio API unavailable.");

      return null;
    }

    audioContext = new AudioContextClass();

    return audioContext;
  } catch (error) {
    console.warn("[Audio] Could not create AudioContext:", error);

    return null;
  }
}

// --------------------------------------------------
// Prepare Music Recording Route
// --------------------------------------------------
//
// Creates the Web Audio graph exactly once.
//
// Music goes to:
// 1. Phone speakers
// 2. Recording destination
//
// --------------------------------------------------

function setupMusicRecordingRoute(): void {
  const music = getAudio("music");

  if (!music) {
    console.warn("[Audio] Background music element unavailable.");

    return;
  }

  const context = getAudioContext();

  if (!context) {
    return;
  }

  try {
    // ------------------------------------------------
    // Create the MediaElementAudioSourceNode ONLY ONCE.
    //
    // This is critical. A single HTMLAudioElement
    // cannot safely have multiple
    // MediaElementAudioSourceNodes.
    // ------------------------------------------------

    if (!musicSourceNode) {
      musicSourceNode = context.createMediaElementSource(music);

      console.log("[Audio] Music source node created.");
    }

    // ------------------------------------------------
    // Create recording destination ONLY ONCE.
    // ------------------------------------------------

    if (!recordingDestination) {
      recordingDestination = context.createMediaStreamDestination();

      console.log("[Audio] Recording destination created.");
    }

    // ------------------------------------------------
    // Connect music to phone speakers.
    // ------------------------------------------------

    try {
      musicSourceNode.connect(context.destination);
    } catch {
      // Already connected.
    }

    // ------------------------------------------------
    // Connect music to recorder.
    // ------------------------------------------------

    try {
      musicSourceNode.connect(recordingDestination);
    } catch {
      // Already connected.
    }

    console.log("[Audio] Music recording route ready.");
  } catch (error) {
    console.warn("[Audio] Could not create music recording route:", error);
  }
}

// --------------------------------------------------
// Get Recording Audio Stream
// --------------------------------------------------
//
// Returns ONLY CyberWrap background music.
//
// No microphone.
// No camera audio.
//
// --------------------------------------------------

export function getRecordingAudioStream(): MediaStream | null {
  setupMusicRecordingRoute();

  if (!recordingDestination) {
    console.warn("[Audio] Recording destination unavailable.");

    return null;
  }

  const context = getAudioContext();

  if (context && context.state === "suspended") {
    void context.resume();
  }

  const tracks = recordingDestination.stream.getAudioTracks();

  console.log(`[Audio] Recording audio tracks available: ${tracks.length}`);

  return recordingDestination.stream;
}

// --------------------------------------------------
// Get Recording Audio Track
// --------------------------------------------------

export function getRecordingAudioTrack(): MediaStreamTrack | null {
  const stream = getRecordingAudioStream();

  if (!stream) {
    return null;
  }

  return stream.getAudioTracks()[0] ?? null;
}

// --------------------------------------------------
// Music Recording Stream
// --------------------------------------------------
//
// This is the function used by record-button.ts.
//
// IMPORTANT:
// It uses the SAME audio pipeline as the game.
//
// --------------------------------------------------

export function getMusicRecordingStream(): MediaStream | null {
  return getRecordingAudioStream();
}

// --------------------------------------------------
// Preload Audio
// --------------------------------------------------

function preloadAllAudio(): void {
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

  const context = getAudioContext();

  // ------------------------------------------------
  // Resume Web Audio context.
  // ------------------------------------------------

  if (context) {
    try {
      void context.resume();
    } catch {
      // Ignore.
    }
  }

  // ------------------------------------------------
  // Prepare the SINGLE music recording route.
  // ------------------------------------------------

  setupMusicRecordingRoute();

  const unlockPromises: Promise<unknown>[] = [];

  (Object.keys(AUDIO_FILES) as AudioName[]).forEach((name) => {
    const audio = getAudio(name);

    if (!audio) {
      return;
    }

    try {
      // --------------------------------------------
      // Temporarily mute playback.
      // --------------------------------------------

      audio.muted = true;

      audio.volume = 0;

      audio.currentTime = 0;

      // --------------------------------------------
      // Trigger playback from the user gesture.
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
              // Individual audio unlock failure.
            }),
        );
      }
    } catch {
      // Ignore individual audio failures.
    }
  });

  Promise.all(unlockPromises)
    .then(() => {
      audioUnlocked = true;

      console.log("[Audio] Audio unlocked.");
    })
    .finally(() => {
      unlockInProgress = false;
    });
}

// --------------------------------------------------
// First User Interaction
// --------------------------------------------------

function setupFirstInteractionUnlock(): void {
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
        // Ignore playback rejection.
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

  // ------------------------------------------------
  // Make sure the single recording route exists.
  // ------------------------------------------------

  setupMusicRecordingRoute();

  // ------------------------------------------------
  // Resume Web Audio context.
  // ------------------------------------------------

  const context = getAudioContext();

  if (context) {
    try {
      if (context.state === "suspended") {
        void context.resume();
      }
    } catch {
      // Ignore.
    }
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

          console.log("[Audio] Background music started.");
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
    // Ignore.
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
      // Ignore.
    }
  });

  musicPlaying = false;

  lowTimePlayed = false;
}

// --------------------------------------------------
// Audio Status
// --------------------------------------------------

export function isAudioUnlocked(): boolean {
  return audioUnlocked;
}

export function isMusicPlaying(): boolean {
  return musicPlaying;
}

// --------------------------------------------------
// ECS COMPONENT
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
