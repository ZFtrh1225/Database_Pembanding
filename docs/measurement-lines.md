# Garis pengukuran pada Measurement

## Cara memakai

1. Isi koordinat **Objek Penilaian** dan satu atau lebih **Data Pembanding**, atau pilih titik di peta. Angka jarak dan pin tetap terlihat ketika garis disembunyikan.
2. Di baris tombol atas, pilih **Sembunyikan Garis** jika peta terlalu ramai; pilih **Tampilkan Garis** untuk menyalakannya kembali. Pilihan ini berlaku juga setelah berpindah antara OpenStreetMap dan Google Maps, mengubah koordinat, menutup lalu membuka Measurement. Tombol `+` dan `−` pada baris yang sama memperbesar dan memperkecil kedua peta.
3. Pada ponsel, kontrol tersusun dua baris. Panel titik lebih pendek dan dapat digulir atau disembunyikan agar peta lebih lapang.

## Arti garis dan gerakannya

Garis putus-putus berjalan dari objek menuju tiap data pembanding **hanya pada OpenStreetMap**. Mode ini memakai garis lurus dan jarak lurus (haversine), tetap diberi label `(lurus)`. **Google Maps** menampilkan garis putus-putus yang diam, mengikuti bentuk jalan dan jarak berkendara dari Directions ketika tersedia. Jika permintaan Directions gagal, garis lurus dipakai dan jarak ditandai `(lurus)`. Jika jarak rute tersedia tetapi geometri jalannya tidak ada, label menyatakan jalur peta tidak tersedia. Animasi hanya mengubah tampilan garis; koordinat, jarak, dan sumber perhitungan tidak berubah.

OSM menggeser pola putus-putus pada jalur SVG secara linear. Satu putaran menempuh 22 piksel, tepat sepanjang satu garis dan satu sela, sehingga sambungannya mulus. Animasi hanya aktif ketika Measurement terbuka dan mode OSM tampil; pengaturan pengurangan gerak perangkat menghentikannya. Google Maps memakai simbol garis berulang dengan posisi tetap. Respons rute lama diabaikan setelah input atau tampilan berubah.

## Pemasangan dan pemeriksaan

Perubahan hanya pada `index.html`; `Backend/Code.gs` tidak diubah. Setelah frontend terbaru dipasang, periksa satu pasangan titik di masing-masing mode, tombol tampil/sembunyi sebelum dan sesudah mengganti mode, zoom pada ponsel, dan jarak lurus ketika Directions tidak memberi rute. Jalankan `node tests/measurement-lines.test.cjs` untuk pemeriksaan logika tanpa koneksi peta nyata. Koneksi Google Maps dan tile OSM tetap memerlukan pengujian di aplikasi yang sudah terpasang.
