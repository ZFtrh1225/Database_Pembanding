# Integritas model dalam fitur Analisa

## Sumber dan versi

`Backend/Code.gs` membaca sheet `Model_Regresi`, kolom B (ID), C (wilayah), D (tipe), F (nama variabel), dan G (koefisien). Delapan digit tanggal pada akhir ID kolom B menjadi versi model. Model dikelompokkan per **wilayah → versi → variabel**. Baris tanpa tanggal versi dan duplikat variabel pada kelompok yang sama dilewati dan jumlahnya ditampilkan di Audit. Analisa memilih versi tanggal terbaru di wilayah **aset target** yang didapat dari reverse geocoding koordinat target. Respons backend lama yang hanya berisi koefisien gabungan tidak digunakan untuk RaLAT.

Pada workbook yang diperiksa, terdapat 687 baris berkoefisien, 13 wilayah, 36 kelompok wilayah/versi, dan 2 baris Jawa Timur tanpa akhiran tanggal (baris 2–3). Gabungan variabel wilayah lintas versi berjumlah 322, sedangkan himpunan versi terbaru hanya 256 variabel. Pemisahan versi mencegah variabel dari versi lama terbawa ke analisis terbaru.

## Alur perhitungan

1. Harga pembanding disesuaikan terhadap waktu penilaian menurut persentase yang diisi pada formulir.
2. Jika model wilayah dan versi tersedia, RaLAT menghitung perbedaan fitur aset dan pembanding yang **keduanya** tersedia. Audit memperlihatkan jumlah fitur terhitung, fitur yang dilewati beserta alasannya, dan versi model.
3. Median pembanding terpilih setelah uji IQR menjadi nilai dasar SBM. SBM menghitung nilai harapan dari probabilitas serta penyesuaian skenario pengguna.
4. Monte Carlo mengambil nilai dasar serta pilihan pembanding dari Analisa, lalu menggunakan distribusi dan parameter sendiri. Hasil P5–P95 ialah persentil simulasi, bukan selang kepercayaan nilai pasar.

Jika versi/wilayah tidak dapat diverifikasi atau proses RaLAT gagal, aplikasi memakai penyesuaian waktu saja dan menunjukkan alasannya. Perubahan aset, koordinat, tanggal, tingkat penyesuaian waktu, pembanding terpilih, atau asumsi SBM membatalkan keluaran terkait yang sudah dihitung.

## Batas penafsiran

Sheet ini tidak menyediakan definisi lengkap setiap variabel, koordinat acuan sejumlah fitur jarak, ambang kelas luas, transformasi variabel dependen, maupun diagnostik dan validasi model. Variabel yang tidak dapat dibangun sesuai definisi aslinya dilewati dan dicatat; khususnya kategori retail POI, persentase kawasan industri, kelas luas, dan sejumlah titik acuan yang belum dikonfirmasi. Rumus yang mengubah selisih koefisien menjadi persen penyesuaian masih perlu dicocokkan dengan dokumentasi estimasi model asli sebelum hasil dipakai sebagai kesimpulan penilaian. Hasil SBM dan Monte Carlo juga bergantung pada asumsi pengguna dan tidak memvalidasi RaLAT.

## Aktivasi

Perubahan `Backend/Code.gs` harus dipasang pada deployment Google Apps Script yang melayani aplikasi. Setelah frontend dan backend diperbarui, jalankan pencarian baru lalu buka Analisa untuk memuat model per versi. Jika hanya frontend yang diperbarui, aplikasi menampilkan alasan dan menggunakan penyesuaian waktu saja.
