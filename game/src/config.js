// Tuning and palette for AURORA COURIER. One logical field, 1280x720, scaled to the
// window; the world steps at a fixed 1/60 s so a screenshot seed always replays the same frame.
export const FIELD = { width: 1280, height: 720 };
export const STEP = 1 / 60;
export const FONT = 'system-ui, "Segoe UI", sans-serif';
export const BEST_KEY = 'aurora-courier-best';
export const CREDITS_KEY = 'aurora-courier-credits';
export const OWNED_KEY = 'aurora-courier-upgrades';
export const CONTRACT_KEY = 'aurora-courier-contract';

// The plane flies a corridor: lateral position in [-1, 1] across the sky, altitude in feet,
// speed in knots. Rings, cargo and hazards live in the same corridor and approach in z.
export const PLANE = {
  lateralSpeed: 1.35, // corridor units per second at full steer
  climbRate: 260, // ft per second at full climb
  baseSpeed: 148, // knots at cruise throttle
  minSpeed: 96,
  maxSpeed: 212,
  throttleStep: 26, // knots per second of throttle input
  fuelDrain: 0.55, // fuel units per second at cruise (100 = full tank)
  fuelDrainFast: 0.85, // at full throttle
  hull: 3,
  invulnerable: 1.6, // seconds after a hit
};

export const RING = {
  score: 100,
  nearMiss: 25,
  fuelBonus: 18, // fuel units a green fuel ring restores
  passRadius: 0.16, // corridor units: centred enough to count as flown-through
  nearRadius: 0.3,
};

export const CARGO = { score: 60, credits: 12 };
export const COMBO = { step: 4, cap: 8 }; // every 4 rings in a row raises the multiplier, to x8
export const CONTRACT = { rings: 12, cargo: 5, parSeconds: 150 };

export const PALETTE = {
  backdrop: '#1a1030',
  skyTop: '#241a4d',
  skyMid: '#7a3b6e',
  skyBand: '#e2603f',
  skyLow: '#ffb347',
  sunCore: '#fff3c4',
  sunGlow: '#ff9e57',
  seaDeep: '#173a5e',
  seaGlitter: '#ffd98a',
  ridgeFar: '#5a3a6e',
  ridgeMid: '#3d2a55',
  ridgeNear: '#2a1c40',
  cloud: '#ffd9c0',
  cloudShade: '#c98bb0',
  ringGold: '#ffd34d',
  ringGreen: '#7dff9e',
  ringGlow: '#fff2b0',
  hazard: '#3a2b4d',
  hazardBolt: '#ffe45e',
  balloon: '#ff5d73',
  planeBody: '#f4f1e6',
  planeAccent: '#e2603f',
  planeGlass: '#9fd8ef',
  planeDark: '#2b2b3a',
  hudBack: 'rgba(12, 8, 28, 0.72)',
  hudEdge: 'rgba(255, 211, 77, 0.55)',
  text: '#ffffff',
  muted: '#ffd9a0',
  good: '#7dff9e',
  bad: '#ff6b6b',
  panel: 'rgba(14, 10, 32, 0.88)',
};
