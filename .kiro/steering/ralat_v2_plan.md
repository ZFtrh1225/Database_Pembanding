---
inclusion: manual
description: Rencana arsitektur Fase 1.5 — RaLAT Engine v2 (penyesuaian spasial + variabel non-spasial menggunakan seluruh model regresi yang tersedia di sheet Model_Regresi)
---

# RaLAT v2 — Rencana Arsitektur Fase 1.5

> Dokumen ini adalah blueprint kerja untuk meng-upgrade fungsi RaLAT (Regresi
> Lokasi Aset Terhadap pembanding) dari pemakaian 4 variabel POI menjadi
> pemakaian penuh seluruh variabel di model regresi yang tersedia di sheet
> Google Sheets `Model_Regresi`.
>
> Konteks lengkap diskusi sebelum dokumen ini ada di chat history:
> "Analisis Data Model_Regresi yang Kamu Lampirkan" — temuan utama bahwa
> RaLAT versi sekarang hanya memakai ~15% kapasitas model.

---

## 1. Tujuan Fase 1.5

1. **Manfaatkan seluruh koefisien regresi** yang sudah ada di
   `Model_Regresi` (25+ variabel × 13 region × 3 versi model).
2. **Adjustment yang konsisten dengan SPI/PPPI 2.4**: cakup elemen fisik
   (luas tanah, frontage, bentuk tapak) dan kategori (penggunaan, kawasan
   industri) yang belum tersentuh oleh RaLAT v1.
3. **Transparansi & auditability**: tampilkan kontribusi tiap variabel
   terhadap penyesuaian harga per pembanding (tornado mini per row).
4. **Versioning model**: pilih versi terbaru otomatis, tetap dapat memilih
   versi lama untuk mereproduksi laporan historis.
5. Menjadi **fondasi yang benar** sebelum SBM upgrade & Monte Carlo,
   supaya tidak garbage-in garbage-out.

---

## 2. Inventarisasi Variabel Model

### 2.1 Variabel `ln_distance_to_*` (jarak ke fitur)

| CSV variable | OSM tag | Perlu Overpass query baru? |
|---|---|---|
| `ln_distance_to_mall` | `shop=mall` | sudah |
| `ln_distance_to_hospital` | `amenity=hospital` | sudah |
| `ln_distance_to_school` | `amenity=school` | sudah |
| `ln_distance_to_university` | `amenity=university` | **tambah** |
| `ln_distance_to_bus_stop` | `highway=bus_stop` | **tambah** |
| `ln_distance_to_train_station` | `railway=station` | sudah |
| `ln_distance_to_lrt` | `railway=station` + `station=light_rail` | **tambah** |
| `ln_distance_to_toll_gate` | `highway=motorway_junction` | sudah |
| `ln_distance_to_road` (jalan utama) | `highway=primary\|trunk\|motorway` (way) | **tambah, query way** |
| `ln_distance_to_government` | `office=government` / `amenity=townhall` | **tambah** |
| `ln_distance_to_airport` | `aeroway=aerodrome` | **tambah** |
| `ln_distance_to_harbour` | `harbour=yes` / `landuse=harbour` / `amenity=ferry_terminal` | **tambah** |
| `ln_distance_to_graveyard` | `landuse=cemetery` / `amenity=grave_yard` | **tambah** |
| `ln_distance_to_hotel` | `tourism=hotel` | **tambah** |
| `ln_distance_to_retail` | `landuse=retail` / `shop=*` | **tambah** |
| `ln_distance_to_entertainment` | `amenity=theatre\|cinema\|nightclub` | **tambah** (Bali) |
| `ln_distance_to_restaurant` | `amenity=restaurant` | **tambah** (Bali) |
| `ln_distance_to_historical` | `historic=*` | **tambah** (Bali) |
| `ln_distance_to_coastline` | `natural=coastline` (way) | **tambah** (Bali, NTT, Banten) |
| `ln_distance_to_river` | `waterway=river` (way) | **tambah** (Kalimantan) |
| `ln_distance_to_big_city` / `small_city` | `place=city/town` | **tambah** |
| `ln_distance_to_jakarta` / `BEJ` / `KRB` / `tigaraksa` / `tangsel` / `satelite_*` | titik koordinat hardcode (config) | **lookup table** |

**Rekomendasi implementasi**:
- Bangun **satu Overpass query gabungan per region** yang mengambil semua
  fitur di atas dalam radius adaptif (2.5/5/10/20 km).
- Untuk way (jalan utama, sungai, garis pantai), pakai Overpass query
  geometry + hitung jarak ke segment terdekat (haversine ke setiap node way,
  ambil minimum). Untuk MVP: cukup pakai centroid atau node dari way.
- Untuk titik tetap (Jakarta, BEJ, KRB), simpan di JSON config `landmarks.js`.

### 2.2 Variabel `POI_*_500m` / `POI_*_1000m` (jumlah POI)

Tipe **count**, bukan distance. Implementasi:

```js
// Hitung jumlah node yang match tag dalam radius rₓ
function countPOI(propLatLng, elements, tagFilter, radiusM) {
  return elements.filter(el => el.tags && tagFilter(el.tags) &&
    distance(propLatLng, el) <= radiusM
  ).length;
}
```

Adjustment ke harga: `price *= (1 + (countAset - countComp) * koefisien)`
(linier, bukan log, karena variabel sumber tidak di-log).

### 2.3 Variabel non-spasial (input user / metadata)

| Variabel | Tipe | Sumber data |
|---|---|---|
| `ln_luas_tanah` | ln | dari `row.luasTanah` (dataset) + input aset |
| `lebar_jalan_di_depan_adj` | numerik | input user di form aset target |
| `industrial_area_percentage` | numerik [0..1] | reverse-geocode landuse OSM atau input |
| `is_komersial` / `is_perumahan` / `is_industrial` / `is_kebun` / `is_hook` | dummy 0/1 | dari `row.peruntukan`, `row.posisi`, `row.objek` |
| `tapak_beraturan` | dummy 0/1 | dari `row.bentuk` |
| `luas_lower` / `luas_upper` | dummy 0/1 | dari `row.luasTanah` vs threshold size class |

### 2.4 Variabel `is_<city>` (city marker)

Auto-detect via **Nominatim reverse-geocoding**:

```
GET https://nominatim.openstreetmap.org/reverse?format=json&lat=...&lon=...&zoom=10&accept-language=id
```

Map `address.city` / `address.town` / `address.county` ke daftar marker
yang relevan untuk model region terpilih. Cache localStorage 30 hari (kota
tidak berubah).

> ⚠️ **Nominatim Usage Policy** mewajibkan: rate limit 1 req/s, set
> `User-Agent` jelas, pakai cache. Aplikasi ini sudah memenuhi krn
> request hanya saat user input aset (jarang).

---

## 3. Arsitektur Modul

```
js/
  ralat/
    model_loader.js      # Normalize regressionModels (decimal comma, typo, version)
    overpass_collector.js# Bangun query gabungan + cache + adaptive radius
    nominatim_lookup.js  # Reverse-geocode → city markers
    feature_builder.js   # Susun {fitur: nilai} untuk aset & tiap pembanding
    ralat_engine.js      # Apply koefisien → return {adjPct, breakdown[]}
    ralat_ui.js          # Render audit trail + tornado mini
```

(Untuk single-file index.html sekarang: tetap inline tapi dipisah dengan
section comment yang jelas.)

---

## 4. Pipeline Eksekusi RaLAT v2

```
1. doSearch() berhasil → window.regressionModels terisi
2. User klik tombol Analisa
3. RaLAT engine v2 mulai:
   a. Pilih model:
        regionKey = mapProvinceToModelRegion(centerProvinsi)
        modelVersion = pickLatestVersion(regionKey)  // by suffix YYYYMMDD
        activeModel = regressionModels[regionKey][modelVersion]
   b. Reverse-geocode aset → city markers
   c. Overpass query gabungan untuk aset (radius adaptif)
        → asetFeatures = featureBuilder(asetCoord, asetMeta, overpassRes, geocodeRes)
   d. Untuk tiap pembanding:
        Overpass query gabungan untuk pembanding (cache hit kebanyakan)
        compFeatures = featureBuilder(compCoord, compMeta, ...)
        adjPct, breakdown = ralatEngine(activeModel, asetFeatures, compFeatures)
        priceAdj = priceTimeAdjusted * (1 + adjPct)
4. Simpan ke _avmRawData[i].breakdown untuk audit
5. recalcAVM() sebagai sebelumnya (IQR + override + median)
6. Render audit trail dengan kolom tambahan: top-3 variabel paling kontribusi
```

### 4.1 Rumus per variabel

```
Untuk tiap variabel v dalam activeModel:
  jika v.tipe == 'ln':
      dAset = jarak(asetFeatures[v]); dComp = jarak(compFeatures[v])
      dAset = max(dAset, 50);  // floor 50m supaya log tidak meledak
      dComp = max(dComp, 50);
      kontribPct = (ln(dAset) - ln(dComp)) * v.koefisien

  jika v.tipe == 'poi' (count):
      kontribPct = (asetFeatures[v] - compFeatures[v]) * v.koefisien

  jika v.tipe == 'numerik':
      kontribPct = (asetFeatures[v] - compFeatures[v]) * v.koefisien

  jika v.tipe in ('kategori', 'marking'):
      kontribPct = (asetFeatures[v] - compFeatures[v]) * v.koefisien
                                     # nilainya {0,1}, jadi {-1, 0, +1}

  jika v.tipe == 'konstanta':
      skip (konstanta hanya untuk model awal, cancel di selisih)
```

`adjPct = sum(semua kontribPct)`. Aplikasikan ke harga pembanding dengan
`price * (1 + adjPct)`.

Catatan ekonometrik: karena kedua sisi (aset vs pembanding) sama-sama
diprediksi pakai model yang sama dan kita ambil **selisihnya**, konstanta β₀
otomatis batal. Inilah yang membuat pendekatan "RaLAT" valid sebagai
*adjustment*, bukan prediksi nilai absolut.

### 4.2 Sanity check

- Hard cap **|adjPct| ≤ 50%** per pembanding agar tidak "meledak"
  saat data ekstrem (mis. is_kebun aktif untuk ruko karena salah label).
- Kalau capped, beri warning di audit trail.

---

## 5. Loader Model_Regresi (normalisasi)

```js
function normalizeRegressionModels(rawModels) {
  // rawModels: dari getRegressionModels() backend, bentuk:
  //   { "Jawa Timur": { "is_surabaya": {tipe:"marking", koefisien:0.74...}, ... } }
  // Tapi backend sekarang men-flatten semua versi ke satu Model name yg sama.
  //
  // FIX backend (atau di frontend): pakai kolom A "Order"/Kolom B "ID"
  // untuk mengekstrak suffix versi YYYYMMDD.
  //
  // Keluaran:
  //   { "Jawa Timur": { "20241213": {is_surabaya: {...}, ...}, "20241202": {...} } }
  //
  // Decimal koma → titik: backend sudah handle parseFloat, tapi pastikan locale.
  // Typo: "katergori" → "kategori"; "unknown" → "kategori".
}
```

Kemudian:
```js
function pickLatestVersion(regionMap) {
  return Object.keys(regionMap).sort().reverse()[0];
}
```

---

## 6. Mapping Provinsi → Model Region

Karena model region tidak persis mengikuti provinsi BPS:

```js
const PROVINCE_TO_MODEL_REGION = {
  'DKI Jakarta':           'Jabodetabek',
  'Banten':                ['Jabodetabek', 'Banten'],   // by city: Tangerang/Tangsel → Jabodetabek
  'Jawa Barat':            ['Jabodetabek', 'Jawa Barat'], // Bekasi/Bogor/Depok → Jabodetabek
  'Jawa Tengah':           'Jawa Tengah - Yogyakarta',
  'DI Yogyakarta':         'Jawa Tengah - Yogyakarta',
  'Jawa Timur':            'Jawa Timur',                 // Madura cek by kota
  'Bali':                  'Bali',
  'Nusa Tenggara Barat':   'Nusa Tenggara',
  'Nusa Tenggara Timur':   'Nusa Tenggara',
  'Sumatera Utara':        'Sumatra',
  // ... dst
  'Kepulauan Bangka Belitung': 'Bangka Belitung',
  'Kepulauan Riau':        'Batam',                      // jika kota=Batam
  'Kalimantan*':           'Kalimantan',
  'Sulawesi*':             'Sulawesi',
};
```

Kasus disambiguasi (Bekasi/Karawang antara Jabodetabek vs Jawa Barat):
gunakan kota dari Nominatim, bukan kolom provinsi.

---

## 7. Field Tambahan di Form Aset Target

Sebelum memanggil RaLAT v2, user perlu mengisi:

- **Tanggal Penilaian** ✅ (sudah ada, Patch 6 Fase 1)
- **Lebar jalan depan (m)** — nomor desimal, default null
- **Bentuk tapak** — radio (beraturan/tidak) ; default beraturan
- **Posisi** — radio (hook/tengah/tusuk sate) ; default tengah
- **Penggunaan** — auto-pick dari peruntukan filter; bisa override
- **Luas tanah aset** — nomor, default null

Idealnya panel kecil yg muncul saat klik "Gunakan sbg Pusat Radius",
sebelum modal Analisa dibuka. Atau di top section modal Analisa.

`industrial_area_percentage` — untuk MVP: default 0, advanced: hitung dari
Overpass `landuse=industrial` polygon yang overlap radius 1 km aset.

---

## 8. UI Audit Trail v2

Tabel audit existing punya kolom: Pakai, ID DP, Harga Terkoreksi,
Penyesuaian RaLAT, Status IQR.

Tambahkan:
- **Top-3 driver**: tooltip atau row expand menampilkan 3 variabel dengan
  |kontribPct| terbesar untuk pembanding tsb.
- **Total adj %**: badge berwarna (hijau < 10%, kuning 10–25%, merah > 25%).
- **Warning capped**: ikon ⚠️ jika adj di-clamp ke ±50%.
- **Gross adjustment**: jumlah |kontribPct| (bukan net) — penilai
  pakai gross < 25% sebagai indikator pembanding paling reliable
  (PPPI 2.4 best practice).

---

## 9. Penambahan ke PDF Laporan

- Tabel "Komposisi Penyesuaian Spasial (RaLAT)" per pembanding:
  variabel | nilai aset | nilai pembanding | β | kontribusi % | komentar.
- Catatan **disclaimer ekonometrik**:
  > Adjustment dihitung dari koefisien regresi hedonic log-log
  > pada model {regionKey}/{version}. β tidak menyatakan kausalitas
  > dan tidak menggantikan judgement penilai.
- Sumber model & timestamp pengambilan data Overpass.

---

## 10. Estimasi Effort

| Task | Effort | Dependensi |
|---|---|---|
| Backend: ekspos versioning di getRegressionModels | 30 mnt | Apps Script |
| Frontend: model loader + normalisasi | 1.5 jam | — |
| Frontend: overpass_collector unified | 2 jam | Patch 2/3 (sudah selesai) |
| Frontend: nominatim_lookup + city marker map | 1.5 jam | — |
| Frontend: feature_builder | 2 jam | overpass + nominatim |
| Frontend: ralat_engine | 1 jam | feature_builder |
| Frontend: form aset target (lebar, bentuk, posisi, dll) | 2 jam | — |
| Frontend: audit trail v2 | 1.5 jam | ralat_engine |
| QA & sanity check (cap ±50%, warning capped) | 1 jam | — |
| **Total** | **~13 jam** | — |

---

## 11. Risiko & Mitigasi

| Risiko | Mitigasi |
|---|---|
| Overpass timeout untuk query gabungan | Split per kategori, parallel fetch, cache |
| Nominatim rate limit | Cache 30 hari, request hanya 1× per koordinat |
| β yang aneh (Banten bus_stop +0.31) | Tampilkan ke penilai dengan highlight; tidak diam-diam |
| `is_kebun` aktif untuk ruko | Validasi: tipe properti vs kategori. Warning. |
| Ada model region tidak punya variabel tertentu | Skip variabel itu (β=0 effect), jangan crash |
| User isi `lebar_jalan_di_depan_adj` kosong | Skip kontribusi variabel itu, log ke audit |
| Pembanding tidak punya `luas tanah` | Skip `ln_luas_tanah` untuk row tsb |

---

## 12. Acceptance Criteria

- [ ] Model regresi versioning otomatis pick latest, dapat di-override.
- [ ] Setiap variabel di model dipakai (tidak ada koefisien yang terbuang).
- [ ] Auto-detect kota via Nominatim untuk fill `is_<city>`.
- [ ] Form aset target memuat 5 field tambahan.
- [ ] Audit trail menampilkan kontribusi per variabel (top-3).
- [ ] Cap ±50% per pembanding berfungsi & ada warning UI.
- [ ] PDF laporan memuat breakdown RaLAT per pembanding.
- [ ] Tidak ada regresi pada Fase 1 fitur (POI, SBM, IQR tetap jalan).
- [ ] Semua call Overpass via cache helper Fase 1.

---

## 13. Setelah Fase 1.5 Selesai → Fase 2 & 3

- **Fase 2**: SBM upgrade (rename → "Forward Scenario / Investment View",
  tornado chart, anchored probabilities, sensitivity analysis).
- **Fase 3**: Monte Carlo Simulation (lognormal dari pembanding ter-RaLAT,
  histogram + persentil + probability calculator).
- **Fase 4**: Reconciliation tab (penilai memilih final value dari median
  / Monte Carlo / SBM dengan justifikasi tertulis).

Ketiga fase di atas membutuhkan output RaLAT v2 sebagai input — itulah
mengapa Fase 1.5 wajib lebih dulu.
