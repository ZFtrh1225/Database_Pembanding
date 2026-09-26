// ============================================================
// CARI DATA PEMBANDING — Google Apps Script Backend (API MODE)
// ============================================================

const SHEET_NAME = "DataPembanding";
const USERS_SHEET = "Users";
const HISTORY_SHEET = "History";
const MODEL_SHEET = "Model_Regresi"; // TAMBAHAN: Nama sheet database model

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    const args = body.args || [];
    let result;

    if (action === 'checkLogin') { result = checkLogin(args[0], args[1]); } 
    else if (action === 'searchData') { result = searchData(args[0]); } 
    else if (action === 'addData') { result = addData(args[0], args[1]); } 
    else if (action === 'editData') { result = editData(args[0], args[1], args[2]); } 
    else if (action === 'uploadFoto') { result = uploadFoto(args[0], args[1]); } 
    else if (action === 'updateFoto') { result = updateFoto(args[0], args[1]); } 
    else { result = { success: false, error: "Fungsi tidak ditemukan!" }; }

    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (error) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: error.message })).setMimeType(ContentService.MimeType.JSON);
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
  SpreadsheetApp.flush();
  return "Spreadsheet siap! Database Properti, Akun, dan Histori telah disetup.";
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
        let isLengkap = String(row[3]||'').trim()!=="" && String(row[5]||'').trim()!=="" && String(row[6]||'').trim()!=="" && String(row[7]||'').trim()!=="" && String(row[8]||'').trim()!=="" && String(row[10]||'').trim()!=="" && String(row[13]||'').trim()!=="";
        if (params.statusData === "Lengkap" && !isLengkap) return false;
        if (params.statusData === "Tidak Lengkap" && isLengkap) return false;
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
