// Keyboard and mouse state. WASD + arrows drive, mouse drag orbits the
// camera, click shoots. Edge-triggered `pressed()` answers "just pressed
// this frame" for actions like entering a car or punching.

export function createInput(canvas) {
  const keys = new Set();
  const justPressed = new Set();
  let mouseDX = 0;
  let mouseDY = 0;
  let mouseDown = false;
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let wheelDelta = 0;

  window.addEventListener('keydown', (e) => {
    if (e.repeat) return;
    keys.add(e.code);
    justPressed.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => keys.delete(e.code));
  window.addEventListener('blur', () => keys.clear());

  canvas.addEventListener('mousedown', (e) => {
    mouseDown = true;
    dragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  window.addEventListener('mouseup', () => {
    mouseDown = false;
    dragging = false;
  });
  window.addEventListener('mousemove', (e) => {
    if (!dragging) return;
    mouseDX += e.clientX - lastX;
    mouseDY += e.clientY - lastY;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  canvas.addEventListener('wheel', (e) => {
    wheelDelta += e.deltaY;
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  return {
    isDown(code) {
      return keys.has(code);
    },
    // true once, on the frame the key went down
    pressed(code) {
      return justPressed.has(code);
    },
    // WASD / arrows as -1..1 axes
    moveAxis() {
      const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const y = (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0) - (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0);
      return { x, y };
    },
    get throttle() {
      return keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0;
    },
    get brake() {
      return keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0;
    },
    get steer() {
      return (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0) - (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0);
    },
    get sprint() {
      return keys.has('ShiftLeft') || keys.has('ShiftRight');
    },
    get handbrake() {
      return keys.has('Space');
    },
    get mouseDown() {
      return mouseDown;
    },
    // accumulated drag since last read, then cleared
    consumeMouseDelta() {
      const d = { x: mouseDX, y: mouseDY };
      mouseDX = 0;
      mouseDY = 0;
      return d;
    },
    consumeWheel() {
      const d = wheelDelta;
      wheelDelta = 0;
      return d;
    },
    // call once per frame, after the game read the edge triggers
    endFrame() {
      justPressed.clear();
    },
  };
}
