# Garis pengukuran pada Measurement

## Cara memakai

1. Isi koordinat **Objek Penilaian** dan satu atau lebih **Data Pembanding**, atau pilih titik di peta. Angka jarak dan pin tetap terlihat ketika garis disembunyikan.
2. Di baris tombol atas, pilih **Sembunyikan Garis** jika peta terlalu ramai; pilih **Tampilkan Garis** untuk menyalakannya kembali. Pilihan ini berlaku juga setelah berpindah antara OpenStreetMap dan Google Maps, mengubah koordinat, menutup lalu membuka Measurement. Tombol `+` dan `−` pada baris yang sama memperbesar dan memperkecil kedua peta.
3. Saat mode Google Maps aktif, pilih lapisan **Default** atau **Satelit**. Pilihan lapisan disimpan pada browser dan digunakan kembali ketika Measurement dibuka berikutnya.
4. Pada ponsel, kontrol tetap tersusun dua baris: empat tindakan utama di baris pertama, lalu pilihan lapisan dan zoom di baris kedua. Setiap tombol memiliki target sentuh minimal 44 piksel. Panel titik lebih pendek dan dapat digulir atau disembunyikan agar peta lebih lapang.

## Arti garis dan gerakannya

Garis putus-putus berjalan dari objek menuju tiap data pembanding **hanya pada OpenStreetMap**, termasuk saat diakses lewat laptop. Mode ini memakai garis lurus dan jarak lurus (haversine), tetap diberi label `(lurus)`. **Google Maps** menampilkan garis solid yang berhenti tepat di ujung pin, mengikuti bentuk jalan serta jarak dan estimasi waktu berkendara dari Maps JavaScript Routes Library. Ujung jalur disambungkan ke koordinat pin OBJ dan data pembanding karena layanan rute terkadang mengakhiri geometri di jalan terdekat. Sambungan visual tersebut tidak mengubah angka jarak berkendara dari Google.

Jika Routes API modern belum aktif, aplikasi mencoba `DirectionsService` lama sebagai kompatibilitas sementara dan menampilkan pemberitahuan kuning. Jika kedua layanan gagal, aplikasi memakai garis lurus, menandai jaraknya dengan `· lurus`, memberi pemberitahuan merah/kuning, dan menyediakan tombol **Coba Hitung Lagi**. Dengan demikian garis lurus cadangan tidak tertukar dengan rute berkendara.

Pesan **Routes API belum aktif atau belum diizinkan pada pembatasan API key** berarti project Google Cloud perlu diperiksa: aktifkan Routes API, pastikan billing aktif, dan tambahkan Routes API pada daftar API yang diizinkan untuk key aplikasi. Setelah perubahan Google Cloud tersimpan, tunggu propagasi sebentar lalu tekan **Coba Hitung Lagi**; aplikasi tidak perlu di-deploy ulang hanya untuk perubahan konfigurasi Cloud tersebut.

OSM memakai renderer SVG Leaflet; setiap frame memperbarui posisi pola putus-putus pada jalur SVG yang benar-benar terlihat. Satu putaran menempuh 22 piksel, tepat sepanjang satu garis dan satu sela, sehingga sambungannya mulus. Gerak berlangsung 120 piksel per detik dan menunggu jika Leaflet belum memasang SVG pada frame pertama. Animasi aktif ketika Measurement terbuka, garis ditampilkan, dan mode OSM aktif; berhenti ketika tab tersembunyi. Di Google Maps, titik jangkar ikon berada pada ujung pin yang sebenarnya; garis solid mengikuti koordinat yang sama. Respons rute lama diabaikan setelah input atau tampilan berubah.

## Pemasangan dan pemeriksaan

Perubahan hanya pada `index.html`; `Backend/Code.gs` tidak diubah. Di Google Cloud, aktifkan **Maps JavaScript API** dan **Routes API** pada project yang sama, lalu izinkan keduanya pada pembatasan API key. `Directions API` bersifat opsional selama fallback kompatibilitas lama masih dipertahankan.

Gabungan PR di GitHub tidak otomatis memperbarui salinan `index.html` yang sudah dipasang secara terpisah. Pasang frontend terbaru, kemudian periksa satu pasangan titik di masing-masing mode, tombol tampil/sembunyi sebelum dan sesudah mengganti mode, zoom pada ponsel, dan jarak lurus ketika layanan rute tidak memberi hasil. Jalankan `node tests/measurement-lines.test.cjs` untuk memeriksa Routes API, fallback, perubahan offset jalur SVG per frame, dan sambungan ke pin tanpa koneksi peta nyata. Koneksi Google Maps dan tile OSM tetap memerlukan pengujian di aplikasi yang sudah dipasang.
