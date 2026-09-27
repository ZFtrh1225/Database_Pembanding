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

## Dua pencarian Overpass yang berdiri sendiri

**Analisis Jarak POI** pada peta menampilkan fasilitas sekitar aset atau pembanding. Penilai memilih radius 2,5 km, 5 km, atau 10 km; aplikasi memeriksa semua kelompok pada radius itu, menampilkan tiga fasilitas terdekat per jenis pada tampilan awal, dan menyediakan tombol **Tampilkan fasilitas lainnya** untuk membuka seluruh hasil pada jenis tersebut. Jika tidak ada hasil pada suatu kelompok, aplikasi menyatakan bahwa fasilitas belum tercatat di OSM dalam radius pencarian. Kelompoknya meliputi transportasi, kesehatan, pendidikan, peribadatan, dan niaga. Query menerima titik, bangunan, dan relasi OSM. Jarak adalah garis lurus ke koordinat titik atau titik perwakilan bangunan/area; titik perwakilan tidak harus berupa pintu masuk. Nama dan tingkat sekolah, jenis puskesmas/posyandu, serta bangunan niaga yang belum jelas diberi label sesuai data OSM yang tersedia. Hasilnya merupakan informasi lingkungan, bukan koreksi otomatis dalam RaLAT.

**Overpass RaLAT** dibuat setelah wilayah dan versi model diketahui. Hanya tag OSM yang terkait variabel spasial pada versi itu yang diminta. Pencarian 20 km dilewati bila tidak ada variabel wilayah jauh. Kamus query mempertahankan tipe objek/tag dan radius 5 km/20 km sebelumnya untuk membatasi perubahan angka akibat optimasi. Variabel yang bersumber dari karakter aset/pembanding tidak memicu permintaan peta. Cache POI dan RaLAT terpisah, memuat versi aturan query, koordinat, radius, serta identitas model/tag bila relevan. Layanan peta yang gagal tetap dicatat berbeda dari hasil pencarian kosong.

Daftar fasilitas POI yang diperluas **tidak mengubah** matcher RaLAT: `POI_hospital_1000m` tetap mengambil `amenity=hospital`, tidak menghitung klinik dan puskesmas. `POI_retail_1000m` tetap dilewati karena kategori toko saat pelatihan model tidak tersedia. Informasi fasilitas POI juga tidak lagi disisipkan sebagai klaim otomatis tentang HBU atau likuiditas pada insight SBM.

### Status validasi setelah pengembangan

1. **Kelengkapan POI:** alur pencarian tidak berhenti hanya karena satu jenis fasilitas ditemukan, bangunan/area dapat tampil, dan seluruh fasilitas yang tercatat bisa dilihat dari tombol perluasan per jenis. Kelengkapan OSM setempat serta kebenaran nama perlu diperiksa penilai di lapangan.
2. **Konsistensi RaLAT:** pemilihan tag mengikuti versi model, sementara rumus dan matcher variabel tetap sama. Pengujian kode memeriksa partisi query, larangan tercampurnya klinik ke hospital, jejak fitur, dan contoh aritmetika manual. Ini membuktikan perilaku implementasi untuk contoh uji, bukan akurasi model pada pasar.
3. **Definisi dan rumus model asli:** spreadsheet `Model_Regresi` dan berkas repo tidak memuat spesifikasi pembentukan variabel dependen maupun kode pelatihan yang dapat membuktikan apakah `β × Δ` boleh dipakai sebagai persen langsung. Maka status **belum tervalidasi terhadap regresi asli** tetap muncul pada Audit dan PDF; tidak ada perubahan rumus koreksi atau koefisien. Dokumen yang diperlukan tercantum di bagian bawah.

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

### Cek aritmetika dan data pemeriksaan

Audit sekarang memperlihatkan harga pembanding **setelah penyesuaian waktu**, jumlah kontribusi **sebelum batas ±50%**, persentase setelah batas, serta harga akhir untuk setiap pasangan aset–pembanding. Fungsi pemeriksa menghitung ulang setiap `β × Δ` dari nilai aset, pembanding, dan koefisien; kemudian mencocokkan jumlah, penerapan batas, dan harga akhir terhadap hasil RaLAT yang tampil. Jika ada selisih, Audit menandainya. Status **"cek hitung aplikasi: sesuai"** hanya berarti aritmetika dua jalur implementasi cocok; status ini **tidak** memastikan definisi variabel, transformasi harga, atau pembatas ±50% sudah sesuai model asli.

Tombol **Unduh data pemeriksaan RaLAT (CSV)** tersedia di tab Audit setelah analisis dengan model berjalan. Setiap baris mencatat wilayah/versi, ID pembanding, sumber dan nomor baris koefisien pada `Model_Regresi`, nilai mentah dan nilai masuk rumus, satuan, β, Δ, kontribusi, harga awal, harga setelah waktu, harga setelah RaLAT, serta alasan variabel dilewati. Berkas memakai pemisah titik koma agar mudah dibuka di Excel Indonesia; nilai teks OSM di-escape untuk mencegah dibaca sebagai rumus. Hasil ekspor dapat dicocokkan dengan contoh keluaran dari pembuat model saat dokumentasinya tersedia. Tidak ada angka model baru atau konversi koefisien yang diperkenalkan oleh alat audit ini.

Perhitungan yang **saat ini diterapkan aplikasi** untuk setiap variabel yang tersedia pada kedua sisi:

- Variabel jarak `ln_distance_to_*`: `β × [ln(max(jarak aset, 50 m)) − ln(max(jarak pembanding, 50 m))]`.
- `ln_luas_tanah`: `β × [ln(luas tanah aset dalam m²) − ln(luas tanah pembanding dalam m²)]`.
- Variabel numerik, POI, dan penanda kategori: `β × (nilai aset − nilai pembanding)`.

Kontribusi dijumlahkan sebagai perubahan proporsional harga, dibatasi ke rentang −50% sampai +50%, lalu dikalikan ke harga pembanding setelah koreksi waktu: `harga terkoreksi = harga setelah waktu × (1 + penyesuaian RaLAT)`. Pembatas 50 m dan ±50% merupakan aturan aplikasi, belum terbukti berasal dari spesifikasi estimasi regresi. Konstanta tidak digunakan karena selisih pada pasangan aset–pembanding saling meniadakannya. Jika nilai salah satu sisi tidak ada atau hasilnya tidak hingga, kontribusi dilewati dan dicatat.

Contoh uji aritmetika dengan koefisien Sumatra versi `20241213`: jarak ke jalan utama 100 m (aset) dan 200 m (pembanding), lebar jalan 8 m dan 6 m. β jarak `−0,04100143518` berasal dari baris 597, β lebar `0,04002363823` dari baris 593. Kontribusi jarak = `0,02842002919`; kontribusi lebar = `0,08004727646`; jumlah = `0,10846730565`. Harga pembanding Rp1.000.000/m² setelah koreksi waktu menjadi sekitar **Rp1.108.467/m²** menurut rumus aplikasi. Jika variabel dependen model ternyata berbentuk log harga dan aturan model mengharuskan `exp(jumlah) − 1`, hasil contoh akan menjadi **Rp1.114.568/m²**. Selisih sekitar 0,6101 poin persentase ini menunjukkan mengapa jenis variabel dependen harus dibuktikan dahulu. Kedua angka ini ilustrasi aritmetika, bukan pilihan rumus baru atau nilai pasar yang tervalidasi.

Untuk `ln_distance_to_road`, aplikasi saat ini memilih fitur OSM terdekat dengan tag `highway=primary`, `trunk`, atau `motorway` pada hasil Overpass. Jarak diukur sebagai **garis lurus ke titik tengah way** yang dikembalikan OSM, bukan jarak ke sisi jalan atau jarak tempuh. Jejak menampilkan way, tag, koordinat, dan radius yang dipakai. Definisi “jalan utama”, geometri jarak, dan cakupan radius harus dibandingkan dengan definisi variabel yang dipakai saat pelatihan model.

### Konsistensi koordinat node OSM pada satu analisis

RaLAT meminta peta untuk aset dan tiap pembanding secara terpisah, dengan cache RaLAT per koordinat yang berlaku hingga tujuh hari. Waktu basis data OSM (`osm3s.timestamp_osm_base`), waktu respons diambil, dan tanda cache sekarang mengikuti sumber tiap fitur jarak pada Audit/PDF dan CSV. Cache RaLAT lama dibedakan dengan versi key baru; cache POI lingkungan dan query POI tidak berubah.

Sebelum menghitung satu pun harga RaLAT, aplikasi membandingkan **ID dan koordinat node OSM yang benar-benar terpilih** untuk variabel jarak pada seluruh pasangan. Jika satu ID node muncul pada titik yang berbeda lebih dari 1 m dalam analisis yang sama, Audit menyebut ID, dua titik, waktu basis OSM, serta variabel yang terdampak. Batas 1 m adalah toleransi teknis pemeriksaan konsistensi koordinat, **bukan ketentuan SPI/IVS atau perubahan rumus regresi**. Variabel terdampak ditahan untuk seluruh pembanding dalam analisis itu dan tercatat `dilewati` pada CSV beserta sumber kedua titik. Variabel lainnya tetap dihitung; jika variabel jarak nanti dapat dibuktikan konsisten, analisis dapat dijalankan kembali. Waktu basis yang berbeda saja belum membuktikan perbedaan titik; pemeriksaan memerlukan ID sama **dan** perbedaan lokasi.

Dalam CSV Audit Sumatra `20241213` yang diuji, `node/544519673` muncul di `-5.429386,105.262617` dan `-5.446071,105.264374` (sekitar 1.865 m). Jika hanya kontribusi `ln_distance_to_big_city` dari contoh tersebut yang ditahan dan variabel lainnya tetap, lima pembanding berubah dari cakupan 23/25 menjadi 22/25; median contoh berubah dari Rp2.329.740/m² menjadi sekitar **Rp2.290.342/m²**. Angka ini hasil uji terhadap CSV yang telah diunduh, bukan hasil pasti dari permintaan peta baru. Jalankan ulang Analisa, lalu SBM dan Monte Carlo, setelah pembaruan frontend untuk memperoleh hasil dari sumber peta saat itu. Penamaan `DP1`, `DP2`, dan seterusnya berasal dari data pembanding dan tidak perlu dibuat unik.

### Pemeriksaan dari contoh Audit Sumatra

Pada satu tangkapan layar Analisa Sumatra `20241213`, Audit menunjukkan 12 pembanding, minimal 22 dari 25 variabel terhitung. Ini adalah **cakupan data**, bukan tingkat akurasi model. Untuk satu pembanding yang terlihat:

Pada tangkapan layar yang lebih baru, contoh pasangan memperlihatkan jarak kota besar aset `2306,2023 m` dan pembanding `750,40943 m`. Koefisien `−0,2380993745` dari `Model_Regresi!586` memberi `β × ln(2306,2023 / 750,40943) ≈ −26,732%`. Contoh luas tanah dalam log aset `5,8579332` dan pembanding `6,6995003`, dengan β `−0,1339430666` pada baris 592, memberi `β × (5,8579332 − 6,6995003) ≈ +11,272%`. Pengujian aplikasi membandingkan dua angka ini dengan hitungan terpisah; sisa kontribusi pasangan tidak tampak lengkap pada tangkapan layar. Kesesuaian dua kontribusi membuktikan hitung implementasi untuk data tersebut, bukan pilihan transformasi hasil regresi asli.

- `is_komersial` bernilai 0 untuk aset dan 1 untuk pembanding. β `0,4960917532` di `Model_Regresi` baris 594 memberi `(0−1) × β = −49,609%`. Input kategori aset dan pembanding yang sebenarnya tidak tampak dalam tangkapan layar, sehingga nilai 0/1 perlu diperiksa pada rincian sumber.
- `ln_distance_to_road` menampilkan jarak terukur aset `17,274647 m` dan pembanding `262,08696 m`. Aturan aplikasi membatasi jarak masuk rumus ke minimum 50 m. Dengan β `−0,04100143518` di baris 597, kontribusinya `β × [ln(50)−ln(262,08696)] ≈ +6,793%`. Rincian Audit/PDF sekarang menampilkan kedua jarak yang **dipakai dalam rumus** jika berbeda dari jarak mentah.

Dua kontribusi ini saja belum dapat membuktikan total penyesuaian sekitar −36% atau harga akhir yang terlihat, karena masih ada 20 variabel lain yang terhitung dan informasi harga sebelum koreksi waktu tidak tampak. Besarnya satu kontribusi kategori hampir 50% adalah alasan penting untuk memeriksa definisi `is_komersial` dan bentuk regresi asli sebelum menafsirkan nilai akhirnya.

Jika label dan nomor baris `Model_Regresi` belum muncul setelah PR yang menambah metadata digabung, periksa deployment frontend dan `Backend/Code.gs`. Pada frontend terbaru, Audit memberi peringatan khusus bila respons backend masih belum mengirim nomor baris; setelah backend dipasang, jalankan **Cari** dan **Analisa** lagi untuk mengambil respons baru. Menggabungkan PR di GitHub saja tidak memperbarui deployment Google Apps Script.

### Dokumen yang diperlukan untuk menuntaskan validasi

1. Spesifikasi model tiap wilayah/versi: variabel dependen, transformasi (`harga`, `ln(harga)`, atau bentuk lain), satuan harga dan luas, serta cara mengubah selisih prediksi menjadi koreksi harga. Jika target model log harga, penjumlahan koefisien sebagai persen langsung kemungkinan perlu diganti setelah spesifikasi terbukti.
2. Kamus variabel dan kode pembentukan fitur saat pelatihan, termasuk tipe POI, geometri dan koordinat acuan jarak, kategori peruntukan, radius pencarian, penanganan nilai kosong, dan asal batas 50 m serta ±50%.
3. Data uji berpasangan dengan keluaran yang diharapkan, periode dan cakupan data pelatihan, pengujian di luar sampel dan residual; gunakan ini untuk mencocokkan hasil manual dan mengukur ketidakpastian. Angka σ RaLAT 8% di Monte Carlo tetap asumsi pengguna sampai ada pengujian residual.

Sampai dokumen ini tersedia dan dicocokkan, Audit, SBM, dan laporan PDF menandai rumus RaLAT sebagai **belum tervalidasi terhadap model asli**. Perhitungan SBM dan Monte Carlo tetap menggunakan keluaran Analisa dengan label asumsi yang jelas.

## Aktivasi

Perubahan `Backend/Code.gs` harus dipasang pada deployment Google Apps Script yang melayani aplikasi. Setelah frontend dan backend diperbarui, jalankan pencarian baru lalu buka Analisa untuk memuat model per versi. Jika hanya frontend yang diperbarui, aplikasi menampilkan alasan dan menggunakan penyesuaian waktu saja.
