const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const code = fs.readFileSync(path.join(__dirname, '../Backend/Code.gs'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '../index.html'), 'utf8');
const legacyHeader = ['ID','Sumber','HP','Koordinat','Alamat','Kota','Provinsi','Objek','Tipe Bangunan','Legalitas','Luas Tanah','Luas Bangunan','Tahun Bangun','Harga','Frontage','Lokasi','Posisi','Bentuk','Kontur','Lebar Jalan (ROW)','Elevasi','Status Harga','Waktu Data','Tujuan Penilaian','Peruntukan','Indikasi Nilai /m2','Foto'];
const legacyRow = ['DP1','Pemilik','08123456789','-5.38,105.28','Jl. Mawar','Bandar Lampung','Lampung','Tanah Bangunan','Rumah Tinggal','SHM',120,80,2020,'Rp 400.000.000',8,'Baik','Tengah','Persegi Panjang','Datar',6,0,'Penawaran','2025','Penjaminan Utang','Perumahan','Rp 3.333.333','foto-lama'];
const cells = [legacyHeader.slice(), legacyRow.slice()];
let width = 27, migrations = 0, locks = 0;
const sheet = {
  getLastColumn() { return width; }, getMaxColumns() { return width; }, getLastRow() { return cells.length; },
  insertColumnsAfter(column, count) { assert.equal(column, 9); migrations++; cells.forEach(row => row.splice(column, 0, ...Array(count).fill(''))); width += count; },
  getRange(r, c, h = 1, w = 1) { return {
    getValues() { return Array.from({length:h}, (_,i) => Array.from({length:w}, (_,j) => cells[r - 1 + i]?.[c - 1 + j] ?? '')); },
    setValues(values) { for (let i=0;i<h;i++) for(let j=0;j<w;j++) { (cells[r-1+i] ||= [])[c-1+j] = values[i][j]; } return this; },
    getValue() { return cells[r-1]?.[c-1] ?? ''; }, setValue(v) { (cells[r-1] ||= [])[c-1] = v; return this; },
    setBackground() { return this; }, setFontColor() { return this; }, setFontWeight() { return this; }, setHorizontalAlignment() { return this; }, setNumberFormat() { return this; }
  }; },
  appendRow(row) { cells.push(row.slice()); }
};
const ctx = vm.createContext({
  SpreadsheetApp: { getActiveSpreadsheet:() => ({ getSheetByName: name => name === 'DataPembanding' ? sheet : null }), flush() {} },
  LockService: { getScriptLock:() => ({ waitLock() { locks++; }, releaseLock() {} }) },
  Session: { getScriptTimeZone:() => 'GMT+7' },
  Utilities: { formatDate: () => '2025' },
  Number, String, Math, Date, JSON
});
vm.runInContext(code, ctx);
ctx._readQualityReviews_ = () => ({});
ctx.getRegressionModels = () => ({ models:{}, diagnostics:{} });
ctx._requireDataEditor_ = () => 'Admin';
ctx._findDuplicateCandidates_ = () => [];
ctx._resolveDuplicateDecision_ = () => null;
ctx._recordDataRelation_ = () => {};
ctx.logActivity = () => {};

let result = ctx.searchData({ jenisProprti:['Tanah Bangunan'], legalitas:['SHM'], jenisData:['Penawaran'], tahun:['2025'], rowJalan:'6' });
assert.equal(result.success, true, result.error);
assert.equal(migrations, 1, 'Sheet lama dimigrasikan tepat sekali');
assert.equal(locks, 1);
assert.equal(cells[0].length, 30);
assert.equal(cells[0][7], 'Jenis Properti');
assert.deepEqual(Array.from(cells[0].slice(9, 12)), ['Tipe Indikasi','Transaksi Bangunan (Rp)','Indikasi NP Bangunan (Rp/m2)']);
assert.equal(cells[1][12], 'SHM');
assert.equal(cells[1][29], 'foto-lama', 'Foto lama tetap berada pada kolom baru');
assert.equal(result.total, 1);
assert.equal(result.data[0].harga, 'Rp 400.000.000');
assert.equal(result.data[0].indikasiNilai, 'Rp 3.333.333');
assert.equal(result.data[0].tipeIndikasi, '');
assert.equal(ctx._getDataCompleteness_(cells[1]).total, 26, 'Kolom opsional baru tidak mengubah ambang kelengkapan lama');
assert.equal(ctx._getAvailableDataYears_()[0], '2025');

const newRow = legacyRow.slice(0,9).concat(['Bangunan','Rp 250.000.000','Rp 3.125.000'], legacyRow.slice(9));
newRow[0] = 'DP2'; newRow[3] = '-5.39,105.29';
result = ctx.addData(newRow, 'admin');
assert.equal(result.success, true, result.error);
assert.equal(cells[2].length, 30);
assert.equal(cells[2][10], 'Rp 250.000.000');
assert.equal(cells[2][12], 'SHM');
assert.equal(ctx.searchData({}).data[1].indikasiNpBangunan, 'Rp 3.125.000');
newRow[10] = 'Rp 275.000.000';
result = ctx.editData(newRow, 'admin', '-5.39,105.29');
assert.equal(result.success, true, result.error);
assert.equal(cells[2][10], 'Rp 275.000.000');
result = ctx.updateFoto('-5.39,105.29', 'foto-baru');
assert.equal(result.success, true, result.error);
assert.equal(cells[2][29], 'foto-lama,foto-baru');
assert.equal(migrations, 1, 'Pencarian berikutnya tidak menyisipkan kolom lagi');
assert.equal(ctx._normalizeDataRow_(legacyRow)[29], 'foto-lama', 'Survei lama 27 kolom tetap dapat disetujui');

const formBody = html.slice(html.indexOf('function _buildDataFormRow('), html.indexOf('var _duplicateDecisionState'));
const formFields = Array.from(formBody.matchAll(/_form(?:Value|Number)\('([^']+)'\)/g), m => m[1]);
assert.equal(formFields.length, 29, 'Form menyimpan 29 nilai dan satu foto');
assert.deepEqual(formFields.slice(8,12), ['f_tipe','f_tipeIndikasi','f_transaksiBangunan','f_indikasiNpBangunan']);
assert.match(html, /row\[29\] = _surveyMeta\.watermarkedPhotoUrl/);
const surveyForm = {};
for (const id of formFields) surveyForm[id] = { tagName:'INPUT', value:'' };
const surveyCtx = vm.createContext({ document:{ getElementById:id => surveyForm[id] }, Array });
const surveyFunction = html.slice(html.indexOf('function _populateSurveyFormRow('), html.indexOf('function editFieldSurvey('));
vm.runInContext(surveyFunction, surveyCtx);
surveyCtx._populateSurveyFormRow(legacyRow);
assert.equal(surveyForm.f_tipeIndikasi.value, '');
assert.equal(surveyForm.f_legalitas.value, 'SHM', 'Draf survei lama membuka kolom setelah sisipan dengan benar');
assert.equal(surveyForm.f_indikasi.value, 'Rp 3.333.333');
console.log('Migrasi 27→30, filter, kelengkapan, tambah/edit, foto, dan survei lama OK');
