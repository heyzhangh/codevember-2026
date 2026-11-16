// Static-output integration check: no Vite dev server, repo aliases or CDN.
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { readFile, readdir, mkdir, writeFile } from 'node:fs/promises';
import { resolve, extname, relative, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { gzipSync } from 'node:zlib';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright-core';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = resolve(root, 'dist');
const output = resolve(root, process.argv[2] ?? '../bird-evidence');
await mkdir(output, { recursive: true });
const files = async dir => (await Promise.all((await readdir(dir, { withFileTypes: true })).map(async f =>
  f.isDirectory() ? files(resolve(dir, f.name)) : [resolve(dir, f.name)]))).flat();
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.txt': 'text/plain' };
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    assert(pathname.startsWith('/bird-preview/'));
    const file = resolve(dist, pathname.slice('/bird-preview/'.length) || 'index.html');
    assert(!relative(dist, file).startsWith('..'));
    res.setHeader('Content-Type', mime[extname(file)] ?? 'text/plain');
    res.end(await readFile(file));
  } catch { res.statusCode = 404; res.end('Not found'); }
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://127.0.0.1:${server.address().port}/bird-preview/`;
let browser;
try {
  browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
    args: ['--no-sandbox', ...(process.env.BIRD_SOFTWARE_GL === '1'
      ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [])],
  });
  const report = {
    browser: await browser.version(), platform: process.platform,
    viewport: { width: 960, height: 720, deviceScaleFactor: 1 },
    softwareGLRequested: process.env.BIRD_SOFTWARE_GL === '1',
    fpsMethod: 'At least 8 seconds AND 10 wall-clock RAF intervals after compilation; real animation, no virtual clock',
    staticSubdirectory: '/bird-preview/', variants: {},
  };
  for (const variant of ['original', 'proof']) {
    const page = await browser.newPage({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 1 });
    const errors = [], externalRequests = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('request', r => { if (!r.url().startsWith(base) && !r.url().startsWith('data:')) externalRequests.push(r.url()); });
    const url = `${base}?quiet&pose=three${variant === 'proof' ? '&species=proof' : ''}`;
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__birdDemo?.frames >= 3, {}, { timeout: 120000 });
    await page.evaluate(() => window.__birdDemo.ready);
    assert.equal(await page.locator('a, button, .plate, nav').count(), 0);
    assert.equal((await page.locator('body').innerText()).trim(), '');
    const stats = await page.evaluate(async () => {
      const demo = window.__birdDemo, b = demo.bird, r = demo.renderer;
      const gl = r.getContext(), debug = gl.getExtension('WEBGL_debug_renderer_info');
      const meshes = Object.fromEntries(Object.entries(b.feathers).map(([key, mesh]) => [key, {
        feathers: mesh.geometry.userData.featherCount,
        vertices: mesh.geometry.attributes.position.count,
        triangles: mesh.geometry.index.count / 3,
      }]));
      const geometries = new Set();
      b.root.traverse(o => { if (o.geometry) geometries.add(o.geometry); });
      let bytes = 0;
      for (const g of geometries) {
        for (const a of Object.values(g.attributes)) bytes += a.array.byteLength;
        bytes += g.index?.array.byteLength ?? 0;
      }
      const times = await new Promise(resolve => {
        const samples = []; let start, prev;
        const sample = now => {
          start ??= now;
          if (prev !== undefined) samples.push(now - prev);
          prev = now;
          if (now - start >= 8000 && samples.length >= 10) resolve(samples); else requestAnimationFrame(sample);
        };
        requestAnimationFrame(sample);
      });
      const sorted = [...times].sort((a, b) => a - b);
      const head = b.rig.bones.head.getWorldPosition(b.root.position.clone());
      return {
        name: b.species.name, bones: b.rig.skeleton.bones.length, meshes,
        featherTotal: meshes.contour.feathers + meshes.flight.feathers,
        geometryBufferBytes: bytes,
        render: { ...r.info.render }, memory: { ...r.info.memory },
        gpu: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
        pixelRatio: r.getPixelRatio(), head: head.toArray(),
        fps: times.length / (times.reduce((a, b) => a + b, 0) / 1000),
        sampledFrames: times.length, sampledMilliseconds: times.reduce((a, b) => a + b, 0),
        frameMilliseconds: { p50: sorted[Math.floor(sorted.length * .5)], p95: sorted[Math.floor(sorted.length * .95)] },
        billLength: b.species.bill.length, bellyWidth: b.species.sections[3].w,
        gorget: b.species.looks.gorget.iri, bodyTip: b.species.looks.body.tip,
        scripts: performance.getEntriesByType('resource').filter(e => e.name.endsWith('.js')).map(e => new URL(e.name).pathname),
        clock: { mindTime: b.mind.t, dt: b.mind.dt },
      };
    });
    assert(stats.head.every(Number.isFinite));
    assert(stats.head[1] > 0.5 && stats.head[1] < 1.5, 'Head must be inside the actual scene');
    assert(stats.clock.mindTime >= 0 && stats.clock.dt >= 0, 'No negative startup time');
    assert(stats.featherTotal > 5000 && stats.render.triangles > 100000);
    await page.screenshot({ path: resolve(output, variant === 'original' ? '02-standalone-original.png' : '03-standalone-proof.png'), timeout: 120000 });

    // Exercise 15 simulated seconds of the actual behaviour system without GPU waits.
    // This section is excluded from the wall-clock FPS sample above.
    stats.behaviour = await page.evaluate(() => {
      const b = window.__birdDemo.bird;
      b.mind.quiet = false; b.mind.pinGaze = null;
      let saccades = 0, blink = 0, minBreath = Infinity, maxBreath = -Infinity;
      b.mind.on('saccade', () => saccades++);
      b.startle(.7); b.ruffle('puff', .6);
      for (let i = 0; i < 900; i++) {
        b.update(1 / 60);
        minBreath = Math.min(minBreath, b.pose.breath); maxBreath = Math.max(maxBreath, b.pose.breath);
        blink = Math.max(blink, b.pose.lidUpper, b.pose.nict);
        if (!b.rig.skeleton.bones.every(bone => [...bone.position, ...bone.quaternion].every(Number.isFinite))) throw Error('Nonfinite bone');
      }
      return { saccades, blink, minBreath, maxBreath };
    });
    assert(stats.behaviour.saccades > 0 && stats.behaviour.blink > .5);
    assert(stats.behaviour.maxBreath - stats.behaviour.minBreath > .2);
    const frames = await page.evaluate(() => {
      const d = window.__birdDemo;
      d.dispose(); d.dispose();
      return d.frames;
    });
    await page.waitForTimeout(250);
    stats.disposal = await page.evaluate(() => ({
      frames: window.__birdDemo.frames, disposed: window.__birdDemo.disposed,
      geometries: window.__birdDemo.renderer.info.memory.geometries,
    }));
    assert.equal(stats.disposal.frames, frames);
    assert.equal(stats.disposal.geometries, 0);
    assert(stats.disposal.disposed);
    assert.deepEqual(errors, []); assert.deepEqual(externalRequests, []);
    stats.errors = errors; stats.externalRequests = externalRequests;
    report.variants[variant] = stats;
    console.log(`${variant}: ${stats.featherTotal} feathers, ${stats.fps.toFixed(2)} FPS, no errors/external requests`);
    await page.close();
  }
  const [original, proof] = [report.variants.original, report.variants.proof];
  assert.deepEqual(original.scripts, proof.scripts, 'Same engine bundle for both data objects');
  assert(proof.billLength < original.billLength && proof.bellyWidth > original.bellyWidth);
  assert.notEqual(proof.gorget, original.gorget); assert.notEqual(proof.bodyTip, original.bodyTip);
  report.build = await Promise.all((await files(dist)).sort().map(async file => {
    const content = await readFile(file);
    return { file: relative(dist, file), bytes: content.length, gzipBytes: gzipSync(content).length };
  }));
  report.engineHashes = Object.fromEntries(await Promise.all((await files(resolve(root, 'src/engine'))).sort().map(async f =>
    [relative(root, f), createHash('sha256').update(await readFile(f)).digest('hex')])));
  await writeFile(resolve(output, 'metrics.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(`Verified static build under /bird-preview/. Evidence: ${output}`);
} finally {
  await browser?.close();
  await new Promise(r => server.close(r));
}
