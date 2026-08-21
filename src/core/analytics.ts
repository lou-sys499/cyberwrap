// --------------------------------------------------
// CyberWrap Analytics
//
// Anonymous gameplay telemetry.
//
// Privacy by design:
// - No names
// - No emails
// - No phone numbers
// - No GPS
// - No camera data
// - No microphone data
// - No advertising IDs
// - No direct personal identifiers
//
// Analytics require explicit player consent.
//
// Events are kept in a local memory queue and
// uploaded to Supabase in small batches.
//
// IMPORTANT:
// - No analytics event is created without consent.
// - No Supabase request is made without consent.
// - Denying/resetting consent clears pending events.
// --------------------------------------------------

import {
  hasAnalyticsConsent,
  getAnalyticsConsent,
  grantAnalyticsConsent as grantConsent,
  denyAnalyticsConsent as denyConsent,
  resetAnalyticsConsent as resetConsent,
} from "./analytics-consent";

import { supabase } from "./supabase";

// --------------------------------------------------
// ANALYTICS EVENTS
// --------------------------------------------------

export type AnalyticsEvent =
  | "session_started"
  | "ar_ready"
  | "drivezone_placed"
  | "game_started"
  | "collectible_collected"
  | "delivery_completed"
  | "game_completed"
  | "game_over"
  | "recording_requested"
  | "replay_started";

// --------------------------------------------------
// ANALYTICS PAYLOAD
// --------------------------------------------------

export interface AnalyticsPayload {
  sessionId: string;
  campaign: string;
  event: AnalyticsEvent;
  timestamp: number;
  gameVersion: string;

  [key: string]: unknown;
}

// --------------------------------------------------
// GAME VERSION
// --------------------------------------------------

const GAME_VERSION = "1.0.0";

// --------------------------------------------------
// SESSION ID
// --------------------------------------------------
//
// Created once per page load.
//
// This is NOT a personal identifier.
// It exists only to group events belonging
// to the same CyberWrap browser session.
// --------------------------------------------------

function createSessionId(): string {
  try {
    if (
      typeof crypto !== "undefined" &&
      typeof crypto.randomUUID === "function"
    ) {
      return `CW-${crypto.randomUUID()}`;
    }
  } catch {
    // Fall through to random fallback.
  }

  const random = Math.random().toString(36).substring(2, 10).toUpperCase();

  return `CW-${random}`;
}

const sessionId = createSessionId();

// --------------------------------------------------
// CAMPAIGN ID
// --------------------------------------------------
//
// Example:
//
// ?c=DBBAG26
//
// becomes:
//
// DBBAG26
//
// Direct visits become:
//
// direct
// --------------------------------------------------

function getCampaignId(): string {
  try {
    const params = new URLSearchParams(window.location.search);

    const campaign = params.get("c");

    if (!campaign) {
      return "direct";
    }

    return campaign.trim().substring(0, 50);
  } catch {
    return "direct";
  }
}

const campaignId = getCampaignId();

// --------------------------------------------------
// LOCAL EVENT QUEUE
// --------------------------------------------------
//
// Events exist only in memory.
//
// They are NOT stored in localStorage.
// They are NOT stored in cookies.
// They are NOT persisted when the page closes.
// --------------------------------------------------

const eventQueue: AnalyticsPayload[] = [];

// --------------------------------------------------
// UPLOAD STATE
// --------------------------------------------------

let uploadTimer: number | null = null;

let uploadInProgress = false;

// --------------------------------------------------
// UPLOAD SETTINGS
// --------------------------------------------------

const UPLOAD_DELAY = 3000;

const MAX_BATCH_SIZE = 25;

// --------------------------------------------------
// TRACK EVENT
// --------------------------------------------------
//
// Events are created ONLY when consent exists.
//
// This function should never be called every frame.
// --------------------------------------------------

export function trackEvent(
  event: AnalyticsEvent,
  data: Record<string, unknown> = {},
): void {
  // ------------------------------------------------
  // PRIVACY GATE
  // ------------------------------------------------

  if (!hasAnalyticsConsent()) {
    return;
  }

  // ------------------------------------------------
  // Create payload
  //
  // Standard fields are intentionally assigned AFTER
  // custom data so custom data cannot overwrite them.
  // ------------------------------------------------

  const payload: AnalyticsPayload = {
    ...data,

    sessionId,
    campaign: campaignId,
    event,
    timestamp: Date.now(),
    gameVersion: GAME_VERSION,
  };

  // ------------------------------------------------
  // Add to local queue
  // ------------------------------------------------

  eventQueue.push(payload);

  // ------------------------------------------------
  // Schedule Supabase upload
  // ------------------------------------------------

  scheduleAnalyticsUpload();
}

// --------------------------------------------------
// SCHEDULE ANALYTICS UPLOAD
// --------------------------------------------------

function scheduleAnalyticsUpload(delay = UPLOAD_DELAY): void {
  // ------------------------------------------------
  // No consent = no upload
  // ------------------------------------------------

  if (!hasAnalyticsConsent()) {
    return;
  }

  // ------------------------------------------------
  // Upload already running
  //
  // The current upload will schedule another batch
  // when it finishes if events remain.
  // ------------------------------------------------

  if (uploadInProgress) {
    return;
  }

  // ------------------------------------------------
  // Already scheduled
  // ------------------------------------------------

  if (uploadTimer !== null) {
    return;
  }

  uploadTimer = window.setTimeout(() => {
    uploadTimer = null;

    void uploadAnalyticsEvents();
  }, delay);
}

// --------------------------------------------------
// UPLOAD ANALYTICS EVENTS
// --------------------------------------------------

async function uploadAnalyticsEvents(): Promise<void> {
  // ------------------------------------------------
  // PRIVACY GATE
  // ------------------------------------------------

  if (!hasAnalyticsConsent()) {
    return;
  }

  // ------------------------------------------------
  // Prevent overlapping uploads
  // ------------------------------------------------

  if (uploadInProgress) {
    return;
  }

  // ------------------------------------------------
  // Nothing to upload
  // ------------------------------------------------

  if (eventQueue.length === 0) {
    return;
  }

  uploadInProgress = true;

  // ------------------------------------------------
  // Take only one batch
  //
  // New events can continue entering the queue
  // while this upload is happening.
  // ------------------------------------------------

  const eventsToUpload = eventQueue.splice(
    0,
    Math.min(MAX_BATCH_SIZE, eventQueue.length),
  );

  try {
    // ------------------------------------------------
    // Convert analytics payloads into Supabase rows
    // ------------------------------------------------

    const rows = eventsToUpload.map((event) => ({
      session_id: event.sessionId,

      campaign: event.campaign,

      event: event.event,

      timestamp: event.timestamp,

      game_version: event.gameVersion,

      data: getEventData(event),
    }));

    // ------------------------------------------------
    // Upload to Supabase
    // ------------------------------------------------

    const { error } = await supabase.from("analytics_events").insert(rows);

    // ------------------------------------------------
    // Supabase error
    // ------------------------------------------------

    if (error) {
      console.warn("[Analytics] Supabase upload failed:", error.message);

      // ----------------------------------------------
      // Restore events.
      // ----------------------------------------------

      eventQueue.unshift(...eventsToUpload);

      return;
    }

    // ------------------------------------------------
    // Successful upload
    // ------------------------------------------------

    console.log(`[Analytics] Uploaded ${eventsToUpload.length} event(s)`);

    // ------------------------------------------------
    // More events remain.
    //
    // Upload another batch shortly.
    // ------------------------------------------------

    if (eventQueue.length > 0) {
      scheduleAnalyticsUpload(100);
    }
  } catch (error) {
    console.warn("[Analytics] Supabase connection failed:", error);

    // ------------------------------------------------
    // Restore events.
    // ------------------------------------------------

    eventQueue.unshift(...eventsToUpload);
  } finally {
    uploadInProgress = false;

    // ------------------------------------------------
    // Retry after upload has completely finished.
    //
    // This is important because scheduleAnalyticsUpload()
    // ignores scheduling while uploadInProgress is true.
    // ------------------------------------------------

    if (
      hasAnalyticsConsent() &&
      eventQueue.length > 0 &&
      uploadTimer === null
    ) {
      scheduleAnalyticsUpload(UPLOAD_DELAY);
    }
  }
}

// --------------------------------------------------
// EXTRACT EVENT DATA
// --------------------------------------------------
//
// Standard analytics fields belong in dedicated
// Supabase columns.
//
// Everything else goes into the JSONB "data" column.
// --------------------------------------------------

function getEventData(event: AnalyticsPayload): Record<string, unknown> {
  const {
    sessionId: _sessionId,
    campaign: _campaign,
    event: _event,
    timestamp: _timestamp,
    gameVersion: _gameVersion,

    ...data
  } = event;

  return data;
}

// --------------------------------------------------
// START ANALYTICS SESSION
// --------------------------------------------------
//
// Records exactly one session_started event.
//
// IMPORTANT:
// This only happens after analytics consent.
// --------------------------------------------------

let analyticsSessionStarted = false;

export function startAnalyticsSession(): void {
  // ------------------------------------------------
  // No consent = nothing happens.
  // ------------------------------------------------

  if (!hasAnalyticsConsent()) {
    return;
  }

  // ------------------------------------------------
  // Prevent duplicate session events.
  // ------------------------------------------------

  if (analyticsSessionStarted) {
    return;
  }

  analyticsSessionStarted = true;

  trackEvent("session_started");
}

// --------------------------------------------------
// CONSENT: GRANT
// --------------------------------------------------
//
// The actual consent storage remains in
// analytics-consent.ts.
//
// Once consent is granted, start the analytics
// session immediately.
// --------------------------------------------------

export function grantAnalyticsConsent(): void {
  grantConsent();

  startAnalyticsSession();
}

// --------------------------------------------------
// CONSENT: DENY
// --------------------------------------------------
//
// If consent is withdrawn, any events still waiting
// in memory are immediately destroyed.
// --------------------------------------------------

export function denyAnalyticsConsent(): void {
  denyConsent();

  clearPendingAnalytics();

  analyticsSessionStarted = false;
}

// --------------------------------------------------
// CONSENT: RESET
// --------------------------------------------------
//
// Used mainly for testing.
// --------------------------------------------------

export function resetAnalyticsConsent(): void {
  resetConsent();

  clearPendingAnalytics();

  analyticsSessionStarted = false;
}

// --------------------------------------------------
// CONSENT HELPERS
// --------------------------------------------------

export { hasAnalyticsConsent, getAnalyticsConsent };

// --------------------------------------------------
// CLEAR PENDING ANALYTICS
// --------------------------------------------------

function clearPendingAnalytics(): void {
  // ------------------------------------------------
  // Cancel scheduled upload.
  // ------------------------------------------------

  if (uploadTimer !== null) {
    clearTimeout(uploadTimer);

    uploadTimer = null;
  }

  // ------------------------------------------------
  // Remove all queued events.
  // ------------------------------------------------

  eventQueue.length = 0;
}

// --------------------------------------------------
// GET QUEUED EVENTS
// --------------------------------------------------

export function getAnalyticsEvents(): AnalyticsPayload[] {
  return [...eventQueue];
}

// --------------------------------------------------
// GET EVENT COUNT
// --------------------------------------------------

export function getAnalyticsEventCount(): number {
  return eventQueue.length;
}

// --------------------------------------------------
// GET CURRENT CAMPAIGN
// --------------------------------------------------

export function getAnalyticsCampaign(): string {
  return campaignId;
}

// --------------------------------------------------
// GET SESSION ID
// --------------------------------------------------

export function getAnalyticsSessionId(): string {
  return sessionId;
}

// --------------------------------------------------
// GET GAME VERSION
// --------------------------------------------------

export function getAnalyticsGameVersion(): string {
  return GAME_VERSION;
}

// --------------------------------------------------
// CLEAR EVENTS
// --------------------------------------------------
//
// Development/testing only.
//
// Does not change consent.
// --------------------------------------------------

export function clearAnalyticsEvents(): void {
  eventQueue.length = 0;

  if (uploadTimer !== null) {
    clearTimeout(uploadTimer);

    uploadTimer = null;
  }
}

// --------------------------------------------------
// FLUSH ANALYTICS
// --------------------------------------------------
//
// Attempts to upload everything currently queued.
//
// Useful before manually ending a test session.
//
// NOTE:
// Browser shutdown does not guarantee that an async
// Supabase request will finish.
// --------------------------------------------------

export async function flushAnalytics(): Promise<void> {
  if (!hasAnalyticsConsent()) {
    return;
  }

  // ------------------------------------------------
  // Cancel scheduled upload.
  // ------------------------------------------------

  if (uploadTimer !== null) {
    clearTimeout(uploadTimer);

    uploadTimer = null;
  }

  // ------------------------------------------------
  // Upload current batches.
  // ------------------------------------------------

  while (eventQueue.length > 0) {
    const previousCount = eventQueue.length;

    await uploadAnalyticsEvents();

    // ----------------------------------------------
    // Prevent an infinite loop if an upload fails.
    // ----------------------------------------------

    if (eventQueue.length >= previousCount) {
      break;
    }
  }
}
