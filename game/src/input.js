// Keyboard and pointer input for a flight game. Held keys give steer (-1..1), climb (-1..1)
// and throttle (-1..1); one-shot presses (confirm, pause, hangar) are queued as bit flags
// and taken once by the loop, so a press between two frames is never lost or counted twice.
// Mouse: hold and drag steers toward the pointer and climbs toward it.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_HANGAR = 4;

const LEFT = new Set(['ArrowLeft', 'KeyA']);
const RIGHT = new Set(['ArrowRight', 'KeyD']);
const UP = new Set(['ArrowUp', 'KeyW']);
const DOWN = new Set(['ArrowDown', 'KeyS']);
const THROTTLE_UP = new Set(['KeyE']);
const THROTTLE_DOWN = new Set(['KeyQ']);
const CONFIRM = new Set(['Space', 'Enter']);
const PAUSE = new Set(['KeyP', 'Escape']);
const HANGAR = new Set(['KeyH']);

export function createInput(target) {
  const held = new Set();
  let actions = 0;
  let pointer = null; // {x, y} in canvas CSS pixels while the pointer is held

  window.addEventListener('keydown', (event) => {
    if (LEFT.has(event.code) || RIGHT.has(event.code) || UP.has(event.code) || DOWN.has(event.code)
      || THROTTLE_UP.has(event.code) || THROTTLE_DOWN.has(event.code)) {
      held.add(event.code);
    } else if (CONFIRM.has(event.code)) {
      if (!event.repeat) actions |= ACTION_CONFIRM;
    } else if (PAUSE.has(event.code)) {
      if (!event.repeat) actions |= ACTION_PAUSE;
    } else if (HANGAR.has(event.code)) {
      if (!event.repeat) actions |= ACTION_HANGAR;
    } else return;
    event.preventDefault();
  });
  window.addEventListener('keyup', (event) => held.delete(event.code));
  window.addEventListener('blur', () => { held.clear(); pointer = null; });
  target.addEventListener('pointerdown', (event) => {
    pointer = { x: event.clientX, y: event.clientY };
    actions |= ACTION_CONFIRM;
  });
  target.addEventListener('pointermove', (event) => {
    if (pointer) pointer = { x: event.clientX, y: event.clientY };
  });
  target.addEventListener('pointerup', () => { pointer = null; });

  const has = (set) => [...set].some((c) => held.has(c));

  return {
    /** Steer/climb/throttle in -1..1 from keys, or from the held pointer. */
    controls() {
      let steer = (has(RIGHT) ? 1 : 0) - (has(LEFT) ? 1 : 0);
      let climb = (has(UP) ? 1 : 0) - (has(DOWN) ? 1 : 0);
      const throttle = (has(THROTTLE_UP) ? 1 : 0) - (has(THROTTLE_DOWN) ? 1 : 0);
      if (pointer) {
        const rect = target.getBoundingClientRect();
        const nx = (pointer.x - rect.left) / rect.width - 0.5;
        const ny = (pointer.y - rect.top) / rect.height - 0.5;
        steer = Math.max(-1, Math.min(1, nx * 2.4));
        climb = Math.max(-1, Math.min(1, -ny * 2.4));
      }
      return { steer, climb, throttle };
    },
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
