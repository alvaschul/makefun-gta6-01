// Keyboard and mouse input for a third-person open world.
// Held keys are a live state the simulation polls; one-shot presses (enter a
// car, interact, pause, radio) are queued as flags and taken exactly once by
// the loop, so a press between two frames is never lost or counted twice.
// The camera orbits from mouse movement: drag anywhere, or click the canvas
// to take pointer lock for free-look, as desktop players expect.
// The one-shot side is a bitmask of the ACT_* flags below: several presses
// inside one frame all survive until the loop takes the mask exactly once.

export const ACT_INTERACT = 1;   // E
export const ACT_VEHICLE = 2;    // F
export const ACT_PAUSE = 4;      // P / Esc
export const ACT_RADIO = 8;      // Tab
export const ACT_MUTE = 16;      // M
export const ACT_CONFIRM = 32;   // Enter / Space on menus

const FLAG_BY_CODE = {
  KeyE: ACT_INTERACT,
  KeyF: ACT_VEHICLE,
  KeyP: ACT_PAUSE,
  Escape: ACT_PAUSE,
  Tab: ACT_RADIO,
  KeyM: ACT_MUTE,
  Enter: ACT_CONFIRM,
  Space: ACT_CONFIRM,
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouseDX = 0;
  let mouseDY = 0;
  let firing = false;
  let dragging = false;
  let locked = false;

  window.addEventListener('keydown', (event) => {
    held.add(event.code);
    const flag = FLAG_BY_CODE[event.code];
    if (flag && !event.repeat) actions |= flag;
    if (event.code === 'Tab' || event.code === 'Space') event.preventDefault();
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => { held.clear(); firing = false; dragging = false; });

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button === 0) {
      firing = true;
      dragging = true;
      if (!locked && event.pointerType === 'mouse') {
        // Pointer lock is a nicety, not a requirement: if the browser refuses
        // (an embedded frame, a screenshot run) drag-look still works.
        try { canvas.requestPointerLock(); } catch { /* drag-look fallback */ }
      }
    }
  });
  window.addEventListener('pointerup', (event) => {
    if (event.button === 0) { firing = false; dragging = false; }
  });
  document.addEventListener('pointerlockchange', () => {
    locked = document.pointerLockElement === canvas;
  });
  window.addEventListener('mousemove', (event) => {
    if (locked || dragging) {
      mouseDX += event.movementX || 0;
      mouseDY += event.movementY || 0;
    }
  });

  return {
    down(code) { return held.has(code); },
    /** Forward/strafe axes from WASD and the arrow keys, each in -1..1. */
    moveAxes() {
      const f = (held.has('KeyW') || held.has('ArrowUp') ? 1 : 0) - (held.has('KeyS') || held.has('ArrowDown') ? 1 : 0);
      const s = (held.has('KeyD') || held.has('ArrowRight') ? 1 : 0) - (held.has('KeyA') || held.has('ArrowLeft') ? 1 : 0);
      return { f, s };
    },
    sprint() { return held.has('ShiftLeft') || held.has('ShiftRight'); },
    firing() { return firing; },
    /** Mouse movement since the last call, in pixels; taking it clears it. */
    takeMouse() {
      const taken = { dx: mouseDX, dy: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return taken;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    isLocked() { return locked; },
  };
}
