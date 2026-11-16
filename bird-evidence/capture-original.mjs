// Run from the repository root with the untouched day-12 server on port 5173.
// Kept outside bird/: this is extraction evidence, not a runtime dependency.
import { chromium } from 'playwright-core';
import { writeFile } from 'node:fs/promises';
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox', '--enable-unsafe-swiftshader', '--use-angle=swiftshader'] });
try {
  // Full original post-processing and GLB. Half DPR keeps software rendering feasible.
  const page = await browser.newPage({ viewport: { width: 960, height: 720 }, deviceScaleFactor: 0.5 });
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  await page.addInitScript(() => {
    // Day 12 passes RAF's queued timestamp into a Timer created after the long
    // synchronous geometry build. That first timestamp can be stale (negative dt).
    // Normalize the timestamp in the browser harness; DO NOT patch original files.
    const raf = window.requestAnimationFrame.bind(window);
    window.requestAnimationFrame = callback => raf(() => callback(performance.now()));
  });
  await page.goto('http://127.0.0.1:5173/?still&quiet&pose=three', { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => window.__bird && window.__post, {}, { timeout: 120000 });
  const deadline = Date.now() + 900000;
  let status;
  do {
    await page.waitForTimeout(15000);
    status = await page.evaluate(() => ({ reveal: window.__post.grade.uReveal.value,
      time: window.__bird.mind.t, pitch: window.__bird.pose.bodyPitch, headShift: window.__bird.pose.headShift.y }));
    console.log(status);
    if (Date.now() > deadline) throw Error('Original never completed its reveal');
  } while (status.reveal !== 1 || Math.abs(status.pitch) > .3 || Math.abs(status.headShift) > .12);
  await page.screenshot({ path: 'bird-evidence/01-original-feather.png', timeout: 120000 });
  const diagnostics = await page.evaluate(() => {
    const r = window.__renderer, gl = r.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info');
    return { species: window.__bird.species.name, bones: window.__bird.rig.skeleton.bones.length,
      pixelRatio: r.getPixelRatio(), gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER),
      loading: document.body.classList.contains('loading'), reveal: window.__post.grade.uReveal.value };
  });
  await writeFile('bird-evidence/original.json', JSON.stringify({ ...diagnostics, errors, sourceModified: false,
    harness: 'RAF callback receives performance.now() to avoid upstream negative first dt',
    viewport: { width: 960, height: 720, dpr: .5 }, query: '?still&quiet&pose=three' }, null, 2) + '\n');
  console.log('Captured complete original Feather');
} finally { await browser.close(); }
