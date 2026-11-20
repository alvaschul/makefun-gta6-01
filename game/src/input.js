// input.js — keyboard and mouse state for the game.
// Modules poll isDown() for held keys and wasPressed() for one-frame edges.
// endFrame() must be called once per frame by the main loop to clear edges
// and accumulate mouse movement.

const held = new Set();
const pressed = new Set();
let canvasRef = null;

export const mouseDelta = { x: 0, y: 0 };
export const mouse = { down: false, clicked: false };

function onKeyDown(e) {
  if (!held.has(e.code)) pressed.add(e.code);
  held.add(e.code);
  if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) {
    e.preventDefault();
  }
}

function onKeyUp(e) {
  held.delete(e.code);
}

function onMouseMove(e) {
  if (document.pointerLockElement === canvasRef) {
    mouseDelta.x += e.movementX || 0;
    mouseDelta.y += e.movementY || 0;
  }
}

function onMouseDown(e) {
  if (e.button === 0) {
    if (!mouse.down) mouse.clicked = true;
    mouse.down = true;
  }
}

function onMouseUp(e) {
  if (e.button === 0) mouse.down = false;
}

function onCanvasClick() {
  if (canvasRef && document.pointerLockElement !== canvasRef) {
    canvasRef.requestPointerLock?.();
  }
}

function onBlur() {
  held.clear();
}

export function initInput(canvas) {
  canvasRef = canvas || null;
  window.addEventListener("keydown", onKeyDown);
  window.addEventListener("keyup", onKeyUp);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mouseup", onMouseUp);
  window.addEventListener("blur", onBlur);
  if (canvasRef) canvasRef.addEventListener("click", onCanvasClick);
}

export function isDown(code) {
  return held.has(code);
}

export function wasPressed(code) {
  return pressed.has(code);
}

// Call at the end of each frame: clears edge presses and mouse deltas.
export function endFrame() {
  pressed.clear();
  mouse.clicked = false;
  mouseDelta.x = 0;
  mouseDelta.y = 0;
}
