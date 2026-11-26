// A tiny WebAudio synth: no audio files, everything is an oscillator shaped by the game.
// Created lazily on the first user gesture (browsers block audio before one); silent in
// headless screenshots, where no gesture ever happens.
let ctx = null;
let engineHum = null;

export function ensureAudio() {
  try {
    if (ctx) return;
    const AC = window.AudioContext ?? window.webkitAudioContext;
    if (!AC) return;
    ctx = new AC();
    engineHum = ctx.createOscillator();
    const gain = ctx.createGain();
    gain.gain.value = 0.015;
    engineHum.type = 'sawtooth';
    engineHum.frequency.value = 68;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 320;
    engineHum.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    engineHum.start();
  } catch {
    // No audio on this machine: the game plays silent.
  }
}

export function setEngine(throttle, speed) {
  if (!ctx || !engineHum) return;
  try {
    engineHum.frequency.setTargetAtTime(52 + throttle * 46 + speed * 0.08, ctx.currentTime, 0.1);
  } catch { /* audio is decorative */ }
}

function blip(freq, dur, type, vol) {
  if (!ctx) return;
  try {
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = type;
    o.frequency.value = freq;
    g.gain.setValueAtTime(vol, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    o.stop(ctx.currentTime + dur);
  } catch { /* audio is decorative */ }
}

export function ringSound(combo) { blip(520 + combo * 60, 0.22, 'sine', 0.12); }
export function cargoSound() { blip(340, 0.18, 'triangle', 0.1); }
export function hitSound() { blip(110, 0.35, 'square', 0.14); }
export function completeSound() { blip(660, 0.3, 'sine', 0.12); setTimeout(() => blip(880, 0.4, 'sine', 0.12), 160); }
