// The screenshot scenes behind ?shot=cover|coast|storm|debrief. Each one plays the real rules
// forward from a fresh world for a fixed time, steered by an autopilot that chases the nearest
// ring (a PD steer toward its lateral position and altitude), so the frame is what a real
// flight looks like and the same seed always gives the same frame. No scene is a menu: every
// shot is a live gameplay frame, the debrief one with its results panel over the live sky.
import { STEP } from './config.js';
import { EVENT_COMPLETE, EVENT_OVER, KIND_CARGO, KIND_FUEL_RING, KIND_RING, createWorld } from './world.js';
import { SCREEN_DONE, SCREEN_OVER, SCREEN_PLAY } from './render.js';
import { createRandom } from './random.js';

const SAMPLE = STEP;

// Two pilot styles: 'rings' chases the next ring and only takes cargo lying on its line;
// 'courier' goes out of its way for every pod in reach. Shots pick the style that shows
// their scene best: the cover and storm frames are ring runs, the debrief is a full courier run.
function autopilot(state, mode) {
  let ring = null;
  let cargo = null;
  for (const e of state.entities) {
    if ((e.kind === KIND_RING || e.kind === KIND_FUEL_RING) && e.dist > 0 && (ring === null || e.dist < ring.dist)) ring = e;
    if (e.kind === KIND_CARGO && e.dist > 0 && (cargo === null || e.dist < cargo.dist)) cargo = e;
  }
  let target = ring;
  if (mode === 'courier' && cargo !== null && cargo.dist < 650 && Math.abs(cargo.lat - state.plane.lat) < 0.55) target = cargo;
  else if (cargo !== null && ring !== null && cargo.dist < ring.dist + 120
    && Math.abs(cargo.lat - ring.lat) < 0.3 && Math.abs(cargo.alt - ring.alt) < 300) target = cargo;
  if (target === null) return { steer: 0, climb: (1800 - state.plane.alt) / 400, throttle: 0 };
  const steer = Math.max(-1, Math.min(1, (target.lat - state.plane.lat) * 2.4));
  const climb = Math.max(-1, Math.min(1, (target.alt - state.plane.alt) / 320));
  return { steer, climb, throttle: 0 };
}

function fly(world, seconds, mode) {
  const state = world.state;
  let events = 0;
  const steps = Math.round(seconds / SAMPLE);
  for (let i = 0; i < steps; i += 1) {
    events = world.step(SAMPLE, autopilot(state, mode ?? 'rings'), false);
    if (events & (EVENT_COMPLETE | EVENT_OVER)) break;
  }
  return events;
}

/**
 * Stage the named scene and return the screen to draw over it and the best score to show.
 * Worlds are built per shot so each scene is independent and deterministic.
 */
export function stageShot(name, seed) {
  const random = createRandom(seed);
  if (name === 'coast') {
    const world = createWorld(random, { contract: 2 });
    fly(world, 16, 'rings');
    return { world, screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'storm') {
    const world = createWorld(random, { contract: 10 });
    fly(world, 42, 'rings');
    const over = world.state.over;
    return { world, screen: over ? SCREEN_OVER : SCREEN_PLAY, best: 0 };
  }
  if (name === 'debrief') {
    const world = createWorld(random, { contract: 1 });
    const events = fly(world, 300, 'courier');
    const done = Boolean(events & EVENT_COMPLETE) || world.state.done;
    return { world, screen: done ? SCREEN_DONE : SCREEN_PLAY, best: world.state.score };
  }
  // cover: a mid-contract dawn run, rings banked, combo live, fuel ring ahead.
  const world = createWorld(random, { contract: 1 });
  fly(world, 27, 'rings');
  return { world, screen: SCREEN_PLAY, best: 0 };
}
