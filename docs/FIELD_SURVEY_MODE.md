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

## Pengajuan di latar belakang

- **Ajukan Survei** memindahkan salinan data, GPS, waktu, akun pembuat, dan foto ke antrean pengajuan. Formulir langsung ditutup; **+ Survei Baru** dapat digunakan sementara unggahan berjalan.
- Antrean mengirim satu survei setiap giliran. Panel **survei belum selesai** menampilkan tahap pemeriksaan duplikat, watermark, unggah foto, dan penyimpanan pengajuan.
- Jika ditemukan data serupa, pilih **Periksa Data Serupa** setelah menyimpan draf atau menutup dialog aktif. Survei lain dalam antrean tetap dapat diproses.
- Jika terjadi kegagalan, data dan foto tetap berada dalam antrean selama halaman terbuka. Gunakan **Coba Lagi**. Setelah foto berhasil diunggah, percobaan penyimpanan ulang memakai URL foto yang sama. ID survei tetap digunakan dan hasil pengajuan sebelumnya diperiksa untuk menghindari pengajuan ganda setelah respons terputus.
- Antrean berada dalam memori halaman, belum tersimpan permanen di perangkat. Tetap buka aplikasi sampai antrean selesai. Refresh, menutup browser, atau penghentian aplikasi oleh Android dapat menghilangkan antrean; browser akan memperingatkan sebelum meninggalkan halaman jika mendukungnya. Proses ini tidak menjamin pengiriman ketika aplikasi ditutup atau ditangguhkan di latar belakang oleh sistem operasi.
- **Simpan Draf**, Tambah/Edit Data biasa, endpoint backend, dan struktur sheet tetap menggunakan alur sebelumnya.

## Deployment

Peningkatan GPS otomatis dan antrean pengajuan hanya mengubah frontend dan tidak memerlukan deployment Apps Script baru. Jika pembaruan berikutnya mengubah `Backend/Code.gs`, buat deployment Apps Script versi baru dan pastikan URL aktif tetap digunakan oleh `SCRIPT_URL` pada frontend.
