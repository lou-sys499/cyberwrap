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
  if (gameData.gameMode === "freeRoam") {
    gameData.freeRoamSessionScore = (gameData.freeRoamSessionScore || 0) + amount;
    return;
  }
  gameData.score += amount;
}

export function resetScore() {
  gameData.score = 0;
  gameData.freeRoamSessionScore = 0;
}
