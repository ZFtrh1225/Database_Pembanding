# Master Parameter

Fitur ini menjadikan pilihan **Jenis Properti**, **Hak Kepemilikan**, dan
**Jenis Data** berasal dari satu sumber. Pilihan yang sama dipakai oleh panel
filter serta form Tambah/Edit Data.

## Sumber data

Saat backend terbaru pertama kali dipanggil, Apps Script membuat sheet
`Master_Parameter` dengan kolom:

| Kolom | Fungsi |
|---|---|
| Kategori | `JENIS_PROPERTI`, `HAK_KEPEMILIKAN`, atau `JENIS_DATA` |
| Nilai Tersimpan | Nilai stabil yang disimpan di `DataPembanding` |
| Label Tampilan | Teks yang terlihat pada filter dan pilihan form |
| Aktif | Menampilkan atau menyembunyikan pilihan |
| Urutan | Urutan pilihan pada aplikasi |

Jangan mengubah **Nilai Tersimpan** untuk parameter yang sudah dipakai oleh
data lama. Gunakan **Label Tampilan** untuk mengubah teks yang terlihat.
Parameter lama sebaiknya dinonaktifkan, bukan dihapus.

## Pengelolaan dari aplikasi

1. Login sebagai **Superadmin**.
2. Pilih **Parameter** pada topbar desktop atau **Kelola Parameter** pada menu
   tiga titik di ponsel.
3. Pilih kategori.
4. Tambahkan parameter baru, ubah label/urutan, atau matikan pilihan melalui
   kotak **Aktif**.
5. Tekan **Simpan Parameter**.

Backend menolak nilai duplikat dan memastikan setiap kategori tetap memiliki
minimal satu pilihan aktif.

## Tahun Data

Tahun Data tidak dikelola di `Master_Parameter`. Aplikasi membaca tahun unik
dari kolom **Waktu Data** pada sheet `DataPembanding`, lalu mengurutkannya
dari tahun terbaru ke tahun terlama. Setelah data baru ditambah atau diedit,
daftar tahun dimuat ulang otomatis.

## Deployment

Perubahan ini menyentuh `index.html` dan `Backend/Code.gs`. Setelah merge:

1. salin `Backend/Code.gs` terbaru ke project Apps Script;
2. deploy sebagai **New version**;
3. tunggu GitHub Pages selesai memperbarui `index.html`;
4. lakukan hard refresh pada aplikasi.
