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
const QUALITY_REVIEW_SHEET = "Quality_Review";
const DATA_RELATION_SHEET = "Relasi_Data";
const FIELD_SURVEY_SHEET = "Survei_Lapangan";
const DUPLICATE_RELATION_TYPES = [
  "SAME_MARKET_DATA",
  "NEW_MARKET_EVENT",
  "SAME_PROPERTY_DIFFERENT_SOURCE",
  "DIFFERENT_PROPERTY"
];

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
  if (action === 'findDuplicateCandidates') return findDuplicateCandidates(args[0], args[1], args[2]);
  if (action === 'addData') return addData(args[0], args[1], args[2]);
  if (action === 'editData') return editData(args[0], args[1], args[2], args[3]);
  if (action === 'getDataRelations') return getDataRelations(args[0], args[1]);
  if (action === 'reviewDataRelation') return reviewDataRelation(args[0], args[1]);
  if (action === 'saveFieldSurvey') return saveFieldSurvey(args[0], args[1]);
  if (action === 'getFieldSurveys') return getFieldSurveys(args[0], args[1]);
  if (action === 'reviewFieldSurvey') return reviewFieldSurvey(args[0], args[1]);
  if (action === 'uploadSurveyPhotos') return uploadSurveyPhotos(args[0], args[1], args[2], args[3]);
  if (action === 'uploadFoto') return uploadFoto(args[0], args[1]);
  if (action === 'updateFoto') return updateFoto(args[0], args[1]);
  if (action === 'getFilterOptions') return getFilterOptions();
  if (action === 'getMasterParameters') return getMasterParameters(args[0]);
  if (action === 'saveMasterParameters') return saveMasterParameters(args[0], args[1]);
  if (action === 'saveQualityReview') return saveQualityReview(args[0], args[1]);
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

function _requireQualityEditor_(username) {
  const role = _getUserRole_(username);
  if (role !== "Admin" && role !== "Superadmin") {
    throw new Error("Hanya Admin atau Superadmin yang dapat menyimpan review kualitas.");
  }
  return role;
}

function _qualityReviewHeaders_() {
  return [
    "Review Key", "ID", "Koordinat", "Status Verifikasi", "Catatan Verifikasi",
    "Diverifikasi Oleh", "Diverifikasi Pada", "Status Review", "Keputusan Duplikat",
    "Catatan Kualitas", "Diperbarui Oleh", "Diperbarui Pada"
  ];
}

function _normalizeReviewCoord_(value) {
  const raw = String(value == null ? "" : value).trim();
  const coord = _parseCoord(raw, "");
  if (!coord) return raw.replace(/\s+/g, "");
  return Number(coord.lat).toFixed(6) + "," + Number(coord.lng).toFixed(6);
}

function _qualityReviewKey_(id, coordinate) {
  return String(id == null ? "" : id).trim().toLowerCase() + "|" + _normalizeReviewCoord_(coordinate);
}

function _emptyQualityReview_() {
  return {
    verificationStatus: "Belum Diverifikasi",
    verificationNote: "",
    verifiedBy: "",
    verifiedAt: "",
    reviewStatus: "Aktif",
    duplicateDecision: "Belum Ditinjau",
    qualityNote: "",
    updatedBy: "",
    updatedAt: ""
  };
}

function _ensureQualityReviewSheetUnlocked_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(QUALITY_REVIEW_SHEET);
  const headers = _qualityReviewHeaders_();
  if (!sheet) sheet = ss.insertSheet(QUALITY_REVIEW_SHEET);
  if (!sheet.getRange(1, 1).getValue()) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground("#7c3aed").setFontColor("#ffffff").setFontWeight("bold");
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function _ensureQualityReviewSheet_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return _ensureQualityReviewSheetUnlocked_();
  } finally {
    lock.releaseLock();
  }
}

function _dataRelationHeaders_() {
  return [
    "Relation ID", "Data Aktif ID", "Koordinat Data Aktif", "Data Existing ID",
    "Koordinat Existing", "Jenis Hubungan", "Skor Kemiripan", "Indikator",
    "Alasan", "Status Review", "Diputuskan Oleh", "Role", "Waktu Keputusan", "Sumber Aksi",
    "Jenis Hubungan Final", "Direview Oleh", "Waktu Review", "Catatan Review"
  ];
}

function _ensureDataRelationSheetUnlocked_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(DATA_RELATION_SHEET);
  const headers = _dataRelationHeaders_();
  if (!sheet) sheet = ss.insertSheet(DATA_RELATION_SHEET);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground("#0f766e").setFontColor("#ffffff").setFontWeight("bold");
  sheet.setFrozenRows(1);
  return sheet;
}

function _ensureDataRelationSheet_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    return _ensureDataRelationSheetUnlocked_();
  } finally {
    lock.releaseLock();
  }
}

function _reviewDateText_(value) {
  if (!value) return "";
  if (Object.prototype.toString.call(value) === "[object Date]" && !isNaN(value.getTime())) {
    return Utilities.formatDate(value, "GMT+7", "dd-MM-yyyy HH:mm");
  }
  return String(value);
}

function _reviewFromRow_(row) {
  const review = _emptyQualityReview_();
  review.verificationStatus = String(row[3] || review.verificationStatus);
  review.verificationNote = String(row[4] || "");
  review.verifiedBy = String(row[5] || "");
  review.verifiedAt = _reviewDateText_(row[6]);
  review.reviewStatus = String(row[7] || review.reviewStatus);
  review.duplicateDecision = String(row[8] || review.duplicateDecision);
  review.qualityNote = String(row[9] || "");
  review.updatedBy = String(row[10] || "");
  review.updatedAt = _reviewDateText_(row[11]);
  return review;
}

function _readQualityReviews_() {
  const sheet = _ensureQualityReviewSheet_();
  const map = {};
  if (sheet.getLastRow() < 2) return map;
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 12).getValues();
  rows.forEach(function(row) {
    const key = String(row[0] || "") || _qualityReviewKey_(row[1], row[2]);
    if (key) map[key] = _reviewFromRow_(row);
  });
  return map;
}

function _boundedReviewText_(value, label) {
  const text = String(value == null ? "" : value).trim();
  if (text.length > 500) throw new Error(label + " maksimal 500 karakter.");
  return text;
}

function _allowedReviewValue_(value, allowed, fallback, label) {
  const normalized = String(value || fallback);
  if (allowed.indexOf(normalized) === -1) throw new Error(label + " tidak valid.");
  return normalized;
}

function _assertQualityTargetExists_(id, coordinate) {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) throw new Error("Data pembanding tidak ditemukan.");
  const targetKey = _qualityReviewKey_(id, coordinate);
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 5).getValues();
  const exists = rows.some(function(row) {
    const parsed = _parseCoord(row[3], row[4]);
    return _qualityReviewKey_(row[0], parsed ? parsed.raw : row[3]) === targetKey;
  });
  if (!exists) throw new Error("Data pembanding tidak ditemukan. Muat ulang data lalu coba kembali.");
}

function saveQualityReview(payload, activeUser) {
  try {
    _requireQualityEditor_(activeUser);
    payload = payload || {};
    const id = String(payload.id || "").trim();
    const coordinate = String(payload.koordinat || "").trim();
    if (!id || !coordinate) throw new Error("ID dan koordinat wajib tersedia untuk review.");
    _assertQualityTargetExists_(id, coordinate);

    const verificationStatus = _allowedReviewValue_(payload.verificationStatus,
      ["Belum Diverifikasi", "Terverifikasi", "Perlu Verifikasi Ulang"],
      "Belum Diverifikasi", "Status verifikasi");
    const reviewStatus = _allowedReviewValue_(payload.reviewStatus,
      ["Aktif", "Perlu Ditelaah", "Dikecualikan"], "Aktif", "Status review");
    const duplicateDecision = _allowedReviewValue_(payload.duplicateDecision,
      ["Belum Ditinjau", "Bukan Duplikat", "Duplikat"], "Belum Ditinjau", "Keputusan duplikat");
    const verificationNote = _boundedReviewText_(payload.verificationNote, "Catatan verifikasi");
    const qualityNote = _boundedReviewText_(payload.qualityNote, "Catatan kualitas");
    const key = _qualityReviewKey_(id, coordinate);
    const now = new Date();
    const verifiedBy = verificationStatus === "Terverifikasi" ? String(activeUser || "") : "";
    const verifiedAt = verificationStatus === "Terverifikasi" ? now : "";
    const values = [key, id, coordinate, verificationStatus, verificationNote, verifiedBy, verifiedAt,
      reviewStatus, duplicateDecision, qualityNote, String(activeUser || ""), now];

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      const sheet = _ensureQualityReviewSheetUnlocked_();
      let targetRow = -1;
      if (sheet.getLastRow() >= 2) {
        const keys = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
        for (let i = 0; i < keys.length; i++) {
          if (String(keys[i][0] || "") === key) { targetRow = i + 2; break; }
        }
      }
      if (targetRow === -1) sheet.appendRow(values);
      else sheet.getRange(targetRow, 1, 1, values.length).setValues([values]);
      SpreadsheetApp.flush();
    } finally {
      lock.releaseLock();
    }

    logActivity(activeUser, "Review kualitas data ID " + id + " (" + verificationStatus + ", " + reviewStatus + ")");
    return { success: true, review: _reviewFromRow_(values) };
  } catch (error) {
    return { success: false, error: error.message };
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
  _ensureQualityReviewSheet_();
  _ensureDataRelationSheet_();
  _ensureFieldSurveySheet_();
  SpreadsheetApp.flush();
  return "Spreadsheet siap! Database Properti, Akun, Histori, Master Parameter, Quality Review, Relasi Data, dan Survei Lapangan telah disetup.";
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

    const reviewMap = _readQualityReviews_();
    const result = filtered.map(row => {
      var coord = _parseCoord(row[3], row[4]); var offset = (coord && coord.shifted) ? 1 : 0;
      var id = _str(row[0]);
      var coordinate = coord ? coord.raw : _str(row[3]);
      return {
        id: id, sumber: _str(row[1]), hp: _formatPhone(row[2]), koordinat: coordinate,
        alamat: _str(row[4+offset]), kota: _str(row[5+offset]), provinsi: _str(row[6+offset]), objek: _str(row[7+offset]),
        tipeBangunan: _str(row[8+offset]), legalitas: _str(row[9+offset]), luasTanah: row[10+offset], luasBangunan: row[11+offset],
        tahunBangun: row[12+offset], harga: _str(row[13+offset]), frontage: row[14+offset], lokasi: 
        _str(row[15+offset]), posisi: _str(row[16+offset]), bentuk: _str(row[17+offset]), kontur: _str(row[18+offset]), lebarJalanROW: row[19+offset],
        elevasi: row[20+offset], statusHarga: _str(row[21+offset]), waktuData: _str(row[22+offset]), tujuanPenilaian: _str(row[23+offset]),
        peruntukan: _str(row[24+offset]), indikasiNilai: _str(row[25+offset]), foto: _str(row[26+offset]) || "",
        qualityReview: reviewMap[_qualityReviewKey_(id, coordinate)] || _emptyQualityReview_()
      };
    });
    
    // TAMBAHAN: Tarik data model regresi dan lemparkan ke respon
    const regModels = getRegressionModels();
    return { success: true, data: result, total: result.length, models: regModels.models, modelDiagnostics: regModels.diagnostics };
    
  } catch (err) { return { success: false, error: err.message }; }
}

function _str(v) { if (v === null || v === undefined) return ''; return String(v).trim().replace(/\.0+$/, ''); }

function _requireDataEditor_(username) {
  const role = _getUserRole_(username);
  if (["Surveyor", "Admin", "Superadmin"].indexOf(role) === -1) {
    throw new Error("Role ini tidak diizinkan menambah atau mengubah data pembanding.");
  }
  return role;
}

function _duplicateNormalizeText_(value) {
  let text = String(value == null ? "" : value).toLowerCase().trim();
  if (text.normalize) text = text.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return text
    .replace(/\b(jl|jln)\.?\b/g, "jalan")
    .replace(/\bgg\.?\b/g, "gang")
    .replace(/\bno\.?\b/g, "nomor")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function _duplicatePhone_(value) {
  let digits = String(value == null ? "" : value).replace(/\D/g, "");
  if (digits.indexOf("0062") === 0) digits = digits.substring(4);
  else if (digits.indexOf("62") === 0) digits = digits.substring(2);
  if (digits.indexOf("0") === 0) digits = digits.substring(1);
  return digits;
}

function _duplicateNumber_(value) {
  if (typeof value === "number") return isFinite(value) ? value : null;
  let text = String(value == null ? "" : value).trim().replace(/[^0-9,.-]/g, "");
  if (!text) return null;
  if (/^-?\d{1,3}(\.\d{3})+(,\d+)?$/.test(text)) text = text.replace(/\./g, "").replace(",", ".");
  else text = text.replace(",", ".");
  const parsed = Number(text);
  return isFinite(parsed) ? parsed : null;
}

function _duplicateAddressSimilarity_(left, right) {
  const a = _duplicateNormalizeText_(left).split(" ").filter(Boolean);
  const b = _duplicateNormalizeText_(right).split(" ").filter(Boolean);
  if (!a.length || !b.length) return 0;
  const aSet = {};
  const bSet = {};
  a.forEach(function(token) { aSet[token] = true; });
  b.forEach(function(token) { bSet[token] = true; });
  const union = {};
  Object.keys(aSet).concat(Object.keys(bSet)).forEach(function(token) { union[token] = true; });
  const intersection = Object.keys(aSet).filter(function(token) { return bSet[token]; }).length;
  return Object.keys(union).length ? intersection / Object.keys(union).length : 0;
}

function _duplicateRelativeDifference_(left, right) {
  const a = _duplicateNumber_(left), b = _duplicateNumber_(right);
  if (a == null || b == null || a <= 0 || b <= 0) return null;
  return Math.abs(a - b) / Math.max(a, b);
}

function _duplicateRecordFromRow_(row, sheetRow) {
  const coord = _parseCoord(row[3], row[4]);
  const offset = coord && coord.shifted ? 1 : 0;
  return {
    id: _str(row[0]),
    sumber: _str(row[1]),
    hp: _str(row[2]),
    koordinat: coord ? coord.raw : _str(row[3]),
    coord: coord,
    alamat: _str(row[4 + offset]),
    kota: _str(row[5 + offset]),
    provinsi: _str(row[6 + offset]),
    objek: _str(row[7 + offset]),
    legalitas: _str(row[9 + offset]),
    luasTanah: row[10 + offset],
    luasBangunan: row[11 + offset],
    harga: row[13 + offset],
    statusHarga: _str(row[21 + offset]),
    waktuData: _str(row[22 + offset]),
    sheetRow: sheetRow || null
  };
}

function _duplicateScore_(input, existing) {
  let score = 0;
  const indicators = [];
  let distanceMeters = null;
  function add(key, label, points, detail) {
    score += points;
    indicators.push({ key: key, label: label, points: points, detail: detail || "" });
  }

  if (input.coord && existing.coord) {
    distanceMeters = _haversine(input.coord.lat, input.coord.lng, existing.coord.lat, existing.coord.lng) * 1000;
    if (distanceMeters <= 10) add("coordinate", "Koordinat sangat dekat", 40, Math.round(distanceMeters) + " m");
    else if (distanceMeters <= 30) add("coordinate", "Koordinat berdekatan", 35, Math.round(distanceMeters) + " m");
    else if (distanceMeters <= 100) add("coordinate", "Lokasi sekitar", 20, Math.round(distanceMeters) + " m");
  }

  const inputPhone = _duplicatePhone_(input.hp), existingPhone = _duplicatePhone_(existing.hp);
  if (inputPhone.length >= 8 && inputPhone === existingPhone) add("phone", "Nomor telepon sama", 25, "Nomor sumber cocok");

  const addressSimilarity = _duplicateAddressSimilarity_(input.alamat, existing.alamat);
  if (addressSimilarity >= 0.85) add("address", "Alamat sangat mirip", 20, Math.round(addressSimilarity * 100) + "%");
  else if (addressSimilarity >= 0.65) add("address", "Alamat mirip", 12, Math.round(addressSimilarity * 100) + "%");

  const landDifference = _duplicateRelativeDifference_(input.luasTanah, existing.luasTanah);
  if (landDifference != null && landDifference <= 0.03) add("land", "Luas tanah hampir sama", 10, Math.round(landDifference * 100) + "% selisih");
  else if (landDifference != null && landDifference <= 0.10) add("land", "Luas tanah berdekatan", 5, Math.round(landDifference * 100) + "% selisih");

  const buildingDifference = _duplicateRelativeDifference_(input.luasBangunan, existing.luasBangunan);
  if (buildingDifference != null && buildingDifference <= 0.03) add("building", "Luas bangunan hampir sama", 5, Math.round(buildingDifference * 100) + "% selisih");
  else if (buildingDifference != null && buildingDifference <= 0.10) add("building", "Luas bangunan berdekatan", 3, Math.round(buildingDifference * 100) + "% selisih");

  const priceDifference = _duplicateRelativeDifference_(input.harga, existing.harga);
  if (priceDifference != null && priceDifference <= 0.03) add("price", "Harga hampir sama", 10, Math.round(priceDifference * 100) + "% selisih");
  else if (priceDifference != null && priceDifference <= 0.10) add("price", "Harga berdekatan", 5, Math.round(priceDifference * 100) + "% selisih");

  if (_duplicateNormalizeText_(input.objek) && _duplicateNormalizeText_(input.objek) === _duplicateNormalizeText_(existing.objek)) {
    add("propertyType", "Jenis properti sama", 5, input.objek);
  }

  return {
    score: Math.min(100, score),
    indicators: indicators,
    distanceMeters: distanceMeters,
    addressSimilarity: addressSimilarity
  };
}

function _findDuplicateCandidates_(rowData, excludeId) {
  if (!Array.isArray(rowData)) throw new Error("Data pembanding tidak valid.");
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sheet || sheet.getLastRow() < 2) return [];
  const input = _duplicateRecordFromRow_(rowData, null);
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, Math.max(27, Math.min(sheet.getLastColumn(), 28))).getValues();
  const normalizedExcludeId = String(excludeId || "").trim();
  return rows.map(function(row, index) {
    const existing = _duplicateRecordFromRow_(row, index + 2);
    if (!existing.id || (normalizedExcludeId && existing.id === normalizedExcludeId)) return null;
    const match = _duplicateScore_(input, existing);
    if (match.score < 35) return null;
    return {
      id: existing.id,
      koordinat: existing.koordinat,
      alamat: existing.alamat,
      kota: existing.kota,
      provinsi: existing.provinsi,
      objek: existing.objek,
      legalitas: existing.legalitas,
      luasTanah: existing.luasTanah,
      luasBangunan: existing.luasBangunan,
      harga: _str(existing.harga),
      statusHarga: existing.statusHarga,
      waktuData: existing.waktuData,
      sumber: existing.sumber,
      hp: existing.hp,
      score: match.score,
      indicators: match.indicators,
      distanceMeters: match.distanceMeters == null ? null : Math.round(match.distanceMeters)
    };
  }).filter(Boolean).sort(function(a, b) {
    return b.score - a.score || (a.distanceMeters == null ? Number.MAX_VALUE : a.distanceMeters) - (b.distanceMeters == null ? Number.MAX_VALUE : b.distanceMeters);
  }).slice(0, 5);
}

function findDuplicateCandidates(rowData, activeUser, excludeId) {
  try {
    _requireDataEditor_(activeUser);
    return { success: true, candidates: _findDuplicateCandidates_(rowData, excludeId) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function _resolveDuplicateDecision_(candidates, decision) {
  if (!candidates.length) return null;
  if (!decision || !decision.existingId || !decision.relationType) {
    return { required: true, candidates: candidates };
  }
  const relationType = String(decision.relationType || "").trim();
  if (DUPLICATE_RELATION_TYPES.indexOf(relationType) === -1 || relationType === "SAME_MARKET_DATA") {
    throw new Error("Jenis hubungan data tidak dapat digunakan untuk menyimpan data baru.");
  }
  const existingCoord = _normalizeReviewCoord_(decision.existingCoord);
  const candidate = candidates.find(function(item) {
    return String(item.id) === String(decision.existingId) && _normalizeReviewCoord_(item.koordinat) === existingCoord;
  });
  if (!candidate) throw new Error("Kandidat data berubah. Jalankan pemeriksaan duplikat kembali.");
  const reason = String(decision.reason || "").trim();
  if (reason.length < 5) throw new Error("Alasan hubungan data wajib diisi minimal 5 karakter.");
  if (reason.length > 500) throw new Error("Alasan hubungan data maksimal 500 karakter.");
  return { required: false, candidate: candidate, relationType: relationType, reason: reason };
}

function _recordDataRelation_(activeRow, resolvedDecision, activeUser, role, sourceAction) {
  if (!resolvedDecision || !resolvedDecision.candidate) return;
  const candidate = resolvedDecision.candidate;
  const now = new Date();
  const relationId = "REL-" + Utilities.formatDate(now, "GMT+7", "yyyyMMddHHmmss") + "-" + Utilities.getUuid().slice(0, 8);
  const indicatorText = candidate.indicators.map(function(item) {
    return item.label + " (+" + item.points + ")" + (item.detail ? " " + item.detail : "");
  }).join("; ");
  const reviewStatus = role === "Surveyor" ? "Menunggu Review" : "Dikonfirmasi";
  const reviewedBy = role === "Surveyor" ? "" : String(activeUser || "");
  const reviewedAt = role === "Surveyor" ? "" : now;
  const finalRelationType = role === "Surveyor" ? "" : resolvedDecision.relationType;
  const relationRow = [
    relationId, String(activeRow[0] || ""), String(activeRow[3] || ""),
    candidate.id, candidate.koordinat, resolvedDecision.relationType, candidate.score,
    indicatorText, resolvedDecision.reason, reviewStatus, String(activeUser || ""), role, now, sourceAction,
    finalRelationType, reviewedBy, reviewedAt, role === "Surveyor" ? "" : "Dikonfirmasi saat input."
  ];
  const sheet = _ensureDataRelationSheet_();
  sheet.appendRow(relationRow);
}

function _requireRelationReviewer_(username) {
  const role = _getUserRole_(username);
  if (role !== "Admin" && role !== "Superadmin") {
    throw new Error("Hanya Admin atau Superadmin yang dapat mereview relasi data.");
  }
  return role;
}

function _relationKey_(id, coordinate) {
  return String(id || "").trim().toLowerCase() + "|" + _normalizeReviewCoord_(coordinate);
}

function _relationRecordSummary_(record) {
  if (!record) return null;
  return {
    id: record.id,
    koordinat: record.koordinat,
    alamat: record.alamat,
    kota: record.kota,
    provinsi: record.provinsi,
    objek: record.objek,
    legalitas: record.legalitas,
    luasTanah: record.luasTanah,
    luasBangunan: record.luasBangunan,
    harga: _str(record.harga),
    statusHarga: record.statusHarga,
    waktuData: record.waktuData,
    sumber: record.sumber,
    hp: record.hp
  };
}

function _relationDataLookup_() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  const lookup = {};
  if (!sheet || sheet.getLastRow() < 2) return lookup;
  const columnCount = Math.max(27, Math.min(sheet.getLastColumn(), 28));
  const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, columnCount).getValues();
  rows.forEach(function(row, index) {
    const record = _duplicateRecordFromRow_(row, index + 2);
    if (record.id) lookup[_relationKey_(record.id, record.koordinat)] = record;
  });
  return lookup;
}

function _dataRelationFromRow_(row, dataLookup) {
  const activeKey = _relationKey_(row[1], row[2]);
  const existingKey = _relationKey_(row[3], row[4]);
  const proposedType = String(row[5] || "");
  const status = String(row[9] || "Menunggu Review");
  return {
    relationId: String(row[0] || ""),
    activeId: String(row[1] || ""),
    activeCoord: String(row[2] || ""),
    existingId: String(row[3] || ""),
    existingCoord: String(row[4] || ""),
    proposedType: proposedType,
    score: Number(row[6]) || 0,
    indicators: String(row[7] || ""),
    reason: String(row[8] || ""),
    status: status,
    submittedBy: String(row[10] || ""),
    submittedRole: String(row[11] || ""),
    submittedAt: _reviewDateText_(row[12]),
    sourceAction: String(row[13] || ""),
    finalType: String(row[14] || ""),
    reviewedBy: String(row[15] || ""),
    reviewedAt: _reviewDateText_(row[16]),
    reviewNote: String(row[17] || ""),
    activeData: _relationRecordSummary_(dataLookup[activeKey]),
    existingData: _relationRecordSummary_(dataLookup[existingKey]),
    _sortAt: row[12] instanceof Date ? row[12].getTime() : 0
  };
}

function getDataRelations(activeUser, options) {
  try {
    _requireRelationReviewer_(activeUser);
    const sheet = _ensureDataRelationSheet_();
    if (sheet.getLastRow() < 2) return { success: true, relations: [], pendingCount: 0, total: 0 };
    if (options && options.summaryOnly) {
      const statuses = sheet.getRange(2, 10, sheet.getLastRow() - 1, 1).getValues();
      return {
        success: true,
        relations: [],
        pendingCount: statuses.filter(function(row) { return String(row[0] || "") === "Menunggu Review"; }).length,
        total: statuses.length
      };
    }
    const width = _dataRelationHeaders_().length;
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, width).getValues();
    const dataLookup = _relationDataLookup_();
    const relations = rows.map(function(row) { return _dataRelationFromRow_(row, dataLookup); })
      .filter(function(item) { return item.relationId; })
      .sort(function(a, b) {
        const pendingOrder = (a.status === "Menunggu Review" ? 0 : 1) - (b.status === "Menunggu Review" ? 0 : 1);
        return pendingOrder || b._sortAt - a._sortAt;
      });
    relations.forEach(function(item) { delete item._sortAt; });
    return {
      success: true,
      relations: relations.slice(0, 250),
      pendingCount: relations.filter(function(item) { return item.status === "Menunggu Review"; }).length,
      total: relations.length
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function reviewDataRelation(payload, activeUser) {
  try {
    const reviewerRole = _requireRelationReviewer_(activeUser);
    payload = payload || {};
    const relationId = String(payload.relationId || "").trim();
    const action = String(payload.action || "").trim().toUpperCase();
    const note = String(payload.note || "").trim();
    if (!relationId) throw new Error("Relation ID wajib tersedia.");
    if (["CONFIRM", "RECLASSIFY", "REJECT"].indexOf(action) === -1) throw new Error("Keputusan review tidak valid.");
    if ((action === "RECLASSIFY" || action === "REJECT") && note.length < 5) {
      throw new Error("Catatan review minimal 5 karakter untuk perubahan atau penolakan.");
    }
    if (note.length > 500) throw new Error("Catatan review maksimal 500 karakter.");

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    let updatedRow;
    try {
      const sheet = _ensureDataRelationSheetUnlocked_();
      if (sheet.getLastRow() < 2) throw new Error("Relasi data tidak ditemukan.");
      const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues();
      let rowIndex = -1;
      for (let index = 0; index < ids.length; index++) {
        if (String(ids[index][0] || "").trim() === relationId) { rowIndex = index + 2; break; }
      }
      if (rowIndex === -1) throw new Error("Relasi data tidak ditemukan.");
      const width = _dataRelationHeaders_().length;
      const row = sheet.getRange(rowIndex, 1, 1, width).getValues()[0];
      const proposedType = String(row[5] || "");
      let finalType = proposedType;
      let status = "Dikonfirmasi";
      if (action === "RECLASSIFY") {
        finalType = String(payload.finalType || "").trim();
        if (DUPLICATE_RELATION_TYPES.indexOf(finalType) === -1) throw new Error("Klasifikasi akhir tidak valid.");
      } else if (action === "REJECT") {
        finalType = "";
        status = "Ditolak";
      }
      row[9] = status;
      row[14] = finalType;
      row[15] = String(activeUser || "");
      row[16] = new Date();
      row[17] = note || (action === "CONFIRM" ? "Klasifikasi dikonfirmasi." : "");
      sheet.getRange(rowIndex, 1, 1, width).setValues([row]);
      SpreadsheetApp.flush();
      updatedRow = row;
    } finally {
      lock.releaseLock();
    }

    logActivity(activeUser, "Review Relasi Data " + relationId + " (" + action + ", " + reviewerRole + ")");
    return { success: true, relation: _dataRelationFromRow_(updatedRow, _relationDataLookup_()) };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

function _fieldSurveyHeaders_() {
  return [
    "Survey ID", "Status", "Dibuat Oleh", "Role Pembuat", "Dibuat Pada", "Diperbarui Pada",
    "Diajukan Pada", "Direview Oleh", "Waktu Review", "Catatan Review", "Waktu Pengambilan",
    "Koordinat GPS", "Akurasi GPS (m)", "Foto Asli", "Foto Watermark", "Data JSON",
    "Keputusan Duplikat JSON", "ID Database"
  ];
}

function _ensureFieldSurveySheetUnlocked_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(FIELD_SURVEY_SHEET);
  const headers = _fieldSurveyHeaders_();
  if (!sheet) sheet = ss.insertSheet(FIELD_SURVEY_SHEET);
  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  sheet.getRange(1, 1, 1, headers.length)
    .setBackground("#0369a1").setFontColor("#ffffff").setFontWeight("bold");
  sheet.setFrozenRows(1);
  return sheet;
}

function _ensureFieldSurveySheet_() {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try { return _ensureFieldSurveySheetUnlocked_(); }
  finally { lock.releaseLock(); }
}

function _safeJsonParse_(value, fallback) {
  try { return JSON.parse(String(value || "")); }
  catch (error) { return fallback; }
}

function _fieldSurveyFromRow_(row) {
  const capturedAt = row[10] instanceof Date && !isNaN(row[10]) ? row[10].toISOString() : String(row[10] || "");
  return {
    surveyId: String(row[0] || ""), status: String(row[1] || "Draf"), submittedBy: String(row[2] || ""),
    submittedRole: String(row[3] || ""), createdAt: _reviewDateText_(row[4]), updatedAt: _reviewDateText_(row[5]),
    submittedAt: _reviewDateText_(row[6]), reviewedBy: String(row[7] || ""), reviewedAt: _reviewDateText_(row[8]),
    reviewNote: String(row[9] || ""), capturedAt: capturedAt, gpsCoordinate: String(row[11] || ""),
    gpsAccuracy: row[12] === "" ? null : Number(row[12]), originalPhotoUrl: String(row[13] || ""),
    watermarkedPhotoUrl: String(row[14] || ""), dataRow: _safeJsonParse_(row[15], []),
    duplicateDecision: _safeJsonParse_(row[16], null), databaseId: String(row[17] || ""),
    _sortAt: row[5] instanceof Date ? row[5].getTime() : 0
  };
}

function _validateSubmittedFieldSurvey_(payload) {
  const row = Array.isArray(payload.dataRow) ? payload.dataRow : [];
  if (!String(row[0] || "").trim()) throw new Error("ID data wajib diisi sebelum survei diajukan.");
  if (!_parseCoord(row[3], "")) throw new Error("Koordinat GPS survei belum valid.");
  if (!_parseCoord(payload.gpsCoordinate, "") || !payload.capturedAt) throw new Error("Metadata GPS dan waktu pengambilan belum lengkap.");
  if (_normalizeReviewCoord_(row[3]) !== _normalizeReviewCoord_(payload.gpsCoordinate)) throw new Error("Koordinat form berbeda dari bukti GPS. Ambil ulang GPS sebelum mengajukan.");
  if (isNaN(new Date(payload.capturedAt).getTime())) throw new Error("Waktu pengambilan survei tidak valid.");
  if (!String(payload.watermarkedPhotoUrl || "").trim()) throw new Error("Foto lapangan wajib diambil sebelum survei diajukan.");
  const candidates = _findDuplicateCandidates_(row, "");
  const resolved = _resolveDuplicateDecision_(candidates, payload.duplicateDecision);
  if (resolved && resolved.required) return { candidates: candidates, requiresDecision: true };
  return { candidates: candidates, resolved: resolved };
}

function saveFieldSurvey(payload, activeUser) {
  try {
    payload = payload || {};
    const role = _requireDataEditor_(activeUser);
    const submitting = String(payload.action || "draft").toLowerCase() === "submit";
    const validation = submitting ? _validateSubmittedFieldSurvey_(payload) : null;
    if (validation && validation.requiresDecision) {
      return { success: false, requiresDuplicateDecision: true, candidates: validation.candidates };
    }

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    let savedRow;
    try {
      const sheet = _ensureFieldSurveySheetUnlocked_();
      const now = new Date();
      const surveyId = String(payload.surveyId || "").trim() || ("SVY-" + Utilities.formatDate(now, "GMT+7", "yyyyMMddHHmmss") + "-" + Utilities.getUuid().slice(0, 6));
      let rowIndex = -1, existing = null;
      if (sheet.getLastRow() >= 2) {
        const ids = sheet.getRange(2, 1, sheet.getLastRow() - 1, 3).getValues();
        for (let i = 0; i < ids.length; i++) {
          if (String(ids[i][0]) === surveyId) { rowIndex = i + 2; existing = sheet.getRange(rowIndex, 1, 1, 18).getValues()[0]; break; }
        }
      }
      if (existing && String(existing[2]) !== String(activeUser || "")) throw new Error("Draf survei hanya dapat diubah oleh pembuatnya.");
      if (existing && ["Menunggu Review", "Disetujui", "Sedang Diproses"].indexOf(String(existing[1])) >= 0) throw new Error("Survei ini tidak dapat diubah pada status sekarang.");
      const status = submitting ? "Menunggu Review" : "Draf";
      const dataRow = Array.isArray(payload.dataRow) ? payload.dataRow.slice(0, 27) : [];
      const originalPhotoUrl = String(payload.originalPhotoUrl || (existing && existing[13]) || "");
      const watermarkedPhotoUrl = String(payload.watermarkedPhotoUrl || (existing && existing[14]) || "");
      if (watermarkedPhotoUrl) dataRow[26] = watermarkedPhotoUrl;
      savedRow = [
        surveyId, status, String(activeUser || ""), role, existing ? existing[4] : now, now,
        submitting ? now : "", "", "", "", payload.capturedAt ? new Date(payload.capturedAt) : "",
        String(payload.gpsCoordinate || dataRow[3] || ""), payload.gpsAccuracy == null ? "" : Number(payload.gpsAccuracy),
        originalPhotoUrl, watermarkedPhotoUrl, JSON.stringify(dataRow), JSON.stringify(payload.duplicateDecision || null), ""
      ];
      if (rowIndex > 0) sheet.getRange(rowIndex, 1, 1, 18).setValues([savedRow]);
      else sheet.appendRow(savedRow);
      SpreadsheetApp.flush();
    } finally { lock.releaseLock(); }
    logActivity(activeUser, (submitting ? "Mengajukan" : "Menyimpan draf") + " Survei Lapangan " + savedRow[0]);
    return { success: true, survey: _fieldSurveyFromRow_(savedRow) };
  } catch (error) { return { success: false, error: error.message }; }
}

function getFieldSurveys(activeUser, options) {
  try {
    const role = _requireDataEditor_(activeUser);
    const sheet = _ensureFieldSurveySheet_();
    if (sheet.getLastRow() < 2) return { success: true, surveys: [], pendingCount: 0, total: 0 };
    const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 18).getValues();
    const visible = rows.filter(function(row) {
      return role === "Admin" || role === "Superadmin" || String(row[2]) === String(activeUser || "");
    });
    const pendingCount = visible.filter(function(row) { return String(row[1]) === "Menunggu Review"; }).length;
    if (options && options.summaryOnly) return { success: true, pendingCount: pendingCount, total: visible.length };
    const surveys = visible.map(_fieldSurveyFromRow_).sort(function(a, b) { return b._sortAt - a._sortAt; });
    return { success: true, surveys: surveys, pendingCount: pendingCount, total: surveys.length };
  } catch (error) { return { success: false, error: error.message }; }
}

function _requireFieldSurveyReviewer_(username) {
  const role = _getUserRole_(username);
  if (role !== "Admin" && role !== "Superadmin") throw new Error("Hanya Admin atau Superadmin yang dapat mereview survei lapangan.");
  return role;
}

function reviewFieldSurvey(payload, activeUser) {
  try {
    _requireFieldSurveyReviewer_(activeUser);
    payload = payload || {};
    const surveyId = String(payload.surveyId || "").trim();
    const action = String(payload.action || "").toUpperCase();
    const note = String(payload.note || "").trim();
    if (!surveyId || ["APPROVE", "REJECT"].indexOf(action) === -1) throw new Error("Keputusan review survei tidak valid.");
    if (action === "REJECT" && note.length < 5) throw new Error("Catatan penolakan minimal 5 karakter.");

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    let rowIndex = -1, survey;
    try {
      const sheet = _ensureFieldSurveySheetUnlocked_();
      if (sheet.getLastRow() < 2) throw new Error("Survei tidak ditemukan.");
      const rows = sheet.getRange(2, 1, sheet.getLastRow() - 1, 18).getValues();
      for (let i = 0; i < rows.length; i++) if (String(rows[i][0]) === surveyId) { rowIndex = i + 2; survey = _fieldSurveyFromRow_(rows[i]); break; }
      if (rowIndex < 0 || !survey) throw new Error("Survei tidak ditemukan.");
      if (survey.status !== "Menunggu Review") throw new Error("Survei ini sudah diproses atau belum diajukan.");
      if (action === "REJECT") {
        sheet.getRange(rowIndex, 2).setValue("Ditolak");
        sheet.getRange(rowIndex, 8, 1, 3).setValues([[String(activeUser || ""), new Date(), note]]);
        SpreadsheetApp.flush();
        logActivity(activeUser, "Menolak Survei Lapangan " + surveyId);
        return { success: true, status: "Ditolak" };
      }
      sheet.getRange(rowIndex, 2).setValue("Sedang Diproses");
      SpreadsheetApp.flush();
    } finally { lock.releaseLock(); }

    const result = addData(survey.dataRow, survey.submittedBy, survey.duplicateDecision);
    const finalLock = LockService.getScriptLock();
    finalLock.waitLock(10000);
    try {
      const sheet = _ensureFieldSurveySheetUnlocked_();
      if (!result || !result.success) {
        sheet.getRange(rowIndex, 2).setValue("Menunggu Review");
        SpreadsheetApp.flush();
        return { success: false, error: (result && result.error) || "Data survei belum dapat dimasukkan ke database.", requiresDuplicateDecision: !!(result && result.requiresDuplicateDecision) };
      }
      sheet.getRange(rowIndex, 2).setValue("Disetujui");
      sheet.getRange(rowIndex, 8, 1, 3).setValues([[String(activeUser || ""), new Date(), note || "Survei disetujui."]]);
      sheet.getRange(rowIndex, 18).setValue(String(result.id || ""));
      SpreadsheetApp.flush();
    } finally { finalLock.releaseLock(); }
    logActivity(activeUser, "Menyetujui Survei Lapangan " + surveyId + " menjadi data " + result.id);
    return { success: true, status: "Disetujui", databaseId: result.id, relationWarning: result.relationWarning || "" };
  } catch (error) { return { success: false, error: error.message }; }
}

function addData(rowData, activeUser, duplicateDecision) {
  try {
    const role = _requireDataEditor_(activeUser);
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("Sheet database tidak ditemukan.");
    const candidates = _findDuplicateCandidates_(rowData, "");
    const resolvedDecision = _resolveDuplicateDecision_(candidates, duplicateDecision);
    if (resolvedDecision && resolvedDecision.required) {
      return { success: false, requiresDuplicateDecision: true, candidates: candidates };
    }
    rowData[0] = rowData[0] || getNextId();
    sheet.appendRow(rowData); sheet.getRange(sheet.getLastRow(), 3).setNumberFormat('@'); SpreadsheetApp.flush();
    let relationWarning = "";
    try { _recordDataRelation_(rowData, resolvedDecision, activeUser, role, "Tambah Data"); }
    catch (relationError) { relationWarning = relationError.message; }
    let sumberLog = rowData[1] ? " - " + rowData[1] : "";
    logActivity(activeUser, "Menambah Data Baru (ID: " + rowData[0] + sumberLog + ")");
    return { success: true, id: rowData[0], relationRecorded: !relationWarning, relationWarning: relationWarning };
  } catch (err) { return { success: false, error: err.message }; }
}

function editData(rowData, activeUser, originalCoord, duplicateDecision) {
  try {
    const role = _requireDataEditor_(activeUser);
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

    const candidates = _findDuplicateCandidates_(rowData, targetId);
    const resolvedDecision = _resolveDuplicateDecision_(candidates, duplicateDecision);
    if (resolvedDecision && resolvedDecision.required) {
      return { success: false, requiresDuplicateDecision: true, candidates: candidates };
    }
    sheet.getRange(rowIndex, 1, 1, rowData.length).setValues([rowData]);
    sheet.getRange(rowIndex, 3).setNumberFormat('@'); SpreadsheetApp.flush();
    let relationWarning = "";
    try { _recordDataRelation_(rowData, resolvedDecision, activeUser, role, "Edit Data"); }
    catch (relationError) { relationWarning = relationError.message; }
    let sumberLog = rowData[1] ? " - " + rowData[1] : "";
    logActivity(activeUser, "Mengedit Data (ID: " + targetId + sumberLog + ")");
    return { success: true, id: targetId, relationRecorded: !relationWarning, relationWarning: relationWarning };
  } catch (err) { return { success: false, error: err.message }; }
}

function _photoBlobFromDataUrl_(dataUrl, filename) {
  if (!dataUrl || dataUrl.indexOf(',') === -1) throw new Error("Data foto tidak valid.");
  const parts = dataUrl.split(',');
  const mimeType = parts[0].split(':')[1].split(';')[0];
  return Utilities.newBlob(Utilities.base64Decode(parts[1]), mimeType, filename || "foto.jpg");
}

function uploadSurveyPhotos(originalDataUrl, watermarkedDataUrl, baseName, activeUser) {
  try {
    _requireDataEditor_(activeUser);
    const safeBase = String(baseName || "Survei").replace(/[^A-Za-z0-9 _.-]/g, "-").slice(0, 80);
    const folders = DriveApp.getFoldersByName("DataPembanding_Foto");
    const folder = folders.hasNext() ? folders.next() : DriveApp.createFolder("DataPembanding_Foto");
    const original = folder.createFile(_photoBlobFromDataUrl_(originalDataUrl, safeBase + " - ASLI.jpg"));
    const watermarked = folder.createFile(_photoBlobFromDataUrl_(watermarkedDataUrl, safeBase + " - WATERMARK.jpg"));
    // Bukti asli tetap privat di Drive. Hanya salinan watermark yang dipakai pada tampilan aplikasi.
    watermarked.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return {
      success: true,
      originalUrl: original.getUrl(),
      originalFileId: original.getId(),
      watermarkedUrl: "https://drive.google.com/thumbnail?id=" + watermarked.getId() + "&sz=w1200",
      watermarkedFileId: watermarked.getId()
    };
  } catch (error) { return { success: false, error: error.message }; }
}

function uploadFoto(dataUrl, filename) {
  try {
    const blob = _photoBlobFromDataUrl_(dataUrl, filename || 'foto.jpg'); const folderName = 'DataPembanding_Foto';
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
