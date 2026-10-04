const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const backend = fs.readFileSync(path.join(__dirname, '..', 'Backend', 'Code.gs'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

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

test('backend menyediakan antrean review khusus Admin dan Superadmin', () => {
  assert.match(backend, /action === 'getDataRelations'/);
  assert.match(backend, /action === 'reviewDataRelation'/);
  const guard = extract(backend, '_requireRelationReviewer_');
  assert.match(guard, /role !== "Admin" && role !== "Superadmin"/);
  assert.match(extract(backend, 'getDataRelations'), /pendingCount/);
  assert.match(extract(backend, 'getDataRelations'), /options && options\.summaryOnly/);
  assert.match(extract(html, 'loadRelationReviewCount'), /summaryOnly:true/);
});

test('sheet relasi menyimpan hasil reviewer dan klasifikasi final', () => {
  const headers = extract(backend, '_dataRelationHeaders_');
  for (const label of ['Jenis Hubungan Final', 'Direview Oleh', 'Waktu Review', 'Catatan Review']) {
    assert.match(headers, new RegExp(label));
  }
  const review = extract(backend, 'reviewDataRelation');
  assert.match(review, /"CONFIRM", "RECLASSIFY", "REJECT"/);
  assert.match(review, /status = "Dikonfirmasi"/);
  assert.match(review, /status = "Ditolak"/);
  assert.doesNotMatch(review, /deleteRow|clearContent/);
});

test('keputusan Surveyor menunggu review sedangkan keputusan Admin langsung dikonfirmasi', () => {
  const record = extract(backend, '_recordDataRelation_');
  assert.match(record, /role === "Surveyor" \? "Menunggu Review" : "Dikonfirmasi"/);
  assert.match(record, /finalRelationType/);
  assert.match(record, /reviewedBy/);
});

test('ruang review membandingkan dua data dan tersedia pada desktop serta mobile', () => {
  assert.match(html, /id="btnRelationReview"/);
  assert.match(html, /id="btnRelationReviewMobile"/);
  assert.match(html, /id="relationReviewOverlay"/);
  assert.match(extract(html, 'applyPermissions'), /role === 'Admin' \|\| role === 'Superadmin'/);
  const card = extract(html, '_relationReviewCard');
  assert.match(card, /Data aktif \/ baru/);
  assert.match(card, /Data existing/);
  assert.match(card, /Klasifikasi akhir/);
  assert.match(html, /\.relation-pair \{ grid-template-columns:1fr; \}/);
});

test('penolakan mempertahankan data utama dan membutuhkan konfirmasi', () => {
  const save = extract(html, 'saveRelationReviewByIndex');
  assert.match(save, /Data utama tetap tersimpan dan tidak akan dihapus/);
  assert.match(save, /reviewDataRelation/);
  assert.doesNotMatch(save, /delete|removeData|editData/);
});
