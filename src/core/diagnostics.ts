// =====================================================
// FAKO RUNTIME DIAGNOSTIC & LIFECYCLE TRACKER
// =====================================================

export const fakoLifecycle = {
  cameraSystemInitCount: 0,
  cameraAttachCount: 0,
  cameraResetCount: 0,
  truckSpawnCount: 0,
  cityBuildCount: 0,
  countdownStartCount: 0,
  gameStartCount: 0,
};

export function logFakoLifecycle(caller: string): void {
  console.log(`[FakoLifecycle] (triggered by ${caller})`, {
    cameraSystemInit: fakoLifecycle.cameraSystemInitCount,
    cameraAttach: fakoLifecycle.cameraAttachCount,
    cameraReset: fakoLifecycle.cameraResetCount,
    truckSpawn: fakoLifecycle.truckSpawnCount,
    cityBuild: fakoLifecycle.cityBuildCount,
    countdownStart: fakoLifecycle.countdownStartCount,
    gameStart: fakoLifecycle.gameStartCount,
  });
}

export function recordFakoLifecycleEvent(event: keyof typeof fakoLifecycle): void {
  fakoLifecycle[event]++;
  logFakoLifecycle(event);
}
