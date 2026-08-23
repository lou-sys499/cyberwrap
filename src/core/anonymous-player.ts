const PLAYER_ID_KEY = "cyberwrap_player_id";

export function getAnonymousPlayerId(): string | null {
  try {
    return localStorage.getItem(PLAYER_ID_KEY);
  } catch {
    return null;
  }
}

export function ensureAnonymousPlayerId(): string {
  const existing = getAnonymousPlayerId();

  if (existing) {
    return existing;
  }

  const playerId = crypto.randomUUID();

  try {
    localStorage.setItem(PLAYER_ID_KEY, playerId);
  } catch {
    // The server will reject reward claims without a persistent identity.
  }

  return playerId;
}