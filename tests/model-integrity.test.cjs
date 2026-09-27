const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.join(__dirname, '..');
const backend = fs.readFileSync(path.join(root, 'Backend/Code.gs'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' is missing');
  const body = source.indexOf('{', start);
  let depth = 0, quote = '', comment = '', escaped = false;
  for (let i = body; i < source.length; i++) {
    const c = source[i], next = source[i + 1];
    if (comment === 'line') { if (c === '\n') comment = ''; continue; }
    if (comment === 'block') { if (c === '*' && next === '/') { comment = ''; i++; } continue; }
    if (quote) {
      if (escaped) { escaped = false; continue; }
      if (c === '\\') { escaped = true; continue; }
      if (c === quote) quote = '';
      continue;
    }
    if (c === '/' && next === '/') { comment = 'line'; i++; continue; }
    if (c === '/' && next === '*') { comment = 'block'; i++; continue; }
    if (c === "'" || c === '"' || c === '`') { quote = c; continue; }
    if (c === '{') depth++;
    if (c === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('Unclosed function ' + name);
}

const context = vm.createContext({
  console,
  RALAT_LANDMARKS: { bej: { lat: -6.2247, lng: 106.8090 } },
  RALAT_TAG_MATCHERS: {},
  RALAT_LN_FLOOR_M: 50,
  RALAT_CAP: 0.5,
  _mcRunToken: 0,
  _mcLastResult: { stats: { p50: 1 } },
  _analysisRunToken: 0,
  _analysisReady: true,
  _avmRawData: [{ price: 10 }],
  _avmCurrentMedian: 10,
  currentData: [{ price: 10 }],
  document: {
    getElementById(id) {
      if (id === 'mcResultWrap' || id === 'btnDownloadMCPDF') return { style: { display: 'block' } };
      if (id === 'btnRecalculateAVM') return context.recalculateButton;
      return null;
    }
  }
});
context.recalculateButton = { disabled: true };
for (const name of ['_modelVersionFromId', '_groupRegressionRows']) {
  vm.runInContext(extractFunction(backend, name), context);
}
for (const name of [
  'ralatNormalizeModels', '_ralatFixVarTypes', 'ralatPickLatestVersion',
  'ralatClassifyVar', '_ralatNorm', '_ralatHaversine', '_ralatElCoord', '_ralatMinDistance',
  'ralatFeatureIssue', 'ralatBuildFeatures', '_ralatIsKomersial', '_ralatFindOSMConflicts',
  '_ralatHoldConflictingFeatures', 'ralatEngineV2', '_ralatEscapeHtml',
  '_ralatTraceSource', '_ralatCheckArithmetic', '_ralatCsvCell', '_ralatBuildAuditCsv',
  '_ralatRenderMissing', '_ralatRenderVariableTrace', 'renderRalatAuditSummary',
  'invalidateMonteCarlo', 'markAnalysisStale'
]) {
  // The HTML escaping helper contains quote characters inside regular expressions;
  // the lightweight brace scanner above treats those as string delimiters.
  const source = name === '_ralatEscapeHtml'
    ? html.slice(html.indexOf('function ' + name + '('), html.indexOf('\n}', html.indexOf('function ' + name + '(')) + 2)
    : extractFunction(html, name);
  try { vm.runInContext(source, context); }
  catch (error) { throw new Error('Gagal memuat ' + name + ': ' + error.message, { cause: error }); }
}

// Kamus query RaLAT sengaja terpisah dari POI lingkungan.
const queryRegistry = html.slice(html.indexOf('var RALAT_QUERY_TAGS ='), html.indexOf('function _ralatV2CacheKey('));
vm.runInContext(queryRegistry, context);
vm.runInContext(html.slice(html.indexOf('var RALAT_TAG_MATCHERS ='), html.indexOf('function ralatFeatureIssue(')), context);
for (const name of ['_ralatV2CacheKey', '_ralatV2CacheGet', '_ralatV2CacheSet', '_ralatV2Fetch', '_overpassQuery', '_poiKind', '_poiResults', '_poiEntryHtml', '_poiSubtypeHtml']) {
  vm.runInContext(extractFunction(html, name), context);
}

function row(id, name, variable, coefficient, type = 'ln', label = variable) {
  return [0, id, name, type, label, variable, coefficient];
}

const result = context._groupRegressionRows([
  row('2Jawa Timur20241120', 'Jawa Timur', 'ln_distance_to_mall', -0.212638988),
  row('3Jawa Timur20241120', 'Jawa Timur', 'POI_retail_1000m', 0.006712297162, 'poi', 'jumlah toko retail dalam radius 1 km'),
  row('2Jawa Timur20241213', 'Jawa Timur', 'ln_distance_to_mall', -0.1417004),
  row('0Jawa Timur', 'Jawa Timur', 'const', 20.60380889, 'konstanta'),
  row('4Jawa Timur20241213', 'Jawa Timur', 'ln_distance_to_mall', -0.2)
]);
assert.equal(result.models['Jawa Timur']['20241120'].POI_retail_1000m.koefisien, 0.006712297162);
assert.equal(result.models['Jawa Timur']['20241120'].POI_retail_1000m.label, 'jumlah toko retail dalam radius 1 km');
assert.equal(result.models['Jawa Timur']['20241120'].POI_retail_1000m.sheetRow, 3);
assert.equal(result.models['Jawa Timur']['20241213'].ln_distance_to_mall.koefisien, -0.1417004);
assert.equal(result.models['Jawa Timur']['20241213'].POI_retail_1000m, undefined);
assert.equal(result.diagnostics.unversionedRows.length, 1);
assert.equal(result.diagnostics.duplicateRows.length, 1);

const normalized = context.ralatNormalizeModels(result.models);
const selectedVersion = context.ralatPickLatestVersion(normalized['Jawa Timur']);
assert.equal(selectedVersion, '20241213');
assert.equal(Object.keys(normalized['Jawa Timur'][selectedVersion]).length, 1);
assert.equal(context.ralatPickLatestVersion({ current: {}, 20241213: {} }), '20241213');
assert.equal(context.ralatPickLatestVersion({ current: {} }), null);

assert.match(context.ralatFeatureIssue('POI_retail_1000m'), /belum dipetakan/);
assert.match(context.ralatFeatureIssue('industrial_area_percentage'), /belum diukur/);
assert.match(context.ralatFeatureIssue('ln_distance_to_jakarta'), /belum terkonfirmasi/);
const bej = context.ralatBuildFeatures(
  { lat: -6.3, lng: 106.8 }, {}, { near: [], far: [], nearAvailable: true, farAvailable: true },
  { bestCity: 'Jakarta Selatan' },
  { ln_distance_to_BEJ: { tipe: 'ln', koefisien: -0.5 } }
);
assert.ok(bej.ln_distance_to_BEJ > 0, 'BEJ landmark should be recognized case insensitively');

const unknownUse = context.ralatBuildFeatures(
  { lat: -6.3, lng: 106.8 }, { peruntukan: '' },
  { near: [], far: [], nearAvailable: true, farAvailable: true },
  { bestCity: 'Jakarta Selatan' },
  { is_komersial: { tipe: 'marking', koefisien: 0.2 } }
);
assert.equal(unknownUse.is_komersial, undefined, 'Unknown use must not be classified as non-commercial');
const unknownShape = context.ralatBuildFeatures(
  { lat: -6.3, lng: 106.8 }, { bentuk: '', posisi: '' },
  { near: [], far: [], nearAvailable: true, farAvailable: true },
  { bestCity: 'Jakarta Selatan' },
  { tapak_beraturan: { tipe: 'marking', koefisien: 0.2 }, is_hook: { tipe: 'marking', koefisien: 0.2 } }
);
assert.equal(unknownShape.tapak_beraturan, undefined);
assert.equal(unknownShape.is_hook, undefined);

const coverage = context.ralatEngineV2(
  { ln_distance_to_BEJ: { tipe: 'ln', koefisien: -0.5 }, POI_retail_1000m: { tipe: 'poi', koefisien: 0.02 } },
  { ln_distance_to_BEJ: 500 }, { ln_distance_to_BEJ: 1000 }
).coverage;
assert.equal(coverage.used, 1);
assert.equal(coverage.total, 2);
assert.equal(coverage.skipped[0].name, 'POI_retail_1000m');
const retailModel = { POI_retail_1000m: result.models['Jawa Timur']['20241120'].POI_retail_1000m };
const retailCoverage = context.ralatEngineV2(retailModel, {}, {}).coverage;
assert.equal(retailCoverage.skipped[0].label, 'jumlah toko retail dalam radius 1 km');
assert.equal(retailCoverage.skipped[0].sheetRow, 3);
assert.match(context._ralatRenderMissing({ coverage: retailCoverage }), /Model_Regresi!3/);
assert.match(context._ralatRenderMissing({ coverage: retailCoverage }), /belum dipetakan/);
assert.match(context._ralatRenderMissing({ coverage: { used: 0, total: 1, skipped: [
  { name: 'POI_retail_1000m', label: '<img src=x onerror="x">', reason: 'Definisi belum tersedia' }
] } }), /&lt;img src=x onerror=&quot;x&quot;&gt;/);

// Hitungan manual Sumatra 20241213: 100 m vs 200 m ke jalan utama dan ROW 8 vs 6 m.
const betaRoad = -0.04100143518, betaRow = 0.04002363823;
const aset = { ln_distance_to_road: 100, lebar_jalan_di_depan_adj: 8 };
const comp = { ln_distance_to_road: 200, lebar_jalan_di_depan_adj: 6 };
const audit = context.ralatEngineV2({
  ln_distance_to_road: { tipe: 'ln', koefisien: betaRoad },
  lebar_jalan_di_depan_adj: { tipe: 'numerik', koefisien: betaRow }
}, aset, comp);
const expected = betaRoad * Math.log(100 / 200) + betaRow * (8 - 6);
assert.ok(Math.abs(audit.adjPct - expected) < 1e-12);
assert.ok(Math.abs(audit.adjPct - 0.10846730565392834) < 1e-12);
assert.ok(Math.abs(audit.breakdown.find(b => b.var === 'ln_distance_to_road').kontribPct - 0.028420029193928352) < 1e-12);
assert.ok(Math.abs(audit.breakdown.find(b => b.var === 'lebar_jalan_di_depan_adj').kontribPct - 0.08004727646) < 1e-12);
assert.ok(Math.abs(Math.expm1(expected) - expected) > 0.006, 'Konversi exp(Δ)−1 berbeda dari implementasi saat ini; perlu spesifikasi model');
assert.ok(Math.abs(1000000 * (1 + audit.adjPct) - 1108467.3) < 1);
// Angka yang tampak pada Audit Sumatra: cocokkan dua kontribusi yang terlihat
// dengan koefisien baris 586 dan 592, tanpa menganggap model asli tervalidasi.
const observedAudit = context.ralatEngineV2({
  ln_distance_to_big_city: { tipe:'ln', koefisien:-0.2380993745 },
  ln_luas_tanah: { tipe:'ln', koefisien:-0.1339430666 }
}, { ln_distance_to_big_city:2306.2023, ln_luas_tanah:5.8579332 },
   { ln_distance_to_big_city:750.40943, ln_luas_tanah:6.6995003 });
assert.ok(Math.abs(observedAudit.breakdown.find(b => b.var === 'ln_distance_to_big_city').kontribPct + 0.26732) < 0.00002);
assert.ok(Math.abs(observedAudit.breakdown.find(b => b.var === 'ln_luas_tanah').kontribPct - 0.11272) < 0.00002);
const manualPair = Object.assign({}, audit, { priceObserved:1000000, priceAfterTime:1000000,
  price:1000000 * (1 + audit.adjPct), id:'DP-1' });
assert.equal(context._ralatCheckArithmetic(manualPair).status, 'sesuai');
assert.equal(context._ralatCheckArithmetic(Object.assign({}, manualPair, { price:1100000 })).status, 'selisih');
assert.equal(context._ralatCheckArithmetic(Object.assign({}, manualPair, { rawAdjPct:audit.rawAdjPct + 0.01 })).status, 'selisih');
const reviewCsv = context._ralatBuildAuditCsv([Object.assign({}, manualPair, { coverage:{
  used:2, total:3, skipped:[{ name:'POI_retail_1000m', label:'retail', sheetRow:460,
    reason:'Definisi; belum tersedia' }] } })], { region:'Sumatra', version:'20241213' });
assert.match(reviewCsv, /^\ufeffsep=;/);
assert.equal((reviewCsv.match(/\r\n/g) || []).length, 5, 'Header, dua variabel terhitung dan satu dilewati');
assert.match(reviewCsv, /"POI_retail_1000m"/);
assert.match(reviewCsv, /"Definisi; belum tersedia"/);
assert.match(reviewCsv, /"sesuai"/);
const reviewRows = reviewCsv.slice(1).split('\r\n').slice(1, -1);
const countFields = line => (line.match(/(?:^|;)(?:"(?:[^"]|"")*"|[^;]*)/g) || []).length;
assert.deepEqual(reviewRows.map(countFields), [25, 25, 25, 25], 'Setiap baris CSV mengikuti 25 kolom header');
assert.match(context._ralatCsvCell('=HYPERLINK("https://x")'), /^"'=HYPERLINK\(""https:\/\/x""\)"$/);
assert.ok(Math.abs(audit.breakdown.find(b => b.var === 'ln_distance_to_road').delta - Math.log(0.5)) < 1e-12);
const floor = context.ralatEngineV2({ ln_distance_to_road: { tipe: 'ln', koefisien: betaRoad } },
  { ln_distance_to_road: 5 }, { ln_distance_to_road: 50 });
assert.equal(floor.adjPct, 0, 'Jarak di bawah batas 50 m dihitung sebagai 50 m');
assert.equal(floor.breakdown[0].asetVal, 5);
assert.equal(floor.breakdown[0].asetUsed, 50);
const capped = context.ralatEngineV2({ width: { tipe: 'numerik', koefisien: 1 } },
  { width: 3 }, { width: 1 });
assert.equal(capped.rawAdjPct, 2);
assert.equal(capped.adjPct, 0.5);
assert.equal(capped.capped, true);
const inverse = context.ralatEngineV2({
  ln_distance_to_road: { tipe: 'ln', koefisien: betaRoad },
  lebar_jalan_di_depan_adj: { tipe: 'numerik', koefisien: betaRow }
}, comp, aset);
assert.ok(Math.abs(inverse.adjPct + audit.adjPct) < 1e-12);

// Jarak jalan yang diaudit harus menunjuk ke fitur OSM yang benar-benar dipakai.
context.RALAT_TAG_MATCHERS.ln_distance_to_road = t => ['primary', 'trunk', 'motorway'].includes(t.highway);
const trace = {};
const roadFeatures = context.ralatBuildFeatures({ lat: -6.2, lng: 106.8 }, {}, {
  near: [{ type: 'way', id: 423, tags: { highway: 'primary' }, center: { lat: -6.2, lon: 106.801 } }],
  far: [], nearAvailable: true, farAvailable: true,
  nearMeta:{ osmTimestamp:'2026-09-27T02:00:00Z',fetchedAt:Date.UTC(2026,8,27),fromCache:true }
}, {}, { ln_distance_to_road: { tipe: 'ln', koefisien: betaRoad } }, trace, 'aset');
assert.ok(roadFeatures.ln_distance_to_road > 0);
assert.equal(trace.ln_distance_to_road.osmId, 423);
assert.match(context._ralatTraceSource(trace.ln_distance_to_road), /OSM way\/423/);
assert.match(context._ralatTraceSource(trace.ln_distance_to_road), /highway=primary/);
assert.match(context._ralatTraceSource(trace.ln_distance_to_road), /ke -6\.200000,106\.801000/);
assert.match(context._ralatTraceSource(trace.ln_distance_to_road), /basis OSM 2026-09-27T02:00:00Z/);
assert.match(context._ralatTraceSource(trace.ln_distance_to_road), /cache RaLAT/);
// Satu node kota dari dua cache berbeda: jangan memilih koordinat yang kebetulan datang dahulu.
const cityModel = { ln_distance_to_big_city:{ tipe:'ln', koefisien:-0.2380993745 },
  lebar_jalan_di_depan_adj:{ tipe:'numerik', koefisien:betaRow } };
function cityTrace(lat, lng, stamp) {
  return { source:'OpenStreetMap via Overpass',osmType:'node',osmId:544519673,
    featureLat:lat,featureLng:lng,osmTimestamp:stamp,fetchedAt:Date.UTC(2026,8,27),fromCache:true };
}
const assetTrace = { ln_distance_to_big_city:cityTrace(-5.429386,105.262617,'2026-09-27T01:00:00Z') };
const compareTrace = { ln_distance_to_big_city:cityTrace(-5.446071,105.264374,'2026-09-27T02:00:00Z') };
const consistentTrace = { ln_distance_to_big_city:cityTrace(-5.429386,105.262617,'2026-09-27T01:00:00Z') };
assert.equal(context._ralatFindOSMConflicts([assetTrace,consistentTrace]).conflicts.length,0);
const anotherCity = { ln_distance_to_big_city:Object.assign({},compareTrace.ln_distance_to_big_city,{osmId:77}) };
assert.equal(context._ralatFindOSMConflicts([assetTrace,anotherCity]).conflicts.length,0,
  'Dua kota berbeda boleh memiliki koordinat berbeda');
const conflict = context._ralatFindOSMConflicts([assetTrace,compareTrace,consistentTrace]);
assert.equal(conflict.conflicts.length,1);
assert.match(conflict.variables.ln_distance_to_big_city,/node\/544519673/);
assert.match(conflict.variables.ln_distance_to_big_city,/1865 m/);
const assetFeats = { ln_distance_to_big_city:4740.3461, lebar_jalan_di_depan_adj:9 };
const prepped = [
  { compFeats:{ ln_distance_to_big_city:6173.6618, lebar_jalan_di_depan_adj:6 }, compTrace:compareTrace },
  { compFeats:{ ln_distance_to_big_city:4743.8239, lebar_jalan_di_depan_adj:6 }, compTrace:consistentTrace }
];
context._ralatHoldConflictingFeatures(assetFeats,assetTrace,prepped,conflict);
assert.equal(assetFeats.ln_distance_to_big_city,undefined);
assert.ok(prepped.every(p => p.compFeats.ln_distance_to_big_city === undefined));
const held = context.ralatEngineV2(cityModel,assetFeats,prepped[0].compFeats,assetTrace,prepped[0].compTrace);
assert.equal(held.coverage.used,1);
assert.equal(held.coverage.total,2);
assert.match(held.coverage.skipped[0].reason,/Konflik titik OSM/);
assert.match(context._ralatRenderMissing({coverage:held.coverage}),/Konflik titik OSM/);
assert.ok(Math.abs(held.adjPct - betaRow*3)<1e-12);
const heldCsv = context._ralatBuildAuditCsv([{ id:'DP1',priceObserved:1000000,priceAfterTime:1000000,
  price:1000000*(1+held.adjPct),rawAdjPct:held.rawAdjPct,adjPct:held.adjPct,
  capped:false,breakdown:held.breakdown,coverage:held.coverage,asetTrace:assetTrace,
  compTrace:prepped[0].compTrace }],{region:'Sumatra',version:'20241213'});
assert.match(heldCsv,/"dilewati";"";"ln_distance_to_big_city"/);
assert.match(heldCsv,/basis OSM 2026-09-27T02:00:00Z/);
assert.match(heldCsv,/"Konflik titik OSM node\/544519673/);
assert.deepEqual(heldCsv.slice(1).split('\r\n').slice(1,-1).map(line =>
  (line.match(/(?:^|;)(?:"(?:[^"]|"")*"|[^;]*)/g)||[]).length),[25,25,25]);
// Lima pembanding dari contoh Audit Sumatra: bila node kota bertentangan,
// seluruh kontribusi kota ditahan dan median mengikuti harga baru.
const observedFive = [
  [1274042.21767317, .16199181131205015, .06290156728210107],
  [1022191.25352134, .05584852126273851, .08041863916374646],
  [1922039.352345919, .25833396130978303, .06671294067978259],
  [2022334.9857512214, .15200500120950805, .0001746168559977283],
  [1910128.5657013597, .2969449700718857, .07654366409329821]
];
const afterHold = observedFive.map(([timePrice, oldAdjustment, cityContribution]) =>
  Math.round(timePrice * (1 + oldAdjustment - cityContribution))).sort((a,b)=>a-b);
assert.equal(afterHold[2],2290342,'Median contoh berubah ketika fitur kota yang bertentangan ditahan');
assert.match(context._ralatEscapeHtml('<img src=x onerror="x">'), /&lt;img src=x onerror=&quot;x&quot;&gt;/);
const missingTrace = {};
context.ralatBuildFeatures({ lat: -6.2, lng: 106.8 }, {},
  { near: [], far: [], nearAvailable: false, farAvailable: false }, {},
  { ln_distance_to_road: { tipe: 'ln', koefisien: betaRoad } }, missingTrace, 'aset');
const missingRoad = context.ralatEngineV2({ ln_distance_to_road: { tipe: 'ln', koefisien: betaRoad } },
  {}, { ln_distance_to_road: 200 }, missingTrace, {});
assert.match(missingRoad.coverage.skipped[0].reason, /Layanan peta/);
const emptyTrace = {};
context.ralatBuildFeatures({ lat: -6.2, lng: 106.8 }, {},
  { near: [], far: [], nearAvailable: true, farAvailable: true }, {},
  { ln_distance_to_road: { tipe: 'ln', koefisien: betaRoad } }, emptyTrace, 'aset');
assert.match(emptyTrace.ln_distance_to_road.missingReason, /tidak ditemukan/);
const markup = context._ralatRenderVariableTrace({ breakdown: [Object.assign({}, audit.breakdown[0], {
  label: 'jarak ke jalan utama', sheetRow: 597,
  asetTrace: trace.ln_distance_to_road,
  compTrace: trace.ln_distance_to_road
})] });
assert.match(markup, /Rincian rumus/);
assert.match(markup, /OSM way\/423/);
assert.match(markup, /Model_Regresi!597/);

// Screenshot kasus Sumatra: jarak tercatat 17,27 m, tetapi rumus memakai 50 m.
const screenshotRoad = context.ralatEngineV2({ ln_distance_to_road: {
  tipe: 'ln', koefisien: betaRoad, label: 'jarak ke jalan utama', sheetRow: 597
} }, { ln_distance_to_road: 17.274647 }, { ln_distance_to_road: 262.08696 });
const roadBreakdown = screenshotRoad.breakdown[0];
assert.equal(roadBreakdown.asetUsed, 50);
assert.equal(roadBreakdown.compUsed, 262.08696);
assert.ok(Math.abs(roadBreakdown.delta - (Math.log(50) - Math.log(262.08696))) < 1e-12);
assert.ok(Math.abs(roadBreakdown.kontribPct - 0.06793) < 0.00001);
assert.match(context._ralatRenderVariableTrace({ breakdown: screenshotRoad.breakdown }), /Batas minimum 50 m: jarak yang masuk rumus/);
assert.match(context._ralatRenderVariableTrace({ breakdown: screenshotRoad.breakdown }), /Aset 50\.000000 m/);

const compCategoryTrace = {};
const asetCategoryTrace = {};
const categoryModel = { is_komersial: { tipe: 'marking', koefisien: 0.4960917532, label: 'penggunaan komersial', sheetRow: 594 } };
const asetCategory = context.ralatBuildFeatures({ lat: -6.2, lng: 106.8 },
  { peruntukan: 'Pemukiman' }, {}, {}, categoryModel, asetCategoryTrace, 'aset');
const compCategory = context.ralatBuildFeatures({ lat: -6.2, lng: 106.8 },
  { peruntukan: 'Perdagangan dan Jasa', objek: 'Ruko' }, {}, {}, categoryModel, compCategoryTrace, 'pembanding');
const categoryBreakdown = context.ralatEngineV2(categoryModel, asetCategory, compCategory,
  asetCategoryTrace, compCategoryTrace).breakdown[0];
assert.equal(categoryBreakdown.kontribPct, -0.4960917532);
assert.match(context._ralatTraceSource(categoryBreakdown.compTrace), /peruntukan=Perdagangan dan Jasa/);
assert.match(context._ralatTraceSource(categoryBreakdown.compTrace), /jenis properti=Ruko/);

// Bila halaman sudah baru, beri tanda bila deployment backend masih tanpa metadata PR #22.
const summary = { innerHTML: '', classList: { add() {} } };
const originalGetElementById = context.document.getElementById;
context.document.getElementById = id => id === 'ralatAuditSummary' ? summary : originalGetElementById(id);
context.window = { regressionModels: { Sumatra: { 20241213: { is_komersial: { koefisien: 0.4960917532 } } } } };
context._ralatLastRun = { region: 'Sumatra', version: '20241213' };
context._modelDiagnostics = {};
context._avmRawData = [{ coverage: { used: 1, total: 1, skipped: [] } }];
context.renderRalatAuditSummary();
assert.match(summary.innerHTML, /Label dan nomor baris model belum diterima dari backend/);
context.window.regressionModels.Sumatra[20241213].is_komersial.sheetRow = 594;
context.renderRalatAuditSummary();
assert.doesNotMatch(summary.innerHTML, /Label dan nomor baris model belum diterima dari backend/);
context.document.getElementById = originalGetElementById;

context.invalidateMonteCarlo();
assert.equal(context._mcLastResult, null);
assert.equal(context._mcRunToken, 1);
context._mcLastResult = { stats: { p50: 10 } };
context.markAnalysisStale();
assert.equal(context._analysisReady, false);
assert.equal(context._avmCurrentMedian, 0);
assert.equal(context._mcLastResult, null);
assert.equal(context._analysisRunToken, 1);
assert.equal(context.recalculateButton.disabled, false, 'Editing target must enable a re-run inside modal');
// Model yang hanya punya variabel input aset tidak perlu memanggil Overpass.
const manualOnly = context._ralatV2QueryParts({ ln_luas_tanah: {}, is_komersial: {} });
assert.equal(manualOnly.near.length, 0);
assert.equal(manualOnly.far.length, 0);
const sumatraTags = context._ralatV2QueryParts({
  ln_distance_to_road: {}, ln_distance_to_bus_stop: {}, POI_hospital_1000m: {},
  ln_distance_to_big_city: {}, POI_retail_1000m: {}, is_komersial: {}
});
assert.ok(sumatraTags.near.includes('way["highway"~"^(primary|trunk|motorway)$"]'));
assert.ok(sumatraTags.near.includes('node["amenity"="hospital"]'));
assert.ok(sumatraTags.near.includes('node["highway"="bus_stop"]'));
assert.ok(!sumatraTags.near.includes('node["amenity"="clinic"]'));
assert.ok(!sumatraTags.near.includes('node["amenity"="school"]'));
assert.equal(sumatraTags.far.length, 1);
assert.equal(sumatraTags.far[0], 'node["place"="city"]');
assert.match(context._ralatV2Query(-6.2, 106.8, 5000, sumatraTags.near), /around:5000,-6\.2,106\.8/);
assert.notEqual(context._ralatV2CacheKey(-6.2, 106.8, 5000, 'near', 'Sumatra:20241213', sumatraTags.near),
  context._ralatV2CacheKey(-6.2, 106.8, 5000, 'near', 'Sumatra:20241202', sumatraTags.near));
assert.match(context.ralatFeatureIssue('POI_hospital_6000m'), /melebihi/);

// POI lingkungan mencari area dan halte/klinik tanpa memasukkannya ke query RaLAT.
assert.match(context._overpassQuery(-6.2, 106.8, 5000), /nwr\["amenity"="clinic"\]/);
assert.match(context._overpassQuery(-6.2, 106.8, 5000), /nwr\["amenity"="place_of_worship"\]/);
const poiGroups = context._poiResults([
  { type:'node', id:1, lat:-6.2, lon:106.801, tags:{ amenity:'clinic', name:'Puskesmas Melati' } },
  { type:'way', id:2, center:{ lat:-6.2, lon:106.802 }, tags:{ amenity:'hospital', name:'RS Melati' } },
  { type:'node', id:3, lat:-6.2, lon:106.803, tags:{ amenity:'hospital', name:'RS Melati' } },
  { type:'way', id:4, center:{ lat:-6.2, lon:106.804 }, tags:{ amenity:'place_of_worship', religion:'hindu', name:'Pura Melati' } }
], -6.2, 106.8, 5000);
assert.equal(poiGroups.Kesehatan['Puskesmas (berdasarkan nama)'].length, 1);
assert.equal(poiGroups.Kesehatan['Rumah sakit'].length, 2);
assert.equal(poiGroups.Peribadatan.Pura[0].type, 'way');
assert.equal(poiGroups.Peribadatan.Pura[0].approximate, true);
const manyHospitals = Array.from({ length: 5 }, (_, n) => ({
  type:'node', id:100 + n, lat:-6.2, lon:106.801 + n * 0.001,
  tags:{ amenity:'hospital', name: n === 4 ? '<img src=x onerror=alert(1)>' : 'RS Nomor ' + n }
}));
const allHospitals = context._poiResults(manyHospitals, -6.2, 106.8, 2500).Kesehatan['Rumah sakit'];
const expandedList = context._poiSubtypeHtml('Rumah sakit', allHospitals);
assert.match(expandedList, /Rumah sakit \(5\)/);
assert.match(expandedList, /Tampilkan 2 fasilitas lainnya/);
assert.equal((expandedList.match(/class="poi-entry"/g) || []).length, 5, 'Seluruh hasil POI dapat ditampilkan');
assert.ok(expandedList.indexOf('RS Nomor 0') < expandedList.indexOf('RS Nomor 3'));
assert.match(expandedList, /&lt;img src=x onerror=alert\(1\)&gt;/);
assert.doesNotMatch(expandedList, /<img src=x/);
assert.doesNotMatch(context._poiSubtypeHtml('Rumah sakit', allHospitals.slice(0, 3)), /poi-more/);
assert.ok(Object.keys(context.RALAT_TAG_MATCHERS).every(k => !!context.RALAT_QUERY_TAGS[k]),
  'Setiap matcher jarak berbasis OSM harus memiliki definisi query');

const saved = new Map(), requested = [];
context.OVERPASS_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
context.localStorage = {
  getItem: k => saved.get(k) || null,
  setItem: (k, v) => saved.set(k, v),
  get length() { return saved.size; },
  key: n => Array.from(saved.keys())[n],
  removeItem: k => saved.delete(k)
};
context._overpassFetchWithFallback = query => {
  requested.push(query);
  return Promise.resolve({ osm3s:{timestamp_osm_base:'2026-09-27T02:00:00Z'},
    elements:query.includes('place"="city')
      ? [{ type:'node',id:544519673,lat:-5.429386,lon:105.262617,tags:{place:'city'} }]
      : [] });
};
(async () => {
  await context._ralatV2Fetch(-6.2, 106.8, { ln_luas_tanah: {} }, 'Sumatra:20241213');
  assert.equal(requested.length, 0, 'Model non-spasial tidak meminta Overpass');
  await context._ralatV2Fetch(-6.2, 106.8, { POI_hospital_1000m: {} }, 'Sumatra:20241213');
  assert.equal(requested.length, 1, 'Model radius dekat tidak meminta pencarian 20 km');
  assert.match(requested[0], /amenity"="hospital/);
  assert.doesNotMatch(requested[0], /amenity"="clinic/);
  await context._ralatV2Fetch(-6.2, 106.8, { POI_hospital_1000m: {} }, 'Sumatra:20241213');
  assert.equal(requested.length, 1, 'Query identik memakai cache');
  const freshCity = await context._ralatV2Fetch(-6.2, 106.8, { ln_distance_to_big_city: {} }, 'Sumatra:20241213');
  assert.equal(requested.length, 2);
  assert.match(requested[1], /around:20000/);
  assert.equal(freshCity.farMeta.osmTimestamp,'2026-09-27T02:00:00Z');
  assert.equal(freshCity.farMeta.fromCache,false);
  assert.equal(freshCity.far[0].id,544519673);
  const cachedCity = await context._ralatV2Fetch(-6.2, 106.8, { ln_distance_to_big_city: {} }, 'Sumatra:20241213');
  assert.equal(requested.length,2,'Data dengan waktu basis OSM tetap menggunakan cache RaLAT');
  assert.equal(cachedCity.farMeta.osmTimestamp,freshCity.farMeta.osmTimestamp);
  assert.equal(cachedCity.farMeta.fromCache,true);
  console.log('POI terpisah, query RaLAT per model, cache, rumus manual, dan audit: OK');
})().catch(error => { console.error(error); process.exitCode = 1; });
