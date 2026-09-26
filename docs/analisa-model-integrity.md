# Integritas model dalam fitur Analisa

## Sumber dan versi

`Backend/Code.gs` membaca sheet `Model_Regresi`, kolom B (ID), C (wilayah), D (tipe), E (label asli), F (nama variabel), dan G (koefisien). Delapan digit tanggal pada akhir ID kolom B menjadi versi model. Model dikelompokkan per **wilayah → versi → variabel**. Label dan nomor baris sheet ikut dikirim ke Audit agar sumber koefisien dapat diperiksa. Baris tanpa tanggal versi dan duplikat variabel pada kelompok yang sama dilewati dan jumlahnya ditampilkan di Audit. Analisa memilih versi tanggal terbaru di wilayah **aset target** yang didapat dari reverse geocoding koordinat target. Respons backend lama yang hanya berisi koefisien gabungan tidak digunakan untuk RaLAT.

Pada workbook yang diperiksa, terdapat 687 baris berkoefisien, 13 wilayah, 36 kelompok wilayah/versi, dan 2 baris Jawa Timur tanpa akhiran tanggal (baris 2–3). Gabungan variabel wilayah lintas versi berjumlah 322, sedangkan himpunan versi terbaru hanya 256 variabel. Pemisahan versi mencegah variabel dari versi lama terbawa ke analisis terbaru.

## Alur perhitungan

1. Harga pembanding disesuaikan terhadap waktu penilaian menurut persentase yang diisi pada formulir.
2. Jika model wilayah dan versi tersedia, RaLAT menghitung perbedaan fitur aset dan pembanding yang **keduanya** tersedia. Audit memperlihatkan jumlah fitur terhitung, fitur yang dilewati beserta alasannya, dan versi model.
3. Median pembanding terpilih setelah uji IQR menjadi nilai dasar SBM. SBM menghitung nilai harapan dari probabilitas serta penyesuaian skenario pengguna.
4. Monte Carlo mengambil nilai dasar serta pilihan pembanding dari Analisa, lalu menggunakan distribusi dan parameter sendiri. Hasil P5–P95 ialah persentil simulasi, bukan selang kepercayaan nilai pasar.

Saat tombol **Analisa** pada panel pencarian diklik, Audit mulai memeriksa model dan fitur. Setelah selesai, modal berpindah ke tab SBM. Karakter aset pada tab SBM adalah **input RaLAT**, walaupun ditempatkan dekat keluaran SBM: luas, lebar jalan, bentuk, posisi, dan penggunaan aset dibandingkan dengan karakter setiap pembanding. Setelah mengisi atau mengubahnya, tekan **Hitung Ulang Analisa & RaLAT** di panel karakter aset. Hasil median dan proyeksi SBM kemudian dihitung kembali. Bentuk, posisi, dan penggunaan yang belum diketahui tidak dianggap sebagai kondisi negatif/default; variabel terkait dilewati dan muncul di Audit.

Jika versi/wilayah tidak dapat diverifikasi atau proses RaLAT gagal, aplikasi memakai penyesuaian waktu saja dan menunjukkan alasannya. Perubahan aset, koordinat, tanggal, tingkat penyesuaian waktu, pembanding terpilih, atau asumsi SBM membatalkan keluaran terkait yang sudah dihitung.

## Batas penafsiran

Sheet ini menyediakan label bahasa manusia, tetapi tidak menyediakan definisi lengkap setiap variabel, koordinat acuan sejumlah fitur jarak, ambang kelas luas, transformasi variabel dependen, maupun diagnostik dan validasi model. Label yang tampil pada Audit merupakan **teks asli dari sheet**, bukan bukti bahwa implementasi fitur sudah sama dengan saat model dilatih. Variabel yang tidak dapat dibangun sesuai definisi aslinya dilewati dan dicatat; khususnya kategori retail POI, persentase kawasan industri, kelas luas, dan sejumlah titik acuan yang belum dikonfirmasi. Rumus yang mengubah selisih koefisien menjadi persen penyesuaian masih perlu dicocokkan dengan dokumentasi estimasi model asli sebelum hasil dipakai sebagai kesimpulan penilaian. Hasil SBM dan Monte Carlo juga bergantung pada asumsi pengguna dan tidak memvalidasi RaLAT.

| Contoh dari `Model_Regresi` | Informasi yang ada | Yang masih diperlukan |
| --- | --- | --- |
| `POI_retail_1000m` (Jawa Timur `20241213`, baris 460) | Label: jumlah toko retail di radius 1 km. | Daftar kategori/tag toko yang dihitung, aturan fitur ganda, dan sumber peta saat model dilatih. Jangan samakan begitu saja dengan `shop=mall/supermarket`. |
| `industrial_area_percentage` (Jabodetabek `20241213`, baris 683) | Label: dominasi kawasan industri. | Penyebut, wilayah pengukuran, dan skala angka persen atau proporsi. |
| `luas_lower` (Jawa Timur `20241213`, baris 471) | Label: luas tanah kecil. | Ambang m² dan aturan tepat pada ambang. |
| `ln_distance_to_BEJ` (Jabodetabek `20241213`, baris 688) | Label: jarak ke Bursa Efek Jakarta. | Titik acuan dan geometri jarak yang dipakai saat pelatihan; titik tetap di aplikasi masih perlu dicocokkan. |

## Jejak per variabel dan rumus implementasi

Di tab Audit, setiap pembanding memiliki **Rincian rumus & sumber**. Daftar ini memuat nilai aset, nilai pembanding, koefisien β, selisih Δ, kontribusi, serta asal kedua nilai. PDF Audit mencantumkan sumber dan Δ pada tabel per pembanding. Jika data peta gagal dimuat, alasannya dibedakan dari keadaan peta tersedia tetapi fiturnya tidak ditemukan. Sumber diambil saat analisis dijalankan; elemen peta yang tercatat pada jejak memuat jenis dan ID OSM, tag, radius pencarian, koordinat titik pencarian dan titik fitur, bila tersedia.

Perhitungan yang **saat ini diterapkan aplikasi** untuk setiap variabel yang tersedia pada kedua sisi:

- Variabel jarak `ln_distance_to_*`: `β × [ln(max(jarak aset, 50 m)) − ln(max(jarak pembanding, 50 m))]`.
- `ln_luas_tanah`: `β × [ln(luas tanah aset dalam m²) − ln(luas tanah pembanding dalam m²)]`.
- Variabel numerik, POI, dan penanda kategori: `β × (nilai aset − nilai pembanding)`.

Kontribusi dijumlahkan sebagai perubahan proporsional harga, dibatasi ke rentang −50% sampai +50%, lalu dikalikan ke harga pembanding setelah koreksi waktu: `harga terkoreksi = harga setelah waktu × (1 + penyesuaian RaLAT)`. Pembatas 50 m dan ±50% merupakan aturan aplikasi, belum terbukti berasal dari spesifikasi estimasi regresi. Konstanta tidak digunakan karena selisih pada pasangan aset–pembanding saling meniadakannya. Jika nilai salah satu sisi tidak ada atau hasilnya tidak hingga, kontribusi dilewati dan dicatat.

Contoh uji aritmetika dengan koefisien Sumatra versi `20241213`: jarak ke jalan utama 100 m (aset) dan 200 m (pembanding), lebar jalan 8 m dan 6 m. β jarak `−0,04100143518` berasal dari baris 597, β lebar `0,04002363823` dari baris 593. Kontribusi jarak = `0,02842002919`; kontribusi lebar = `0,08004727646`; jumlah = `0,10846730565`. Harga pembanding Rp1.000.000/m² setelah koreksi waktu menjadi sekitar **Rp1.108.467/m²** menurut rumus aplikasi. Jika variabel dependen model ternyata berbentuk log harga dan aturan model mengharuskan `exp(jumlah) − 1`, hasil contoh akan menjadi **Rp1.114.568/m²**. Selisih sekitar 0,6101 poin persentase ini menunjukkan mengapa jenis variabel dependen harus dibuktikan dahulu. Kedua angka ini ilustrasi aritmetika, bukan pilihan rumus baru atau nilai pasar yang tervalidasi.

Untuk `ln_distance_to_road`, aplikasi saat ini memilih fitur OSM terdekat dengan tag `highway=primary`, `trunk`, atau `motorway` pada hasil Overpass. Jarak diukur sebagai **garis lurus ke titik tengah way** yang dikembalikan OSM, bukan jarak ke sisi jalan atau jarak tempuh. Jejak menampilkan way, tag, koordinat, dan radius yang dipakai. Definisi “jalan utama”, geometri jarak, dan cakupan radius harus dibandingkan dengan definisi variabel yang dipakai saat pelatihan model.

### Dokumen yang diperlukan untuk menuntaskan validasi

1. Spesifikasi model tiap wilayah/versi: variabel dependen, transformasi (`harga`, `ln(harga)`, atau bentuk lain), satuan harga dan luas, serta cara mengubah selisih prediksi menjadi koreksi harga. Jika target model log harga, penjumlahan koefisien sebagai persen langsung kemungkinan perlu diganti setelah spesifikasi terbukti.
2. Kamus variabel dan kode pembentukan fitur saat pelatihan, termasuk tipe POI, geometri dan koordinat acuan jarak, kategori peruntukan, radius pencarian, penanganan nilai kosong, dan asal batas 50 m serta ±50%.
3. Data uji berpasangan dengan keluaran yang diharapkan, periode dan cakupan data pelatihan, pengujian di luar sampel dan residual; gunakan ini untuk mencocokkan hasil manual dan mengukur ketidakpastian. Angka σ RaLAT 8% di Monte Carlo tetap asumsi pengguna sampai ada pengujian residual.

Sampai dokumen ini tersedia dan dicocokkan, Audit, SBM, dan laporan PDF menandai rumus RaLAT sebagai **belum tervalidasi terhadap model asli**. Perhitungan SBM dan Monte Carlo tetap menggunakan keluaran Analisa dengan label asumsi yang jelas.

## Aktivasi

Perubahan `Backend/Code.gs` harus dipasang pada deployment Google Apps Script yang melayani aplikasi. Setelah frontend dan backend diperbarui, jalankan pencarian baru lalu buka Analisa untuk memuat model per versi. Jika hanya frontend yang diperbarui, aplikasi menampilkan alasan dan menggunakan penyesuaian waktu saja.
