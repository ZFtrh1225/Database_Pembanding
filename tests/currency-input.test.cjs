const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extract(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, name + ' missing');
  const body = source.indexOf('{', start);
  let depth = 0;
  for (let i = body; i < source.length; i++) {
    if (source[i] === '{') depth++;
    if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(name + ' unclosed');
}

test('formatter menerima angka mentah dan format Rupiah yang ditempel', () => {
  const context = {};
  vm.runInNewContext(extract(html, '_formatCurrencyInputValue'), context);
  assert.equal(context._formatCurrencyInputValue('1250000'), '1.250.000');
  assert.equal(context._formatCurrencyInputValue('1.250.000'), '1.250.000');
  assert.equal(context._formatCurrencyInputValue('Rp 1.250.000'), '1.250.000');
  assert.equal(context._formatCurrencyInputValue('1,250,000'), '1.250.000');
  assert.equal(context._formatCurrencyInputValue('0001250000'), '1.250.000');
});

test('Harga dan Indikasi Nilai tidak melewati penyaring digit umum', () => {
  const numericDeclaration = html.match(/var numFields = \[([^\]]+)\]/);
  assert.ok(numericDeclaration);
  assert.doesNotMatch(numericDeclaration[1], /f_harga|f_indikasi/);
  const setup = extract(html, 'setupDataInputFormatting');
  assert.match(setup, /\['f_harga','f_indikasi'\]/);
  assert.match(setup, /_formatCurrencyInputValue\(field\.value\)/);
  assert.doesNotMatch(setup, /Hanya menerima input angka|toast\(/);
});

test('validasi akhir tetap memeriksa kedua kolom mata uang', () => {
  const validation = extract(html, 'validateDataForm');
  assert.match(validation, /'f_harga'/);
  assert.match(validation, /'f_indikasi'/);
  assert.match(validation, /replace\(\/\\\.\/g,''\)/);
});
