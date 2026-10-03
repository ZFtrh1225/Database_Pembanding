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

const context = vm.createContext({ DATA_COMPLETENESS_RATIO: 0.70 });
for (const name of ['_parseCoord', '_hasDataInputValue_', '_getDataCompleteness_']) {
  vm.runInContext(extractFunction(backend, name), context);
}

function rowWithFilledInputs(count) {
  const row = Array(27).fill('');
  row[0] = '001'; // ID sistem tidak masuk hitungan.
  for (let i = 1; i <= count; i++) row[i] = 'terisi-' + i;
  return row;
}

let result = context._getDataCompleteness_(rowWithFilledInputs(18));
assert.equal(result.total, 26);
assert.equal(result.minimumFilled, 19);
assert.equal(result.filled, 18);
assert.equal(result.isComplete, false, '18/26 masih di bawah 70%');

result = context._getDataCompleteness_(rowWithFilledInputs(19));
assert.equal(result.filled, 19);
assert.equal(result.isComplete, true, '19/26 adalah batas minimum 70%');

result = context._getDataCompleteness_(rowWithFilledInputs(26));
assert.equal(result.isComplete, true);

const legacy = Array(28).fill('');
legacy[0] = '002';
legacy[3] = '-5.380964';
legacy[4] = '105.284946';
for (let i = 1; i <= 18; i++) {
  if (i !== 3 && i !== 4) legacy[i < 4 ? i : i + 1] = 'terisi-' + i;
}
result = context._getDataCompleteness_(legacy);
assert.equal(result.total, 26, 'Koordinat D/E lama tetap dihitung sebagai satu input');

assert.match(html, /data-val="Semua"[^>]*><input[^>]*value="Semua" checked/);
assert.match(html, /data-val="Lengkap"/);
assert.match(html, /data-val="Tidak Lengkap"/);
assert.match(html, /statusVal === 'Semua'/);
assert.match(backend, /params\.statusData === "Lengkap"/);
assert.match(backend, /params\.statusData === "Tidak Lengkap"/);

console.log('Status data: Semua, Lengkap >=70%, dan Tidak Lengkap <70% tervalidasi.');
