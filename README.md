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

## Dashboard ADMIN PUSAT

Folder `dashboard ADMIN PUSAT/` meniru menu role Admin Pusat di prototipe PHP (Laravel), dengan gaya yang sama seperti dashboard OWNER (`styles.css` dan `app.js`). Tambahan khusus:

- `assets/css/admin-pusat.css` untuk gaya tambahan halaman Admin Pusat.
- `assets/js/admin-pusat.js` untuk filter tabel, grafik drilldown 7 level, dan filter Area Dashboard.

Tahap 1 (Monitoring & Analytics):

| Halaman | Padanan di PHP |
|---|---|
| `index.html` | Executive Dashboard (`/dashboard/executive`) |
| `sales-dashboard.html` | Sales Dashboard (`/dashboard/sales`) |
| `area.html` | Area Dashboard (`/dashboard/area`) |
| `drilldown.html` | Grafik Drilldown 7 Level (`/dashboard/drilldown`) |
| `early-warning.html` | Risk & Fraud / Early Warning (`/dashboard/early-warning`) |

Tahap 2 (Master Data):

| Halaman | Padanan di PHP |
|---|---|
| `master-sales.html` | Sales Directory (`/master/sales`) |
| `sales-detail.html?npk=S006` | Detail Sales (`/master/sales/{npk}`) |
| `master-outlet.html` | Outlet SAP OCRD (`/master/outlet`) |
| `outlet-detail.html?code=C10001` | Detail Outlet (`/master/outlet/{code}`) |
| `master-product.html` | Product SAP OITM (`/master/product`) |
| `master-area.html` | Area Hierarki (`/master/area`) |
| `master-route.html` | Master Route (`/master/route`) |
| `master-vehicle.html` | Fleet Concox GT06N (`/master/vehicle`) |

Revisi 13 Oktober (papan tulis "Dashboard Admin Pusat"):

- `index.html` (Executive): filter global periode (default 30 hari terakhir, bisa pilih tanggal) + wilayah → area → toko; 6 KPI berwarna sesuai target (Volume Penjualan, Effective Call, NOO, NOP, Outlet ROA, Item RO); peta outlet NOO/NOP lebar di atas; tren penjualan (klik bulan → drilldown 7 level bulan itu); produk paling laku; kesehatan outlet (gabungan outlet health + at risk).
- Halaman detail KPI (klik kartu): `penjualan.html`, `effective-call.html`, `noo.html`, `nop.html`, `roa.html`, `ro-item.html`. Filter ikut terbawa lewat URL.
- `live-tracking.html`: posisi kendaraan sales (simulasi, update tiap 5 detik).
- Data contoh bersama ada di `assets/js/admin-data.js` (Region 1–5 → area → kecamatan → sales → toko), diolah oleh `assets/js/admin-filter.js`.

Menu lain (Report, Transaksi, Administration) sudah tampil di sidebar dengan label "soon" dan dibuat di tahap berikutnya.
