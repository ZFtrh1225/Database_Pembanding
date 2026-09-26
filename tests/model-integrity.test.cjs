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
  'ralatClassifyVar', '_ralatNorm', '_ralatHaversine', 'ralatFeatureIssue',
  'ralatBuildFeatures', 'ralatEngineV2', 'invalidateMonteCarlo', 'markAnalysisStale'
]) {
  vm.runInContext(extractFunction(html, name), context);
}

function row(id, name, variable, coefficient, type = 'ln') {
  return [0, id, name, type, variable, variable, coefficient];
}

const result = context._groupRegressionRows([
  row('2Jawa Timur20241120', 'Jawa Timur', 'ln_distance_to_mall', -0.212638988),
  row('3Jawa Timur20241120', 'Jawa Timur', 'POI_retail_1000m', 0.006712297162, 'poi'),
  row('2Jawa Timur20241213', 'Jawa Timur', 'ln_distance_to_mall', -0.1417004),
  row('0Jawa Timur', 'Jawa Timur', 'const', 20.60380889, 'konstanta'),
  row('4Jawa Timur20241213', 'Jawa Timur', 'ln_distance_to_mall', -0.2)
]);
assert.equal(result.models['Jawa Timur']['20241120'].POI_retail_1000m.koefisien, 0.006712297162);
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
console.log('Model versioning, feature coverage, and simulation invalidation: OK');
