# Mode Survei Lapangan

Mode Survei Lapangan memakai struktur data yang sama dengan **Tambah Data**, tetapi memiliki alur khusus untuk pekerjaan lapangan dan pemeriksaan Admin.

## Alur

1. Surveyor membuka **Survei** dari navigasi ponsel atau header desktop.
2. Aplikasi merekam koordinat, akurasi GPS, dan waktu pengambilan.
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

## Deployment

Pembaruan ini mengubah `Backend/Code.gs`. Setelah merge, buat deployment Apps Script versi baru dan pastikan URL deployment aktif tetap digunakan oleh `SCRIPT_URL` pada frontend.
