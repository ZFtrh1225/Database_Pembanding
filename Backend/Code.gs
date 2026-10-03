// ============================================================
// CARI DATA PEMBANDING — Google Apps Script Backend (API MODE)
// ============================================================

const SHEET_NAME = "DataPembanding";
const USERS_SHEET = "Users";
const HISTORY_SHEET = "History";
const MODEL_SHEET = "Model_Regresi"; // TAMBAHAN: Nama sheet database model
const PARAMETER_SHEET = "Master_Parameter";
const PARAMETER_CATEGORIES = ["JENIS_PROPERTI", "HAK_KEPEMILIKAN", "JENIS_DATA"];
const WEB_APP_ORIGIN = "https://zftrh1225.github.io";
const MAPS_API_KEY_PROPERTY = "GOOGLE_MAPS_API_KEY";

/**
 * Halaman jembatan untuk GitHub Pages.
 *
 * GitHub Pages tidak dapat memakai google.script.run secara langsung. Sebelumnya
 * aplikasi memakai fetch() lintas-domain ke ContentService. Respons ContentService
 * melewati redirect googleusercontent sehingga pada sebagian jaringan/browser
 * berakhir sebagai "Failed to fetch" atau halaman HTML yang gagal diparse sebagai
 * JSON. Iframe HtmlService ini memakai google.script.run dari origin Apps Script,
 * kemudian mengirim hasilnya kembali ke origin GitHub Pages yang diizinkan.
 */
function doGet(e) {
  const nonce = e && e.parameter ? String(e.parameter.nonce || '') : '';
  return HtmlService.createHtmlOutput(_apiBridgeHtml_(nonce))
    .setTitle("Database Pembanding API Bridge")
    .addMetaTag("viewport", "width=device-width, initial-scale=1")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const result = _dispatchApiAction_(body.action, body.args || []);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

/** Dipanggil oleh google.script.run di halaman jembatan. */
function apiCall(action, args) {
  return _dispatchApiAction_(action, Array.isArray(args) ? args : []);
}

function _dispatchApiAction_(action, args) {
  if (action === 'checkLogin') return checkLogin(args[0], args[1]);
  if (action === 'searchData') return searchData(args[0] || {});
  if (action === 'addData') return addData(args[0], args[1]);
  if (action === 'editData') return editData(args[0], args[1], args[2]);
  if (action === 'uploadFoto') return uploadFoto(args[0], args[1]);
  if (action === 'updateFoto') return updateFoto(args[0], args[1]);
  if (action === 'getFilterOptions') return getFilterOptions();
  if (action === 'getMasterParameters') return getMasterParameters(args[0]);
  if (action === 'saveMasterParameters') return saveMasterParameters(args[0], args[1]);
  if (action === 'getPublicConfig') return getPublicConfig();
  if (action === 'health') return { success: true, service: 'Database Pembanding API', version: 'bridge-v1' };
  return { success: false, error: "Fungsi tidak ditemukan!" };
}

/**
 * Key tetap akan terlihat oleh browser karena Google Maps JavaScript API berjalan
 * di sisi pengguna. Script Properties mengeluarkannya dari GitHub; keamanan riil
 * tetap berasal dari HTTP referrer restriction dan API restriction di Google Cloud.
 */
function getPublicConfig() {
  const mapsApiKey = PropertiesService.getScriptProperties().getProperty(MAPS_API_KEY_PROPERTY) || '';
  if (!mapsApiKey) {
    return {
      success: false,
      error: "Script Property GOOGLE_MAPS_API_KEY belum diatur pada deployment Apps Script."
    };
  }
  return { success: true, mapsApiKey: mapsApiKey };
}

function _apiBridgeHtml_(nonce) {
  const allowedOrigin = JSON.stringify(WEB_APP_ORIGIN);
  const safeNonce = /^[A-Za-z0-9_-]{16,128}$/.test(nonce) ? nonce : '';
  const serializedNonce = JSON.stringify(safeNonce);
  return [
    '<!doctype html><html><head><base target="_top"></head><body>',
    '<script>',
    '(function(){',
    '"use strict";',
    'var ALLOWED_ORIGIN=' + allowedOrigin + ',NONCE=' + serializedNonce + ';',
    'function reply(target,origin,payload){target.postMessage(payload,origin);}',
    'function ready(){reply(window.top,ALLOWED_ORIGIN,{source:"database-pembanding-bridge",type:"ready",version:"bridge-v1",nonce:NONCE});}',
    'window.addEventListener("message",function(event){',
    '  if(event.origin!==ALLOWED_ORIGIN||event.source!==window.top)return;',
    '  var msg=event.data||{};',
    '  if(msg.source!=="database-pembanding-client"||msg.nonce!==NONCE)return;',
    '  if(msg.type==="ping"){ready();return;}',
    '  if(msg.type!=="request"||!msg.id||!msg.action)return;',
    '  var target=event.source,origin=event.origin,id=msg.id;',
    '  google.script.run',
    '    .withSuccessHandler(function(result){reply(target,origin,{source:"database-pembanding-bridge",type:"response",id:id,nonce:NONCE,ok:true,result:result});})',
    '    .withFailureHandler(function(error){reply(target,origin,{source:"database-pembanding-bridge",type:"response",id:id,nonce:NONCE,ok:false,error:(error&&error.message)||String(error)});})',
    '    .apiCall(msg.action,Array.isArray(msg.args)?msg.args:[]);',
    '});',
    'ready();setTimeout(ready,250);setTimeout(ready,1000);',
    '})();',
    '<\/script></body></html>'
  ].join('');
}


function _defaultMasterParameters_() {
  return [
    ["JENIS_PROPERTI", "Tanah Bangunan", "Tanah Bangunan", true, 1],
    ["JENIS_PROPERTI", "Tanah Kosong", "Tanah Kosong", true, 2],
    ["JENIS_PROPERTI", "Office/Retail/Unit Apartemen", "Office/Retail/Unit Apartemen", true, 3],
    ["JENIS_PROPERTI", "Ruko", "Ruko", true, 4],
    ["HAK_KEPEMILIKAN", "SHM", "SHM", true, 1],
    ["HAK_KEPEMILIKAN", "SHGB", "SHGB", true, 2],
    ["HAK_KEPEMILIKAN", "HGU", "HGU", true, 3],
    ["HAK_KEPEMILIKAN", "Hak Pakai", "Hak Pakai", true, 4],
    ["HAK_KEPEMILIKAN", "HMSRS", "HMSRS", true, 5],
    ["HAK_KEPEMILIKAN", "Girik", "Girik", true, 6],
    ["HAK_KEPEMILIKAN", "AJB", "AJB", true, 7],
    ["HAK_KEPEMILIKAN", "PPJB", "PPJB", true, 8],
    ["HAK_KEPEMILIKAN", "Surat Hijau", "Surat Hijau", true, 9],
    ["JENIS_DATA", "Penawaran", "Penawaran", true, 1],
    ["JENIS_DATA", "Transaksi", "Transaksi", true, 2],
    ["JENIS_DATA", "Sewa", "Sewa", true, 3]
  ];
}

function _parameterIsActive_(value) {
  if (value === true || value === 1) return true;
  const normalized = String(value == null ? "" : value).trim().toLowerCase();
  return ["true", "1", "ya", "yes", "aktif"].indexOf(normalized) !== -1;
}

function _normalizeMasterParameterRows_(rows) {
  return (Array.isArray(rows) ? rows : []).map(function(item, index) {
    const isArray = Array.isArray(item);
    const category = String(isArray ? item[0] : item.category || "").trim().toUpperCase();
    const value = String(isArray ? item[1] : item.value || "").trim();
    const label = String(isArray ? item[2] : item.label || value).trim() || value;
    const active = _parameterIsActive_(isArray ? item[3] : item.active);
    const parsedOrder = parseInt(isArray ? item[4] : item.order, 10);
    return {
      category: category,
      value: value,
      label: label,
      active: active,
      order: isNaN(parsedOrder) || parsedOrder < 1 ? index + 1 : parsedOrder
    };
  }).filter(function(item) {
    return PARAMETER_CATEGORIES.indexOf(item.category) !== -1 && item.value !== "";
  });
}

function _ensureMasterParameterSheetUnlocked_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(PARAMETER_SHEET);
  if (!sheet) sheet = ss.insertSheet(PARAMETER_SHEET);

  const headers = ["Kategori", "Nilai Tersimpan", "Label Tampilan", "Aktif", "Urutan"];
  if (!sheet.getRange(1, 1).getValue()) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground("#1e3a5f")
    .setFontColor("#ffffff")
    .setFontWeight("bold")
    .setHorizontalAlignment("center");
  sheet.setFrozenRows(1);

  if (sheet.getLastRow() < 2) {
    const defaults = _defaultMasterParameters_();
    sheet.getRange(2, 1, defaults.length, headers.length).setValues(defaults);
  }
  return sheet;
}

function _ensureMasterParameterSheet_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return _ensureMasterParameterSheetUnlocked_();
  } finally {
    lock.releaseLock();
  }
}

function _readMasterParameters_() {
  const sheet = _ensureMasterParameterSheet_();
  if (sheet.getLastRow() < 2) return [];
  return _normalizeMasterParameterRows_(
    sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues()
  ).sort(function(a, b) {
    const categoryOrder = PARAMETER_CATEGORIES.indexOf(a.category) - PARAMETER_CATEGORIES.indexOf(b.category);
    return categoryOrder || a.order - b.order || a.label.localeCompare(b.label);
  });
}

function _getAvailableDataYears_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const totalCols = Math.max(sheet.getLastColumn(), 27);
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.min(totalCols, 28)).getValues();
  const years = {};

  rows.forEach(function(row) {
    const coord = _parseCoord(row[3], row[4]);
    const offset = coord && coord.shifted ? 1 : 0;
    const value = row[22 + offset];
    let year = "";

    if (value instanceof Date && !isNaN(value.getTime())) {
      year = Utilities.formatDate(value, Session.getScriptTimeZone() || "GMT+7", "yyyy");
    } else {
      const match = String(value == null ? "" : value).match(/(?:19|20)\d{2}/);
      year = match ? match[0] : "";
    }
    if (year) years[year] = true;
  });
  return Object.keys(years).sort(function(a, b) { return Number(b) - Number(a); });
}

function _groupActiveParameterOptions_(rows) {
  const grouped = {
    jenisProperti: [],
    hakKepemilikan: [],
    jenisData: []
  };
  const keyByCategory = {
    JENIS_PROPERTI: "jenisProperti",
    HAK_KEPEMILIKAN: "hakKepemilikan",
    JENIS_DATA: "jenisData"
  };

  rows.filter(function(item) { return item.active; }).forEach(function(item) {
    grouped[keyByCategory[item.category]].push({ value: item.value, label: item.label });
  });

  // Jika sheet diedit manual sampai suatu kategori kosong, gunakan default kategori itu
  // agar filter dan form tidak rusak.
  const defaults = _normalizeMasterParameterRows_(_defaultMasterParameters_());
  Object.keys(keyByCategory).forEach(function(category) {
    const key = keyByCategory[category];
    if (grouped[key].length === 0) {
      grouped[key] = defaults.filter(function(item) {
        return item.category === category && item.active;
      }).map(function(item) {
        return { value: item.value, label: item.label };
      });
    }
  });
  return grouped;
}

function getFilterOptions() {
  try {
    const rows = _readMasterParameters_();
    const options = _groupActiveParameterOptions_(rows);
    return {
      success: true,
      options: options,
      years: _getAvailableDataYears_()
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function _getUserRole_(username) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return "";
  const normalizedUser = String(username || "").trim();
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
  for (let index = 0; index < rows.length; index++) {
    if (String(rows[index][0] || "").trim() === normalizedUser) {
      return String(rows[index][2] || "").trim();
    }
  }
  return "";
}

function _requireSuperadmin_(username) {
  if (_getUserRole_(username) !== "Superadmin") {
    throw new Error("Hanya Superadmin yang dapat mengelola parameter.");
  }
}

function getMasterParameters(activeUser) {
  try {
    _requireSuperadmin_(activeUser);
    return {
      success: true,
      rows: _readMasterParameters_(),
      years: _getAvailableDataYears_()
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function _prepareMasterParametersForSave_(rows) {
  if (!Array.isArray(rows) || rows.length === 0 || rows.length > 300) {
    throw new Error("Daftar parameter tidak valid.");
  }

  const normalized = _normalizeMasterParameterRows_(rows);
  if (normalized.length !== rows.length) {
    throw new Error("Kategori dan Nilai Tersimpan wajib diisi.");
  }

  const seen = {};
  const activeByCategory = {};
  PARAMETER_CATEGORIES.forEach(function(category) { activeByCategory[category] = 0; });

  normalized.forEach(function(item) {
    if (item.value.length > 100 || item.label.length > 100) {
      throw new Error("Nilai dan label parameter maksimal 100 karakter.");
    }
    const duplicateKey = item.category + "|" + item.value.toLowerCase();
    if (seen[duplicateKey]) {
      throw new Error("Parameter duplikat: " + item.value);
    }
    seen[duplicateKey] = true;
    if (item.active) activeByCategory[item.category]++;
  });

  PARAMETER_CATEGORIES.forEach(function(category) {
    if (!activeByCategory[category]) {
      throw new Error("Setiap kategori harus memiliki minimal satu parameter aktif.");
    }
  });

  return normalized.sort(function(a, b) {
    const categoryOrder = PARAMETER_CATEGORIES.indexOf(a.category) - PARAMETER_CATEGORIES.indexOf(b.category);
    return categoryOrder || a.order - b.order || a.label.localeCompare(b.label);
  });
}

function saveMasterParameters(rows, activeUser) {
  try {
    _requireSuperadmin_(activeUser);
    const normalized = _prepareMasterParametersForSave_(rows);
    const values = normalized.map(function(item) {
      return [item.category, item.value, item.label, item.active, item.order];
    });

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = _ensureMasterParameterSheetUnlocked_();
      const existingRows = Math.max(sheet.getLastRow() - 1, 0);
      if (existingRows > 0) sheet.getRange(2, 1, existingRows, 5).clearContent();
      sheet.getRange(2, 1, values.length, 5).setValues(values);
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }

    logActivity(activeUser, "Memperbarui Master Parameter (" + values.length + " parameter)");
    const filterResult = getFilterOptions();
    return {
      success: true,
      rows: normalized,
      options: filterResult.options,
      years: filterResult.years
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function setupSpreadsheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  const headers = [
    "ID","Sumber","HP","Koordinat","Alamat","Kota","Provinsi","Objek","Tipe Bangunan","Legalitas","Luas Tanah","Luas Bangunan",
    "Tahun Bangun","Harga","Frontage","Lokasi","Posisi","Bentuk","Kontur","Lebar Jalan (ROW)","Elevasi","Status Harga","Waktu Data",
    "Tujuan Penilaian","Peruntukan","Indikasi Nilai /m2","Foto"
  ];
  if (!sheet.getRange(1, 1).getValue()) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setBackground("#1e3a5f").setFontColor("#ffffff").setFontWeight("bold").setHorizontalAlignment("center");
    sheet.setFrozenRows(1); sheet.getRange(2, 3, 1000, 1).setNumberFormat('@');
  }

  let userSheet = ss.getSheetByName(USERS_SHEET);
  if (!userSheet) {
    userSheet = ss.insertSheet(USERS_SHEET);
    userSheet.getRange(1, 1, 1, 3).setValues([["Username", "Password", "Role"]]);
    userSheet.getRange(1, 1, 1, 3).setBackground("#16a34a").setFontColor("#ffffff").setFontWeight("bold");
    userSheet.getRange(2, 1, 1, 3).setValues([["admin", "admin123", "Superadmin"]]);
  }

  let historySheet = ss.getSheetByName(HISTORY_SHEET);
  if (!historySheet) {
    historySheet = ss.insertSheet(HISTORY_SHEET);
    historySheet.getRange(1, 1, 1, 4).setValues([["No.", "Username", "Waktu Akses", "Aktivitas"]]);
    historySheet.getRange(1, 1, 1, 4).setBackground("#ea4335").setFontColor("#ffffff").setFontWeight("bold");
  }
  _ensureMasterParameterSheet_();
  SpreadsheetApp.flush();
  return "Spreadsheet siap! Database Properti, Akun, Histori, dan Master Parameter telah disetup.";
}

function logActivity(username, aktivitas) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(HISTORY_SHEET);
  if (!sheet) return;
  cleanupHistory();
  const now = new Date();
  const timestamp = Utilities.formatDate(now, "GMT+7", "HH:mm, dd-MM-yyyy");
  const lastRow = sheet.getLastRow();
  const nextNo = lastRow < 2 ? 1 : lastRow; 
  sheet.appendRow([nextNo, username, timestamp, aktivitas]);
}

function cleanupHistory() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(HISTORY_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return;
  const data = sheet.getRange(2, 3, sheet.getLastRow() - 1, 1).getValues();
  const today = new Date();
  const thirtyDaysAgo = new Date(today.getTime() - (30 * 24 * 60 * 60 * 1000));
  for (let i = data.length - 1; i >= 0; i--) {
    try {
      const parts = data[i][0].split(", ")[1].split("-");
      const recordDate = new Date(parts[2], parts[1] - 1, parts[0]);
      if (recordDate < thirtyDaysAgo) sheet.deleteRow(i + 2);
    } catch(e) {}
  }
}

function checkLogin(username, password) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(USERS_SHEET);
    if (!sheet) return { success: false, error: "Database akun belum disetup." };
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, error: "Tidak ada akun terdaftar." };
    const data = sheet.getRange(2, 1, lastRow - 1, 3).getValues();
    for (let i = 0; i < data.length; i++) {
      if (String(data[i][0]).trim() === String(username).trim() && String(data[i][1]).trim() === String(password).trim()) {
        const role = data[i][2];
        logActivity(username, "Login ke Aplikasi");
        return { success: true, role: role, username: username };
      }
    }
    return { success: false, error: "Username atau Password salah!" };
  } catch (e) { return { success: false, error: e.message }; }
}

function getNextId() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return "001";
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues().map(r => parseInt(r[0], 10)).filter(n => !isNaN(n));
  if (ids.length === 0) return "001";
  return String(ids.reduce((a, b) => Math.max(a, b), 0) + 1).padStart(3, "0");
}

function _parseCoord(colD, colE) {
  var s = String(colD || '').trim();
  if (s.indexOf(',') !== -1) {
    var parts = s.split(','); var lat = parseFloat(parts[0].trim()), lng = parseFloat(parts[1].trim());
    if (!isNaN(lat) && !isNaN(lng)) return { lat: lat, lng: lng, raw: lat + ',' + lng };
  }
  var spParts = s.split(/\s+/);
  if (spParts.length >= 2) {
    var lat = parseFloat(spParts[0]), lng = parseFloat(spParts[1]);
    if (!isNaN(lat) && !isNaN(lng)) return { lat: lat, lng: lng, raw: lat + ',' + lng };
  }
  if (s !== '') {
    var lat = parseFloat(s), lng = parseFloat(String(colE || '').trim());
    if (!isNaN(lat) && !isNaN(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180) return { lat: lat, lng: lng, raw: lat + ',' + lng, shifted: true };
  }
  return null;
}

function _isPointInPolygon(lat, lng, polygon) {
  let x = lng, y = lat;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    let xi = polygon[i].lng, yi = polygon[i].lat;
    let xj = polygon[j].lng, yj = polygon[j].lat;
    let intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  return inside;
}

// =========================================================================
// FITUR BARU: MENGAMBIL DATABASE MODEL REGRESI DARI SPREADSHEET
// =========================================================================
function _modelVersionFromId(id) {
  const match = String(id || '').trim().match(/(20\d{6})$/);
  return match ? match[1] : null;
}

function _groupRegressionRows(data) {
  const models = {};
  const diagnostics = { unversionedRows: [], duplicateRows: [] };
  data.forEach((row, index) => {
    const modelName = String(row[2] || '').trim();
    const variable = String(row[5] || '').trim();
    if (row[6] === '' || row[6] === null || row[6] === undefined) return;
    const coefficient = Number(row[6]);
    if (!modelName || !variable || !Number.isFinite(coefficient)) return;

    const version = _modelVersionFromId(row[1]);
    const sheetRow = index + 2;
    if (!version) {
      diagnostics.unversionedRows.push(sheetRow);
      return;
    }
    if (!models[modelName]) models[modelName] = {};
    if (!models[modelName][version]) models[modelName][version] = {};
    if (Object.prototype.hasOwnProperty.call(models[modelName][version], variable)) {
      diagnostics.duplicateRows.push(sheetRow);
      return;
    }
    models[modelName][version][variable] = {
      tipe: String(row[3] || '').trim(),
      label: String(row[4] || '').trim(),
      sheetRow: sheetRow,
      koefisien: coefficient
    };
  });
  return { models: models, diagnostics: diagnostics };
}

function getRegressionModels() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sheet = ss.getSheetByName(MODEL_SHEET);
  if (!sheet) return { models: {}, diagnostics: { unversionedRows: [], duplicateRows: [] } };

  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return { models: {}, diagnostics: { unversionedRows: [], duplicateRows: [] } };

  // B menyimpan versi YYYYMMDD pada akhir ID. Setiap versi merupakan model utuh.
  const data = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  return _groupRegressionRows(data);
}
// =========================================================================

// Status kelengkapan dihitung dari 26 kolom input pengguna (B:AA).
// ID pada kolom A tidak dihitung karena dibuat oleh sistem.
// Minimal 70% berarti sekurang-kurangnya 19 dari 26 input harus terisi.
const DATA_COMPLETENESS_RATIO = 0.70;

function _hasDataInputValue_(value) {
  if (value === null || value === undefined) return false;
  if (value instanceof Date) return !isNaN(value.getTime());
  return String(value).trim() !== "";
}

function _getDataCompleteness_(row) {
  var coord = _parseCoord(row[3], row[4]);
  var offset = (coord && coord.shifted) ? 1 : 0;

  // Sumber, HP, dan Koordinat. Koordinat lama yang terpisah di D/E tetap dihitung sebagai satu input.
  var inputValues = [row[1], row[2], coord ? coord.raw : row[3]];

  // Alamat sampai Foto: 23 input berikutnya. Offset menjaga kompatibilitas format koordinat lama.
  for (var columnIndex = 4; columnIndex <= 26; columnIndex++) {
    inputValues.push(row[columnIndex + offset]);
  }

  var filled = inputValues.reduce(function(total, value) {
    return total + (_hasDataInputValue_(value) ? 1 : 0);
  }, 0);
  var minimumFilled = Math.ceil(inputValues.length * DATA_COMPLETENESS_RATIO);

  return {
    filled: filled,
    total: inputValues.length,
    minimumFilled: minimumFilled,
    ratio: inputValues.length ? filled / inputValues.length : 0,
    isComplete: filled >= minimumFilled
  };
}

function searchData(params) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) return { success: false, error: "Sheet tidak ditemukan." };
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: true, data: [], total: 0, models: {} };
    const totalCols = Math.max(sheet.getLastColumn(), 27);
    const rawData   = sheet.getRange(2, 1, lastRow - 1, Math.min(totalCols, 28)).getValues();
    let filtered = rawData.filter(row => {
      var idVal = String(row[0] || '').trim(); var coordVal = String(row[3] || '').trim();
      if (!idVal && !coordVal) return false;

      if (params.jenisProprti && params.jenisProprti.length > 0) if (!params.jenisProprti.includes(row[7])) return false;
      if (params.legalitas && params.legalitas.length > 0) if (!params.legalitas.includes(row[9])) return false;
      if (params.jenisData && params.jenisData.length > 0) {
        const norm = params.jenisData.map(j => j === "Price on Offer" ? "Penawaran" : j);
        if (!norm.includes(row[21])) return false;
      }
      if (params.tahun && params.tahun.length > 0) if (!params.tahun.includes(String(row[22]).substring(0, 4))) return false;
      if (params.rowJalan && params.rowJalan !== "") if ((parseFloat(row[19]) || 0) < parseFloat(params.rowJalan)) return false;
      if (params.statusData) {
        const completeness = _getDataCompleteness_(row);
        if (params.statusData === "Lengkap" && !completeness.isComplete) return false;
        if (params.statusData === "Tidak Lengkap" && completeness.isComplete) return false;
      }
      return true;
    });
    
    if (params.radiusKm === 'polygon' && params.polygon && params.polygon.length >= 3) {
      filtered = filtered.filter(row => {
        var coord = _parseCoord(row[3], row[4]);
        if (!coord) return false;
        return _isPointInPolygon(coord.lat, coord.lng, params.polygon);
      });
    } else if (params.centerLat != null && params.centerLng != null && params.radiusKm && params.radiusKm !== 'polygon') {
      const km = parseFloat(params.radiusKm);
      filtered = filtered.filter(row => {
        var coord = _parseCoord(row[3], row[4]);
        if (!coord) return false;
        return _haversine(params.centerLat, params.centerLng, coord.lat, coord.lng) <= km;
      });
    }

    const result = filtered.map(row => {
      var coord = _parseCoord(row[3], row[4]); var offset = (coord && coord.shifted) ? 1 : 0;
      return {
        id: _str(row[0]), sumber: _str(row[1]), hp: _formatPhone(row[2]), koordinat: coord ? coord.raw : _str(row[3]),
        alamat: _str(row[4+offset]), kota: _str(row[5+offset]), provinsi: _str(row[6+offset]), objek: _str(row[7+offset]),
        tipeBangunan: _str(row[8+offset]), legalitas: _str(row[9+offset]), luasTanah: row[10+offset], luasBangunan: row[11+offset],
        tahunBangun: row[12+offset], harga: _str(row[13+offset]), frontage: row[14+offset], lokasi: 
        _str(row[15+offset]), posisi: _str(row[16+offset]), bentuk: _str(row[17+offset]), kontur: _str(row[18+offset]), lebarJalanROW: row[19+offset],
        elevasi: row[20+offset], statusHarga: _str(row[21+offset]), waktuData: _str(row[22+offset]), tujuanPenilaian: _str(row[23+offset]),
        peruntukan: _str(row[24+offset]), indikasiNilai: _str(row[25+offset]), foto: _str(row[26+offset]) || ""
      };
    });
    
    // TAMBAHAN: Tarik data model regresi dan lemparkan ke respon
    const regModels = getRegressionModels();
    return { success: true, data: result, total: result.length, models: regModels.models, modelDiagnostics: regModels.diagnostics };
    
  } catch (err) { return { success: false, error: err.message }; }
}

function _str(v) { if (v === null || v === undefined) return ''; return String(v).trim().replace(/\.0+$/, ''); }

function addData(rowData, activeUser) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME); const lastRow = sheet.getLastRow();
    if (lastRow >= 2) {
      const existingCoords = sheet.getRange(2, 4, lastRow - 1, 1).getValues().flat();
      const newCoord = String(rowData[3]).trim();
      if (existingCoords.includes(newCoord)) return { success: false, error: "Gagal: Koordinat bertabrakan dengan data lain." };
    }
    rowData[0] = rowData[0] || getNextId();
    sheet.appendRow(rowData); sheet.getRange(sheet.getLastRow(), 3).setNumberFormat('@'); SpreadsheetApp.flush();
    let sumberLog = rowData[1] ? " - " + rowData[1] : "";
    logActivity(activeUser, "Menambah Data Baru (ID: " + rowData[0] + sumberLog + ")");
    return { success: true, id: rowData[0] };
  } catch (err) { return { success: false, error: err.message }; }
}

function editData(rowData, activeUser, originalCoord) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    const targetId = String(rowData[0]).trim();
    const targetCoord = originalCoord ? String(originalCoord).trim() : String(rowData[3]).trim();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) return { success: false, error: "Data kosong." };
    const dataRange = sheet.getRange(2, 1, lastRow - 1, 4).getValues(); let rowIndex = -1;
    for (let i = 0; i < dataRange.length; i++) {
      if (String(dataRange[i][0]).trim() === targetId && String(dataRange[i][3]).trim() === targetCoord) { rowIndex = i + 2; break; }
    }
    if (rowIndex === -1) return { success: false, error: "Data ID " + targetId + " tidak ditemukan di titik koordinat tersebut." };

    const currentCoord = String(sheet.getRange(rowIndex, 4).getValue()).trim(); const newCoord = String(rowData[3]).trim();
    if (newCoord !== currentCoord) {
      const allCoords = sheet.getRange(2, 4, lastRow - 1, 1).getValues().flat();
      if (allCoords.includes(newCoord)) return { success: false, error: "Gagal: Koordinat bertabrakan." };
    }
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    sheet.getRange(rowIndex, 3).setNumberFormat('@'); SpreadsheetApp.flush();
    let sumberLog = rowData[1] ? " - " + rowData[1] : "";
    logActivity(activeUser, "Mengedit Data (ID: " + targetId + sumberLog + ")");
    return { success: true, id: targetId };
  } catch (err) { return { success: false, error: err.message }; }
}

function uploadFoto(dataUrl, filename) {
  try {
    if (!dataUrl || dataUrl.indexOf(',') === -1) return { success: false, error: "Data foto tidak valid." };
    const parts = dataUrl.split(','); const mimeType = parts[0].split(':')[1].split(';')[0]; const decoded = Utilities.base64Decode(parts[1]);
    const blob = Utilities.newBlob(decoded, mimeType, filename || 'foto.jpg'); const folderName = 'DataPembanding_Foto';
    const folders = DriveApp.getFoldersByName(folderName);
    const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
    const file = folder.createFile(blob); file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { success: true, url: 'https://drive.google.com/thumbnail?id=' + file.getId() + '&sz=w800' };
  } catch (err) { return { success: false, error: err.message }; }
}

function updateFoto(koordinatTarget, fotoUrl) {
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME); const lastRow = sheet.getLastRow();
    const coordsData = sheet.getRange(2, 4, lastRow - 1, 2).getValues(); const target = _parseCoord(koordinatTarget, "");
    if (!target) return { success: false, error: "Format koordinat tidak valid." };
    for (let i = 0; i < coordsData.length; i++) {
      let rowCoord = _parseCoord(coordsData[i][0], coordsData[i][1]);
      if (rowCoord && rowCoord.lat === target.lat && rowCoord.lng === target.lng) {
        let offset = rowCoord.shifted ? 1 : 0; let fotoCell = sheet.getRange(i + 2, 27 + offset);
        let currentPhotos = String(fotoCell.getValue() || '').trim();
        let updatedPhotos = currentPhotos ? currentPhotos + "," + fotoUrl : fotoUrl;
        fotoCell.setValue(updatedPhotos); SpreadsheetApp.flush(); return { success: true };
      }
    }
    return { success: false, error: "Data koordinat tidak ditemukan." };
  } catch (err) { return { success: false, error: err.message }; }
}

function _formatPhone(val) {
  if (!val && val !== 0) return '';
  var s = String(val).trim().replace(/\.0+$/, '').replace(/\s/g, '');
  if (/^\d+$/.test(s) && s.charAt(0) !== '0' && s.length >= 9) s = '0' + s;
  return s;
}

function _haversine(lat1, lon1, lat2, lon2) {
  const R = 6371, dLat = (lat2-lat1)*Math.PI/180, dLon = (lon2-lon1)*Math.PI/180;
  const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180)*Math.cos(lat2*Math.PI/180)*Math.sin(dLon/2)**2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
