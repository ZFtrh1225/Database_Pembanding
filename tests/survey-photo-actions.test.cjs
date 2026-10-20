const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
function extract(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' missing');
  const body = html.indexOf('{', start);
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = body; i < html.length; i++) {
    const c = html[i], next = html[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && next === '/') { i++; comment = ''; } continue; }
    if (quote) { if (escaped) escaped = false; else if (c === '\\') escaped = true; else if (c === quote) quote = ''; continue; }
    if (c === '/' && next === '/') { i++; comment = 'line'; continue; }
    if (c === '/' && next === '*') { i++; comment = 'block'; continue; }
    if (c === '"' || c === "'" || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return html.slice(start, i + 1);
  }
  throw new Error(name + ' unclosed');
}

function setup() {
  const nodes = new Map();
  for (const id of ['f_foto', 'fotoSourceChooser', 'btnSubmit', 'btnSubmitSurveyShortcut', 'btnSaveSurveyDraft']) {
    nodes.set(id, {
      attributes:{}, disabled:false, textContent:'', clicks:0, open:true,
      setAttribute(key, value) { this.attributes[key] = value; },
      removeAttribute(key) { delete this.attributes[key]; },
      click() { this.clicks++; }
    });
  }
  const context = vm.createContext({
    document:{ getElementById:id => nodes.get(id) || null },
    _dataEntryMode:'survey', _surveyMeta:{ capturedAt:'2026-10-21', gpsCoordinate:'-6.2,106.8' },
    _surveyOriginalPhotoDataUrl:null, _fotoDataUrl:null,
    validateDataForm:() => true, toast() {}, captureSurveyLocation() {},
    setDataFormStep() {}, setFieldError() {}
  });
  for (const name of ['selectPhotoSource', 'captureSurveyPhoto', '_setSurveyButtonsBusy', 'submitData', 'submitFieldSurvey']) {
    vm.runInContext(extract(name), context);
  }
  return { context, nodes };
}

test('gallery opens the shared picker without capture; Identity shortcut restores rear camera', () => {
  const { context:c, nodes } = setup(), input = nodes.get('f_foto');
  c.captureSurveyPhoto();
  assert.equal(input.attributes.capture, 'environment');
  c.selectPhotoSource('gallery');
  assert.equal(input.attributes.capture, undefined);
  assert.equal(nodes.get('fotoSourceChooser').open, false);
  c.captureSurveyPhoto();
  assert.equal(input.attributes.capture, 'environment');
  assert.equal(input.clicks, 3);
});

test('step 5 camera uses the same picker and invalid sources never open it', () => {
  const { context:c, nodes } = setup();
  c.selectPhotoSource('camera');
  c.selectPhotoSource('invalid');
  assert.equal(nodes.get('f_foto').clicks, 1);
  assert.equal(nodes.get('f_foto').attributes.capture, 'environment');
  c._dataEntryMode = 'standard';
  c.captureSurveyPhoto();
  assert.equal(nodes.get('f_foto').clicks, 1);
});

test('both submission buttons disable and recover together for requests and failures', () => {
  const { context:c, nodes } = setup();
  c._setSurveyButtonsBusy(true, 'Mengajukan…');
  for (const id of ['btnSubmit', 'btnSubmitSurveyShortcut']) {
    assert.equal(nodes.get(id).disabled, true);
    assert.equal(nodes.get(id).textContent, 'Mengajukan…');
    assert.equal(nodes.get(id).attributes['aria-busy'], 'true');
  }
  assert.equal(nodes.get('btnSaveSurveyDraft').disabled, true);
  c._setSurveyButtonsBusy(false);
  for (const id of ['btnSubmit', 'btnSubmitSurveyShortcut']) {
    assert.equal(nodes.get(id).disabled, false);
    assert.equal(nodes.get(id).textContent, '📤 Ajukan Survei');
    assert.equal(nodes.get(id).attributes['aria-busy'], 'false');
  }
});

function clickIdentitySubmit(context) {
  const handler = html.match(/id="btnSubmitSurveyShortcut"[^>]*onclick="([^"]+)"/);
  assert.ok(handler, 'Identity submission shortcut missing');
  vm.runInContext(handler[1], context);
}

test('Identity submission stops at the existing complete-form validation', () => {
  const { context:c } = setup(); let validations = 0;
  c.validateDataForm = () => { validations++; return false; };
  clickIdentitySubmit(c);
  assert.equal(validations, 1);
});

test('Identity submission requires GPS and directs missing photos to step 5', () => {
  const { context:c } = setup(); let gpsRequests = 0, targetStep = null, invalidField = null;
  c.captureSurveyLocation = () => { gpsRequests++; };
  c._surveyMeta.gpsCoordinate = '';
  clickIdentitySubmit(c);
  assert.equal(gpsRequests, 1);
  c._surveyMeta.gpsCoordinate = '-6.2,106.8';
  c.setDataFormStep = step => { targetStep = step; };
  c.setFieldError = field => { invalidField = field; };
  clickIdentitySubmit(c);
  assert.equal(targetStep, 4);
  assert.equal(invalidField, 'f_foto');
});

test('Identity submission uses the existing duplicate review and persistence flow', () => {
  const { context:c, nodes } = setup();
  let checked = 0, persisted = null, success;
  c._surveyMeta.watermarkedPhotoUrl = 'https://example.test/survey.jpg';
  c.activeUsername = 'Surveyor';
  c._buildDataFormRow = () => ['DP1'];
  c._persistFieldSurvey = (action, decision) => { persisted = { action, decision }; };
  const run = {
    withSuccessHandler(fn) { success = fn; return this; },
    withFailureHandler() { return this; },
    findDuplicateCandidates() { checked++; }
  };
  c.GAS = { script:{ run } };
  clickIdentitySubmit(c);
  assert.equal(checked, 1);
  assert.equal(nodes.get('btnSubmitSurveyShortcut').disabled, true);
  success({ success:true, candidates:[] });
  assert.deepEqual(persisted, { action:'submit', decision:null });
});
