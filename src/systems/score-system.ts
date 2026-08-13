import { gameData } from "../core/game-data";


// --------------------------------------------------
// Score System
//
// Responsibilities:
// - Add points
// - Reset score
// - Central score management
// --------------------------------------------------



export function addScore(
  amount:number
){

  gameData.score += amount;


  console.log(
    `[Score] +${amount} | Total Score: ${gameData.score}`
  );

}




export function resetScore(){

  gameData.score = 0;


  console.log(
    "[Score] Reset"
  );

}