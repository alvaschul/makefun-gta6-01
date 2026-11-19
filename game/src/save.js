// NEON HARBOR v2 — localStorage persistence.
// One versioned key holds the whole run: cash, story progress, where Rio
// is standing, and lifetime counters for the complete screen.

const SAVE_KEY = "neon-harbor-v2-save-v1";

export function hasSave() {
  try {
    return window.localStorage.getItem(SAVE_KEY) !== null;
  } catch {
    return false;
  }
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (!data || data.version !== 1) return null;
    return data;
  } catch {
    return null;
  }
}

export function storeSave(snapshot) {
  try {
    const data = {
      version: 1,
      savedAt: Date.now(),
      cash: Math.round(snapshot.cash ?? 0),
      missionIndex: snapshot.missionIndex ?? 0,
      storyDone: Boolean(snapshot.storyDone),
      playerPos: snapshot.playerPos ?? null,
      hour: snapshot.hour ?? 8,
      stats: {
        earned: Math.round(snapshot.stats?.earned ?? 0),
        carsStolen: snapshot.stats?.carsStolen ?? 0,
        busts: snapshot.stats?.busts ?? 0,
        wasted: snapshot.stats?.wasted ?? 0,
        missionsDone: snapshot.stats?.missionsDone ?? 0,
        couriersDone: snapshot.stats?.couriersDone ?? 0,
      },
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function wipeSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Storage unavailable (private mode etc.) — nothing to clear.
  }
}
