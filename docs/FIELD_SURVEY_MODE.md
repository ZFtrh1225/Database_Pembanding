# Mode Survei Lapangan

Mode Survei Lapangan memakai struktur data yang sama dengan **Tambah Data**, tetapi memiliki alur khusus untuk pekerjaan lapangan dan pemeriksaan Admin.

## Alur

1. Surveyor membuka **+ Survei Baru** dari navigasi ponsel atau **Survei** dari header desktop.
2. Aplikasi memantau GPS secara otomatis, menampilkan akurasi secara langsung, dan merekam koordinat terbaik yang masih baru beserta waktu pengambilan.
3. Surveyor mengisi formulir bertahap dan mengambil foto dengan kamera belakang.
4. Foto asli disimpan privat di folder Google Drive `DataPembanding_Foto`. Salinan JPEG ber-watermark digunakan pada aplikasi.
5. Draf teks tersimpan otomatis di perangkat. Tombol **Simpan Draf** menyimpan draf ke sheet `Survei_Lapangan` ketika koneksi tersedia.
6. Sebelum diajukan, mesin mendeteksi kandidat duplikat. Jika ditemukan, Surveyor wajib menjelaskan hubungan datanya.
7. Survei berstatus **Menunggu Review**. Admin atau Superadmin dapat menyetujui atau menolak dengan catatan.
8. Survei yang disetujui baru dimasukkan ke `DataPembanding`. Jika ada relasi duplikat dari Surveyor, relasinya tetap masuk ke antrean **Review Relasi**.

## Status

- **Draf**: masih dapat diedit oleh pembuat.
- **Menunggu Review**: terkunci sampai keputusan reviewer.
- **Ditolak**: kembali dapat diperbaiki dan diajukan ulang.
- **Disetujui**: sudah dipindahkan ke database utama.

## Privasi foto

File asli tidak diberi izin publik dan tidak diubah. Salinan watermark berisi username Surveyor, waktu, koordinat, serta akurasi GPS dan dapat ditampilkan melalui aplikasi.

## GPS otomatis

- GPS menggunakan `watchPosition()` dengan mode akurasi tinggi selama formulir survei terbuka.
- Target siap adalah akurasi `<= 10 m`; akurasi `<= 5 m` ditandai sangat baik.
- Selama perangkat diam, aplikasi memilih pembacaan terbaik dari lima detik terakhir.
- Saat kendaraan terdeteksi bergerak, aplikasi mengutamakan pembacaan terbaru agar koordinat tidak tertinggal di belakang kendaraan.
- Setelah 12 detik, pengisian form tetap dapat dilanjutkan dan GPS terus meningkatkan akurasi di latar belakang.
- Pemantauan dihentikan ketika halaman disembunyikan, formulir ditutup, atau survei disimpan; saat halaman aktif kembali GPS dimulai lagi.
- Jika GPS berubah setelah foto dipilih, salinan watermark dibuat ulang dengan metadata terbaru sebelum upload. Foto asli tidak diubah.

## Deployment

Peningkatan GPS otomatis hanya mengubah frontend dan tidak memerlukan deployment Apps Script baru. Jika pembaruan berikutnya mengubah `Backend/Code.gs`, buat deployment Apps Script versi baru dan pastikan URL aktif tetap digunakan oleh `SCRIPT_URL` pada frontend.
