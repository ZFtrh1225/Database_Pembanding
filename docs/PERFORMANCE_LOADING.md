# Performa, Loading, dan Pemulihan Error

## Jalur peta pertama

Mode awal aplikasi adalah OpenStreetMap. Setelah login, Leaflet diinisialisasi langsung dan pencarian awal dimulai tanpa menunggu pengambilan konfigurasi maupun pustaka Google Maps. Google Maps API baru dimuat ketika pengguna:

- memilih mode Google Maps;
- mengaktifkan Heatmap;
- menggambar area polygon yang masih memakai Google Maps; atau
- beralih ke Google Maps pada Measurement.

Jika Google Maps gagal dimuat, aplikasi menampilkan **Coba Lagi** dan **Gunakan OpenStreetMap**. Data yang sudah dimuat tetap tersedia.

## Pencarian data

Setiap pencarian memperoleh nomor permintaan. Respons dari permintaan lama diabaikan apabila pengguna sudah memulai pencarian yang lebih baru. Render marker dan tabel dipisahkan ke dua frame browser agar indikator loading sempat tergambar dan antarmuka ponsel tidak membeku selama satu pekerjaan panjang.

Saat offline, pencarian dihentikan sebelum menunggu timeout server. Banner koneksi memberi tahu pengguna bahwa data yang sudah tampil masih dapat ditelaah. Setelah koneksi pulih, tombol **Coba lagi** dapat digunakan tanpa refresh halaman.

## Cache parameter

Master Parameter untuk filter, form, dan legenda disimpan pada `localStorage` selama maksimal enam jam. Cache berlaku lintas tab dan pembukaan browser berikutnya. Cache dibatalkan setelah parameter diedit, sehingga daftar terbaru diambil kembali dari Apps Script.

Cache hanya berisi parameter tampilan dan tahun data, bukan password atau API key.

## Fitur berat yang tetap dimuat sesuai kebutuhan

- Chart.js dimuat ketika grafik pertama kali digunakan.
- Generator PDF dimuat saat pengguna meminta laporan.
- Marker clustering dimuat ketika jumlah marker mencapai ambang clustering.
- Foto dikompres di browser sebelum upload.

