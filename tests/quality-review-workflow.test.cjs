const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const backend = fs.readFileSync(path.join(root, 'Backend', 'Code.gs'), 'utf8');

test('review kualitas tersimpan di sheet terpisah dan hanya dapat diedit role berwenang', () => {
  assert.match(backend, /const QUALITY_REVIEW_SHEET = "Quality_Review"/);
  assert.match(backend, /function saveQualityReview\(payload, activeUser\)/);
  assert.match(backend, /role !== "Admin" && role !== "Superadmin"/);
  assert.match(backend, /\["Belum Diverifikasi", "Terverifikasi", "Perlu Verifikasi Ulang"\]/);
  assert.match(backend, /\["Aktif", "Perlu Ditelaah", "Dikecualikan"\]/);
  assert.match(backend, /qualityReview: reviewMap\[_qualityReviewKey_/);
});

test('UI menampilkan rincian skor, profil aset, dan kontrol verifikasi', () => {
  assert.match(html, /id="qualityTargetOverlay"/);
  assert.match(html, /id="qualityReviewOverlay"/);
  assert.match(html, /function getComparabilityMeta\(row, profile\)/);
  assert.match(html, /function _renderQualityBreakdown\(items\)/);
  assert.match(html, /Kandidat kuat/);
  assert.match(html, /skor ini adalah indikator screening internal/);
  assert.match(html, /\.saveQualityReview\(payload, activeUsername\)/);
});

test('data dikecualikan tidak dapat dibandingkan atau dianalisis', () => {
  assert.match(html, /analysisData = currentData\.filter\(function\(row\) \{ return !row\._excluded; \}\)/);
  assert.match(html, /Data dikecualikan tidak dapat dimasukkan ke perbandingan/);
  assert.match(html, /row\._excluded = _getQualityReview\(row\)\.reviewStatus === 'Dikecualikan'/);
  assert.match(html, /calculateSidebarStats\(activeData\)/);
});

