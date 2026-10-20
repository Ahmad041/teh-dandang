# PROPOSAL PENGEMBANGAN SISTEM MONITORING &amp; ANALITIK PENJUALAN
## PT KARTINI TEH DANDANG
### Sistem Terpadu Multi-Role (Owner, GM, RSM, ASM), Early Warning RO/ROA &amp; Monitoring 90 Area Nasional

---

| Dokumen | Proposal Pengembangan Sistem Monitoring Penjualan |
| :--- | :--- |
| **Klien / Perusahaan** | PT Kartini Teh Dandang |
| **Versi Dokumen** | 2.0 (Revisi Final Multi-Role &amp; Business Rules) |
| **Tanggal** | 20 Oktober 2026 |
| **Klasifikasi** | Dokumen Teknis &amp; Strategis Bisnis |

---

## 1. RINGKASAN EKSEKUTIF (EXECUTIVE SUMMARY)

PT Kartini Teh Dandang merupakan salah satu produsen teh terkemuka dengan jaringan distribusi nasional yang mencakup **90 Area**, melibatkan lebih dari **1.200 personil tim sales** (terdiri atas salesman lapangan, admin cabang/depo, supervisor, dan admin gudang), serta melayani belasan ribu mitra toko (Registered Outlet/RO) di **Wilayah Jawa** dan **Wilayah Luar Jawa**.

Seiring dengan ekspansi pasar yang cepat, manajemen menghadapi kebutuhan kritis untuk memiliki sistem pemantauan yang tidak hanya menyajikan data omzet, melainkan mampu:
1. **Menyediakan pembagian peran hierarkis (4 Role)**: Owner (Direksi Pusat), General Manager (GM), Regional Sales Manager (RSM), dan Area Sales Manager (ASM) dengan batasan wewenang dan sudut pandang analitik yang tepat sasaran.
2. **Menegakkan Aturan Bisnis Kunci**:
   - Standarisasi **RO (Registered Outlet)** dan **ROA (Registered Outlet Active)** dengan batasan rutin **1 bulan**.
   - Kepatuhan **jadwal wajib kunjungan salesman per 2 minggu** (bi-weekly cycle).
   - Pengukuran penetrasi varian **NOP (New Outlet Product)** yang dihitung spesifik hanya pada produk ke-2, ke-3, dst.
   - Klasifikasi produk **Fast Moving** (bebas kadaluarsa) versus **Slow Moving** (wajib pantau kadaluarsa/expired jika outlet macet &gt; 1 bulan).
   - Pencatatan modul promosi fisik **MMT Geber warung/toko**.
3. **Penyederhanaan &amp; Humanisasi Antarmuka**:
   - Menghilangkan istilah **AI** yang membingungkan bagi tim lapangan, menggantikannya dengan sistem aturan bisnis analitik yang konkret.
   - Mengganti istilah asing **Drilldown** menjadi **Penelusuran Hierarki / Rincian Berjenjang**.
   - Menghilangkan header berlebih pada tampilan kerja dashboard agar fokus pada grafik dan peta data.
   - Menghilangkan kartu Effective Call dari header KPI utama dan menata alur operasional ASM: **Pilih Salesman terlebih dahulu, baru kemudian memilih Toko/Outlet**.

Proposal ini menguraikan arsitektur sistem, aturan logika bisnis, struktur navigasi 4 role, dan rencana implementasi sistem pemantauan Teh Dandang.

---

## 2. LATAR BELAKANG &amp; ANALISIS MASALAH OPERASIONAL

Berdasarkan evaluasi lapangan terhadap ekosistem distribusi Teh Dandang, ditemukan beberapa titik rawan operasional yang menjadi dasar perancangan sistem ini:

```
[Kebutuhan Bisnis Teh Dandang]
       │
       ├─► 90 Area Kerja (72 Area Jawa + 18 Area Luar Jawa)
       ├─► 1.200 Personil (Salesman, Admin Depo, Admin Gudang, Supervisor)
       ├─► Mitigasi RO Non-ROA (> 1 Bulan Toko Terdaftar Macet Belanja)
       ├─► Disiplin Kunjungan 2 Mingguan Salesman Lapangan
       ├─► Pemantauan Kadaluarsa Khusus Produk Slow Moving
       └─► Audit Aset Fisik Branding Spanduk (MMT Geber Toko)
```

1. **Ketimpangan Definisi Toko Aktif (RO vs ROA)**:
   Banyak outlet terdaftar (*Registered Outlet / RO*) yang tercatat di database SAP, namun telah berhenti memesan barang selama berbulan-bulan tanpa terdeteksi segera oleh Area Manager. Diperlukan penegasan bahwa status **ROA (Registered Outlet Active)** hanya berlaku apabila outlet melakukan **pembelian rutin dalam kurun waktu &le; 1 bulan (30 hari)**.
2. **Keterlambatan Kunjungan Salesman Lapangan**:
   Siklus distribusi ideal mewajibkan kunjungan salesman setiap **2 minggu sekali (14 hari)**. Tanpa sistem monitoring berbasis pengecekan tanggal kunjungan terakhir, toko sering kali terlewatkan hingga beralih ke produk kompetitor.
3. **Risiko Kerugian Produk Kadaluarsa (Expired)**:
   Produk *Fast Moving* seperti Teh Dandang Celup Biru dan Teh Merah Tubruk memiliki perputaran cepat sehingga tidak memerlukan pemantauan expired yang ketat. Namun untuk produk *Slow Moving* (seperti Teh Putih / White Tea dan Jasmine Box), jika toko tidak melakukan repeat order dalam 1 bulan, stok di warung terancam kadaluarsa dan menimbulkan kerugian retur.
4. **Ketidaksesuaian Pencatatan NOP**:
   Sering terjadi salah kaprah pencatatan NOP (*New Outlet Product*). Sesuai arahan manajemen, pembelian pertama saat toko baru dibuka adalah NOO (*New Outlet Open*). Pencatatan **NOP hanya dihitung ketika toko tersebut bersedia mengambil variasi produk kedua, ketiga, dan seterusnya**.
5. **Pencatatan Promosi Fisik (MMT Geber)**:
   Pemasangan spanduk/MMT Geber di warung-warung strategis merupakan investasi promosi fisik utama Teh Dandang yang belum tercatat rapi secara digital (tanggal pasang, nomor toko, ukuran, dan status kondisi).

---

## 3. ARSITEKTUR 4 PERAN (MULTI-ROLE SALES MANAGEMENT)

Sistem dirancang dengan arsitektur multi-role yang memetakan tanggung jawab manajerial dari level pemegang saham tertinggi hingga pengawas lapangan:

```
┌────────────────────────────────────────────────────────┐
│               👑 1. OWNER / DIREKSI PUSAT              │
│  - Total Eksekutif Nasional                            │
│  - Keuangan Makro, Dividen & Profitabilitas            │
│  - Peta Penetrasi Nasional & Tren Penjualan            │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│             👔 2. GENERAL MANAGER (GM)                 │
│  - Pengawasan Seluruh Operasional Nasional             │
│  - Membawahi 5 Regional Sales Manager (RSM)            │
│  - Monitoring 90 Area (Wilayah Jawa & Luar Jawa)       │
│  - Mengelola 1.200 Personil Tim Sales & Gudang         │
│  - Konsolidasi ROA Nasional & Peringatan RO Non-ROA    │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│        🗺️ 3. REGIONAL SALES MANAGER (RSM)              │
│  - Pengawasan 1 Wilayah Region (misal: Region Jateng)  │
│  - Membawahi Area Sales Manager (ASM) di Bawahnya      │
│  - Target vs Realisasi Regional (Rp Miliar)            │
│  - Monitoring Stok Depo & Slow Moving Expired Regional │
│  - Audit Kinerja Kepatuhan Kunjungan per ASM           │
└──────────────────────────┬─────────────────────────────┘
                           │
┌──────────────────────────▼─────────────────────────────┐
│          📍 4. AREA SALES MANAGER (ASM)                │
│  - Pengawasan 1 Area Spesifik (1 dari 90 Area)         │
│  - ALUR OPERASIONAL: Pilih Salesman Dulu ➔ Buka Toko  │
│  - Monitoring Kunjungan Wajib 2 Mingguan Tiap Sales    │
│  - Peringatan Toko RO Non-ROA (> 1 Bulan Tidak Beli)   │
│  - Verifikasi Penetrasi NOP (Produk Ke-2+)             │
│  - Pencatatan Pemasangan Spanduk MMT Geber Toko        │
└────────────────────────────────────────────────────────┘
```

### Rincian Wewenang dan Fitur Setiap Role:

### 3.1 Role 1: Owner / Direksi Pusat (`dashboard OWNER` / `dashboard ADMIN PUSAT`)
- **Fokus Utama**: Tinjauan makro finansial perusahaan, pergerakan tren bulanan/tahunan, dan sebaran outlet baru secara visual melalui peta geospasial interaktif.
- **Fitur Kunci**:
  - Peta sebaran outlet interaktif NOO &amp; NOP.
  - Grafik tren penjualan aktual vs target nasional.
  - Penelusuran hierarki penjualan berjenjang (*Rincian Hierarki 7 Tingkat*).
  - Ringkasan kesehatan outlet dan deteksi area pasar merah &amp; kuning.
  - Pemilih cepat (*Role Switcher*) ke peran GM, RSM, dan ASM.

### 3.2 Role 2: General Manager (GM) (`dashboard GM`)
- **Fokus Utama**: Kinerja operasional menyeluruh di **90 Area**, meliputi Wilayah Jawa (72 Area) dan Wilayah Luar Jawa (18 Area), serta manajemen **1.200 personil tim sales**.
- **Fitur Kunci**:
  - Matriks perbandingan performa 5 Regional Sales Manager (RSM).
  - Porsi kontribusi penjualan Wilayah Jawa (80%) vs Wilayah Luar Jawa (20%).
  - Total konsolidasi Registered Outlet (RO) dan rasio Registered Outlet Active (ROA &gt; 80%).
  - Peringatan nasional RO Non-ROA yang butuh tindakan eskalasi.
  - Rekap penetrasi branding MMT Geber nasional.

### 3.3 Role 3: Regional Sales Manager (RSM) (`dashboard RSM`)
- **Fokus Utama**: Manajemen teritori tingkat regional (Jateng, Jatim, Jabar/Banten, DKI/DIY, Sumatera/Luar Jawa).
- **Fitur Kunci**:
  - Filter interaktif pilihan region aktif.
  - Evaluasi target vs realisasi masing-masing Area Sales Manager (ASM) di bawahnya.
  - Monitoring rasio kepatuhan kunjungan 2 mingguan salesman per area.
  - Monitoring perputaran produk Fast Moving vs Slow Moving berkadaluarsa di depo regional.
  - Rekap jumlah toko yang telah terpasang MMT Geber per region.

### 3.4 Role 4: Area Sales Manager (ASM) (`dashboard ASM`)
- **Fokus Utama**: Eksekusi mikro harian dan mingguan di 1 dari 90 Area operasional.
- **Fitur Kunci**:
  - **Alur Pemilihan Salesman Dulu Baru Toko**: ASM memilih nama sales (misal: Eko Prasetyo, Andi Pratama) untuk membuka daftar seluruh outlet binaan sales tersebut.
  - **Monitoring Kunjungan 2 Mingguan**: Indikator status apakah toko telah dikunjungi dalam &le; 14 hari terakhir.
  - **Deteksi Toko RO Non-ROA**: Penandaan visual merah tebal bagi outlet terdaftar yang &gt; 30 hari tidak melakukan repeat order, lengkap dengan tombol **Instruksi Kunjungan**.
  - **Verifikasi NOP**: Pencatatan toko yang berhasil melakukan penetrasi produk ke-2, ke-3 dst.
  - **Modul Pencatatan MMT Geber**: Formulir input langsung untuk mencatat kode toko, nama warung, ukuran spanduk, dan tanggal pasang.

---

## 4. FORMULASI ATURAN BISNIS (BUSINESS RULES SPECIFICATION)

Sistem dibangun di atas fondasi aturan bisnis yang ketat dan terukur:

| No | Parameter Bisnis | Definisi &amp; Aturan Sistem | Indikator Status di Dashboard |
| :---: | :--- | :--- | :--- |
| **1** | **RO (Registered Outlet)** | Toko/warung/kios yang sudah resmi terdata di database master SAP Teh Dandang. | Badge Abu-abu `RO` |
| **2** | **ROA (Registered Outlet Active)** | Outlet RO yang melakukan transaksi pembelian rutin dalam rentang waktu **maksimal 1 bulan (30 hari)** terakhir. | Badge Hijau `ROA (Aktif)` |
| **3** | **RO Non-ROA (Macet)** | Outlet RO yang **tidak melakukan pembelian selama &gt; 1 bulan (30 hari)**. | **Badge Merah Warning** `RO Non-ROA` (Memicu sinyal audit) |
| **4** | **Siklus Kunjungan Sales** | Salesman wajib mengunjungi setiap toko binaan **minimal 1 kali setiap 2 minggu (14 hari)**. | Hijau jika &le; 14 hari; Merah jika &gt; 14 hari belum dikunjungi |
| **5** | **NOP (New Outlet Product)** | Penambahan variasi SKU baru pada toko yang sama. **Hanya dihitung untuk produk ke-2, ke-3, dst.** | Badge Ungu `NOP (Varian Baru)` |
| **6** | **Fast Moving Products** | Produk pareto volume tinggi (Teh Celup Biru, Teh Merah Tubruk). **Tidak memerlukan pencatatan kadaluarsa** karena habis dalam 1–2 minggu. | Status `Fast Moving (Bebas Exp)` |
| **7** | **Slow Moving Products** | Produk premium/ekstrak (White Tea, Jasmine Box, Green Tea). **Wajib dicatat tanggal kadaluarsanya**. Jika outlet tidak ROA (&gt; 1 bln), sistem menerbitkan peringatan retur. | Status `Slow Moving (Exp: Bln/Thn)` + Alert jika macet |
| **8** | **Cakupan Teritori** | Terdiri dari **90 Area Nasional**, terbagi menjadi Wilayah Jawa (72 Area) dan Wilayah Luar Jawa (18 Area). | Tag Wilayah `Jawa` / `Luar Jawa` |
| **9** | **Kekuatan Tim Sales** | Total **1.200 personil**, mencakup Salesman Lapangan, Admin Depo/Cabang, Supervisor, dan Admin Gudang. | Matriks Sumber Daya Tim per Region |
| **10** | **MMT Geber Promosi** | Spanduk branding warung. **Wajib dicatat**: No Toko, Ukuran (2x1, 3x1, 4x1), Tanggal Pasang, dan Status Verifikasi. | Badge Hijau `Terpasang` / Kuning `Belum Pasang` |

---

## 5. PENYESUAIAN ANTARMUKA PENGGUNA (UI/UX REFINEMENT)

Menindaklanjuti arahan strategis dari user, antarmuka dashboard telah disempurnakan dengan standar:

1. **Pembersihan Istilah "AI"**:
   Seluruh label yang sebelumnya menggunakan kata AI telah dihapus. Sistem menggunakan terminologi bisnis yang lugas dan transparan: *Peringatan Dini Sistem*, *Aturan Kunjungan*, dan *Analisis Target*.
2. **Penggantian Istilah "Drilldown"**:
   Istilah asing *Drilldown* telah diganti secara konsisten menjadi **Penelusuran Hierarki Penjualan 7 Tingkat** atau **Rincian Berjenjang**. Hal ini memudahkan pemahaman personil dari level direksi hingga supervisor lapangan.
3. **Peniadaan Header Berlebih (*Heder di Hilangkan*)**:
   Top header banner yang memakan ruang vertikal layar telah dihilangkan/disembunyikan melalui konfigurasi tema CSS (`dandang-theme.css`). Layar kerja kini memiliki ruang vertikal optimal untuk visualisasi peta outlet, KPI cards, dan tabel interaktif.
4. **Peniadaan Header "Effective Call"**:
   Kartu Effective Call telah dikeluarkan dari jajaran kartu ringkasan KPI utama di executive dashboard, dan digantikan oleh indikator yang lebih substansial: **ROA (Beli Rutin 1 Bulan)**, **Peringatan RO Non-ROA**, **Penetrasi Varian NOP**, dan **Pencatatan MMT Geber**.
5. **Implementasi Alur "Sales Dulu Baru Toko" pada Level ASM**:
   Pada dashboard Area Sales Manager (`dashboard ASM`), navigasi penelusuran mengadopsi seleksi personil sales terlebih dahulu (berupa tombol kartu profil salesman), yang secara dinamis memuat tabel toko binaan khusus sales tersebut beserta status kepatuhan 2 mingguannya.

---

## 6. STRUKTUR TEKNOLOGI &amp; RUTE SISTEM (TECHNICAL DELIVERABLES)

Sistem dibangun menggunakan arsitektur web modern tanpa dependensi berat (Zero-Bloat Vanilla Architecture):
- **Core Technology**: HTML5 Semantik, Vanilla CSS3 (dengan CSS Custom Properties &amp; Brand Tokens `#9B1C1C`), dan Vanilla JavaScript modular.
- **Visualisasi &amp; Interaktivitas**: Chart.js 4.5.1 via CDN untuk grafik komparasi performa dan distribusi.
- **Routing &amp; Deployment**: Konfigurasi `vercel.json` dan struktur folder bersih untuk deployment cepat di server lokal maupun cloud.

### Peta Berkas &amp; Navigasi Sistem:

| Halaman | Jalur Berkas | Deskripsi Peran &amp; Isi |
| :--- | :--- | :--- |
| **Portal Pemilih Role** | [`index.html`](file:///d:/KULIAH/MANAJEMEN%20INFORMATIKA/SEMESTER%205/Ngeteh%20Dandang/teh-dandang/index.html) | Halaman portal awal untuk memilih salah satu dari 4 role dengan deskripsi wewenang masing-masing. |
| **Owner Dashboard** | [`dashboard ADMIN PUSAT/index.html`](file:///d:/KULIAH/MANAJEMEN%20INFORMATIKA/SEMESTER%205/Ngeteh%20Dandang/teh-dandang/dashboard%20ADMIN%20PUSAT/index.html) | Dashboard eksekutif tertinggi: Peta outlet lebar, tren penjualan, 8 KPI terpilih, dan penelusuran hierarki 7 tingkat. |
| **GM Dashboard** | [`dashboard GM/index.html`](file:///d:/KULIAH/MANAJEMEN%20INFORMATIKA/SEMESTER%205/Ngeteh%20Dandang/teh-dandang/dashboard%20GM/index.html) | Dashboard General Manager: Pengawasan 90 Area, Jawa vs Luar Jawa, performa 5 RSM, konsolidasi 1.200 personil. |
| **RSM Dashboard** | [`dashboard RSM/index.html`](file:///d:/KULIAH/MANAJEMEN%20INFORMATIKA/SEMESTER%205/Ngeteh%20Dandang/teh-dandang/dashboard%20RSM/index.html) | Dashboard Regional Sales Manager: Filter interaktif per region, evaluasi kinerja para ASM, audit ROA regional. |
| **ASM Dashboard** | [`dashboard ASM/index.html`](file:///d:/KULIAH/MANAJEMEN%20INFORMATIKA/SEMESTER%205/Ngeteh%20Dandang/teh-dandang/dashboard%20ASM/index.html) | Dashboard Area Sales Manager: Pilih Salesman dulu baru Toko, kontrol kunjungan 2 minggu, NOP ke-2+, dan input MMT Geber. |
| **Hierarki 7 Tingkat** | [`dashboard ADMIN PUSAT/drilldown.html`](file:///d:/KULIAH/MANAJEMEN%20INFORMATIKA/SEMESTER%205/Ngeteh%20Dandang/teh-dandang/dashboard%20ADMIN%20PUSAT/drilldown.html) | Penelusuran hierarki data penjualan: Nasional &rarr; Region &rarr; Area &rarr; Salesperson &rarr; Segmen &rarr; Toko &rarr; Produk. |
| **Tema Brand Merah** | [`assets/css/dandang-theme.css`](file:///d:/KULIAH/MANAJEMEN%20INFORMATIKA/SEMESTER%205/Ngeteh%20Dandang/teh-dandang/assets/css/dandang-theme.css) | Desain token Teh Dandang (Crimson palette `#9B1C1C`) &amp; aturan layout bebas header berlebih. |
| **Logika KPI &amp; Aturan** | [`assets/js/admin-exec.js`](file:///d:/KULIAH/MANAJEMEN%20INFORMATIKA/SEMESTER%205/Ngeteh%20Dandang/teh-dandang/assets/js/admin-exec.js) | Logika perhitungan RO, ROA sebulan, Warning RO Non-ROA, NOP varian ke-2+, dan penghapusan Effective Call header. |

---

## 7. TAHAPAN IMPLEMENTASI (ROADMAP &amp; TIMELINE)

Implementasi sistem dirancang berlangsung dalam 4 fase terstruktur:

```
[Fase 1: Finalisasi Desain & Dashboard Multi-Role] ──► (SELESAI - Status Saat Ini)
       │
[Fase 2: Uji Coba Lapangan di Area Percontohan (Solo Raya & Boyolali)] ──► (Bulan 1)
       │
[Fase 3: Pelatihan Multi-Role (GM, RSM, ASM, Admin Depo)] ──► (Bulan 2)
       │
[Fase 4: Rollout Skala Penuh 90 Area Nasional (Jawa & Luar Jawa)] ──► (Bulan 3)
```

1. **Fase 1 — Finalisasi Desain &amp; Dashboard Multi-Role (Selesai)**:
   - Pembuatan dan integrasi 4 dashboard peran (Owner, GM, RSM, ASM).
   - Penanaman aturan bisnis (ROA sebulan, Kunjungan 2 minggu, Fast/Slow moving, MMT Geber, NOP produk ke-2+).
   - Penyesuaian antarmuka (hapus AI, ubah drilldown, hilangkan header, hapus effective call).
2. **Fase 2 — Uji Coba Terbatas (Pilot Project Area Solo Raya &amp; Boyolali)**:
   - Uji coba pengisian data kepatuhan kunjungan 2 mingguan oleh tim salesman Solo Raya.
   - Verifikasi modul pencatatan MMT Geber pada 100 warung percontohan.
   - Evaluasi akurasi peringatan RO Non-ROA.
3. **Fase 3 — Sosialisasi &amp; Pelatihan Terpadu**:
   - Workshop penggunaan dashboard untuk jajaran GM dan RSM se-Indonesia.
   - Training operasional bagi para Area Sales Manager (ASM) dan Admin Depo dalam menindaklanjuti notifikasi toko macet.
4. **Fase 4 — Integrasi Menyeluruh 90 Area**:
   - Peluncuran serentak di seluruh 90 area kerja Wilayah Jawa dan Luar Jawa.
   - Pemantauan berkala pencapaian target dan penurunan angka toko tidak aktif.

---

## 8. KESIMPULAN &amp; REKOMENDASI TINDAK LANJUT

Pengembangan **Sistem Monitoring &amp; Analitik Penjualan Multi-Role Teh Dandang** ini memberikan lompatan signifikan dalam efektivitas kepemimpinan dan akuntabilitas tim penjualan. Dengan pemisahan peran yang tegas antara Owner, GM, RSM, dan ASM, setiap tingkat manajerial memiliki instrumen kendali yang presisi untuk:
1. Memastikan target omzet nasional tercapai secara terukur di 90 area.
2. Mencegah kematian outlet binaan sedini mungkin melalui deteksi **RO yang TIDAK ROA**.
3. Menjaga kualitas dan masa simpan produk di warung melalui pemisahan perlakuan **Fast Moving vs Slow Moving Expired**.
4. Melindungi investasi promosi lapangan melalui modul **Pencatatan MMT Geber**.

Kami merekomendasikan manajemen PT Kartini Teh Dandang untuk mengesahkan proposal ini sebagai cetak biru resmi (*official blueprint*) sistem monitoring penjualan perusahaan.

---

**Diajukan oleh:**  
*Tim Pengembang Sistem Analitik Penjualan Teh Dandang*  
*Surakarta, 20 Oktober 2026*
