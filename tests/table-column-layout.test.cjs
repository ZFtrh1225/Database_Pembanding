const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const expected = [
  'ID', 'Aksi', 'Alamat', 'Kota', 'Legalitas', 'LT (m²)', 'LB (m²)',
  'Harga', 'Ind. Nilai/m²', 'Tipe Bangunan', 'Tipe',
  'Indikasi Transaksi Bangunan (Rp)', 'Indikasi NP Bangunan (Rp/m²)',
  'ROW Jalan (m)', 'Status Harga', 'Waktu Data', 'Sumber'
];

test('judul tabel, label kartu, dan sel data mempunyai urutan yang sama', () => {
  const table = html.match(/<table class="data-table">([\s\S]*?)<\/table>/)[1];
  const headings = Array.from(table.matchAll(/<th(?:\s[^>]*)?>(.*?)<\/th>/g), match => match[1]);
  assert.deepEqual(headings, expected);

  const labelsSource = html.match(/var COL_LABELS = (\[[\s\S]*?\]);/)[1];
  assert.deepEqual(Array.from(vm.runInNewContext(labelsSource)), expected);

  const tbody = { innerHTML: '' };
  const context = {
    document: { getElementById: () => tbody }, activeRole: 'Admin',
    _firstPhoto: () => '', _escapeHtmlAppraisal: value => String(value),
    _isPrimaryCompare: () => false, _sourceVerificationMeta: () => ({ tone: 'good', label: 'Sumber' }),
    formatRupiah: value => String(value), getAgingFlag: () => '', selectProperty: () => {},
    _selectedPropertyUid: null
  };
  const source = html.slice(html.indexOf('function renderTable(data) {'), html.indexOf('\nfunction selectProperty(uid) {'));
  vm.runInNewContext(source, context);
  context.renderTable([{
    id: 'DP1', _uid: 'dp-1', objek: 'Tanah Bangunan', alamat: 'ALAMAT_SAMPLE',
    kota: 'KOTA_SAMPLE', legalitas: 'LEGALITAS_SAMPLE', luasTanah: 101, luasBangunan: 102,
    harga: 103, indikasiNilai: 104, tipeBangunan: 'BANGUNAN_SAMPLE', tipe: 'TIPE_SAMPLE',
    indikasiTransaksiBangunan: 105, indikasiNpBangunan: 106, lebarJalanROW: 107,
    statusHarga: 'STATUS_SAMPLE', waktuData: 'WAKTU_SAMPLE', sumber: 'SUMBER_SAMPLE', hp: '08123',
    _quality: { completeness: { complete: true, filled: 26, total: 26, percent: 100 },
      age: 0, comparabilityTone: 'good', comparabilityLabel: 'Sebanding', comparability: 100,
      warnings: [], reviewStatus: '' }
  }]);
  const cells = Array.from(tbody.innerHTML.matchAll(/<td(?:\s[^>]*)?>([\s\S]*?)<\/td>/g), match => match[1]);
  assert.equal(cells.length, expected.length);
  assert.match(cells[8], /104/);
  assert.match(cells[9], /BANGUNAN_SAMPLE/);
  assert.match(cells[10], /TIPE_SAMPLE/);
  assert.match(cells[11], /105/);
  assert.match(cells[12], /106/);
});

test('tombol aksi berisi ikon dan memiliki nama yang dapat dibaca pembaca layar', () => {
  for (const [name, icon] of [['Lihat detail', '👁'], ['Bandingkan', '⚖️'], ['Edit data', '✏️']]) {
    const button = html.match(new RegExp('<button class="card-action [^>]*aria-label="' + name + '"[^>]*>(.*?)<\\/button>'));
    assert.ok(button, name);
    assert.equal(button[1], '<span aria-hidden="true">' + icon + '</span>');
  }
});
