# Pemulihan koneksi API dan perlindungan Google Maps key

## Mengapa peringatan muncul

Frontend GitHub Pages sebelumnya melakukan `fetch()` langsung ke Web App Google
Apps Script. Respons `ContentService` melewati redirect Google. Pada sebagian
browser atau jaringan, redirect itu gagal (`Failed to fetch`) atau mengembalikan
halaman HTML yang kemudian gagal dibaca sebagai JSON (`Unexpected token '<'`).

Versi ini memakai iframe **API Bridge**. Iframe berasal dari Web App Apps Script,
memanggil backend melalui `google.script.run`, dan hanya menerima pesan dari:

`https://zftrh1225.github.io`

Dengan begitu login, pencarian, penyimpanan, dan upload tidak lagi bergantung
pada `fetch()` lintas-domain.

## Langkah deployment Apps Script

1. Salin seluruh `Backend/Code.gs` terbaru ke project Apps Script yang terhubung
   dengan Spreadsheet Database Pembanding.
2. Buka **Project Settings → Script Properties**.
3. Tambahkan property:

   - Property: `GOOGLE_MAPS_API_KEY`
   - Value: key Google Maps baru yang sudah dibatasi.

4. Pilih **Deploy → Manage deployments → Edit**.
5. Pada **Version**, pilih **New version**.
6. Pastikan **Execute as: Me** dan **Who has access: Anyone**.
7. Klik **Deploy**. Jika URL `/exec` berubah, perbarui `SCRIPT_URL` di
   `index.html` sebelum GitHub Pages dipublikasikan.
8. Buka URL `/exec`. Halaman bridge memang kosong; yang tidak boleh muncul lagi
   adalah pesan `Fungsi skrip tidak ditemukan: doGet`.

Perubahan `Code.gs` tidak aktif hanya dengan commit GitHub. Web App Apps Script
harus dibuatkan **versi deployment baru**.

## Membatasi Google Maps API key

Key Google Maps JavaScript tidak dapat benar-benar disembunyikan karena browser
harus mengirimkannya ke Google. Perlindungan utama adalah pembatasan key.

Di **Google Cloud Console → APIs & Services → Credentials**:

1. Cabut/revoke semua key lama yang pernah masuk ke riwayat GitHub.
2. Buat key baru.
3. Pilih **Application restrictions → Websites (HTTP referrers)**.
4. Izinkan hanya:

   - `https://zftrh1225.github.io/Database_Pembanding/`
   - `https://zftrh1225.github.io/Database_Pembanding/*`

5. Pilih **API restrictions → Restrict key** dan izinkan hanya:

   - Maps JavaScript API
   - Directions API, karena fitur Measurement memakai `DirectionsService`

6. Simpan key tersebut sebagai Script Property, bukan di file GitHub.

## Menutup GitHub Secret Scanning alert

Alert lama tetap muncul karena key tersimpan dalam riwayat commit. Setelah key
lama benar-benar dicabut di Google Cloud, tutup alert GitHub dengan alasan
**Revoked**. Jangan pilih **False positive**, karena key memang pernah dipublikasikan.

Menaruh key dalam GitHub Actions Secret saja tidak menyelesaikan masalah apabila
key tetap disisipkan ke file hasil build yang publik. Runtime configuration dalam
versi ini mengeluarkan key dari repository, sedangkan restriction di Google Cloud
melindungi key yang tetap dapat dilihat oleh browser.
