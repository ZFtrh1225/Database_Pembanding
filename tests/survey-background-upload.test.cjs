const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extract(name) {
  const start = html.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' missing');
  return html.slice(start, html.indexOf('\n}', start) + 2);
}

function setup() {
  const nodes = new Map(), calls = [], events = [], dialogs = [], notices = [], images = [], watermarks = [];
  for (const id of ['surveyUploadTray', 'surveyUploadSummary', 'surveyUploadList', 'modalOverlay', 'fieldSurveyOverlay']) {
    nodes.set(id, { hidden:true, open:false, textContent:'', innerHTML:'', classList:{ contains:() => false } });
  }
  const c = vm.createContext({
    document:{
      getElementById:id => nodes.get(id), body:{ style:{ overflow:'' } },
      querySelector:() => null,
      createElement:() => ({ getContext:() => ({ drawImage() {}, fillRect() {}, fillText:text => watermarks.push(text) }), toDataURL:() => 'rendered-photo' })
    },
    Image:class { constructor() { this.width = 1600; this.height = 900; images.push(this); } },
    _surveyUploadJobs:[], _surveyUploadSequence:0, _surveyUploadRunning:false,
    _surveyOriginalPhotoDataUrl:'original-A', _fotoDataUrl:'photo-A', _surveyPhotoWatermarkDirty:false,
    _dataEntryMode:'survey', activeUsername:'user-A',
    _editingSurveyId:null, _surveyMeta:{ capturedAt:'time-A', gpsCoordinate:'gps-A', gpsAccuracy:4 },
    _buildDataFormRow:() => ['DP1', ...Array(29).fill('')], _formValue:() => '',
    _newGasBridgeNonce:() => 'nonce', _stopSurveyGpsWatch:() => events.push('stop'),
    markDataFormSaved:() => events.push('clear-draft'),
    closeModal:() => { events.push('close'); c._surveyOriginalPhotoDataUrl = null; c._fotoDataUrl = null; },
    _setSurveyButtonsBusy:busy => events.push('busy:' + busy),
    _escapeHtmlAppraisal:s => String(s).replaceAll('<', '&lt;'),
    _formatSurveyTime:s => s,
    loadFieldSurveyCount:() => events.push('count'), loadFieldSurveys:() => events.push('list'),
    toast:(...args) => notices.push(args),
    _showDuplicateCandidates:(...args) => dialogs.push(args)
  });
  c.GAS = { script:{ get run() {
    const run = {
      withSuccessHandler(fn) { this.success = fn; return this; },
      withFailureHandler(fn) { this.failure = fn; return this; }
    };
    for (const name of ['findDuplicateCandidates', 'uploadSurveyPhotos', 'saveFieldSurvey', 'getFieldSurveys']) {
      run[name] = (...args) => calls.push({ name, args:structuredClone(args), success:run.success, failure:run.failure });
    }
    return run;
  } } };
  for (const name of ['_fieldSurveyPayload', '_renderSurveyUploadQueue', '_queueFieldSurvey', '_renderQueuedSurveyPhoto', '_processSurveyUploadQueue', 'retrySurveyUpload', '_persistFieldSurvey']) {
    vm.runInContext(extract(name), c);
  }
  function next(name) {
    const call = calls.shift(); assert.ok(call, name + ' expected'); assert.equal(call.name, name); return call;
  }
  return { c, nodes, calls, events, dialogs, notices, images, watermarks, next };
}

function enqueue(s, id = 'DP1') {
  s.c._buildDataFormRow = () => [id, ...Array(29).fill('')];
  s.c._surveyOriginalPhotoDataUrl = 'original-' + id;
  s.c._fotoDataUrl = 'photo-' + id;
  s.c._persistFieldSurvey('submit', null);
}

test('submission frees the form before any network response and owns a deep snapshot', () => {
  const s = setup();
  const decision = { relationType:'NEW_MARKET_EVENT', reason:'event A' };
  s.c._persistFieldSurvey('submit', decision);
  const job = s.c._surveyUploadJobs[0];
  decision.reason = 'changed'; s.c._surveyMeta.gpsCoordinate = 'gps-B'; s.c.activeUsername = 'user-B';
  assert.equal(job.payload.gpsCoordinate, 'gps-A');
  assert.equal(job.payload.duplicateDecision.reason, 'event A');
  assert.equal(job.original, 'original-A'); assert.equal(job.user, 'user-A');
  assert.deepEqual(s.events, ['stop', 'clear-draft', 'close', 'busy:false']);
  assert.equal(s.next('uploadSurveyPhotos').args[0], 'original-A');
  assert.equal(s.nodes.get('surveyUploadTray').hidden, false);
});

test('two surveys upload serially, keep their own GPS/photos/user, and never reset the new form', () => {
  const s = setup(); enqueue(s);
  const checkA = s.next('findDuplicateCandidates');
  s.c._surveyMeta = { capturedAt:'time-B', gpsCoordinate:'gps-B', gpsAccuracy:7 };
  s.c.activeUsername = 'user-B'; enqueue(s, 'DP2');
  assert.equal(s.calls.length, 0);
  // Simulate a third form being filled while A and B finish.
  const meta = { gpsCoordinate:'gps-C' }; s.c._surveyMeta = meta; s.c._fotoDataUrl = 'photo-C';
  checkA.success({ success:true, candidates:[] });
  const uploadA = s.next('uploadSurveyPhotos');
  assert.equal(uploadA.args[0], 'original-DP1'); assert.equal(uploadA.args[3], 'user-A');
  uploadA.success({ success:true, originalUrl:'original-url-A', watermarkedUrl:'url-A' });
  const saveA = s.next('saveFieldSurvey');
  assert.equal(saveA.args[0].gpsCoordinate, 'gps-A'); assert.equal(saveA.args[0].dataRow[29], 'url-A');
  saveA.success({ success:true });
  s.next('findDuplicateCandidates').success({ success:true, candidates:[] });
  const uploadB = s.next('uploadSurveyPhotos'); assert.equal(uploadB.args[0], 'original-DP2');
  uploadB.success({ success:true, originalUrl:'original-url-B', watermarkedUrl:'url-B' });
  const saveB = s.next('saveFieldSurvey');
  assert.equal(saveB.args[0].gpsCoordinate, 'gps-B'); assert.equal(saveB.args[1], 'user-B');
  saveB.success({ success:true });
  assert.equal(s.c._surveyMeta, meta); assert.equal(s.c._fotoDataUrl, 'photo-C');
  assert.equal(s.events.filter(e => e === 'close').length, 2);
  assert.equal(s.events.includes('list'), false);
  assert.equal(s.c._surveyUploadJobs.length, 0); assert.equal(s.c._surveyUploadRunning, false);
  assert.equal(s.nodes.get('surveyUploadTray').hidden, true);
});

test('failed photo upload retains the photo and lets the next survey proceed; retry ignores live form', () => {
  const s = setup(); enqueue(s); enqueue(s, 'DP2');
  s.next('findDuplicateCandidates').success({ success:true, candidates:[] });
  s.next('uploadSurveyPhotos').failure(new Error('offline'));
  const job = s.c._surveyUploadJobs[0];
  assert.equal(job.status, 'failed'); assert.equal(job.original, 'original-DP1');
  const checkB = s.next('findDuplicateCandidates');
  assert.equal(checkB.args[0][0], 'DP2');
  s.c.retrySurveyUpload(job.id); s.c.retrySurveyUpload(job.id);
  assert.equal(s.calls.length, 0); // no concurrent or duplicate upload
  // Complete B before retry A starts.
  s.c._fotoDataUrl = 'new-form-photo';
  checkB.success({ success:true, candidates:[] });
  s.next('uploadSurveyPhotos').success({ success:true, originalUrl:'original-B', watermarkedUrl:'url-B' });
  s.next('saveFieldSurvey').success({ success:true });
  assert.equal(s.next('uploadSurveyPhotos').args[1], 'photo-DP1');
});

test('save timeout retry checks the stable survey ID and recognizes a committed save', () => {
  const s = setup(); enqueue(s);
  s.next('findDuplicateCandidates').success({ success:true, candidates:[] });
  s.next('uploadSurveyPhotos').success({ success:true, originalUrl:'original-url', watermarkedUrl:'url' });
  const save = s.next('saveFieldSurvey'), id = save.args[0].surveyId;
  save.failure(new Error('timeout'));
  const job = s.c._surveyUploadJobs[0];
  assert.equal(job.original, null); assert.equal(job.payload.watermarkedPhotoUrl, 'url');
  s.c.retrySurveyUpload(job.id);
  s.next('getFieldSurveys').success({ success:true, surveys:[{ surveyId:id, status:'Menunggu Review' }] });
  assert.equal(s.calls.length, 0); assert.equal(s.c._surveyUploadJobs.length, 0);
});

test('retry of an uncommitted save reuses photo URLs and the same survey ID', () => {
  const s = setup(); enqueue(s);
  s.next('findDuplicateCandidates').success({ success:true, candidates:[] });
  s.next('uploadSurveyPhotos').success({ success:true, originalUrl:'original-url', watermarkedUrl:'url' });
  const save = s.next('saveFieldSurvey'), id = save.args[0].surveyId;
  save.success({ success:false, error:'Server busy' });
  s.c.retrySurveyUpload(s.c._surveyUploadJobs[0].id);
  s.next('getFieldSurveys').success({ success:true, surveys:[] });
  const retried = s.next('saveFieldSurvey');
  assert.equal(retried.args[0].surveyId, id); assert.equal(retried.args[0].watermarkedPhotoUrl, 'url');
});

test('duplicate check waits for explicit review without disturbing the active form', () => {
  const s = setup(); enqueue(s); enqueue(s, 'DP2');
  s.next('findDuplicateCandidates').success({ success:true, candidates:[{ id:'DP-old' }] });
  const job = s.c._surveyUploadJobs[0];
  assert.equal(job.status, 'decision'); assert.equal(s.dialogs.length, 0);
  assert.equal(s.next('findDuplicateCandidates').args[0][0], 'DP2');
  s.c.document.querySelector = () => ({});
  s.c.retrySurveyUpload(job.id); assert.equal(s.dialogs.length, 0);
  s.c.document.querySelector = () => null;
  s.c.retrySurveyUpload(job.id); assert.equal(s.dialogs.length, 1);
  s.c.document.body.style.overflow = 'hidden';
  s.dialogs[0][1]({ existingId:'DP-old', reason:'A distinct event' });
  assert.equal(job.payload.duplicateDecision.existingId, 'DP-old');
  assert.equal(s.c.document.body.style.overflow, '');
  assert.equal(job.status, 'queued'); assert.equal(s.calls.length, 0);
});

test('server duplicate response after upload retains URLs for decision and resubmission', () => {
  const s = setup(); enqueue(s);
  s.next('findDuplicateCandidates').success({ success:true, candidates:[] });
  s.next('uploadSurveyPhotos').success({ success:true, originalUrl:'original-url', watermarkedUrl:'url' });
  s.next('saveFieldSurvey').success({ success:false, requiresDuplicateDecision:true, candidates:[{ id:'old' }] });
  const job = s.c._surveyUploadJobs[0]; s.c.retrySurveyUpload(job.id);
  s.dialogs[0][1]({ existingId:'old', reason:'new event' });
  s.next('getFieldSurveys').success({ success:true, surveys:[] });
  const save = s.next('saveFieldSurvey');
  assert.equal(save.args[0].duplicateDecision.existingId, 'old');
  assert.equal(save.args[0].watermarkedPhotoUrl, 'url');
});

test('dirty watermark renders in background from the captured GPS and identity only', () => {
  const s = setup(); s.c._surveyPhotoWatermarkDirty = true; enqueue(s);
  s.next('findDuplicateCandidates').success({ success:true, candidates:[] });
  assert.equal(s.images.length, 1);
  s.c._surveyMeta = { gpsCoordinate:'gps-new' }; s.c.activeUsername = 'new-user'; s.c._fotoDataUrl = 'new-photo';
  s.images[0].onload();
  assert.ok(s.watermarks.includes('SURVEI LAPANGAN · user-A'));
  assert.ok(s.watermarks.includes('time-A · gps-A · ±4 m'));
  assert.equal(s.next('uploadSurveyPhotos').args[1], 'rendered-photo');
  assert.equal(s.c._fotoDataUrl, 'new-photo');
});

test('photo processing and lookup errors retain jobs and release the worker', () => {
  const s = setup(); s.c._surveyPhotoWatermarkDirty = true; enqueue(s);
  s.next('findDuplicateCandidates').success({ success:true, candidates:[] });
  s.images[0].onerror();
  const job = s.c._surveyUploadJobs[0];
  assert.equal(job.status, 'failed'); assert.equal(s.c._surveyUploadRunning, false);
  assert.equal(job.original, 'original-DP1');
  job.saveAttempted = true; s.c.retrySurveyUpload(job.id);
  s.next('getFieldSurveys').failure(new Error('offline'));
  assert.equal(job.status, 'failed'); assert.equal(s.c._surveyUploadRunning, false);
});

test('draft saving continues through its existing foreground persistence', () => {
  const s = setup(); let uploaded = 0;
  s.c._uploadSurveyPhotosIfNeeded = done => { uploaded++; done(); };
  s.c._persistFieldSurvey('draft', null);
  assert.equal(uploaded, 1); assert.equal(s.c._surveyUploadJobs.length, 0);
  assert.equal(s.next('saveFieldSurvey').args[0].action, 'draft');
});

test('leaving warning is limited to unfinished queue entries', () => {
  const s = setup(), handlers = {};
  s.c.window = { addEventListener:(name, fn) => { handlers[name] = fn; } };
  const start = html.indexOf("window.addEventListener('beforeunload'");
  vm.runInContext(html.slice(start, html.indexOf('\n});', start) + 4), s.c);
  let prevented = 0; const event = { preventDefault:() => prevented++ };
  handlers.beforeunload(event); assert.equal(prevented, 0);
  enqueue(s); handlers.beforeunload(event); assert.equal(prevented, 1);
  assert.equal(event.returnValue, '');
});
