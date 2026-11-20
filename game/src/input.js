// Keyboard and mouse input. Held keys are read every frame; one-shot presses (pause, mute,
// enter a car, melee, reload) are queued as bit flags and taken once, so a press between two
// frames is never lost and never counted twice.
export const ACTION_PAUSE = 1;
export const ACTION_MUTE = 2;
export const ACTION_ENTER = 4;
export const ACTION_MELEE = 8;
export const ACTION_RELOAD = 16;
export const ACTION_CONFIRM = 32;

const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['Escape', 'KeyP']);

export function createInput(canvas) {
  const keys = new Set();
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;

  function codeOf(event) {
    return event.code;
  }

  window.addEventListener('keydown', (event) => {
    const code = codeOf(event);
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(code)) event.preventDefault();
    if (event.repeat) return;
    keys.add(code);
    if (CONFIRM.has(code)) actions |= ACTION_CONFIRM;
    else if (PAUSE.has(code)) actions |= ACTION_PAUSE;
    else if (code === 'KeyM') actions |= ACTION_MUTE;
    else if (code === 'KeyE') actions |= ACTION_ENTER;
    else if (code === 'KeyF') actions |= ACTION_MELEE;
    else if (code === 'KeyR') actions |= ACTION_RELOAD;
  });
  window.addEventListener('keyup', (event) => {
    keys.delete(codeOf(event));
  });
  window.addEventListener('blur', () => {
    keys.clear();
    mouseDown = false;
  });

  canvas.addEventListener('pointermove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('pointerdown', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
    mouseDown = true;
    mouseClicked = true;
    actions |= ACTION_CONFIRM;
  });
  window.addEventListener('pointerup', () => {
    mouseDown = false;
  });

  return {
    down(code) { return keys.has(code); },
    axis() {
      // -1 left / +1 right, -1 up / +1 down, from WASD or arrows.
      const x = (keys.has('KeyD') || keys.has('ArrowRight') ? 1 : 0) - (keys.has('KeyA') || keys.has('ArrowLeft') ? 1 : 0);
      const y = (keys.has('KeyS') || keys.has('ArrowDown') ? 1 : 0) - (keys.has('KeyW') || keys.has('ArrowUp') ? 1 : 0);
      return { x, y };
    },
    run() { return keys.has('ShiftLeft') || keys.has('ShiftRight'); },
    handbrake() { return keys.has('Space'); },
    mouse() { return { x: mouseX, y: mouseY, down: mouseDown }; },
    takeClick() {
      const clicked = mouseClicked;
      mouseClicked = false;
      return clicked;
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
