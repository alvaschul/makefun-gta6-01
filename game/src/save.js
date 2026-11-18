// The save game: one JSON record in localStorage, written at every moment
// that matters (a mission finished, a respray bought, the game paused) and
// offered back on the title screen as Continue. It holds Rio's cash, story
// progress, lifetime stats and where he was standing — never anything the
// simulation cannot rebuild, so a stale or corrupt save degrades to a fresh
// game instead of a broken one.

const SAVE_KEY = 'neon-harbor.save.v1';

export function defaultSave() {
  return {
    version: 1,
    cash: 120,
    missionIndex: 0,     // next story mission to play
    storyDone: false,
    position: null,      // {x, z, heading} on foot, or null for the motel door
    stats: { earned: 0, crimes: 0, carsStolen: 0, shotsFired: 0, timesWasted: 0, timesBusted: 0 },
  };
}

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || parsed.version !== 1 || typeof parsed.cash !== 'number') return null;
    const fresh = defaultSave();
    return {
      ...fresh,
      ...parsed,
      stats: { ...fresh.stats, ...(parsed.stats || {}) },
    };
  } catch {
    return null; // storage off or corrupt: a new game, not a crash
  }
}

export function storeSave(save) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Private windows and full quotas lose the save silently; the run goes on.
  }
}

export function clearSave() {
  try { window.localStorage.removeItem(SAVE_KEY); } catch { /* nothing to clear */ }
}
