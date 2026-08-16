import { gameData } from "../core/game-data";

// --------------------------------------------------
// Score System
//
// Responsibilities:
// - Add points
// - Reset score
// - Central score management
// --------------------------------------------------

export function addScore(amount: number) {
  gameData.score += amount;
}

export function resetScore() {
  gameData.score = 0;
}
