# Teh Dandang — Dashboard OWNER

Dashboard HTML multipage dengan data statis. Chart.js dari cdnjs digunakan untuk grafik dan drilldown. JavaScript hanya menangani chart, drilldown, popup, dan pencarian. Sidebar menggunakan link HTML biasa, dan menu ponsel menggunakan checkbox HTML/CSS.

## Struktur proyek

```text
teh-dandang/
├── index.html                   # Link untuk membuka dashboard OWNER
├── dashboard OWNER/
│   ├── index.html               # Owner Overview
│   ├── sales.html               # Sales & Target
│   ├── achievement.html         # Target vs Realisasi
│   ├── drilldown.html           # Grafik Sales Drilldown
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

## Menjalankan web

Dari folder proyek, jalankan server lokal:

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

Buka <http://127.0.0.1:8765/> dan klik Buka Dashboard OWNER. Halaman juga bisa dibuka langsung dari `dashboard OWNER/index.html`. Koneksi internet diperlukan untuk memuat Chart.js dari CDN.

## Mengubah konten

- Edit data dan teks pada HTML halaman terkait. Angka grafik tersimpan pada atribut `data-chart` di elemen canvas; sesuaikan bersama tabel dan ringkasan yang terkait.
- Edit `assets/css/styles.css` untuk mengubah tampilan semua halaman.
- Edit `assets/js/app.js` untuk mengubah perilaku interaktif.
- Sidebar dan header adalah HTML statis pada setiap halaman. Perubahan menu bersama perlu diterapkan pada semua halaman.

Data merupakan snapshot contoh 24 Oktober 2025. Belum ada koneksi backend SAP atau peta langsung. Detail produk/SKU yang belum tersedia ditampilkan sebagai status kosong.

File web, aset, README, dan `.gitignore` perlu ikut commit. Isi `.local/` tidak ikut commit.
