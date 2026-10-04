# Quality Review & Verification Workflow

Fitur ini memisahkan tiga hal yang sebelumnya mudah tercampur:

1. **Kelengkapan input** — persentase kolom yang terisi.
2. **Kualitas data** — kelengkapan yang dikurangi faktor usia, sumber, foto, nilai, outlier, dan potensi duplikat.
3. **Kesebandingan** — kedekatan data terhadap profil aset target, termasuk lokasi, jenis properti, legalitas, luas, jenis data, dan ROW.

Skor dan label kandidat adalah alat bantu penyaringan internal. Hasilnya bukan kesimpulan nilai, bukan opini penilaian, dan tidak menggantikan pertimbangan profesional penilai atau ketentuan SPI/MAPPI yang berlaku.

## Sheet `Quality_Review`

Sheet dibuat otomatis saat `setupSpreadsheet()` dijalankan atau ketika pencarian/review pertama dilakukan. Data utama pada `DataPembanding` tidak diubah.

Kolom yang disimpan:

- Review Key, ID, dan Koordinat
- Status Verifikasi dan Catatan Verifikasi
- Diverifikasi Oleh dan Diverifikasi Pada
- Status Review: Aktif, Perlu Ditelaah, atau Dikecualikan
- Keputusan Duplikat: Belum Ditinjau, Bukan Duplikat, atau Duplikat
- Catatan Kualitas serta audit pengguna/waktu pembaruan

Hanya role **Admin** dan **Superadmin** yang dapat menyimpan review. Viewer tetap dapat membaca rincian skor dan status.

## Dampak status

- **Aktif**: data tetap tersedia untuk perbandingan dan analisis.
- **Perlu Ditelaah**: data tetap tersedia, tetapi diberi indikator perhatian.
- **Dikecualikan**: data tetap terlihat agar audit dapat dilakukan, namun tidak masuk statistik ringkas, perbandingan, atau analisis AVM.

## Profil aset target

Profil aset disimpan per pengguna di penyimpanan lokal browser. Profil ini tidak mengubah Google Sheet. Jika koordinat profil diisi, jarak dihitung dari koordinat tersebut; jika tidak, aplikasi memakai pusat pencarian aktif.

## Deployment

Karena terdapat fungsi Apps Script baru, setelah perubahan digabungkan:

1. salin/perbarui `Backend/Code.gs` pada project Apps Script;
2. jalankan `setupSpreadsheet()` sekali untuk membuat sheet lebih awal (opsional karena sheet juga dibuat otomatis);
3. buat **deployment version baru** untuk Web App;
4. muat ulang aplikasi dan lakukan pencarian;
5. buka chip kualitas pada kartu untuk menyimpan review pertama.

