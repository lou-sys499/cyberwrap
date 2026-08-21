// --------------------------------------------------
// CyberWrap Analytics Consent
//
// Handles player consent for anonymous analytics.
//
// Privacy by design:
// - No analytics without consent
// - Consent persists locally
// - No personal information collected
// --------------------------------------------------

export type AnalyticsConsent = "granted" | "denied" | "unknown";

// --------------------------------------------------
// Storage
// --------------------------------------------------

const CONSENT_KEY = "cyberwrap-analytics-consent";

// --------------------------------------------------
// Get stored consent
// --------------------------------------------------

export function getAnalyticsConsent(): AnalyticsConsent {
  try {
    const value = localStorage.getItem(CONSENT_KEY);

    if (value === "granted") {
      return "granted";
    }

    if (value === "denied") {
      return "denied";
    }
  } catch {
    // Storage unavailable.
  }

  return "unknown";
}

// --------------------------------------------------
// Check consent
// --------------------------------------------------

export function hasAnalyticsConsent(): boolean {
  return getAnalyticsConsent() === "granted";
}

// --------------------------------------------------
// Grant consent
// --------------------------------------------------

export function grantAnalyticsConsent(): void {
  try {
    localStorage.setItem(CONSENT_KEY, "granted");
  } catch {
    // Continue without persistent storage.
  }
}

// --------------------------------------------------
// Deny consent
// --------------------------------------------------

export function denyAnalyticsConsent(): void {
  try {
    localStorage.setItem(CONSENT_KEY, "denied");
  } catch {
    // Continue without persistent storage.
  }
}

// --------------------------------------------------
// Reset consent
//
// Useful for testing and privacy settings.
// --------------------------------------------------

export function resetAnalyticsConsent(): void {
  try {
    localStorage.removeItem(CONSENT_KEY);
  } catch {
    // Ignore storage errors.
  }
}
