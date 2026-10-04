const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

test('viewport mobile tetap aksesibel dan mendukung safe area', () => {
  assert.match(html, /content="width=device-width, initial-scale=1, viewport-fit=cover"/);
  assert.doesNotMatch(html, /user-scalable\s*=\s*no/i);
  assert.doesNotMatch(html, /maximum-scale\s*=\s*1/i);
  assert.match(html, /100dvh/);
});

test('login memakai komponen khusus yang tidak mewarisi modal operasional', () => {
  assert.match(html, /id="loginOverlay" class="login-overlay"/);
  assert.match(html, /class="login-card"/);
  assert.doesNotMatch(html, /id="loginOverlay" class="modal-overlay"/);
  assert.match(html, /autocomplete="username"/);
  assert.match(html, /autocomplete="current-password"/);
  assert.match(html, /function togglePasswordVisibility\(\)/);
  assert.match(html, /id="loginMessage" role="alert" aria-live="polite"/);
});

test('navigasi satu tangan dan ringkasan filter tersedia', () => {
  for (const id of ['mobileBottomNav', 'mobileNavMap', 'mobileNavTable', 'mobileNavFilter', 'mobileNavAdd']) {
    assert.match(html, new RegExp(`id="${id}"`));
  }
  assert.match(html, /function updateFilterSummary\(\)/);
  assert.match(html, /id="mobileFilterBadge"/);
  assert.match(html, /function setupFilterAccordions\(\)/);
});

test('observer filter tidak dapat memicu loop render tanpa henti', () => {
  assert.match(html, /filterOptionContainers = \['cbJenisProprti', 'cbLegalitas', 'cbJenisData', 'cbTahun'\]/);
  assert.match(html, /filterOptionsObserver\.observe\(container, \{ childList:true \}\)/);
  assert.doesNotMatch(html, /observe\(filterBodyForSummary, \{ childList:true, subtree:true \}\)/);
  assert.match(html, /label && label\.textContent !== buttonText/);
});

test('overlay login dilepas total setelah autentikasi', () => {
  assert.match(html, /function closeLoginOverlay\(\)/);
  assert.match(html, /overlay\.hidden = true/);
  assert.match(html, /overlay\.setAttribute\('aria-hidden', 'true'\)/);
  assert.match(html, /backdrop\.classList\.remove\('show'\)/);
  assert.match(html, /closeLoginOverlay\(\); initializeAuthenticatedApp\(res\.role\)/);
});

test('form tambah dan edit dibagi menjadi lima tahap', () => {
  const stepDefinitions = html.match(/\{ title: '[^']+', ids: \[[^\]]+\] \}/g) || [];
  assert.equal(stepDefinitions.length, 5);
  for (const title of ['Identitas', 'Lokasi', 'Properti', 'Nilai & Data', 'Foto']) {
    assert.match(html, new RegExp(`title: '${title.replace('&', '\\&')}'`));
  }
  assert.match(html, /function setDataFormStep\(index\)/);
  assert.match(html, /id="btnFormBack"/);
  assert.match(html, /id="btnFormNext"/);
});

test('kartu mobile menampilkan status kelengkapan dan fungsi penting tetap tersintaks', () => {
  assert.match(html, /class="data-completeness /);
  assert.match(html, /Math\.ceil\(keys\.length \* \.70\)/);

  const scripts = [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1])
    .filter((source) => source.trim());
  assert.ok(scripts.length > 0);
  scripts.forEach((source) => assert.doesNotThrow(() => new Function(source)));
});

console.log('Mobile login, navigation, filter, form wizard, dan kartu data tervalidasi.');
