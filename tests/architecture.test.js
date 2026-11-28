// Automated Onion Architecture fitness tests:
// Statically verifies concentric dependency direction, zero outward leakage,
// and exact case-sensitive asset existence for GitHub Pages.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CUSTOM } from '../js/domain/data.js';
import {
  CUSTOM_ASSETS,
  STOP_BACKGROUNDS,
  CUSTOM_PREVIEW_NORMAL,
  LOCK_ICON_SRC,
  DEFAULT_ROAD_LOOP_SRC,
  DEFAULT_INTERIOR_SRC,
} from '../js/presentation/assets.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function listJsFiles(relDir) {
  const dir = path.join(ROOT, relDir);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir)
    .filter((f) => f.endsWith('.js'))
    .map((f) => path.join(dir, f));
}

function extractImports(src) {
  const specs = [];
  const staticRe = /(?:import|export)\s+(?:[^'"]*?\s+from\s+)?['"]([^'"]+)['"]/g;
  const dynamicRe = /import\(\s*['"]([^'"]+)['"]\s*\)/g;
  let m;
  while ((m = staticRe.exec(src))) specs.push(m[1]);
  while ((m = dynamicRe.exec(src))) specs.push(m[1]);
  return specs;
}

function resolveLayer(filePath, spec) {
  if (/^https?:\/\//.test(spec)) return 'external';
  const clean = spec.split('?')[0];
  const resolved = path.resolve(path.dirname(filePath), clean);
  const rel = path.relative(path.join(ROOT, 'js'), resolved).replace(/\\/g, '/');
  return rel.split('/')[0];
}

function assertFileExistsExactCase(relFromHtml) {
  const resolved = path.resolve(path.join(ROOT, 'html'), relFromHtml);
  const relFromRoot = path.relative(ROOT, resolved);
  const parts = relFromRoot.split(path.sep);
  let cur = ROOT;
  for (const part of parts) {
    const entries = fs.readdirSync(cur);
    assert.ok(
      entries.includes(part),
      `Asset missing or wrong capitalization: ${relFromHtml} (segment "${part}" not in ${cur})`
    );
    cur = path.join(cur, part);
  }
}

function stripComments(src) {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');
}

test('Onion Ring 1 (js/domain): imports ONLY domain modules and has zero DOM/Firebase/asset leaks', () => {
  const files = listJsFiles('js/domain');
  assert.ok(files.length >= 6);
  for (const file of files) {
    const src = stripComments(fs.readFileSync(file, 'utf8'));
    const name = path.relative(ROOT, file);
    for (const spec of extractImports(src)) {
      const targetLayer = resolveLayer(file, spec);
      assert.equal(targetLayer, 'domain', `${name} must only import domain, found "${spec}" (${targetLayer})`);
    }
    assert.ok(!/\b(document|window|localStorage|sessionStorage)\b/.test(src), `${name} must be DOM/storage-free`);
    assert.ok(!/firebase/i.test(src), `${name} must be Firebase-free`);
    assert.ok(!/\.\.\/assets\//.test(src), `${name} must not embed UI asset paths`);
  }
});

test('Onion Ring 2 (js/application): imports ONLY domain/application and has zero DOM/Firebase/storage leaks', () => {
  const files = listJsFiles('js/application');
  assert.ok(files.length >= 4);
  for (const file of files) {
    const src = stripComments(fs.readFileSync(file, 'utf8'));
    const name = path.relative(ROOT, file);
    for (const spec of extractImports(src)) {
      const targetLayer = resolveLayer(file, spec);
      assert.ok(
        targetLayer === 'domain' || targetLayer === 'application',
        `${name} must only import domain/application, found "${spec}" (${targetLayer})`
      );
    }
    assert.ok(!/\b(document|window|localStorage|sessionStorage)\b/.test(src), `${name} must be DOM/storage-free`);
    assert.ok(!/firebase/i.test(src), `${name} must be Firebase-free`);
  }
});

test('Onion Ring 3 (js/infrastructure): never imports presentation or composition', () => {
  const files = listJsFiles('js/infrastructure');
  assert.ok(files.length >= 5);
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const name = path.relative(ROOT, file);
    for (const spec of extractImports(src)) {
      const targetLayer = resolveLayer(file, spec);
      assert.notEqual(targetLayer, 'presentation', `${name} must not import presentation`);
      assert.notEqual(targetLayer, 'composition', `${name} must not import composition`);
    }
  }
});

test('Onion Ring 3 (js/presentation): never imports infrastructure, composition, or Firebase directly', () => {
  const files = listJsFiles('js/presentation');
  assert.ok(files.length >= 6);
  for (const file of files) {
    const src = fs.readFileSync(file, 'utf8');
    const name = path.relative(ROOT, file);
    for (const spec of extractImports(src)) {
      const targetLayer = resolveLayer(file, spec);
      assert.ok(
        targetLayer === 'domain' || targetLayer === 'application' || targetLayer === 'presentation',
        `${name} must not import "${spec}" (${targetLayer}); inject adapters via composition root`
      );
    }
    assert.ok(!/gstatic\.com\/firebasejs/i.test(src), `${name} must not import Firebase CDN directly`);
  }
});

test('HTML entry points only load Composition Roots (no inline Firebase or infrastructure imports)', () => {
  assert.ok(fs.existsSync(path.join(ROOT, 'favicon.ico')), 'Root favicon.ico must exist to prevent /favicon.ico 404s');
  for (const rel of ['html/login.html', 'html/game.html']) {
    const src = fs.readFileSync(path.join(ROOT, rel), 'utf8');
    assert.ok(!/gstatic\.com\/firebasejs/i.test(src), `${rel} must not import Firebase directly`);
    assert.ok(!/js\/infrastructure\//i.test(src), `${rel} must not import infrastructure directly`);
    assert.ok(/src="\.\.\/js\/composition\/.+\.js/.test(src), `${rel} must bootstrap via js/composition/`);
  }
});

test('Presentation asset catalog covers every customization item and all referenced files exist with exact case', () => {
  assertFileExistsExactCase(CUSTOM_PREVIEW_NORMAL);
  assertFileExistsExactCase(LOCK_ICON_SRC);
  assertFileExistsExactCase(DEFAULT_ROAD_LOOP_SRC);
  assertFileExistsExactCase(DEFAULT_INTERIOR_SRC);
  for (const src of Object.values(STOP_BACKGROUNDS)) assertFileExistsExactCase(src);

  for (const item of Object.values(CUSTOM).flat()) {
    const a = CUSTOM_ASSETS[item.id];
    assert.ok(a, `Missing presentation assets for ${item.id}`);
    assertFileExistsExactCase(a.icon);
    assertFileExistsExactCase(a.preview);
    if (item.category === 'decor') assertFileExistsExactCase(a.decorImg);
    if (item.category === 'interior') assertFileExistsExactCase(a.interiorImg);
    if (item.category === 'scenery') {
      assertFileExistsExactCase(a.roadGif);
      for (const stopSrc of Object.values(a.stopBackgrounds)) assertFileExistsExactCase(stopSrc);
    }
  }
});
