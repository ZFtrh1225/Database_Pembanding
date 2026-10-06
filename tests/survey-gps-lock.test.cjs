const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

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

function gpsSelector() {
  const factory = new Function(`
    var SURVEY_GPS_RECENT_WINDOW_MS = 5000;
    var _surveyGpsSamples = [];
    ${extract(html, '_surveyGpsDistanceMeters')}
    ${extract(html, '_surveyGpsIsMoving')}
    ${extract(html, '_selectSurveyGpsSample')}
    return {
      select: function(samples, now) { _surveyGpsSamples = samples; return _selectSurveyGpsSample(now); },
      remaining: function() { return _surveyGpsSamples.slice(); }
    };
  `);
  return factory();
}

test('GPS survei memakai pemantauan kontinu dengan target cepat', () => {
  const capture = extract(html, 'captureSurveyLocation');
  assert.match(capture, /navigator\.geolocation\.watchPosition/);
  assert.doesNotMatch(capture, /getCurrentPosition/);
  assert.match(capture, /enableHighAccuracy:true/);
  assert.match(html, /SURVEY_GPS_NORMAL_WAIT_MS = 12000/);
  assert.match(html, /SURVEY_GPS_GOOD_ACCURACY_M = 10/);
  assert.match(html, /SURVEY_GPS_RECENT_WINDOW_MS = 5000/);
  assert.match(html, /\.survey-gps-button \{ width:100%; min-height:44px; \}/);
});

test('perangkat diam memakai sampel terbaik yang masih baru', () => {
  const gps = gpsSelector(), now = 100000;
  const selected = gps.select([
    { lat:-6.2, lng:106.8, accuracy:14, speed:0, receivedAt:now - 4000 },
    { lat:-6.2, lng:106.8, accuracy:17, speed:0, receivedAt:now - 2000 },
    { lat:-6.2, lng:106.8, accuracy:3, speed:0, receivedAt:now - 100 }
  ], now);
  assert.equal(selected.accuracy, 3);
});

test('sampel lama dibuang dan kendaraan bergerak memakai posisi terbaru', () => {
  const gps = gpsSelector(), now = 200000;
  let selected = gps.select([
    { lat:-6.2, lng:106.8, accuracy:2, speed:0, receivedAt:now - 6000 },
    { lat:-6.2, lng:106.8, accuracy:8, speed:0, receivedAt:now - 100 }
  ], now);
  assert.equal(selected.accuracy, 8);
  assert.equal(gps.remaining().length, 1);

  selected = gps.select([
    { lat:-6.2000, lng:106.8000, accuracy:3, speed:10, receivedAt:now - 2000 },
    { lat:-6.1990, lng:106.8010, accuracy:17, speed:10, receivedAt:now - 50 }
  ], now);
  assert.equal(selected.accuracy, 17);
  assert.equal(selected.lat, -6.1990);
});

test('watch GPS berhenti pada lifecycle yang aman dan watermark disinkronkan', () => {
  assert.match(extract(html, '_stopSurveyGpsWatch'), /clearWatch\(_surveyGpsWatchId\)/);
  assert.match(extract(html, 'closeModal'), /_stopSurveyGpsWatch\('close'\)/);
  assert.match(extract(html, '_persistFieldSurvey'), /_stopSurveyGpsWatch\('save'\)/);
  assert.match(html, /visibilitychange[\s\S]*?_stopSurveyGpsWatch\('hidden'\)[\s\S]*?captureSurveyLocation\(\)/);
  assert.match(extract(html, '_uploadSurveyPhotosIfNeeded'), /_surveyPhotoWatermarkDirty[\s\S]*?_renderSelectedPhoto/);
});
