// NEON HARBOR v2 — keyboard and mouse state.
// One factory builds the tracker; the game loop polls it each frame and
// calls endFrame() so "pressed this frame" edges fire exactly once.

export function createInput(targetElement) {
  const held = new Set();
  const pressedEdges = new Set();
  const state = {
    mouseDX: 0,
    mouseDY: 0,
    mouseDown: false,
    rightDown: false,
    pointerLocked: false,
  };

  window.addEventListener("keydown", (event) => {
    if (!held.has(event.code)) pressedEdges.add(event.code);
    held.add(event.code);
    if (["Space", "ArrowUp", "ArrowDown"].includes(event.code)) event.preventDefault();
  });
  window.addEventListener("keyup", (event) => {
    held.delete(event.code);
  });
  window.addEventListener("blur", () => {
    held.clear();
    state.mouseDown = false;
    state.rightDown = false;
  });

  document.addEventListener("mousemove", (event) => {
    if (!state.pointerLocked) return;
    state.mouseDX += event.movementX || 0;
    state.mouseDY += event.movementY || 0;
  });
  document.addEventListener("mousedown", (event) => {
    if (event.button === 0) state.mouseDown = true;
    if (event.button === 2) state.rightDown = true;
  });
  document.addEventListener("mouseup", (event) => {
    if (event.button === 0) state.mouseDown = false;
    if (event.button === 2) state.rightDown = false;
  });
  document.addEventListener("contextmenu", (event) => event.preventDefault());
  document.addEventListener("pointerlockchange", () => {
    state.pointerLocked = document.pointerLockElement === targetElement;
  });

  return {
    state,
    /** True while the key is physically down. */
    down(code) {
      return held.has(code);
    },
    /** True only on the frame the key went down. */
    pressed(code) {
      return pressedEdges.has(code);
    },
    /** Movement axes from WASD + arrows, each in [-1, 1]. */
    moveAxes() {
      const x = (held.has("KeyD") || held.has("ArrowRight") ? 1 : 0)
        - (held.has("KeyA") || held.has("ArrowLeft") ? 1 : 0);
      const z = (held.has("KeyS") || held.has("ArrowDown") ? 1 : 0)
        - (held.has("KeyW") || held.has("ArrowUp") ? 1 : 0);
      return { x, z };
    },
    /** Consume accumulated mouse motion for this frame. */
    takeMouseDelta() {
      const delta = { x: state.mouseDX, y: state.mouseDY };
      state.mouseDX = 0;
      state.mouseDY = 0;
      return delta;
    },
    requestLock() {
      if (targetElement && targetElement.requestPointerLock) {
        targetElement.requestPointerLock();
      }
    },
    releaseLock() {
      if (document.pointerLockElement) document.exitPointerLock();
    },
    endFrame() {
      pressedEdges.clear();
    },
  };
}
