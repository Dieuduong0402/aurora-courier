// AURORA COURIER — screenshot + measurement harness (Node 22, stdlib only).
// Serves game/ on localhost, drives headless Chromium over CDP, and for each shot in
// shots.json: navigates to ?shot=<name>&seed=1, waits for window.__shotReady, reads the
// window.__aurora measurement hook, captures a 1280x720 JPEG (q95) into screenshots/,
// and reports any console error or page exception. Usage: node scripts/capture.mjs
import { createServer } from 'node:http';
import { readFileSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { extname, join, resolve, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const here = fileURLToPath(new URL('.', import.meta.url));
const repo = resolve(here, '..');
const gameRoot = join(repo, 'game');
const shotDir = join(repo, 'screenshots');
const CHROME = `${process.env.HOME}/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`;
const PORT = 8932;

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8' };
const SHOTS = JSON.parse(readFileSync(join(repo, 'shots.json'), 'utf8'));

function serve() {
  return new Promise((resolvePromise) => {
    const server = createServer((req, res) => {
      let pathname;
      try {
        pathname = decodeURIComponent(new URL(req.url ?? '/', 'http://localhost').pathname);
      } catch {
        res.writeHead(400).end('bad request');
        return;
      }
      if (pathname.endsWith('/')) pathname += 'index.html';
      const file = resolve(join(gameRoot, normalize(pathname)));
      if (file !== gameRoot && !file.startsWith(gameRoot + sep)) {
        res.writeHead(403).end('forbidden');
        return;
      }
      try {
        const size = statSync(file).size;
        res.writeHead(200, {
          'content-type': MIME[extname(file).toLowerCase()] ?? 'application/octet-stream',
          'content-length': size,
          'cache-control': 'no-store',
        });
        res.end(readFileSync(file));
      } catch {
        res.writeHead(404).end('not found');
      }
    });
    server.listen(PORT, '127.0.0.1', () => resolvePromise(server));
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function launchChrome() {
  const proc = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu', '--hide-scrollbars',
    '--window-size=1280,720', '--remote-debugging-port=9223',
    '--user-data-dir=/tmp/aurora-chrome-profile',
    'about:blank',
  ], { stdio: 'ignore' });
  for (let i = 0; i < 40; i++) {
    try {
      const res = await fetch('http://127.0.0.1:9223/json/version');
      if (res.ok) return proc;
    } catch { /* not up yet */ }
    await sleep(250);
  }
  throw new Error('Chromium did not start its debugger');
}

async function cdpConnect() {
  const targets = await (await fetch('http://127.0.0.1:9223/json')).json();
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  const errors = [];
  await new Promise((resolvePromise, reject) => {
    ws.onopen = resolvePromise;
    ws.onerror = reject;
  });
  let id = 0;
  const pending = new Map();
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id !== undefined && pending.has(msg.id)) {
      pending.get(msg.id)(msg);
      pending.delete(msg.id);
    }
    if (msg.method === 'Runtime.exceptionThrown') {
      errors.push(`exception: ${msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text}`);
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      errors.push(`console: ${(msg.params.args ?? []).map((a) => a.value ?? a.description ?? '').join(' ')}`);
    }
  };
  const send = (method, params = {}) => new Promise((resolvePromise) => {
    const mid = ++id;
    pending.set(mid, resolvePromise);
    ws.send(JSON.stringify({ id: mid, method, params }));
  });
  return { send, errors, close: () => ws.close() };
}

async function evaluate(cdp, expression) {
  const res = await cdp.send('Runtime.evaluate', { expression, returnByValue: true });
  if (res.result?.exceptionDetails) throw new Error(`page error: ${JSON.stringify(res.result.exceptionDetails)}`);
  return res.result?.result?.value;
}

async function main() {
  mkdirSync(shotDir, { recursive: true });
  const server = await serve();
  const chrome = await launchChrome();
  const cdp = await cdpConnect();
  const measured = [];
  try {
    await cdp.send('Page.enable');
    await cdp.send('Runtime.enable');
    // Force the viewport to exactly 1280x720: --window-size alone leaves headless
    // Chrome at 1280x520, which letterboxes the 1280x720 field with side bars.
    await cdp.send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 720, deviceScaleFactor: 1, mobile: false });
    for (const shot of SHOTS) {
      await cdp.send('Page.navigate', { url: `http://127.0.0.1:${PORT}/${shot.query}` });
      let ready = false;
      for (let i = 0; i < 40; i++) {
        await sleep(250);
        try {
          ready = await evaluate(cdp, 'window.__shotReady === true');
        } catch { /* page still loading */ }
        if (ready) break;
      }
      if (!ready) throw new Error(`${shot.name}: __shotReady never became true`);
      const vp = await evaluate(cdp, '`${window.innerWidth}x${window.innerHeight}`');
      if (vp !== '1280x720') throw new Error(`${shot.name}: viewport is ${vp}, expected 1280x720`);
      const m = await evaluate(cdp, 'JSON.stringify(window.__aurora)');
      const shotRes = await cdp.send('Page.captureScreenshot', { format: 'jpeg', quality: 95 });
      const buf = Buffer.from(shotRes.result.data, 'base64');
      writeFileSync(join(shotDir, shot.name), buf);
      const parsed = JSON.parse(m);
      measured.push({ ...parsed, bytes: buf.length });
      console.log(`${shot.name}: ${buf.length} B | ring ${parsed.rings} cargo ${parsed.cargo} score ${parsed.score} combo x${parsed.combo} ${parsed.elapsed}s feats [${parsed.feats.join(', ')}]`);
    }
    writeFileSync(join(repo, 'shots-measured.json'), `${JSON.stringify(measured, null, 2)}\n`);
    if (cdp.errors.length > 0) {
      console.error(`PAGE ERRORS (${cdp.errors.length}):`);
      for (const e of cdp.errors) console.error(`  ${e}`);
      process.exitCode = 1;
    } else {
      console.log('0 page errors');
    }
  } finally {
    cdp.close();
    chrome.kill('SIGKILL');
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
