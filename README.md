# Teh Dandang — Dashboard OWNER

Dashboard HTML multipage dengan data statis. Chart.js dari cdnjs digunakan untuk grafik dan drilldown. JavaScript hanya menangani chart, drilldown, popup, dan pencarian. Sidebar menggunakan link HTML biasa, dan menu ponsel menggunakan checkbox HTML/CSS.

## Struktur proyek

```text
teh-dandang/
├── index.html                   # Link untuk membuka dashboard OWNER
├── dashboard OWNER/
│   ├── index.html               # Owner Overview
│   ├── sales.html               # Sales & Target
│   ├── achievement.html         # Target vs Realisasi + drilldown
│   ├── drilldown.html           # Pengalihan ke achievement.html
│   ├── master-sales.html        # Master Sales & NPK
│   ├── outlets.html             # Master Outlet / CardCode
│   ├── products.html            # Master Produk & SKU
│   ├── regions.html             # Master Wilayah & Rute
│   ├── vehicles.html            # Kendaraan & GPS IoT
│   ├── orders.html              # Sales Order SAP
│   ├── visits.html              # Sales Visit & Check-in
│   ├── noo.html                 # New Open Outlet
│   ├── nop.html                 # New Open Product
│   ├── ro.html                  # RO & ROA Monitoring
│   ├── gps.html                 # Live Telematics GPS
│   ├── audit.html               # Audit Radius Kunjungan
│   └── integration.html         # Integrasi SAP S/4HANA
├── assets/
│   ├── css/styles.css           # Gaya semua halaman
│   └── js/app.js                # Interaksi semua halaman
├── .local/                     # Diabaikan Git
│   ├── backups/                 # HTML versi awal
│   ├── screenshots/             # Preview dan gambar referensi
│   └── tools/                   # Alat pemeriksaan lokal
├── .gitignore
└── README.md
```

## Mengubah konten

- Edit data dan teks pada HTML halaman terkait. Angka grafik tersimpan pada atribut `data-chart` di elemen canvas; sesuaikan bersama tabel dan ringkasan yang terkait.
- Edit `assets/css/styles.css` untuk mengubah tampilan semua halaman.
- Edit `assets/js/app.js` untuk mengubah perilaku interaktif.
- Sidebar dan header adalah HTML statis pada setiap halaman. Perubahan menu bersama perlu diterapkan pada semua halaman.

Data merupakan snapshot contoh 24 Oktober 2025. Belum ada koneksi backend SAP atau peta langsung. Detail produk/SKU yang belum tersedia ditampilkan sebagai status kosong.

File web, aset, README, dan `.gitignore` perlu ikut commit. Isi `.local/` tidak ikut commit.

## Bootstrap

Bootstrap CSS 5.3.8 tersedia lewat CDN jsDelivr pada semua halaman. CSS proyek dimuat setelah Bootstrap. Gunakan class seperti `container`, `row`, `col`, `btn`, dan `form-control` saat menambahkan konten. JavaScript Bootstrap belum dimuat; fungsi JavaScript proyek tetap hanya chart, drilldown, popup, dan pencarian.

## Grafik drilldown gabungan

Halaman `dashboard OWNER/achievement.html` menggabungkan Target vs Realisasi dan drilldown dalam satu menu, dengan gaya batang aktual biru di atas target abu-abu. Halaman ini memakai satu grafik per level. Dropdown memilih Target vs Realisasi (Rp) atau Barang Terjual (Unit), serta semua barang atau produk tertentu. Pilihan tetap aktif saat menelusuri Nasional → Region → Area → Kabupaten → Kecamatan → Sales → Outlet → Produk. Breadcrumb dan tombol kembali membuka level sebelumnya; klik produk terakhir membuka popup detail. Data grafik ini adalah contoh statis, dengan total anak yang menjumlah ke total induk. Nama produk mengacu pada katalog resmi Teh Dandang.
