// Boot and the one loop: input is read every frame, the world advances in fixed 1/60 s
// steps, and the renderer paints what is there. Screens: briefing (over the live runway
// sky), play, paused, hangar (upgrades, feats and contracts over the live sky), contract
// complete and forced landing. Credits, owned upgrades and the unlocked contract persist in
// this browser only.
//
// ?seed=N fixes the flight. ?shot=cover|coast|storm|debrief (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { BEST_KEY, CONTRACT_KEY, CREDITS_KEY, OWNED_KEY, STEP } from './config.js';
import { CONTRACTS, FEATS, UPGRADES } from './data.js';
import { createRandom } from './random.js';
import { EVENT_CARGO, EVENT_COMPLETE, EVENT_FEAT, EVENT_HIT, EVENT_OVER, EVENT_RING, createWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_HANGAR, ACTION_PAUSE, createInput } from './input.js';
import { SCREEN_BRIEF, SCREEN_DONE, SCREEN_HANGAR, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, createRenderer } from './render.js';
import { stageShot } from './shots.js';
import { cargoSound, completeSound, ensureAudio, hitSound, ringSound, setEngine } from './audio.js';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const contractParam = Number.parseInt(params.get('contract') ?? '', 10);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);

function readInt(key, fallback) {
  try {
    const v = Number.parseInt(window.localStorage.getItem(key) ?? '', 10);
    return Number.isInteger(v) ? v : fallback;
  } catch { return fallback; }
}
function readSet(key) {
  try {
    const raw = window.localStorage.getItem(key);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch { return new Set(); }
}
function save(key, value) {
  try { window.localStorage.setItem(key, value); } catch { /* storage can be off */ }
}

function runShot(name) {
  const scene = stageShot(name, seed);
  const s = scene.world.state;
  // Freeze the post-hit blink for the photo: the plane is the hero of every frame, and a
  // screenshot caught mid-blink (alpha 0.45) reads as a muddy grey plane. Positions,
  // score, rings and hull are untouched — only the 1.6 s transient is settled.
  s.plane.invulnerable = 0;
  // Measurement hook for the capture harness: the staged scene's real numbers, so every
  // screenshot version carries its score/rings/cargo/time instead of a guess from pixels.
  window.__aurora = {
    shot: name, seed,
    rings: `${s.ringsPassed}/${s.ringsTotal}`,
    cargo: `${s.cargoGot}/${s.cargoTotal}`,
    score: s.score, combo: s.combo, elapsed: Math.round(s.elapsed),
    credits: s.credits, feats: s.feats.map((id) => FEATS[id - 1].name),
    screen: scene.screen, route: s.route.name, contract: s.contract.name,
  };
  let painted = 0;
  function paint() {
    renderer.draw(scene.world.state, scene.screen, scene.best, { steer: 0 });
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let best = readInt(BEST_KEY, 0);
  let credits = readInt(CREDITS_KEY, 0);
  let owned = readSet(OWNED_KEY);
  let contractIdx = Math.min(CONTRACTS.length, Math.max(1, readInt(CONTRACT_KEY, 1)));
  if (Number.isInteger(contractParam) && contractParam >= 1 && contractParam <= CONTRACTS.length) contractIdx = contractParam;
  let world = createWorld(createRandom(seed), { contract: contractIdx, owned: [...owned] });
  let screen = SCREEN_BRIEF;
  let steer = 0;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startContract(index) {
    contractIdx = index;
    world = createWorld(createRandom(Math.floor(Math.random() * 4294967296)), { contract: index, owned: [...owned] });
    screen = SCREEN_PLAY;
    accumulator = 0;
    announce(`Contract ${index}: ${CONTRACTS[index - 1].name}. Fly ${CONTRACTS[index - 1].rings} rings.`);
  }

  function bankScore() {
    if (world.state.score > best) {
      best = world.state.score;
      save(BEST_KEY, String(best));
    }
    credits += world.state.credits;
    save(CREDITS_KEY, String(credits));
  }

  function buyUpgrade(id) {
    const u = UPGRADES[id - 1];
    if (!u || owned.has(id)) return;
    if (credits < u.cost) {
      announce(`${u.name} costs ${u.cost} credits; you hold ${credits}.`);
      return;
    }
    credits -= u.cost;
    owned.add(id);
    save(CREDITS_KEY, String(credits));
    save(OWNED_KEY, JSON.stringify([...owned]));
    announce(`${u.name} installed. ${u.effect}.`);
    // Rebuild the current contract with the new loadout (progress on this run restarts).
    world = createWorld(createRandom(Math.floor(Math.random() * 4294967296)), { contract: contractIdx, owned: [...owned] });
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_HANGAR && (screen === SCREEN_PLAY || screen === SCREEN_PAUSED || screen === SCREEN_HANGAR)) {
      screen = screen === SCREEN_HANGAR ? SCREEN_PLAY : SCREEN_HANGAR;
      announce(screen === SCREEN_HANGAR ? 'Hangar.' : 'Playing.');
      return;
    }
    if (actions & ACTION_CONFIRM) {
      ensureAudio();
      if (screen === SCREEN_BRIEF || screen === SCREEN_OVER) {
        screen = SCREEN_PLAY;
        if (screen === SCREEN_PLAY && world.state.over) startContract(contractIdx);
        announce('Playing.');
      } else if (screen === SCREEN_DONE) {
        bankScore();
        const next = Math.min(CONTRACTS.length, contractIdx + 1);
        if (next > contractIdx) save(CONTRACT_KEY, String(next));
        startContract(next);
      }
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & ACTION_PAUSE && screen === SCREEN_PAUSED) {
      screen = SCREEN_PLAY;
      announce('Playing.');
    }
  }

  // Hangar number keys are read here (input.js only queues confirm/pause/hangar).
  window.addEventListener('keydown', (event) => {
    window.__lastKey = event.code;
    if (screen === SCREEN_HANGAR && !event.repeat) {
      const buy = { Digit1: 1, Digit2: 2, Digit3: 3, Digit4: 4, Digit5: 5, Digit6: 6, Digit7: 7, Digit8: 8, Digit9: 9, Digit0: 10, Minus: 11, Equal: 12 };
      if (buy[event.code] !== undefined) buyUpgrade(buy[event.code]);
    }
  });

  function step() {
    if (screen !== SCREEN_PLAY) return;
    const c = input.controls();
    steer = c.steer;
    const events = world.step(STEP, c, false);
    setEngine(world.state.plane.throttle, world.state.plane.speed);
    if (events & EVENT_RING) ringSound(world.state.combo);
    else if (events & EVENT_CARGO) cargoSound();
    else if (events & EVENT_HIT) {
      hitSound();
      announce(`Hit. Hull ${world.state.plane.hull} left.`);
    }
    if (events & EVENT_COMPLETE) {
      bankScore();
      completeSound();
      screen = SCREEN_DONE;
      announce(`Contract complete. Score ${world.state.score}.`);
    } else if (events & EVENT_OVER) {
      bankScore();
      screen = SCREEN_OVER;
      announce(`Forced landing. ${world.state.overReason}`);
    } else if (events & EVENT_FEAT) {
      announce(`Feat unlocked: ${world.state.feats.map((id) => id).join(', ')}.`);
    }
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    while (accumulator >= STEP && screen === SCREEN_PLAY) {
      step();
      accumulator -= STEP;
    }
    if (screen !== SCREEN_PLAY) accumulator = 0;
    renderer.draw(world.state, screen, best, { steer, owned, credits });
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  announce('Aurora Courier. Press Space or click to take off.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
