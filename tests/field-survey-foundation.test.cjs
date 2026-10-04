const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const backend = fs.readFileSync(path.join(__dirname, '..', 'Backend', 'Code.gs'), 'utf8');

function extract(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' missing');
  const body = source.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = body; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && next === '/') { i++; comment = ''; } continue; }
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = ''; continue; }
    if (c === '/' && next === '/') { i++; comment = 'line'; continue; }
    if (c === '/' && next === '*') { i++; comment = 'block'; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(name + ' unclosed');
}

test('backend menyediakan antrean survei dan endpoint API bridge', () => {
  assert.match(backend, /const FIELD_SURVEY_SHEET = "Survei_Lapangan"/);
  for (const action of ['saveFieldSurvey', 'getFieldSurveys', 'reviewFieldSurvey', 'uploadSurveyPhotos']) {
    assert.match(backend, new RegExp("action === '" + action + "'"));
    assert.match(html, new RegExp(action + '\\('));
  }
  const headers = extract(backend, '_fieldSurveyHeaders_');
  for (const label of ['Waktu Pengambilan', 'Koordinat GPS', 'Akurasi GPS (m)', 'Foto Asli', 'Foto Watermark']) {
    assert.match(headers, new RegExp(label.replace(/[()]/g, '\\$&')));
  }
});

test('Surveyor menyimpan draf dan Admin menyetujui sebelum masuk database', () => {
  const save = extract(backend, 'saveFieldSurvey');
  assert.match(save, /"Menunggu Review" : "Draf"/);
  assert.match(save, /Draf survei hanya dapat diubah oleh pembuatnya/);
  const review = extract(backend, 'reviewFieldSurvey');
  assert.match(review, /_requireFieldSurveyReviewer_\(activeUser\)/);
  assert.match(review, /addData\(survey\.dataRow, survey\.submittedBy, survey\.duplicateDecision\)/);
  assert.match(review, /"Disetujui"/);
  assert.match(review, /"Ditolak"/);
});

test('foto asli tetap privat dan hanya salinan watermark dibagikan', () => {
  const upload = extract(backend, 'uploadSurveyPhotos');
  assert.match(upload, /original = folder\.createFile/);
  assert.match(upload, /watermarked = folder\.createFile/);
  assert.match(upload, /watermarked\.setSharing/);
  assert.doesNotMatch(upload, /original\.setSharing/);
  assert.match(extract(html, 'handleFotoChange'), /SURVEI LAPANGAN/);
  assert.match(extract(html, 'handleFotoChange'), /_surveyOriginalPhotoDataUrl = ev\.target\.result/);
});

test('mode survei mobile memakai GPS, kamera, draf terpisah, dan deteksi duplikat', () => {
  assert.match(html, /id="mobileNavSurvey"/);
  assert.match(html, /\.mobile-bottom-nav\.survey-enabled \{ grid-template-columns:repeat\(5,1fr\); \}/);
  assert.match(html, /id="surveyCapturePanel"/);
  assert.match(extract(html, 'captureSurveyLocation'), /enableHighAccuracy:true/);
  assert.match(extract(html, '_setDataEntryMode'), /setAttribute\('capture', 'environment'\)/);
  assert.match(extract(html, '_draftStorageKey'), /baseKey \+ ':survey'/);
  assert.match(extract(html, 'submitFieldSurvey'), /findDuplicateCandidates/);
  assert.match(extract(html, 'submitFieldSurvey'), /_persistFieldSurvey\('submit'/);
});
