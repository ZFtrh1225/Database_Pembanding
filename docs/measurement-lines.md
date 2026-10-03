# Garis pengukuran pada Measurement

## Cara memakai

1. Isi koordinat **Objek Penilaian** dan satu atau lebih **Data Pembanding**, atau pilih titik di peta. Angka jarak dan pin tetap terlihat ketika garis disembunyikan.
2. Di baris tombol atas, pilih **Sembunyikan Garis** jika peta terlalu ramai; pilih **Tampilkan Garis** untuk menyalakannya kembali. Pilihan ini berlaku juga setelah berpindah antara OpenStreetMap dan Google Maps, mengubah koordinat, menutup lalu membuka Measurement. Tombol `+` dan `−` pada baris yang sama memperbesar dan memperkecil kedua peta.
3. Pada ponsel, kontrol tersusun dua baris. Panel titik lebih pendek dan dapat digulir atau disembunyikan agar peta lebih lapang.

## Arti garis dan gerakannya

Garis putus-putus berjalan dari objek menuju tiap data pembanding **hanya pada OpenStreetMap**, termasuk saat diakses lewat laptop. Mode ini memakai garis lurus dan jarak lurus (haversine), tetap diberi label `(lurus)`. **Google Maps** menampilkan garis solid yang berhenti tepat di ujung pin, mengikuti bentuk jalan dan jarak berkendara dari Directions ketika tersedia. Simbol garis berulang lama bisa menggambar bagian di luar titik koordinat, sehingga kini jalur Google digambar sebagai garis langsung. Ujung jalur disambungkan ke koordinat pin OBJ dan data pembanding, karena Directions terkadang mengakhiri geometri di jalan terdekat. Jika permintaan Directions gagal, garis lurus dipakai dan jarak ditandai `(lurus)`. Jika jarak rute tersedia tetapi geometri jalannya tidak ada, label menyatakan jalur peta tidak tersedia. Sambungan visual ke pin tidak mengubah angka jarak berkendara dari Directions.

OSM memakai renderer SVG Leaflet; setiap frame memperbarui posisi pola putus-putus pada jalur SVG yang benar-benar terlihat. Satu putaran menempuh 22 piksel, tepat sepanjang satu garis dan satu sela, sehingga sambungannya mulus. Gerak berlangsung 120 piksel per detik dan menunggu jika Leaflet belum memasang SVG pada frame pertama. Animasi aktif ketika Measurement terbuka, garis ditampilkan, dan mode OSM aktif; berhenti ketika tab tersembunyi. Di Google Maps, titik jangkar ikon berada pada ujung pin yang sebenarnya; garis solid mengikuti koordinat yang sama. Respons rute lama diabaikan setelah input atau tampilan berubah.

## Pemasangan dan pemeriksaan

Perubahan hanya pada `index.html`; `Backend/Code.gs` tidak diubah. Gabungan PR di GitHub tidak otomatis memperbarui salinan `index.html` yang sudah dipasang secara terpisah. Pasang frontend terbaru, kemudian periksa satu pasangan titik di masing-masing mode, tombol tampil/sembunyi sebelum dan sesudah mengganti mode, zoom pada ponsel, dan jarak lurus ketika Directions tidak memberi rute. Jalankan `node tests/measurement-lines.test.cjs` untuk memeriksa perubahan offset jalur SVG per frame dan sambungan ke pin tanpa koneksi peta nyata. Koneksi Google Maps dan tile OSM tetap memerlukan pengujian di aplikasi yang sudah terpasang.
