// save.js — localStorage persistence for NEON HARBOR.
// Stores cash, completed missions, position and vehicle paint so Continue
// can pick the story back up. All failures are swallowed: a corrupt or
// missing save simply means "no save".

const KEY = "neon-harbor-save-v3";

export function saveGame(obj) {
  try {
    const payload = { version: 3, savedAt: Date.now(), data: obj };
    localStorage.setItem(KEY, JSON.stringify(payload));
    return true;
  } catch (err) {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !parsed.data) return null;
    return parsed.data;
  } catch (err) {
    return null;
  }
}

export function clearSave() {
  try {
    localStorage.removeItem(KEY);
  } catch (err) {
    // Storage unavailable (private mode etc.) — nothing to clear.
  }
}

export function hasSave() {
  return loadGame() !== null;
}
