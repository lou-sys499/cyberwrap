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
// Analytics are currently stored in memory only.
// No network requests are made yet.
// --------------------------------------------------

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
//
// Update this whenever you release a meaningful
// gameplay or analytics version.
//
// Example:
// 1.0.0
// 1.1.0
// 1.2.0
// --------------------------------------------------

const GAME_VERSION = "1.0.0";

// --------------------------------------------------
// ANONYMOUS SESSION ID
// --------------------------------------------------
//
// A new anonymous ID is generated every time
// CyberWrap is opened.
//
// It does NOT identify the player.
// --------------------------------------------------

function createSessionId(): string {
  const random = Math.random().toString(36).substring(2, 10).toUpperCase();

  return `CW-${random}`;
}

const sessionId = createSessionId();

// --------------------------------------------------
// CAMPAIGN ID
// --------------------------------------------------
//
// QR code example:
//
// https://www.dbcyberwrap.netlify.app/?c=DBBAG26
//
// CyberWrap reads:
// ?c=DBBAG26
//
// If someone opens CyberWrap directly without
// a campaign parameter, the campaign becomes:
// "direct"
// --------------------------------------------------

function getCampaignId(): string {
  try {
    const params = new URLSearchParams(window.location.search);

    const campaign = params.get("c");

    if (!campaign) {
      return "direct";
    }

    // Keep the campaign identifier short and safe.
    return campaign.trim().substring(0, 50);
  } catch {
    return "direct";
  }
}

const campaignId = getCampaignId();

// --------------------------------------------------
// EVENT QUEUE
// --------------------------------------------------
//
// Events remain in memory for now.
//
// We deliberately DO NOT send network requests
// during gameplay while we are optimizing CyberWrap.
// --------------------------------------------------

const eventQueue: AnalyticsPayload[] = [];

// --------------------------------------------------
// TRACK EVENT
// --------------------------------------------------
//
// Call this from gameplay systems when meaningful
// events occur.
//
// IMPORTANT:
// Never call this from a per-frame tick unless
// the event itself only happens once.
// --------------------------------------------------

export function trackEvent(
  event: AnalyticsEvent,
  data: Record<string, unknown> = {},
): void {
  const payload: AnalyticsPayload = {
    sessionId,
    campaign: campaignId,
    event,
    timestamp: Date.now(),
    gameVersion: GAME_VERSION,
    ...data,
  };

  eventQueue.push(payload);
}

// --------------------------------------------------
// GET QUEUED EVENTS
// --------------------------------------------------
//
// Useful later when we connect the analytics
// system to a backend.
//
// Returns a copy so other code cannot accidentally
// modify the internal queue.
// --------------------------------------------------

export function getAnalyticsEvents(): AnalyticsPayload[] {
  return [...eventQueue];
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
// Useful for development/testing.
// Not normally needed during gameplay.
// --------------------------------------------------

export function clearAnalyticsEvents(): void {
  eventQueue.length = 0;
}
