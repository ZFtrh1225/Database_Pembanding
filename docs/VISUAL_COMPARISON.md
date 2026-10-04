# Ruang Kerja Perbandingan Properti

Fitur perbandingan memakai **Profil Aset** sebagai kolom acuan dan menampilkan maksimal empat data pembanding dalam satu telaah. Warna sel menunjukkan kedekatan karakteristik, bukan penilaian otomatis bahwa suatu data baik atau buruk.

## Alur penggunaan

1. Isi Profil Aset dari tombol `Profil Aset`.
2. Pilih tombol `Bandingkan` pada maksimal empat kartu data.
3. Buka ruang kerja perbandingan.
4. Gunakan urutan dan penyaring sumber, kandidat, atau duplikat.
5. Tetapkan maksimal tiga data sebagai `Pembanding Utama`.
6. Tinjau alasan otomatis dan rincian perbedaan sebelum menjalankan analisis pada tahap berikutnya.

## Pembanding utama

Pilihan disimpan pada `localStorage` berdasarkan pengguna dengan kunci stabil `ID + Koordinat`. Pilihan dipulihkan ketika hasil pencarian berikutnya memuat data yang sama. Data berstatus `Dikecualikan` tidak dapat dipilih.

Penyimpanan ini hanya berlaku pada browser/perangkat yang digunakan. Belum ada perubahan pada Google Sheet atau Apps Script.

## Warna perbedaan

- Hijau: karakteristik berada dalam rentang dekat terhadap Profil Aset.
- Kuning: ada perbedaan yang perlu ditelaah.
- Merah: perbedaan besar atau informasi penting kosong.
- Abu-abu: karakteristik Profil Aset belum diisi atau tidak dinilai secara arah baik/buruk.

Harga dan indikasi nilai tidak diberi makna “murah lebih baik” atau “mahal lebih buruk”. Ringkasan rata-rata, median, dan rentang bersifat deskriptif dan bukan kesimpulan nilai.

## Statistik sebaran nilai/m²

Ruang kerja menghitung statistik dari kandidat yang sedang tampil setelah filter perbandingan diterapkan:

- rata-rata dan median indikasi nilai/m²;
- standar deviasi sampel dalam Rp/m² dengan pembagi `n - 1`;
- koefisien variasi (`standar deviasi ÷ rata-rata × 100%`);
- rentang minimum–maksimum dan selisih relatif terhadap nilai minimum.

Warna koefisien variasi mempertahankan indikator internal aplikasi: hijau sampai 4%, kuning di atas 4% sampai 7%, dan merah di atas 7%. Ambang ini bukan standar MAPPI/SPI dan tidak menentukan kelayakan pembanding secara otomatis. Statistik tidak ditampilkan sebagai kesimpulan nilai; penilai tetap menelaah sumber, tanggal, lokasi, karakteristik, serta penyesuaian setiap data.
