// Drawing only: the world's state and the current screen in, pixels out. The 1280x720
// playfield is scaled to fit the window and centred. Every frame is a gameplay frame: the
// sky, the sea, the ridges, the rings, the plane and the full instrument HUD are always on
// screen, and panels sit over the live scene instead of replacing it.
import { FIELD, FONT, PALETTE } from './config.js';
import { KIND_BALLOON, KIND_CARGO, KIND_FUEL_RING, KIND_RING, KIND_STORM, project } from './world.js';
import { CONTRACTS, FEATS, ROUTES, UPGRADES } from './data.js';

export const SCREEN_BRIEF = 'brief';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_DONE = 'done';
export const SCREEN_HANGAR = 'hangar';

const HORIZON_Y = 300;

// Fixed ridge silhouettes: same dawn coast every load, parallaxed by the plane's position.
function ridgePoints(seed, base, amp, step) {
  let s = seed;
  const next = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  const pts = [];
  for (let x = -100; x <= FIELD.width + 100; x += step) pts.push({ x, y: base + (next() - 0.5) * amp + Math.sin(x / 260 + seed) * amp * 0.35 });
  return pts;
}
const RIDGE_FAR = ridgePoints(11, 268, 34, 46);
const RIDGE_MID = ridgePoints(47, 288, 52, 38);
const RIDGE_NEAR = ridgePoints(83, 306, 40, 30);

function fmt(n) {
  return n.toLocaleString('en-US');
}
function mmss(t) {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const view = { scale: 1, x: 0, y: 0 };
  const fonts = new Map();

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(window.innerWidth * ratio);
    const height = Math.round(window.innerHeight * ratio);
    canvas.width = width;
    canvas.height = height;
    view.scale = Math.min(width / FIELD.width, height / FIELD.height);
    view.x = (width - FIELD.width * view.scale) / 2;
    view.y = (height - FIELD.height * view.scale) / 2;
  }

  function text(value, x, y, size, color, align, weight) {
    const key = `${size}:${weight ?? ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ?? 400} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    context.fillStyle = color;
    context.textAlign = align ?? 'left';
    context.textBaseline = 'alphabetic';
    context.fillText(value, x, y);
  }

  // A dark pill behind a label, so gold-on-gold (label on its own ring stroke) and
  // pink-on-ridge (STORM on the ridge line) can never eat the text again. The pill is
  // drawn in the label pass, over every shape, and the text is drawn over the pill.
  function chip(value, x, y, size, color, weight) {
    const key = `${size}:${weight ?? ''}`;
    if (!fonts.has(key)) fonts.set(key, `${weight ?? 400} ${size}px ${FONT}`);
    context.font = fonts.get(key);
    const w = context.measureText(value).width;
    const padX = 9;
    const top = y - size * 0.8;
    const h = size * 1.06;
    context.fillStyle = PALETTE.hudBack;
    context.beginPath();
    context.roundRect(x - w / 2 - padX, top, w + padX * 2, h, 8);
    context.fill();
    context.strokeStyle = 'rgba(255, 211, 77, 0.35)';
    context.lineWidth = 1;
    context.stroke();
    text(value, x, y, size, color, 'center', weight);
  }

  function panel(x, y, w, h, edge) {
    context.fillStyle = PALETTE.hudBack;
    context.beginPath();
    context.roundRect(x, y, w, h, 10);
    context.fill();
    context.strokeStyle = edge ?? PALETTE.hudEdge;
    context.lineWidth = 1.5;
    context.stroke();
  }

  function drawSky(state) {
    const g = context.createLinearGradient(0, 0, 0, HORIZON_Y + 40);
    g.addColorStop(0, PALETTE.skyTop);
    g.addColorStop(0.45, PALETTE.skyMid);
    g.addColorStop(0.78, PALETTE.skyBand);
    g.addColorStop(1, PALETTE.skyLow);
    context.fillStyle = g;
    context.fillRect(0, 0, FIELD.width, HORIZON_Y + 40);
    // Low dawn sun, left of centre, with a warm glow.
    const sx = 430 - state.plane.lat * 30;
    const sy = 252;
    const glow = context.createRadialGradient(sx, sy, 8, sx, sy, 190);
    glow.addColorStop(0, 'rgba(255, 243, 196, 0.95)');
    glow.addColorStop(0.25, 'rgba(255, 158, 87, 0.55)');
    glow.addColorStop(1, 'rgba(255, 158, 87, 0)');
    context.fillStyle = glow;
    context.fillRect(sx - 200, sy - 200, 400, 400);
    context.fillStyle = PALETTE.sunCore;
    context.beginPath();
    context.arc(sx, sy, 34, 0, Math.PI * 2);
    context.fill();
    // Sun glitter path on the sea.
    context.fillStyle = PALETTE.seaGlitter;
    for (let i = 0; i < 26; i += 1) {
      const yy = HORIZON_Y + 44 + i * 13;
      const wob = Math.sin(state.elapsed * 1.4 + i * 1.7) * 26;
      const w = 120 - i * 3.4;
      context.globalAlpha = 0.5 - i * 0.016;
      context.fillRect(sx - w / 2 + wob, yy, w, 2.5);
    }
    context.globalAlpha = 1;
  }

  function drawRidge(points, color, shift) {
    context.fillStyle = color;
    context.beginPath();
    context.moveTo(-100, HORIZON_Y + 44);
    for (const p of points) context.lineTo(p.x + shift, p.y);
    context.lineTo(FIELD.width + 100, HORIZON_Y + 44);
    context.closePath();
    context.fill();
    // Low-poly facets: alternating light/shade triangles down to the sea line.
    for (let i = 0; i + 2 < points.length; i += 2) {
      const a = points[i];
      const b = points[i + 1];
      const c = points[i + 2];
      context.fillStyle = i % 4 === 0 ? 'rgba(255, 220, 180, 0.10)' : 'rgba(0, 0, 0, 0.12)';
      context.beginPath();
      context.moveTo(a.x + shift, a.y);
      context.lineTo(b.x + shift, b.y);
      context.lineTo((a.x + c.x) / 2 + shift, HORIZON_Y + 44);
      context.closePath();
      context.fill();
    }
  }

  function drawSea(state) {
    const g = context.createLinearGradient(0, HORIZON_Y + 40, 0, FIELD.height);
    g.addColorStop(0, '#c96a4a');
    g.addColorStop(0.18, PALETTE.seaDeep);
    g.addColorStop(1, '#0d2138');
    context.fillStyle = g;
    context.fillRect(0, HORIZON_Y + 40, FIELD.width, FIELD.height - HORIZON_Y - 40);
    // Islands with a lighthouse and a runway strip on the nearest one.
    context.fillStyle = PALETTE.ridgeNear;
    context.beginPath();
    context.ellipse(330, 668, 150, 26, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#f4f1e6';
    context.fillRect(300, 622, 6, 34);
    context.fillStyle = PALETTE.ringGold;
    context.beginPath();
    context.arc(303, 618, 7 + Math.sin(state.elapsed * 3) * 1.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.ridgeMid;
    context.beginPath();
    context.ellipse(930, 640, 130, 16, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#8a7a5a';
    context.fillRect(868, 628, 130, 6);
    context.fillStyle = '#f4f1e6';
    for (let i = 0; i < 4; i += 1) context.fillRect(880 + i * 30, 630, 13, 2.5);
    // Faint wave strokes and two small boats with wakes, so the lower sea is not empty.
    context.strokeStyle = 'rgba(255,255,255,0.10)';
    context.lineWidth = 2;
    for (let i = 0; i < 9; i += 1) {
      const yy = 400 + i * 34;
      const off = Math.sin(state.elapsed * 0.7 + i * 2.1) * 18;
      context.beginPath();
      context.moveTo(60 + off, yy);
      context.quadraticCurveTo(320 + off, yy - 6, 560 + off, yy);
      context.moveTo(760 - off, yy + 12);
      context.quadraticCurveTo(1000 - off, yy + 6, 1220 - off, yy + 12);
      context.stroke();
    }
    for (const [bx, by, bs] of [[420, 470, 1], [880, 560, 1.35]]) {
      context.fillStyle = 'rgba(244,241,230,0.9)';
      context.fillRect(bx, by, 26 * bs, 7 * bs);
      context.fillStyle = PALETTE.planeAccent;
      context.fillRect(bx + 8 * bs, by - 9 * bs, 4 * bs, 9 * bs);
      context.strokeStyle = 'rgba(255,255,255,0.35)';
      context.beginPath();
      context.moveTo(bx - 8 * bs, by + 10 * bs);
      context.lineTo(bx - 44 * bs, by + 18 * bs);
      context.moveTo(bx + 34 * bs, by + 10 * bs);
      context.lineTo(bx + 70 * bs, by + 18 * bs);
      context.stroke();
    }
  }

  function drawClouds(state) {
    for (const c of state.clouds) {
      const x = (((c.x + state.elapsed * c.v) % 1.2) - 0.1) * FIELD.width;
      const y = c.y * FIELD.height;
      const s = c.s;
      context.fillStyle = 'rgba(255, 217, 192, 0.85)';
      context.beginPath();
      context.ellipse(x, y, 64 * s, 15 * s, 0, 0, Math.PI * 2);
      context.ellipse(x - 38 * s, y + 5 * s, 40 * s, 11 * s, 0, 0, Math.PI * 2);
      context.ellipse(x + 42 * s, y + 6 * s, 44 * s, 12 * s, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(201, 139, 176, 0.5)';
      context.beginPath();
      context.ellipse(x, y + 9 * s, 58 * s, 9 * s, 0, 0, Math.PI * 2);
      context.fill();
    }
    // Birds: small distant Vs drifting across the dawn.
    context.strokeStyle = 'rgba(43, 43, 58, 0.8)';
    context.lineWidth = 2;
    for (const b of state.birds) {
      const x = (((b.x + state.elapsed * b.v) % 1.2) - 0.1) * FIELD.width;
      const y = b.y * FIELD.height + Math.sin(state.elapsed * 2 + b.ph) * 6;
      const w = 9 * b.s;
      context.beginPath();
      context.moveTo(x - w, y);
      context.lineTo(x, y - 5 * b.s);
      context.lineTo(x + w, y);
      context.stroke();
    }
  }

  function drawRing(e, state, isNearest) {
    const pr = project(e.lat, e.alt, e.dist, state.plane.lat, state.plane.alt);
    if (pr.p < 0.05) return;
    const gold = e.kind === KIND_FUEL_RING;
    const col = gold ? PALETTE.ringGreen : PALETTE.ringGold;
    const r = Math.max(10, pr.r);
    context.save();
    context.globalAlpha = Math.min(1, pr.p * 1.15 + 0.1);
    context.strokeStyle = col;
    context.lineWidth = Math.max(3, 9 * pr.p + 2);
    context.shadowColor = col;
    context.shadowBlur = 18 * pr.p + 4;
    context.beginPath();
    context.arc(pr.x, pr.y, r, 0, Math.PI * 2);
    context.stroke();
    context.shadowBlur = 0;
    // Far rings stay plain gold circles: the white inner ring and chevrons only
    // render near, so the centre of the frame stops being a tangle of circles.
    if (pr.p > 0.3) {
      context.lineWidth = Math.max(1.5, 3 * pr.p + 1);
      context.strokeStyle = 'rgba(255,255,255,0.85)';
      context.beginPath();
      context.arc(pr.x, pr.y, r * 0.72, 0, Math.PI * 2);
      context.stroke();
      // Chevron ticks around the ring, spinning slowly.
      context.fillStyle = col;
      for (let k = 0; k < 8; k += 1) {
        const a = e.spin * 0.4 + (k * Math.PI) / 4;
        context.beginPath();
        context.arc(pr.x + Math.cos(a) * r * 0.86, pr.y + Math.sin(a) * r * 0.86, Math.max(2, 4.5 * pr.p), 0, Math.PI * 2);
        context.fill();
      }
    }
    context.restore();
  }

  // Labels ride in a second pass, over every shape, so a nearer ring never paints over text.
  // The tag sits above the ring when there is room; when the ring crowds the top HUD band
  // (label line above y=140) the tag flips BELOW the ring instead, clear of the ring stroke
  // and the frame edge. Every tag rides a dark chip, so the text reads on any background.
  function drawRingLabel(e, state, isNearest) {
    const pr = project(e.lat, e.alt, e.dist, state.plane.lat, state.plane.alt);
    if (!isNearest || pr.p < 0.1) return;
    const gold = e.kind === KIND_FUEL_RING;
    const col = gold ? PALETTE.ringGreen : PALETTE.ringGold;
    const r = Math.max(10, pr.r);
    const size = Math.max(13, 20 * pr.p + 6);
    const label = gold ? 'FUEL RING' : 'RING';
    const above = pr.y - r - 12;
    if (above >= 140) {
      chip(label, pr.x, Math.max(122, above), size, col, 700);
      text(`${Math.round(e.dist)} m`, pr.x, Math.min(600, pr.y + r + 24), Math.max(12, 17 * pr.p + 5), '#ffffff', 'center', 600);
    } else {
      chip(label, pr.x, pr.y + r + 24, size, col, 700);
      text(`${Math.round(e.dist)} m`, pr.x, Math.min(610, pr.y + r + 50), Math.max(12, 17 * pr.p + 5), '#ffffff', 'center', 600);
    }
  }

  function drawCargo(e, state, nearX) {
    const pr = project(e.lat, e.alt, e.dist, state.plane.lat, state.plane.alt);
    if (pr.p < 0.05) return;
    const s = Math.max(6, 34 * pr.p + 4);
    context.save();
    context.globalAlpha = Math.min(1, pr.p * 1.4 + 0.3);
    context.fillStyle = '#ff8a5c';
    context.beginPath();
    context.arc(pr.x, pr.y - s * 1.1, s * 0.9, Math.PI, 0);
    context.closePath();
    context.fill();
    context.strokeStyle = 'rgba(255,255,255,0.7)';
    context.lineWidth = 1.5;
    context.beginPath();
    context.moveTo(pr.x - s * 0.8, pr.y - s * 1.1);
    context.lineTo(pr.x - s * 0.4, pr.y - s * 0.2);
    context.moveTo(pr.x + s * 0.8, pr.y - s * 1.1);
    context.lineTo(pr.x + s * 0.4, pr.y - s * 0.2);
    context.stroke();
    context.fillStyle = '#c98a3a';
    context.fillRect(pr.x - s * 0.5, pr.y - s * 0.25, s, s);
    context.strokeStyle = '#7a4d16';
    context.lineWidth = 2;
    context.strokeRect(pr.x - s * 0.5, pr.y - s * 0.25, s, s);
    context.beginPath();
    context.moveTo(pr.x - s * 0.5, pr.y - s * 0.25);
    context.lineTo(pr.x + s * 0.5, pr.y + s * 0.75);
    context.moveTo(pr.x + s * 0.5, pr.y - s * 0.25);
    context.lineTo(pr.x - s * 0.5, pr.y + s * 0.75);
    context.stroke();
    context.restore();
  }

  function drawCargoLabel(e, state, nearX) {
    const pr = project(e.lat, e.alt, e.dist, state.plane.lat, state.plane.alt);
    if (pr.p < 0.05) return;
    const s = Math.max(6, 34 * pr.p + 4);
    if (nearX === null || Math.abs(pr.x - nearX) > 130) chip('CARGO', pr.x, pr.y + s * 1.35, Math.max(11, 15 * pr.p + 4), '#ffd9a0', 700);
  }

  function drawHazard(e, state, nearX) {
    const pr = project(e.lat, e.alt, e.dist, state.plane.lat, state.plane.alt);
    if (pr.p < 0.05) return;
    const s = Math.max(10, 46 * pr.p + 6) * (e.size ?? 1);
    context.save();
    context.globalAlpha = Math.min(1, pr.p * 1.4 + 0.3);
    if (e.kind === KIND_STORM) {
      context.fillStyle = PALETTE.hazard;
      context.beginPath();
      context.arc(pr.x, pr.y, s, 0, Math.PI * 2);
      context.arc(pr.x - s * 0.7, pr.y + s * 0.25, s * 0.7, 0, Math.PI * 2);
      context.arc(pr.x + s * 0.7, pr.y + s * 0.25, s * 0.75, 0, Math.PI * 2);
      context.fill();
      if ((state.elapsed * 2 + e.spin) % 1 < 0.14) {
        context.strokeStyle = PALETTE.hazardBolt;
        context.lineWidth = 3;
        context.beginPath();
        context.moveTo(pr.x - s * 0.2, pr.y + s * 0.5);
        context.lineTo(pr.x + s * 0.1, pr.y + s * 1.2);
        context.lineTo(pr.x - s * 0.15, pr.y + s * 1.7);
        context.stroke();
      }
    } else {
      context.fillStyle = PALETTE.balloon;
      context.beginPath();
      context.ellipse(pr.x, pr.y - s * 0.4, s * 0.75, s, 0, 0, Math.PI * 2);
      context.fill();
      context.fillStyle = 'rgba(255,255,255,0.85)';
      context.beginPath();
      context.ellipse(pr.x, pr.y - s * 0.4, s * 0.22, s * 0.96, 0, 0, Math.PI * 2);
      context.fill();
      context.strokeStyle = '#5a2b2b';
      context.lineWidth = 1.5;
      context.beginPath();
      context.moveTo(pr.x - s * 0.4, pr.y + s * 0.35);
      context.lineTo(pr.x - s * 0.25, pr.y + s * 0.9);
      context.moveTo(pr.x + s * 0.4, pr.y + s * 0.35);
      context.lineTo(pr.x + s * 0.25, pr.y + s * 0.9);
      context.stroke();
      context.fillStyle = '#8a6a3a';
      context.fillRect(pr.x - s * 0.28, pr.y + s * 0.85, s * 0.56, s * 0.4);
    }
    context.restore();
  }

  function drawHazardLabel(e, state, nearX) {
    const pr = project(e.lat, e.alt, e.dist, state.plane.lat, state.plane.alt);
    if (pr.p < 0.05) return;
    if (nearX !== null && Math.abs(pr.x - nearX) <= 130) return;
    const s = Math.max(10, 46 * pr.p + 6) * (e.size ?? 1);
    if (e.kind === KIND_STORM) {
      const ly = pr.x > 960 && pr.y - s - 10 < 150 ? pr.y + s + 26 : Math.max(122, pr.y - s - 10);
      chip('STORM', pr.x, ly, Math.max(11, 15 * pr.p + 4), '#ffb3b3', 700);
    } else {
      const ly = pr.x > 960 && pr.y - s * 1.5 < 150 ? pr.y + s * 1.6 : Math.max(122, pr.y - s * 1.5);
      chip('BALLOON', pr.x, ly, Math.max(11, 15 * pr.p + 4), '#ffd9a0', 700);
    }
  }

  function drawPlane(state, steer) {
    const plane = state.plane;
    const cx = FIELD.width / 2;
    const cy = 548;
    const bank = steer * 0.38 + state.gust * 0.2;
    const blink = Math.floor(state.elapsed * 2.4) % 2 === 0;
    context.save();
    context.translate(cx, cy);
    context.rotate(bank);
    if (plane.invulnerable > 0 && Math.floor(plane.invulnerable * 10) % 2 === 0) context.globalAlpha = 0.45;
    // Contrails from the wingtips.
    context.strokeStyle = 'rgba(255,255,255,0.5)';
    context.lineWidth = 3;
    context.beginPath();
    context.moveTo(-216, 22);
    context.quadraticCurveTo(-280, 42, -350, 68);
    context.moveTo(216, 22);
    context.quadraticCurveTo(280, 42, 350, 68);
    context.stroke();
    // Tailplane (nearest the viewer, low on screen) with the callsign on it.
    context.fillStyle = '#c94a2e';
    context.beginPath();
    context.moveTo(-78, 30);
    context.lineTo(-96, 46);
    context.lineTo(-58, 50);
    context.lineTo(-34, 38);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(78, 30);
    context.lineTo(96, 46);
    context.lineTo(58, 50);
    context.lineTo(34, 38);
    context.closePath();
    context.fill();
    // Main wings: thick at the root, swept back toward the tips.
    context.fillStyle = PALETTE.planeAccent;
    context.beginPath();
    context.moveTo(-40, -18);
    context.lineTo(-226, 14);
    context.lineTo(-218, 34);
    context.lineTo(-36, 16);
    context.closePath();
    context.fill();
    context.beginPath();
    context.moveTo(40, -18);
    context.lineTo(226, 14);
    context.lineTo(218, 34);
    context.lineTo(36, 16);
    context.closePath();
    context.fill();
    // Engine nacelles slung under the wings.
    context.fillStyle = PALETTE.planeDark;
    context.beginPath();
    context.roundRect(-128, 8, 34, 18, 8);
    context.roundRect(94, 8, 34, 18, 8);
    context.fill();
    context.fillStyle = '#ffd34d';
    context.beginPath();
    context.arc(-111, 17, 5, 0, Math.PI * 2);
    context.arc(111, 17, 5, 0, Math.PI * 2);
    context.fill();
    // Fuselage: wide at the tail (near), tapering to the nose (far, up-screen).
    const fg = context.createLinearGradient(0, -84, 0, 44);
    fg.addColorStop(0, '#fffaf0');
    fg.addColorStop(1, '#d8cdb4');
    context.fillStyle = fg;
    context.beginPath();
    context.moveTo(0, -86);
    context.quadraticCurveTo(26, -58, 38, -6);
    context.quadraticCurveTo(44, 26, 34, 42);
    context.quadraticCurveTo(0, 52, -34, 42);
    context.quadraticCurveTo(-44, 26, -38, -6);
    context.quadraticCurveTo(-26, -58, 0, -86);
    context.fill();
    // Dawn cheatline + lit cockpit glass on the nose.
    context.fillStyle = PALETTE.planeAccent;
    context.fillRect(-38, -14, 76, 9);
    context.fillStyle = PALETTE.planeGlass;
    context.beginPath();
    context.ellipse(0, -46, 17, 13, 0, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = 'rgba(255,255,255,0.9)';
    context.beginPath();
    context.ellipse(-6, -50, 5, 3.5, -0.4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = PALETTE.planeDark;
    text('KITE-9', 0, 30, 13, '#ffffff', 'center', 700);
    // Nav lights: red left, green right, blinking white tail.
    context.fillStyle = '#ff3b30';
    context.beginPath(); context.arc(-222, 24, blink ? 6 : 4, 0, Math.PI * 2); context.fill();
    context.fillStyle = '#35e07a';
    context.beginPath(); context.arc(222, 24, blink ? 6 : 4, 0, Math.PI * 2); context.fill();
    context.fillStyle = blink ? '#ffffff' : 'rgba(255,255,255,0.25)';
    context.beginPath(); context.arc(0, 48, 4, 0, Math.PI * 2); context.fill();
    context.restore();
    // Speed lines at the frame edges when fast.
    if (plane.speed > 175) {
      context.strokeStyle = 'rgba(255,255,255,0.35)';
      context.lineWidth = 2;
      for (let i = 0; i < 6; i += 1) {
        const y = 90 + i * 96 + ((state.elapsed * 900) % 96);
        context.beginPath();
        context.moveTo(18, y);
        context.lineTo(86, y);
        context.moveTo(FIELD.width - 18, y);
        context.lineTo(FIELD.width - 86, y);
        context.stroke();
      }
    }
  }

  function drawHud(state, best) {
    const plane = state.plane;
    const hdg = Math.round(((plane.lat * 60 + 42) % 360 + 360) % 360);
    const vsi = Math.round(plane.climb ?? 0);
    // Top-left: altitude + climb.
    panel(16, 14, 252, 84);
    text('ALTITUDE', 32, 40, 14, PALETTE.muted, 'left', 700);
    text(`${fmt(Math.round(plane.alt))} FT`, 32, 74, 30, '#ffffff', 'left', 800);
    text(`VSI ${vsi >= 0 ? '+' : ''}${fmt(vsi)} FT/MIN`, 32, 94, 14, vsi >= 0 ? PALETTE.good : PALETTE.bad, 'left', 600);
    // Top-centre: heading compass.
    panel(496, 14, 288, 84);
    text('HEADING', 640, 40, 14, PALETTE.muted, 'center', 700);
    text(`${String(hdg).padStart(3, '0')}°`, 640, 76, 30, '#ffffff', 'center', 800);
    context.fillStyle = PALETTE.ringGold;
    context.beginPath();
    context.moveTo(640, 86);
    context.lineTo(632, 96);
    context.lineTo(648, 96);
    context.closePath();
    context.fill();
    // Top-right: speed + score + combo.
    panel(1012, 14, 252, 84);
    text('SPEED', 1028, 40, 14, PALETTE.muted, 'left', 700);
    text(`${Math.round(plane.speed)} KT`, 1028, 74, 30, '#ffffff', 'left', 800);
    text(`SCORE ${fmt(state.score)}`, 1248, 40, 15, '#ffffff', 'right', 700);
    text(state.combo > 1 ? `COMBO x${state.combo}` : `BEST ${fmt(best)}`, 1248, 66, 15, state.combo > 1 ? PALETTE.ringGold : PALETTE.muted, 'right', 700);
    // Throttle bar under the speed panel.
    panel(1012, 106, 252, 30);
    context.fillStyle = 'rgba(255,255,255,0.18)';
    context.fillRect(1024, 117, 150, 8);
    context.fillStyle = PALETTE.good;
    context.fillRect(1024, 117, 150 * plane.throttle, 8);
    text(`THR ${Math.round(plane.throttle * 100)}%`, 1188, 126, 13, '#ffffff', 'left', 700);
    // Left mission panel: route, contract, rings, cargo, time.
    panel(16, 120, 258, 196);
    text(`ROUTE ${state.route.id}/8 · ${state.route.name.toUpperCase()}`, 32, 146, 14, PALETTE.ringGold, 'left', 800);
    text(state.contract.name.toUpperCase(), 32, 172, 19, '#ffffff', 'left', 700);
    text(`${state.route.from.toUpperCase()} → ${state.route.to.toUpperCase()}`, 32, 194, 12, PALETTE.muted, 'left', 600);
    text(`RING ${state.ringsPassed}/${state.ringsTotal}`, 32, 224, 16, '#ffffff', 'left', 700);
    for (let i = 0; i < state.ringsTotal; i += 1) {
      context.fillStyle = i < state.ringsPassed ? PALETTE.ringGold : 'rgba(255,255,255,0.22)';
      context.beginPath();
      context.arc(34 + i * 19, 240, 6, 0, Math.PI * 2);
      context.fill();
    }
    text(`CARGO ${state.cargoGot}/${state.cargoTotal}  ·  TIME ${mmss(state.elapsed)} / ${mmss(state.contract.par)}`, 32, 272, 14, '#ffffff', 'left', 600);
    text(`CREDITS ${fmt(state.credits)}  ·  ${state.weather.name.toUpperCase()}`, 32, 296, 13, PALETTE.muted, 'left', 700);
    // Bottom-left: fuel + hull.
    panel(16, 606, 258, 92);
    text(`FUEL ${Math.round(plane.fuel)}%`, 32, 632, 16, plane.fuel < 25 ? PALETTE.bad : '#ffffff', 'left', 700);
    context.fillStyle = 'rgba(255,255,255,0.18)';
    context.fillRect(32, 644, 226, 12);
    context.fillStyle = plane.fuel < 25 ? PALETTE.bad : PALETTE.good;
    context.fillRect(32, 644, 226 * Math.max(0, plane.fuel / 100), 12);
    text('HULL', 32, 684, 13, PALETTE.muted, 'left', 700);
    for (let i = 0; i < 3; i += 1) {
      context.fillStyle = i < plane.hull ? PALETTE.planeAccent : 'rgba(255,255,255,0.2)';
      context.beginPath();
      context.moveTo(84 + i * 30, 668);
      context.lineTo(108 + i * 30, 668);
      context.lineTo(96 + i * 30, 684);
      context.closePath();
      context.fill();
    }
    // Bottom-centre: route progress strip.
    panel(430, 648, 420, 50);
    text('ROUTE', 446, 672, 12, PALETTE.muted, 'left', 700);
    for (let i = 0; i < 8; i += 1) {
      const x = 510 + i * 30;
      context.fillStyle = i + 1 === state.route.id ? PALETTE.ringGold : i + 1 < state.route.id ? PALETTE.good : 'rgba(255,255,255,0.25)';
      context.beginPath();
      context.arc(x, 680, i + 1 === state.route.id ? 8 : 6, 0, Math.PI * 2);
      context.fill();
      if (i < 7) {
        context.strokeStyle = 'rgba(255,255,255,0.3)';
        context.beginPath();
        context.moveTo(x + 8, 680);
        context.lineTo(x + 24, 680);
        context.stroke();
      }
    }
    text(`${fmt(state.distanceKm.toFixed(1))} KM FLOWN`, 748, 672, 12, '#ffffff', 'left', 600);
    // Bottom-right: wind + weather.
    panel(1012, 648, 252, 50);
    text(`WIND ${state.weather.wind} KT ${state.gust >= 0 ? '→' : '←'}`, 1028, 672, 14, '#ffffff', 'left', 700);
    text(`${state.weather.name.toUpperCase()} · ${state.feats.length}/10 FEATS`, 1028, 690, 12, PALETTE.muted, 'left', 600);
  }

  function drawOverlayPanel(title, lines, prompt, accent) {
    const w = 640;
    const h = 130 + lines.length * 30 + 64;
    const x = (FIELD.width - w) / 2;
    const y = (FIELD.height - h) / 2;
    context.fillStyle = PALETTE.panel;
    context.beginPath();
    context.roundRect(x, y, w, h, 14);
    context.fill();
    context.strokeStyle = accent ?? PALETTE.hudEdge;
    context.lineWidth = 2;
    context.stroke();
    text(title, FIELD.width / 2, y + 62, 34, '#ffffff', 'center', 800);
    for (let i = 0; i < lines.length; i += 1) {
      text(lines[i], FIELD.width / 2, y + 112 + i * 30, 19, i === 0 ? PALETTE.ringGold : PALETTE.muted, 'center', i === 0 ? 700 : 400);
    }
    text(prompt, FIELD.width / 2, y + h - 30, 18, PALETTE.ringGold, 'center', 700);
  }

  function drawHangar(state, best, owned, credits) {
    context.fillStyle = 'rgba(10, 6, 24, 0.82)';
    context.fillRect(0, 0, FIELD.width, FIELD.height);
    panel(60, 40, 1160, 640);
    text('HANGAR — AURORA COURIER', 640, 92, 30, '#ffffff', 'center', 800);
    text(`CREDITS ${fmt(credits)}   ·   BEST ${fmt(best)}   ·   CONTRACT ${state.contract.id}/24`, 640, 122, 16, PALETTE.muted, 'center', 600);
    text('AIRCRAFT UPGRADES — 12', 96, 168, 17, PALETTE.ringGold, 'left', 800);
    for (let i = 0; i < 12; i += 1) {
      const u = UPGRADES[i];
      const y = 196 + i * 26;
      text(`${owned.has(u.id) ? '✓' : '○'}  ${u.name}`, 96, y, 16, owned.has(u.id) ? PALETTE.good : '#ffffff', 'left', 600);
      text(`${u.effect} — ${u.cost} cr`, 560, y, 15, PALETTE.muted, 'left', 400);
    }
    text('PILOT FEATS — 10', 700, 168, 17, PALETTE.ringGold, 'left', 800);
    for (let i = 0; i < 10; i += 1) {
      const f = FEATS[i];
      const y = 196 + i * 26;
      text(`${state.feats.includes(f.id) ? '★' : '☆'}  ${f.name}`, 700, y, 16, state.feats.includes(f.id) ? PALETTE.ringGold : '#ffffff', 'left', 600);
    }
    text('CONTRACTS — 24 ACROSS 8 ROUTES', 700, 470, 17, PALETTE.ringGold, 'left', 800);
    for (let i = 0; i < 8; i += 1) {
      const r = ROUTES[i];
      const doneCount = CONTRACTS.filter((c) => c.route === r.id && c.id < state.contract.id).length;
      text(`${r.id}. ${r.name} — ${doneCount}/3 done · ${r.weather}`, 700, 498 + i * 24, 15, '#ffffff', 'left', 400);
    }
    text('Press H to return to the dawn sky · 1–9 buys an upgrade in the hangar', 640, 662, 15, PALETTE.muted, 'center', 600);
  }

  /** Paint one frame: sky, sea, entities, plane, HUD, then the screen's panel over the live scene. */
  function draw(state, screen, best, extra = {}) {
    context.setTransform(1, 0, 0, 1, 0, 0);
    context.fillStyle = PALETTE.backdrop;
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.setTransform(view.scale, 0, 0, view.scale, view.x, view.y);
    drawSky(state);
    drawRidge(RIDGE_FAR, PALETTE.ridgeFar, -state.plane.lat * 14);
    drawRidge(RIDGE_MID, PALETTE.ridgeMid, -state.plane.lat * 30);
    drawSea(state);
    drawRidge(RIDGE_NEAR, PALETTE.ridgeNear, -state.plane.lat * 52);
    drawClouds(state);
    const sorted = [...state.entities].sort((a, b) => b.dist - a.dist);
    let nearestRing = null;
    for (const e of state.entities) {
      if ((e.kind === KIND_RING || e.kind === KIND_FUEL_RING) && e.dist > 0 && (nearestRing === null || e.dist < nearestRing.dist)) nearestRing = e;
    }
    const nearX = nearestRing === null ? null : project(nearestRing.lat, nearestRing.alt, nearestRing.dist, state.plane.lat, state.plane.alt).x;
    for (const e of sorted) {
      if (e.kind === KIND_RING || e.kind === KIND_FUEL_RING) drawRing(e, state, e === nearestRing);
      else if (e.kind === KIND_CARGO) drawCargo(e, state, nearX);
      else drawHazard(e, state, nearX);
    }
    for (const e of sorted) {
      if (e.kind === KIND_RING || e.kind === KIND_FUEL_RING) drawRingLabel(e, state, e === nearestRing);
      else if (e.kind === KIND_CARGO) drawCargoLabel(e, state, nearX);
      else drawHazardLabel(e, state, nearX);
    }
    drawPlane(state, extra.steer ?? 0);
    drawHud(state, best);
    if (screen === SCREEN_BRIEF) {
      drawOverlayPanel('AURORA COURIER', [
        `${state.route.name.toUpperCase()} — ${state.contract.name.toUpperCase()}`,
        `Fly ${state.ringsTotal} rings · collect ${state.cargoTotal} cargo · mind the ${state.weather.name.toLowerCase()}`,
        'Steer ← → or A D · climb ↑ ↓ or W S · throttle E Q · pause P · hangar H',
      ], 'Press Space or click to take off');
    } else if (screen === SCREEN_PAUSED) {
      drawOverlayPanel('PAUSED', ['The dawn waits for no courier — but it waits for you.', 'P to resume · H for the hangar'], 'Press P to keep flying');
    } else if (screen === SCREEN_OVER) {
      drawOverlayPanel('FORCED LANDING', [state.overReason, `Score ${fmt(state.score)} · Best ${fmt(best)} · Rings ${state.ringsPassed}/${state.ringsTotal}`], 'Press Space to fly the contract again', PALETTE.bad);
    } else if (screen === SCREEN_DONE) {
      const feats = state.feats.length ? state.feats.map((id) => FEATS[id - 1].name).join(' · ') : 'No new feat this run';
      drawOverlayPanel('CONTRACT COMPLETE', [
        `${state.contract.name.toUpperCase()} — ${state.route.name.toUpperCase()}`,
        `Rings ${state.ringsPassed}/${state.ringsTotal} · Cargo ${state.cargoGot}/${state.cargoTotal} · Time ${mmss(state.elapsed)} (par ${mmss(state.contract.par)})`,
        `Score ${fmt(state.score)} · Credits +${fmt(state.credits)}`,
        `Feats: ${feats}`,
      ], 'Press Space for the next contract');
    } else if (screen === SCREEN_HANGAR) {
      drawHangar(state, best, extra.owned ?? new Set(), extra.credits ?? 0);
    }
  }

  resize();
  window.addEventListener('resize', resize);
  return { draw };
}
