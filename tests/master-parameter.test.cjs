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
  let depth = 0, quote = '', escaped = false, comment = '';
  for (let i = body; i < source.length; i++) {
    const char = source[i], next = source[i + 1];
    if (comment === 'line') { if (char === '\n') comment = ''; continue; }
    if (comment === 'block') { if (char === '*' && next === '/') { comment = ''; i++; } continue; }
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === '/' && next === '/') { comment = 'line'; i++; continue; }
    if (char === '/' && next === '*') { comment = 'block'; i++; continue; }
    if (char === "'" || char === '"' || char === '`') { quote = char; continue; }
    if (char === '{') depth++;
    if (char === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('Unclosed function ' + name);
}

assert.match(backend, /const PARAMETER_SHEET = "Master_Parameter"/);
assert.match(backend, /if \(action === 'getFilterOptions'\)/);
assert.match(backend, /if \(action === 'getMasterParameters'\)/);
assert.match(backend, /if \(action === 'saveMasterParameters'\)/);
assert.match(backend, /_requireSuperadmin_\(activeUser\)/,
  'Backend must enforce Superadmin instead of relying only on a hidden button');
assert.match(backend, /row\[22 \+ offset\]/,
  'Automatic years must support the legacy split-coordinate layout');
assert.doesNotMatch(backend, /\["TAHUN_DATA"/,
  'Years are derived from Waktu Data, not maintained as manual parameters');

const context = vm.createContext({
  PARAMETER_CATEGORIES: ['JENIS_PROPERTI', 'HAK_KEPEMILIKAN', 'JENIS_DATA']
});
for (const name of [
  '_defaultMasterParameters_', '_parameterIsActive_', '_normalizeMasterParameterRows_',
  '_groupActiveParameterOptions_', '_prepareMasterParametersForSave_'
]) {
  vm.runInContext(extractFunction(backend, name), context);
}

const rows = context._normalizeMasterParameterRows_(context._defaultMasterParameters_());
const grouped = context._groupActiveParameterOptions_(rows);
assert.equal(rows.length, 16);
assert.equal(grouped.jenisProperti.length, 4);
assert.equal(grouped.hakKepemilikan.length, 9);
assert.equal(grouped.jenisData.length, 3);

const disabled = rows.map(row => ({ ...row }));
disabled.find(row => row.value === 'Ruko').active = false;
assert.equal(context._groupActiveParameterOptions_(disabled).jenisProperti.length, 3,
  'Inactive values must disappear from filter and input options');

assert.throws(
  () => context._prepareMasterParametersForSave_(rows.concat([{ ...rows[0] }])),
  /duplikat/i,
  'Duplicate stored values must be rejected'
);
assert.throws(
  () => context._prepareMasterParametersForSave_(rows.map(row => ({
    ...row,
    active: row.category === 'JENIS_PROPERTI' ? false : row.active
  }))),
  /minimal satu/i,
  'Each category must keep one active value'
);

assert.equal((html.match(/id="btnParameters"/g) || []).length, 1);
assert.equal((html.match(/id="btnParametersMobile"/g) || []).length, 1);
assert.equal((html.match(/id="parameterOverlay"/g) || []).length, 1);
assert.match(html, /role === 'Superadmin' \? '' : 'none'/);
assert.match(html, /\.getFilterOptions\(\);/);
assert.match(html, /\.getMasterParameters\(activeUsername\)/);
assert.match(html, /\.saveMasterParameters\(payload, activeUsername\)/);
assert.match(html, /_renderYearFilter_\(result\.years \|\| \[\]\)/);
assert.match(html, /_renderDynamicSelect_\('f_objek'/);
assert.match(html, /_renderDynamicSelect_\('f_legalitas'/);
assert.match(html, /_renderDynamicSelect_\('f_statusHarga'/);
assert.match(html, /Nilai Tersimpan pada parameter lama dikunci/);
assert.match(html, /loadFilterOptions\(\);\s+doSearch\(\);/,
  'Saving data must refresh automatic year options');

console.log('Master Parameter, Superadmin guard, dynamic filter/form, and automatic years validated.');
