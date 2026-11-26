// The game's rules and state, with no drawing and no browser in it: the plane, the ring
// corridor, cargo, storm cells, fuel, score, combo, contracts and feats. step() advances one
// fixed step and returns what happened as bit flags. Everything random comes from the seeded
// RNG, so ?seed=N replays the same flight and the same screenshot.
import { CARGO, COMBO, CONTRACT, FIELD, PLANE, RING, STEP } from './config.js';
import { CONTRACTS, FEATS, ROUTES, UPGRADES, weatherOf } from './data.js';

export const KIND_RING = 0;
export const KIND_FUEL_RING = 1;
export const KIND_CARGO = 2;
export const KIND_STORM = 3;
export const KIND_BALLOON = 4;

export const EVENT_RING = 1;
export const EVENT_NEAR = 2;
export const EVENT_CARGO = 4;
export const EVENT_HIT = 8;
export const EVENT_COMPLETE = 16;
export const EVENT_OVER = 32;
export const EVENT_FEAT = 64;

const SPAWN_DIST = 950; // metres ahead when an object appears
const RING_GAP = 2.8; // seconds of flight between rings (was 2.1: five-plus rings in flight
// at once tangled at the vanishing point; 2.8 keeps ~4 in flight and the corridor readable,
// contracts still finish far inside par: 18 rings x 2.8 s = 50 s spawn span vs par 185-200 s)
const HORIZON_Y = 300; // screen line the renderer uses for the horizon

/** Project an object at (lat, altFt, distM) into screen space from the plane's position. */
export function project(lat, altFt, distM, planeLat, planeAlt) {
  const p = 260 / (distM + 260); // 1 at the plane, ~0 far away
  const x = FIELD.width / 2 + (lat - planeLat * 0.35) * 560 * p;
  const y = HORIZON_Y - (altFt - planeAlt) * 0.085 * p - 30 * p;
  return { x, y, p, r: 24 + 150 * p };
}

function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function createWorld(random, options = {}) {
  const contract = CONTRACTS[(options.contract ?? 1) - 1] ?? CONTRACTS[0];
  const route = ROUTES[contract.route - 1];
  const weather = weatherOf(route);
  const owned = new Set(options.owned ?? []);
  const speedBonus = owned.has(1) ? 18 : 0;
  const fuelCap = owned.has(2) ? 125 : 100;
  const turnBonus = owned.has(3) ? 1.2 : 1;
  const ringWide = owned.has(4) ? 1.2 : 1;
  const hullBonus = owned.has(6) ? 1 : 0;
  const fuelSaver = owned.has(9) ? 0.8 : 1;

  const state = {
    contract, route, weather,
    plane: { lat: 0, alt: 1800, speed: PLANE.baseSpeed, throttle: 0.62, fuel: fuelCap, hull: PLANE.hull + hullBonus, invulnerable: 0, climb: 0 },
    score: 0, credits: 0, combo: 1, streak: 0, comboTimer: 0,
    ringsPassed: 0, ringsTotal: contract.rings, cargoGot: 0, cargoTotal: contract.cargo,
    elapsed: 0, distanceKm: 0, topSpeed: 0, noHit: true, feats: [],
    ringTimer: 1.2, cargoTimer: 4, hazardTimer: 6, gust: 0, gustTimer: 3,
    entities: [], clouds: [], birds: [], done: false, over: false, overReason: '',
    fuelEmptyTimer: 0, speedHighTimer: 0,
  };
  // Fixed sky dressing, drawn from the seed: clouds and birds drift with elapsed, never random per frame.
  for (let i = 0; i < 14; i += 1) {
    state.clouds.push({ x: random(), y: 0.06 + random() * 0.3, s: 0.5 + random() * 1.1, v: 0.004 + random() * 0.008 });
  }
  for (let i = 0; i < 7; i += 1) {
    state.birds.push({ x: random(), y: 0.34 + random() * 0.2, s: 0.6 + random() * 0.7, v: 0.01 + random() * 0.02, ph: random() * 6.28 });
  }

  function reset() {
    state.plane.lat = 0;
    state.plane.alt = 1800;
    state.plane.speed = PLANE.baseSpeed;
    state.plane.throttle = 0.62;
    state.plane.fuel = fuelCap;
    state.plane.hull = PLANE.hull + hullBonus;
    state.plane.invulnerable = 0;
    state.score = 0; state.credits = 0; state.combo = 1; state.streak = 0; state.comboTimer = 0;
    state.ringsPassed = 0; state.cargoGot = 0; state.elapsed = 0; state.distanceKm = 0;
    state.topSpeed = 0; state.noHit = true; state.feats = [];
    state.ringTimer = 1.2; state.cargoTimer = 4; state.hazardTimer = 6; state.gust = 0; state.gustTimer = 3;
    state.entities = []; state.done = false; state.over = false; state.overReason = '';
    state.fuelEmptyTimer = 0; state.speedHighTimer = 0;
  }

  function spawnRing() {
    const n = state.ringsPassed + state.entities.filter((e) => e.kind === KIND_RING || e.kind === KIND_FUEL_RING).length + 1;
    const fuel = n % 4 === 0;
    state.entities.push({
      kind: fuel ? KIND_FUEL_RING : KIND_RING,
      lat: (random() * 2 - 1) * 0.72,
      alt: 1400 + random() * 1400,
      dist: SPAWN_DIST,
      spin: random() * 6.28,
    });
  }

  function spawnCargo() {
    // Cargo pods mark the route: each one hangs near the most recently spawned ring, so a
    // pilot flying the rings flies through the cargo too.
    let near = null;
    for (const e of state.entities) {
      if ((e.kind === KIND_RING || e.kind === KIND_FUEL_RING) && (near === null || e.dist > near.dist)) near = e;
    }
    const lat = near === null ? (random() * 2 - 1) * 0.8 : Math.max(-0.95, Math.min(0.95, near.lat + (random() - 0.5) * 0.3));
    const alt = near === null ? 1300 + random() * 1600 : Math.max(900, Math.min(4100, near.alt + (random() - 0.5) * 300));
    state.entities.push({ kind: KIND_CARGO, lat, alt, dist: SPAWN_DIST, spin: random() * 6.28 });
  }

  function spawnHazard() {
    const storm = weather.gusts >= 3 || random() < 0.6;
    state.entities.push({
      kind: storm ? KIND_STORM : KIND_BALLOON,
      lat: (random() * 2 - 1) * 0.85,
      alt: 1200 + random() * 1800,
      dist: SPAWN_DIST,
      spin: random() * 6.28,
      size: 0.8 + random() * 0.5,
    });
  }

  function unlockFeat(id) {
    if (state.feats.includes(id)) return false;
    state.feats.push(id);
    return true;
  }

  function step(dt, input, harmless) {
    let events = 0;
    if (state.done || state.over) return events;
    const plane = state.plane;
    state.elapsed += dt;

    // Wind gusts push the plane sideways; stronger weather gusts harder.
    state.gustTimer -= dt;
    if (state.gustTimer <= 0) {
      state.gust = (random() * 2 - 1) * 0.35 * weather.gusts;
      state.gustTimer = 2 + random() * 3;
    }
    plane.lat = clamp(plane.lat + (input.steer * PLANE.lateralSpeed * turnBonus + state.gust * 0.25) * dt, -1, 1);
    plane.climb = input.climb * PLANE.climbRate;
    plane.alt = clamp(plane.alt + plane.climb * dt, 800, 4200);
    plane.throttle = clamp(plane.throttle + input.throttle * 0.55 * dt, 0.25, 1);
    const targetSpeed = PLANE.minSpeed + (PLANE.maxSpeed + speedBonus - PLANE.minSpeed) * plane.throttle;
    plane.speed += (targetSpeed - plane.speed) * Math.min(1, dt * 0.9);
    if (plane.speed > state.topSpeed) state.topSpeed = plane.speed;
    if (plane.speed > 200) {
      state.speedHighTimer += dt;
      if (state.speedHighTimer > 10 && unlockFeat(7)) events |= EVENT_FEAT;
    } else state.speedHighTimer = 0;

    // Fuel: cruise drain, faster at full throttle; empty tank means a glide, then a forced landing.
    const drain = (plane.throttle > 0.85 ? PLANE.fuelDrainFast : PLANE.fuelDrain) * fuelSaver;
    plane.fuel = Math.max(0, plane.fuel - drain * dt);
    if (plane.fuel <= 0) {
      state.fuelEmptyTimer += dt;
      plane.speed = Math.max(70, plane.speed - 14 * dt);
      if (state.fuelEmptyTimer > 6) {
        state.over = true; state.overReason = 'Out of fuel over the strait.';
        return events | EVENT_OVER;
      }
    }
    if (plane.invulnerable > 0) plane.invulnerable = Math.max(0, plane.invulnerable - dt);
    if (state.comboTimer > 0) {
      state.comboTimer -= dt;
      if (state.comboTimer <= 0) { state.streak = 0; state.combo = 1; }
    }
    state.distanceKm += (plane.speed * 0.514444 * dt) / 1000;

    // Spawning: rings on a clock until the contract's count is out, cargo between them,
    // hazards more often in rough weather.
    state.ringTimer -= dt;
    const ringsOut = state.ringsPassed + state.entities.filter((e) => e.kind === KIND_RING || e.kind === KIND_FUEL_RING).length;
    if (state.ringTimer <= 0 && ringsOut < state.ringsTotal) {
      spawnRing();
      state.ringTimer += RING_GAP;
    }
    state.cargoTimer -= dt;
    if (state.cargoTimer <= 0 && state.cargoGot + state.entities.filter((e) => e.kind === KIND_CARGO).length < state.cargoTotal) {
      spawnCargo();
      state.cargoTimer += 5 + random() * 3;
    }
    state.hazardTimer -= dt;
    if (state.hazardTimer <= 0) {
      spawnHazard();
      state.hazardTimer += Math.max(3.5, 9 - weather.gusts * 1.6) + random() * 3;
    }

    const speedMs = plane.speed * 0.514444;
    for (let i = state.entities.length - 1; i >= 0; i -= 1) {
      const e = state.entities[i];
      e.dist -= speedMs * dt;
      e.spin += dt;
      if (e.dist < -60) {
        // It slipped past the plane.
        if ((e.kind === KIND_RING || e.kind === KIND_FUEL_RING) && !harmless) {
          state.streak = 0; state.combo = 1; // a missed ring breaks the combo
        }
        state.entities.splice(i, 1);
        continue;
      }
      if (e.dist > 26 || harmless) continue;
      const dlat = Math.abs(e.lat - plane.lat);
      const dalt = Math.abs(e.alt - plane.alt);
      if (e.kind === KIND_RING || e.kind === KIND_FUEL_RING) {
        if (dlat < 0.16 * ringWide && dalt < 130) {
          state.ringsPassed += 1;
          state.streak += 1;
          state.combo = Math.min(COMBO.cap, 1 + Math.floor(state.streak / COMBO.step));
          state.comboTimer = 6;
          const pts = RING.score * state.combo;
          state.score += pts;
          state.credits += 8 * state.combo;
          if (e.kind === KIND_FUEL_RING) plane.fuel = Math.min(fuelCap, plane.fuel + RING.fuelBonus);
          if (state.streak === 1 && unlockFeat(1)) events |= EVENT_FEAT;
          if (state.streak >= 12 && unlockFeat(2)) events |= EVENT_FEAT;
          if (state.combo >= 8 && unlockFeat(6)) events |= EVENT_FEAT;
          events |= EVENT_RING;
          state.entities.splice(i, 1);
          if (state.ringsPassed >= state.ringsTotal) {
            state.done = true;
            state.credits += contract.pay;
            if (state.cargoGot >= state.cargoTotal && unlockFeat(3)) events |= EVENT_FEAT;
            if (plane.fuel > fuelCap / 2 && unlockFeat(5)) events |= EVENT_FEAT;
            if (state.noHit && unlockFeat(8)) events |= EVENT_FEAT;
            return events | EVENT_COMPLETE;
          }
        } else if (dlat < 0.3 * ringWide && dalt < 260) {
          state.score += RING.nearMiss;
          events |= EVENT_NEAR;
          state.entities.splice(i, 1);
        }
      } else if (e.kind === KIND_CARGO) {
        if (dlat < 0.28 && dalt < 200) {
          state.cargoGot += 1;
          state.score += CARGO.score;
          state.credits += CARGO.credits;
          events |= EVENT_CARGO;
          state.entities.splice(i, 1);
        }
      } else if (plane.invulnerable === 0) {
        if (dlat < 0.22 * e.size && dalt < 170 * e.size) {
          plane.hull -= 1;
          plane.invulnerable = PLANE.invulnerable;
          state.noHit = false;
          state.streak = 0; state.combo = 1;
          events |= EVENT_HIT;
          state.entities.splice(i, 1);
          if (plane.hull <= 0) {
            state.over = true; state.overReason = 'Hull lost in the storm.';
            return events | EVENT_OVER;
          }
        }
      }
    }
    return events;
  }

  reset();
  return { state, reset, step, contract, route, weather, owned, fuelCap };
}
