# Deteksi kandidat data serupa

## Tujuan

Deteksi ini mencegah input ganda tanpa menganggap setiap properti yang sama sebagai duplikat. Penawaran 2025, verifikasi ulang 2026, dan transaksi 2026 dapat berkaitan dengan properti yang sama tetapi tetap merupakan kejadian atau observasi pasar yang berbeda.

Sistem tidak menggabungkan, mengganti, atau menghapus data otomatis. Pengguna wajib memilih hubungan dan menuliskan alasan sebelum data kandidat disimpan.

## Cara kerja

Pemeriksaan berjalan saat kolom penting diisi dan diulang sebelum penyimpanan. Backend menghitung kandidat dari:

- jarak koordinat: sampai 10 meter `+40`, 30 meter `+35`, dan 100 meter `+20`;
- nomor telepon yang sama `+25`;
- kemiripan alamat tinggi `+20` atau menengah `+12`;
- kemiripan luas tanah `+10/+5` dan bangunan `+5/+3`;
- kemiripan harga `+10/+5`;
- jenis properti yang sama `+5`.

Skor dibatasi sampai 100. Data dengan skor minimal 35 ditampilkan, maksimal lima kandidat tertinggi. Skor adalah alat penyaringan operasional, bukan keputusan appraisal dan bukan bukti bahwa dua data pasti sama.

## Keputusan pengguna

Jika kandidat ditemukan, pengguna memilih satu kandidat dan salah satu hubungan berikut:

1. **Properti sama — kejadian pasar baru**, misalnya penawaran 2025 menjadi transaksi 2026.
2. **Properti sama — sumber berbeda**, misalnya dua broker menawarkan objek yang sama.
3. **Properti berbeda**, untuk kemiripan lokasi atau karakteristik yang kebetulan berdekatan.

Jika sebenarnya merupakan data pasar yang sama, pengguna kembali ke form dan memakai data lama. Alasan keputusan minimal lima karakter dan maksimal 500 karakter.

## Sheet `Relasi_Data`

Sheet dibuat otomatis melalui `setupSpreadsheet()` atau ketika hubungan pertama dicatat. Isinya meliputi ID kedua data, koordinat, jenis hubungan, skor, indikator, alasan, pengguna, role, waktu, dan sumber tindakan.

Keputusan Surveyor berstatus **Menunggu Review**. Keputusan Admin atau Superadmin berstatus **Dikonfirmasi**. Pencatatan relasi tidak mengubah tanggal data pasar dan tidak membuat dua observasi dari properti yang sama otomatis dihitung sebagai dua pembanding independen.

## Catatan pemasangan

Perubahan membutuhkan deployment ulang `Backend/Code.gs` karena menambahkan action API `findDuplicateCandidates` dan argumen keputusan pada `addData`/`editData`. Setelah backend dipasang, deploy frontend `index.html`, lalu jalankan `setupSpreadsheet()` sekali jika ingin membuat sheet `Relasi_Data` sebelum hubungan pertama tercatat.

