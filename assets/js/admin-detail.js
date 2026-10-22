// Halaman detail 6 KPI (Volume Penjualan, Effective Call, NOO, NOP, ROA, Produk Paling Laku / Penjualan).
// Tanpa kartu per unit: langsung grafik (bisa diurutkan) + tabel berwarna sesuai capaian.
(function () {
  const root = document.getElementById("kpi-detail");
  if (!root || !window.AF) return;
  const AF = window.AF, D = AF.D, KPI = root.dataset.kpi;
  const PNAME = {};
  for (const p of D.products) PNAME[p.code] = p.name;
  const COLOR = { good: "#10b981", warn: "#f59e0b", bad: "#ef4444", neutral: "#2563eb" };
  let filter, INFO, sortBy = null;

  function setText(id, html) { document.getElementById(id).innerHTML = html; }
  function short(name) { return name.replace("Teh Dandang ", ""); }
  function sumUnits(u) { return Object.values(u).reduce(function (a, b) { return a + b; }, 0); }

  // ambang warna: target (≥100 hijau, 90–99 kuning, <90 merah); kunjungan/EC/ROA (≥90, 80–89, <80)
  function toneTarget(p) { return p >= 100 ? "good" : p >= 90 ? "warn" : "bad"; }
  function tone80(p) { return p >= 90 ? "good" : p >= 80 ? "warn" : "bad"; }
  const LEGEND = {
    target: [["good", "≥ 100% target"], ["warn", "90–99%"], ["bad", "< 90%"]],
    rate: [["good", "≥ 90%"], ["warn", "80–89%"], ["bad", "< 80% (peringatan)"]]
  };

  function summaryCard(label, value, sub, dl, invert) {
    const t = dl ? AF.deltaTone(dl, invert) : "flat";
    const pill = dl ? '<div class="kpi-top">' + AF.deltaPill(dl, "Dibanding " + INFO.prevRange, invert) + "</div>" : "";
    return '<article class="card kpi trend-' + t + '"><h2 class="kpi-label">' + label + '</h2><div class="kpi-value">' + value + "</div>" + pill + (sub ? '<span class="kpi-sub">' + sub + "</span>" : "") + "</article>";
  }

  function badgeFor(t, text) {
    return '<span class="badge ' + { good: "", warn: "warning", bad: "danger", neutral: "neutral" }[t] + '">' + text + "</span>";
  }

  function statusBadge(o) {
    return o.status === "Inactive" ? badgeFor("bad", "RO tidak ROA") : o.status === "At Risk" ? badgeFor("warn", "Belum dikunjungi") : badgeFor("good", "ROA");
  }

  // ---------- breadcrumb cakupan ----------
  function crumbs(state) {
    const L = AF.LOCK, deepest = L.sales ? "sales" : L.area ? "area" : L.region ? "region" : "all";
    const show = function (k) { return !L[k] || k === deepest; };
    const parts = deepest === "all" ? ['<button type="button" data-go="all">Semua Wilayah</button>'] : [];
    if (state.region !== "all" && show("region")) parts.push('<button type="button" data-go="region">' + AF.esc(AF.REGION[state.region].name) + "</button>");
    if (state.area !== "all" && show("area")) parts.push('<button type="button" data-go="area">' + AF.esc(AF.AREA[state.area].name) + "</button>");
    if (state.sales !== "all" && KPI !== "ro-item" && show("sales")) parts.push('<button type="button" data-go="sales">' + AF.esc(AF.SALES[state.sales].name) + "</button>");
    if (state.outlet !== "all" && KPI !== "ro-item") parts.push('<button type="button" data-go="outlet">' + AF.esc(AF.OUTLET[state.outlet].name) + "</button>");
    if (KPI === "ro-item" && state.item !== "all") parts.push('<button type="button" data-go="item">' + AF.esc(short(PNAME[state.item])) + "</button>");
    if (!parts.length) parts.push('<button type="button" data-go="none">' + AF.esc(AF.scopeName(state)) + "</button>");
    const el = document.getElementById("scope-crumbs");
    el.innerHTML = parts.join('<span aria-hidden="true">›</span>');
    const btns = el.querySelectorAll("button");
    btns[btns.length - 1].setAttribute("aria-current", "location");
    for (const b of btns) b.onclick = function () {
      const g = b.dataset.go;
      if (g === "all") filter.set({ pulau: AF.LOCK.pulau || "all", region: "all", area: "all", sales: "all", outlet: "all", item: "all" });
      if (g === "region") filter.set({ area: "all", sales: "all", outlet: "all", item: "all" });
      if (g === "area") filter.set({ sales: "all", outlet: "all" });
      if (g === "sales") filter.set({ outlet: "all" });
    };
  }

  // ---------- baris per unit (wilayah / area / sales / toko / produk) ----------
  function groupsFor(state) {
    const cg = AF.childGroups(state);
    // ROA: dari area langsung ke toko (tanpa level sales)
    if (KPI === "roa" && state.area !== "all" && state.sales === "all") {
      return { level: "Toko", key: "toko", groups: AF.scopeOutlets(state, true).map(function (o) { return { id: o.id, name: o.name, outlets: [o], outlet: o }; }) };
    }
    // Produk paling laku: setelah area dipilih, baris = produk
    if (KPI === "ro-item" && state.area !== "all") return { level: "Produk", key: "produk", groups: [] };
    return cg;
  }

  function rowValue(m, o) {
    if (KPI === "penjualan") return { pct: m.salesPct, tone: toneTarget(m.salesPct), main: m.actual, text: AF.rupiah(m.actual) };
    if (KPI === "effective-call") return { pct: m.ecPct, tone: tone80(Math.min(m.ecPct, m.visitPct)), main: m.ecPct, text: AF.pct(m.ecPct) };
    if (KPI === "noo") return { pct: m.nooPct, tone: toneTarget(m.nooPct), main: m.nooActual, text: AF.num(m.nooActual) };
    if (KPI === "nop") return { pct: m.nopPct, tone: toneTarget(m.nopPct), main: m.nopActual, text: AF.num(m.nopActual) };
    if (KPI === "roa") {
      if (o) return { pct: o.status === "Inactive" ? 0 : 100, tone: o.status === "Inactive" ? "bad" : o.status === "At Risk" ? "warn" : "good", main: m.actual, text: AF.rupiah(m.actual) };
      return { pct: m.roaPct, tone: tone80(m.roaPct), main: m.roaPct, text: AF.pct(m.roaPct) };
    }
    const item = filter.state.item, u = item === "all" ? sumUnits(m.units) : m.units[item];
    return { pct: null, tone: "neutral", main: u, text: AF.num(u) + " unit" };
  }

  function buildRows(state) {
    const g = groupsFor(state);
    if (g.level === "Produk") {
      const m = AF.metrics(AF.scopeOutlets(state, true), INFO.factor);
      const total = sumUnits(m.units);
      return { level: "Produk", rows: D.products.map(function (p) {
        const u = m.units[p.code];
        return { id: p.code, name: short(p.name), units: u, value: u * p.price, share: total ? u / total * 100 : 0, buyers: AF.scopeOutlets(state, true).filter(function (o) { return o.units[p.code] > 0; }).length,
          v: { pct: null, tone: "neutral", main: u, text: AF.num(u) + " unit" } };
      }) };
    }
    return { level: g.level, key: g.key, rows: g.groups.map(function (x) {
      const m = AF.metrics(x.outlets, INFO.factor);
      const p = AF.prevMetrics(x.outlets, INFO, x.id);
      const v = rowValue(m, x.outlet);
      return { id: x.id, name: x.name, sub: x.sub, outlet: x.outlet, m: m, p: p, v: v };
    }) };
  }

  // ---------- urutan ----------
  const SORTS = [["value-desc", "Nilai tertinggi"], ["value-asc", "Nilai terendah"], ["pct-desc", "Capaian tertinggi"], ["pct-asc", "Capaian terendah"], ["name", "Nama A–Z"]];
  function sortRows(rows) {
    const k = sortBy || (KPI === "penjualan" || KPI === "noo" || KPI === "nop" ? "pct-desc" : "value-desc");
    const out = rows.slice();
    const pct = function (r) { return r.v.pct === null ? r.v.main : r.v.pct; };
    if (k === "name") out.sort(function (a, b) { return a.name.localeCompare(b.name, "id"); });
    else if (k === "value-asc") out.sort(function (a, b) { return a.v.main - b.v.main; });
    else if (k === "pct-desc") out.sort(function (a, b) { return pct(b) - pct(a); });
    else if (k === "pct-asc") out.sort(function (a, b) { return pct(a) - pct(b); });
    else out.sort(function (a, b) { return b.v.main - a.v.main; });
    return out;
  }

  function drill(row, level) {
    const key = { Wilayah: "wilayah", Area: "area", Sales: "sales" }[level];
    if (key) filter.set(AF.drillPatch(key, row.id));
    else if (level === "Toko") filter.set({ outlet: filter.state.outlet === row.id ? "all" : row.id });
    else if (level === "Produk") filter.set({ item: filter.state.item === row.id ? "all" : row.id });
  }

  // ---------- ringkasan ----------
  function renderSummary(m, outlets, p) {
    let cards;
    if (KPI === "penjualan") {
      const gap = m.actual - m.target;
      cards = [summaryCard("Aktual Penjualan", AF.rupiah(m.actual), AF.rupiah(m.actual, false), AF.delta(m.actual, p.actual)),
        summaryCard("Target", AF.rupiah(m.target), AF.rupiah(m.target, false)),
        summaryCard("Capaian", AF.pct(m.salesPct), "", AF.delta(m.salesPct, p.salesPct, true)),
        summaryCard("Selisih", (gap >= 0 ? "+" : "−") + AF.rupiah(Math.abs(gap)), gap >= 0 ? "Di atas target" : "Kurang dari target")];
    } else if (KPI === "effective-call") {
      cards = [summaryCard("Kunjungan Terjadwal", AF.num(m.visitsPlan), "Wajib tiap 2 minggu per toko"),
        summaryCard("Kunjungan Terlaksana", AF.pct(m.visitPct), AF.num(m.visitsDone) + " dari " + AF.num(m.visitsPlan) + " jadwal", AF.delta(m.visitPct, p.visitPct, true)),
        summaryCard("Kunjungan + Transaksi", AF.num(m.visitsOrder), "Ada order di tanggal kunjungan", AF.delta(m.visitsOrder, p.visitsOrder)),
        summaryCard("Effective Call", AF.pct(m.ecPct), "Transaksi ÷ kunjungan terlaksana", AF.delta(m.ecPct, p.ecPct, true))];
    } else if (KPI === "noo" || KPI === "nop") {
      const K = KPI, a = m[K + "Actual"], t = m[K + "Target"], pc = m[K + "Pct"];
      const list = m[K + "List"], still = list.filter(function (o) { return o.status !== "Inactive"; }).length;
      cards = [summaryCard(K.toUpperCase() + " Aktual", AF.num(a), K === "nop" ? "Toko menambah produk ke-2, ke-3, dst" : "Toko baru order pertama", AF.delta(a, p[K + "Actual"])),
        summaryCard(K.toUpperCase() + " Target", AF.num(t), ""),
        summaryCard("Capaian", AF.pct(pc), ""),
        summaryCard(K.toUpperCase() + " Masih Beli", AF.num(still) + "<small> / " + AF.num(a) + "</small>", "Sudah jadi ROA")];
    } else if (KPI === "roa") {
      cards = [summaryCard("RO (Registered Outlet)", AF.num(m.outlets), ""),
        summaryCard("ROA (Registered Outlet Active)", AF.num(m.active), "Beli rutin dalam 1 bulan", AF.delta(m.active, p.active)),
        summaryCard("RO Tidak ROA", AF.num(m.inactive), "Tidak beli > 1 bulan", AF.delta(m.inactive, p.inactive), true),
        summaryCard("ROA", AF.pct(m.roaPct), "", AF.delta(m.roaPct, p.roaPct, true))];
    } else {
      const items = D.products.map(function (x) { return { p: x, u: m.units[x.code] }; }).sort(function (a, b) { return b.u - a.u; });
      const total = sumUnits(m.units), sel = filter.state.item;
      const selUnits = sel === "all" ? total : m.units[sel];
      const buyers = outlets.filter(function (o) { return sel === "all" ? AF.outletActual(o) > 0 : o.units[sel] > 0; }).length;
      cards = [summaryCard("Total Unit Terjual", AF.num(selUnits), sel === "all" ? "Semua produk" : short(PNAME[sel]), AF.delta(selUnits, sel === "all" ? sumUnits(p.units) : p.units[sel])),
        summaryCard("Produk Paling Laku", short(items[0].p.name), AF.num(items[0].u) + " unit · " + AF.pct(total ? items[0].u / total * 100 : 0), AF.delta(items[0].u, p.units[items[0].p.code])),
        summaryCard("Toko yang Beli", AF.num(buyers), "dari " + AF.num(outlets.length) + " RO"),
        summaryCard("Nilai Penjualan", AF.rupiah(sel === "all" ? m.actual : m.units[sel] * AF.PRICE[sel]), "", AF.delta(sel === "all" ? m.actual : m.units[sel], sel === "all" ? p.actual : p.units[sel]))];
    }
    setText("detail-kpis", cards.join(""));
  }

  // ---------- grafik ----------
  function refLine(value, label, axis) {
    return {
      id: "ref" + value,
      afterDatasetsDraw: function (chart) {
        const sc = chart.scales[axis], a = chart.chartArea, ctx = chart.ctx, pos = sc.getPixelForValue(value);
        ctx.save(); ctx.strokeStyle = "#0f172a"; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2; ctx.beginPath();
        if (axis === "x") { ctx.moveTo(pos, a.top); ctx.lineTo(pos, a.bottom); } else { ctx.moveTo(a.left, pos); ctx.lineTo(a.right, pos); }
        ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = "#0f172a"; ctx.font = "600 11px 'Segoe UI', Arial, sans-serif"; ctx.textAlign = "center";
        if (axis === "x") ctx.fillText(label, pos, a.top - 6); else ctx.fillText(label, a.right - 30, pos - 6);
        ctx.restore();
      }
    };
  }

  function renderChart(data, state) {
    const canvas = document.getElementById("detail-chart"), wrap = document.getElementById("chart-wrap");
    const rows = data.rows, lvl = data.level;
    let title, labels = rows.map(function (r) { return r.name.slice(0, 32); }), datasets, plugins = [], fmt, xMax, legend = null;
    if (KPI === "ro-item" && lvl !== "Produk") {
      // penyebaran produk ke wilayah: batang bertumpuk per produk
      title = "Penyebaran Produk per " + lvl;
      const PCOL = ["#1d4ed8", "#3b82f6", "#10b981", "#f59e0b", "#a855f7"];
      const sel = filter.state.item;
      datasets = D.products.filter(function (p) { return sel === "all" || p.code === sel; }).map(function (p, i) {
        return { label: short(p.name), data: rows.map(function (r) { return r.m.units[p.code]; }), backgroundColor: PCOL[D.products.indexOf(p) % 5], stack: "s", valueLabel: false };
      });
      legend = true;
    } else if (lvl === "Produk") {
      title = "Unit Terjual per Produk";
      datasets = [{ label: "Unit", data: rows.map(function (r) { return r.units; }), backgroundColor: rows.map(function (r) { return filter.state.item === r.id ? "#1d4ed8" : "#93c5fd"; }), borderRadius: 4 }];
    } else if (KPI === "penjualan") {
      title = "Capaian Target per " + lvl;
      datasets = [{ label: "Capaian", data: rows.map(function (r) { return Math.round(r.v.pct * 10) / 10; }), backgroundColor: rows.map(function (r) { return COLOR[r.v.tone]; }), borderRadius: 3, barThickness: 14 }];
      fmt = function (v) { return v.toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "%"; };
      plugins.push(refLine(100, "Target 100%", "x"));
      xMax = Math.max(110, Math.ceil(Math.max.apply(null, rows.map(function (r) { return r.v.pct; }).concat([0])) / 10) * 10 + 10);
    } else if (KPI === "effective-call") {
      title = "Effective Call & Kunjungan Terlaksana per " + lvl;
      datasets = [
        { label: "Effective Call", data: rows.map(function (r) { return Math.round(r.m.ecPct * 10) / 10; }), backgroundColor: rows.map(function (r) { return COLOR[tone80(r.m.ecPct)]; }), borderRadius: 3, barThickness: 10 },
        { label: "Kunjungan terlaksana", data: rows.map(function (r) { return Math.round(r.m.visitPct * 10) / 10; }), backgroundColor: "#cbd5e1", borderRadius: 3, barThickness: 10 }];
      fmt = function (v) { return v.toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "%"; };
      plugins.push(refLine(80, "Batas 80%", "x"));
      xMax = 110; legend = true;
    } else if (KPI === "noo" || KPI === "nop") {
      title = KPI.toUpperCase() + " Aktual vs Target per " + lvl;
      datasets = [{ label: "Aktual", data: rows.map(function (r) { return r.v.main; }), backgroundColor: rows.map(function (r) { return COLOR[r.v.tone]; }), borderRadius: 3, order: 1, grouped: false, barPercentage: .5 },
        { label: "Target", data: rows.map(function (r) { return r.m[KPI + "Target"]; }), backgroundColor: "#e2e8f0", borderRadius: 3, order: 2, grouped: false, barPercentage: .85, valueLabel: false }];
      legend = true;
    } else if (KPI === "roa") {
      if (lvl === "Toko") {
        title = "Aktual Penjualan per Toko";
        datasets = [{ label: "Aktual", data: rows.map(function (r) { return Math.round(r.m.actual / 1e5) / 10; }), backgroundColor: rows.map(function (r) { return COLOR[r.v.tone]; }), borderRadius: 3, barThickness: 12 }];
        fmt = function (v) { return v.toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " jt"; };
      } else {
        title = "ROA vs RO Tidak ROA per " + lvl;
        datasets = [{ label: "ROA", data: rows.map(function (r) { return r.m.active; }), backgroundColor: "#10b981", stack: "s" },
          { label: "RO tidak ROA", data: rows.map(function (r) { return r.m.inactive; }), backgroundColor: "#ef4444", stack: "s" }];
        legend = true;
      }
    } else {
      title = "Unit Terjual per " + lvl;
      datasets = [{ label: "Unit", data: rows.map(function (r) { return r.v.main; }), backgroundColor: "#2563eb", borderRadius: 4 }];
    }
    setText("chart-title", title);
    // banyak data: batang mendatar, tinggi ikut jumlah baris, area grafik bisa di-scroll
    const per = KPI === "effective-call" ? 30 : 24;
    wrap.style.height = Math.max(280, rows.length * per + 70) + "px";
    const stacked = datasets.some(function (d) { return d.stack; });
    createChart(canvas, {
      type: "bar",
      data: { labels: labels, datasets: datasets },
      plugins: plugins,
      options: {
        responsive: true, maintainAspectRatio: false, animation: false, indexAxis: "y",
        plugins: {
          legend: legend ? { position: "top", align: "end", labels: { boxWidth: 10, color: "#334155", font: { size: 12 } } } : { display: false },
          valueLabels: fmt ? { format: fmt } : {}
        },
        scales: {
          x: { beginAtZero: true, max: xMax, stacked: stacked, grid: { color: "#eef2f7" }, ticks: { color: "#475569", font: { size: 11 }, callback: fmt ? function (v) { return v + "%"; } : undefined } },
          y: { stacked: stacked, grid: { display: false }, ticks: { color: "#1e293b", font: { size: 11 }, autoSkip: false } }
        },
        layout: { padding: { right: 52, top: plugins.length ? 18 : 4 } },
        onClick: function (_e, els) { if (els.length) drill(rows[els[0].index], lvl); }
      }
    });
    if (KPI === "roa" && lvl === "Toko") { const x = chartInstances.get(canvas); x.options.scales.x.ticks.callback = function (v) { return v + " jt"; }; x.update(); }
    // legenda warna
    const lg = KPI === "penjualan" || KPI === "noo" || KPI === "nop" ? LEGEND.target : (KPI === "effective-call" || KPI === "roa") ? LEGEND.rate : null;
    setText("tone-legend", lg && lvl !== "Produk" ? '<span class="lg-title">Warna ' + (KPI === "roa" && lvl === "Toko" ? "status toko" : "capaian") + ":</span>" +
      (KPI === "roa" && lvl === "Toko" ? [["good", "ROA"], ["warn", "Belum dikunjungi"], ["bad", "RO tidak ROA"]] : lg).map(function (x) { return '<span><i class="tone-' + x[0] + '"></i>' + x[1] + "</span>"; }).join("") : "");
  }

  // ---------- panel samping ----------
  function productRanking(m, clickable) {
    const items = D.products.map(function (p) { return { id: p.code, name: short(p.name), u: m.units[p.code] }; }).sort(function (a, b) { return b.u - a.u; });
    const max = items.length ? items[0].u : 1;
    return '<ul class="rank-list' + (clickable ? " clickable" : "") + '">' + items.map(function (it, i) {
      return '<li data-item="' + it.id + '"' + (filter.state.item === it.id ? ' class="selected"' : "") + '><span class="rank-name"><b>#' + (i + 1) + "</b> " + AF.esc(it.name) + '</span><span class="rank-bar"><i style="width:' + (max ? it.u / max * 100 : 0) + '%"></i></span><span class="rank-val">' + AF.num(it.u) + " unit</span></li>";
    }).join("") + "</ul>";
  }

  function visitText(o) {
    const v = o.visits;
    if (!v || !v.length) return "-";
    const lbl = ["Terlewat", "Dikunjungi", "Transaksi"];
    const day = function (d) { const x = new Date(AF.D.snapshot + "T00:00:00"); x.setDate(x.getDate() + d); return x.getDate() + " " + AF.MONTHS[x.getMonth()]; };
    return day(v[0]) + ": " + lbl[v[1]] + " · " + day(v[2]) + ": " + lbl[v[3]];
  }

  function outletDetail(o) {
    const m = AF.metrics([o], INFO.factor), sales = AF.SALES[o.sales];
    return '<dl class="definition-list">' +
      "<div><dt>Toko</dt><dd>" + AF.esc(o.name) + " (" + o.id + ")</dd></div>" +
      "<div><dt>Wilayah / Area</dt><dd>" + AF.esc(AF.REGION[o.region].name) + " · " + AF.esc(AF.AREA[o.area].name) + "</dd></div>" +
      "<div><dt>Sales</dt><dd>" + AF.esc(sales.name) + " (" + sales.id + ")</dd></div>" +
      "<div><dt>ASM / RSM</dt><dd>" + AF.esc(AF.AREA[o.area].asm) + " / " + AF.esc(AF.REGION[o.region].rsm) + "</dd></div>" +
      "<div><dt>Status</dt><dd>" + statusBadge(o) + "</dd></div>" +
      "<div><dt>Kunjungan</dt><dd>" + visitText(o) + "</dd></div>" +
      (o.slow ? "<div><dt>Risiko kedaluwarsa</dt><dd>" + AF.num(o.slow) + " unit produk slow moving" + (o.batch >= 0 ? " (batch " + D.batches[o.batch].id + ")" : "") + "</dd></div>" : "") +
      "<div><dt>NOO / NOP</dt><dd>" + (o.noo ? '<span class="badge">NOO</span> ' : "") + (o.nop ? '<span class="badge blue">NOP: ' + AF.esc(short(PNAME[o.nop])) + "</span>" : "") + (!o.noo && !o.nop ? "-" : "") + "</dd></div>" +
      "<div><dt>Aktual / Target</dt><dd>" + AF.rupiah(m.actual) + " / " + AF.rupiah(m.target) + " (" + AF.pct(m.salesPct) + ")</dd></div></dl>" +
      '<span class="popup-label">Produk dibeli</span>' + productRanking(m);
  }

  function renderSide(state, m, outlets) {
    let title, html;
    if (state.outlet !== "all" && KPI !== "ro-item") {
      title = "Detail Toko"; html = outletDetail(AF.OUTLET[state.outlet]);
    } else if (KPI === "penjualan" || KPI === "ro-item") {
      title = KPI === "ro-item" ? "Pilih Produk" : "Produk Paling Laku";
      html = productRanking(m, KPI === "ro-item");
    } else if (KPI === "effective-call") {
      title = "Sales di Bawah 80%";
      const per = {};
      for (const o of outlets) { const s = per[o.sales] || (per[o.sales] = { p: 0, d: 0, t: 0 }); s.p += o.visits_plan; s.d += o.visits_done; s.t += o.orders; }
      const list = Object.keys(per).map(function (id) { const x = per[id]; return { s: AF.SALES[id], ec: x.d ? x.t / x.d * 100 : 0, vp: x.p ? x.d / x.p * 100 : 0 }; })
        .filter(function (x) { return x.ec < 80 || x.vp < 80; }).sort(function (a, b) { return Math.min(a.ec, a.vp) - Math.min(b.ec, b.vp); });
      html = list.length ? '<ul class="stat-list">' + list.slice(0, 8).map(function (x) {
        return "<li><span>" + AF.esc(x.s.name) + '<span class="subtext">' + AF.esc(AF.AREA[x.s.area].name) + '</span></span><span class="pair">' +
          badgeFor(tone80(x.ec), "EC " + AF.pct(x.ec)) + " " + badgeFor(tone80(x.vp), "Kunjungan " + AF.pct(x.vp)) + "</span></li>";
      }).join("") + "</ul>" + (list.length > 8 ? '<p class="muted small">+' + (list.length - 8) + " sales lain</p>" : "") +
        '<div class="card-link"><a class="detail-button" data-keep-filter data-base="early-warning.html" href="early-warning.html' + AF.stateQuery(state, { jenis: "kinerja" }) + '">Lihat di Peringatan Dini →</a></div>'
        : '<p class="muted">Semua sales di cakupan ini ≥ 80%.</p>';
    } else if (KPI === "noo") {
      title = "Status RO";
      const nooActive = m.nooList.filter(function (o) { return o.status !== "Inactive"; }).length;
      html = '<ul class="stat-list"><li><span><i class="swatch" style="background:#10b981"></i>ROA, kunjungan rutin</span><strong>' + AF.num(m.active - m.atRisk) + "</strong></li>" +
        '<li><span><i class="swatch" style="background:#f59e0b"></i>Belum dikunjungi &gt; 14 hari</span><strong>' + AF.num(m.atRisk) + "</strong></li>" +
        '<li><span><i class="swatch" style="background:#ef4444"></i>RO tidak ROA</span><strong>' + AF.num(m.inactive) + "</strong></li>" +
        "<li><span>NOO yang masih beli</span><strong>" + nooActive + " / " + m.nooActual + "</strong></li></ul>";
    } else if (KPI === "nop") {
      title = "Statistik Produk NOP";
      const c = {};
      for (const p of D.products) c[p.code] = { n: 0, u: 0 };
      for (const o of m.nopList) if (o.nop) { c[o.nop].n++; c[o.nop].u += o.units[o.nop]; }
      const tot = m.nopList.length || 1;
      const rows = D.products.filter(function (p) { return c[p.code].n > 0; }).map(function (p) { return { p: p, n: c[p.code].n, u: c[p.code].u }; }).sort(function (a, b) { return b.n - a.n; });
      const max = rows.length ? rows[0].n : 1;
      html = '<ul class="rank-list nop-stat">' + rows.map(function (r) {
        return '<li><span class="rank-name">' + AF.esc(short(r.p.name)) + '</span><span class="rank-bar"><i style="width:' + r.n / max * 100 + '%"></i></span><span class="rank-val">' + r.n + " toko · " + AF.pct(r.n / tot * 100) + "</span></li>";
      }).join("") + "</ul>" + '<p class="muted small">NOP dihitung saat toko menambah produk ke-2, ke-3, dst. Produk fast moving tidak muncul karena biasanya sudah dibeli sejak order pertama.</p>';
    } else {
      title = "Peringatan";
      const atRisk = outlets.filter(function (o) { return o.status === "At Risk"; }).length, inactive = outlets.filter(function (o) { return o.status === "Inactive"; }).length;
      const slow = outlets.filter(function (o) { return o.slow > 0; }).length;
      html = '<ul class="stat-list"><li><span>Jadwal kunjungan terlewat</span><strong>' + atRisk + "</strong></li><li><span>RO tidak ROA (tidak beli &gt; 1 bulan)</span><strong>" + inactive +
        "</strong></li><li><span>Risiko kedaluwarsa (produk slow moving)</span><strong>" + slow + "</strong></li></ul>" +
        '<div class="card-link"><a class="detail-button" data-keep-filter data-base="early-warning.html" href="early-warning.html' + AF.stateQuery(state) + '">Peringatan Dini →</a></div>';
    }
    setText("side-title", title);
    setText("side-body", html);
    for (const li of document.querySelectorAll("#side-body .rank-list.clickable li")) li.onclick = function () { filter.set({ item: filter.state.item === li.dataset.item ? "all" : li.dataset.item }); };
  }

  // ---------- tabel ----------
  function td(html, sortVal, cls) {
    return '<td class="' + (cls === undefined ? "numeric" : cls) + '"' + (sortVal !== undefined ? ' data-v="' + sortVal + '"' : "") + ">" + html + "</td>";
  }

  function fillTable(id, headers, rows, empty) {
    const t = document.getElementById(id);
    t.querySelector("thead").innerHTML = "<tr>" + headers.map(function (h, i) { return '<th scope="col" data-col="' + i + '">' + h + "</th>"; }).join("") + "</tr>";
    t.querySelector("tbody").innerHTML = rows.join("") + '<tr class="filter-empty" hidden><td class="table-empty" colspan="' + headers.length + '">' + (empty || "Tidak ada data yang sesuai.") + "</td></tr>";
  }

  function renderTable(state, m, data) {
    const lvl = data.level, rows = sortRows(data.rows);
    setText("table-title", (lvl === "Produk" ? "Produk di " + AF.AREA[state.area].name : "Data per " + lvl) + " (" + rows.length + ")");
    let headers, cells;
    const name = function (r) {
      return td("<strong>" + AF.esc(r.name) + "</strong>" + (r.sub && lvl !== "Sales" ? '<span class="subtext">' + AF.esc(r.sub) + "</span>" : r.outlet ? '<span class="subtext mono">' + r.id + "</span>" : ""), r.name, "");
    };
    const dl = function (r) { const d = KPI === "effective-call" ? AF.delta(r.m.ecPct, r.p.ecPct, true) : KPI === "roa" ? AF.delta(r.m.roaPct, r.p.roaPct, true) : AF.delta(r.v.main, KPI === "penjualan" ? r.p.actual : r.p[KPI + "Actual"]); return td(AF.deltaPill(d, "Dibanding " + INFO.prevRange), d.value, ""); };
    if (lvl === "Produk") {
      headers = ["#", "Produk", "Unit", "Nilai", "Porsi", "Toko Pembeli"];
      cells = function (r, i) { return [td(i + 1, i, "mono"), td("<strong>" + AF.esc(r.name) + "</strong>", r.name, ""), td(AF.num(r.units), r.units), td(AF.rupiah(r.value), r.value), td(AF.pct(r.share), r.share), td(AF.num(r.buyers), r.buyers)]; };
    } else if (KPI === "penjualan") {
      headers = [lvl, "Target", "Aktual Penjualan", "Selisih", "Capaian", "vs Periode Lalu"];
      cells = function (r) { const g = r.m.actual - r.m.target; return [name(r), td(AF.rupiah(r.m.target), r.m.target), td("<strong>" + AF.rupiah(r.m.actual) + "</strong>", r.m.actual), td((g >= 0 ? "+" : "−") + AF.rupiah(Math.abs(g)), g), td(AF.pct(r.m.salesPct), r.m.salesPct), dl(r)]; };
    } else if (KPI === "effective-call") {
      if (lvl === "Toko") {
        headers = ["Toko", "Kunjungan", "Terlaksana", "Transaksi", "Effective Call"];
        cells = function (r) { const o = r.outlet; return [name(r), td(visitText(o), o.visits[0], ""), td(o.visits_done + " / 2", o.visits_done), td(o.orders, o.orders), td(AF.pct(r.m.ecPct), r.m.ecPct)]; };
      } else {
        headers = [lvl, "Terjadwal", "Terlaksana", "% Kunjungan", "Transaksi", "Effective Call", "vs Periode Lalu"];
        cells = function (r) { return [name(r), td(AF.num(r.m.visitsPlan), r.m.visitsPlan), td(AF.num(r.m.visitsDone), r.m.visitsDone), td(AF.pct(r.m.visitPct), r.m.visitPct), td(AF.num(r.m.visitsOrder), r.m.visitsOrder), td(AF.pct(r.m.ecPct), r.m.ecPct), dl(r)]; };
      }
    } else if (KPI === "noo" || KPI === "nop") {
      headers = [lvl, "Aktual", "Target", "Capaian", "vs Periode Lalu"];
      cells = function (r) { return [name(r), td(AF.num(r.v.main), r.v.main), td(AF.num(r.m[KPI + "Target"]), r.m[KPI + "Target"]), td(AF.pct(r.v.pct), r.v.pct), dl(r)]; };
    } else if (KPI === "roa") {
      if (lvl === "Toko") {
        headers = ["Toko", "Sales", "Status", "Kunjungan", "Aktual"];
        cells = function (r) { const o = r.outlet; return [name(r), td(AF.esc(AF.SALES[o.sales].name), AF.SALES[o.sales].name, ""), td(statusBadge(o), o.status, ""), td(visitText(o), o.visits[0], ""), td(AF.rupiah(r.m.actual), r.m.actual)]; };
      } else {
        headers = [lvl, "RO", "ROA", "Belum Dikunjungi", "RO Tidak ROA", "ROA %", "vs Periode Lalu"];
        cells = function (r) { return [name(r), td(AF.num(r.m.outlets), r.m.outlets), td(AF.num(r.m.active), r.m.active), td(AF.num(r.m.atRisk), r.m.atRisk), td(AF.num(r.m.inactive), r.m.inactive), td(AF.pct(r.m.roaPct), r.m.roaPct), dl(r)]; };
      }
    } else {
      headers = [lvl].concat(D.products.map(function (p) { return short(p.name); })).concat(["Total unit"]);
      cells = function (r) { const u = r.m.units; return [name(r)].concat(D.products.map(function (p) { return td(AF.num(u[p.code]), u[p.code]); })).concat([td("<strong>" + AF.num(sumUnits(u)) + "</strong>", sumUnits(u))]); };
    }
    fillTable("detail-table", headers, rows.map(function (r, i) {
      const sel = (lvl === "Toko" && state.outlet === r.id) || (lvl === "Produk" && state.item === r.id);
      return '<tr class="row-link tone-row-' + r.v.tone + (sel ? " selected" : "") + '" data-i="' + i + '">' + cells(r, i).join("") + "</tr>";
    }));
    for (const tr of document.querySelectorAll("#detail-table tbody tr[data-i]")) tr.onclick = function () { drill(rows[Number(tr.dataset.i)], lvl); };
  }

  // tabel tambahan: daftar NOO/NOP, atau toko yang membeli produk terpilih
  function renderExtra(state, m, outlets) {
    const card = document.getElementById("extra-card");
    let title = "", headers = [], rows = [];
    if (KPI === "noo" || KPI === "nop") {
      const list = m[KPI + "List"];
      title = "Daftar " + KPI.toUpperCase() + " (" + list.length + " toko)";
      headers = ["Toko", "Wilayah / Area", "Sales", KPI === "noo" ? "Produk Pertama" : "Produk Tambahan", "Status", "Aktual"];
      rows = list.map(function (o) {
        const prod = KPI === "noo" ? Object.keys(o.units).filter(function (k) { return o.units[k] > 0; }).map(function (k) { return short(PNAME[k]); }).join(", ") || "-" : short(PNAME[o.nop] || "-");
        return '<tr class="row-link" data-o="' + o.id + '">' + td("<strong>" + AF.esc(o.name) + '</strong><span class="subtext mono">' + o.id + "</span>", o.name, "") +
          td(AF.esc(AF.REGION[o.region].name) + '<span class="subtext">' + AF.esc(AF.AREA[o.area].name) + "</span>", AF.AREA[o.area].name, "") + td(AF.esc(AF.SALES[o.sales].name), AF.SALES[o.sales].name, "") +
          td(AF.esc(prod), prod, "") + td(statusBadge(o), o.status, "") + td(AF.rupiah(AF.outletActual(o) * INFO.factor), AF.outletActual(o)) + "</tr>";
      });
    } else if (KPI === "ro-item" && state.item !== "all") {
      const code = state.item, buyers = outlets.filter(function (o) { return o.units[code] > 0; }).sort(function (a, b) { return b.units[code] - a.units[code]; });
      title = "Toko yang Membeli " + short(PNAME[code]) + " (" + buyers.length + ")";
      headers = ["Toko", "Wilayah / Area", "Sales", "Unit", "Nilai", "Status"];
      rows = buyers.slice(0, 500).map(function (o) {
        const u = Math.round(o.units[code] * INFO.factor);
        return '<tr class="row-link" data-o="' + o.id + '">' + td("<strong>" + AF.esc(o.name) + '</strong><span class="subtext mono">' + o.id + "</span>", o.name, "") +
          td(AF.esc(AF.REGION[o.region].name) + '<span class="subtext">' + AF.esc(AF.AREA[o.area].name) + "</span>", AF.AREA[o.area].name, "") + td(AF.esc(AF.SALES[o.sales].name), AF.SALES[o.sales].name, "") +
          td(AF.num(u), u) + td(AF.rupiah(u * AF.PRICE[code]), u * AF.PRICE[code]) + td(statusBadge(o), o.status, "") + "</tr>";
      });
    } else if (KPI === "ro-item") {
      title = "Toko yang Membeli Produk";
      headers = ["Info"];
      rows = ['<tr><td class="table-empty">Pilih produk di panel "Pilih Produk" atau di filter untuk melihat daftar toko pembelinya.</td></tr>'];
    }
    card.hidden = !title;
    if (!title) return;
    setText("extra-title", title);
    fillTable("extra-table", headers, rows, "Belum ada toko.");
    for (const tr of document.querySelectorAll("#extra-table tbody tr[data-o]")) tr.onclick = function () {
      const o = AF.OUTLET[tr.dataset.o];
      location.href = "penjualan.html" + AF.stateQuery(Object.assign({}, filter.state, { region: o.region, area: o.area, sales: o.sales, outlet: o.id, item: "all" }));
    };
  }

  function render(state) {
    INFO = AF.periodInfo(state);
    const outlets = AF.scopeOutlets(state, KPI === "ro-item");
    const m = AF.metrics(outlets, INFO.factor);
    const p = AF.prevMetrics(outlets, INFO, [state.pulau, state.region, state.area, state.sales, state.outlet].join("|"));
    crumbs(state);
    renderSummary(m, outlets, p);
    const data = buildRows(state);
    data.rows = sortRows(data.rows);
    renderChart(data, state);
    renderSide(state, m, outlets);
    renderTable(state, m, data);
    renderExtra(state, m, outlets);
    if (document.getElementById("search").value) searchTables();
  }

  document.addEventListener("DOMContentLoaded", function () {
    const sel = document.getElementById("sort-by");
    const opts = KPI === "ro-item" ? SORTS.filter(function (s) { return s[0].indexOf("pct") < 0; }) : SORTS;
    sel.innerHTML = opts.map(function (s) { return '<option value="' + s[0] + '">' + s[1] + "</option>"; }).join("");
    sortBy = opts.some(function (s) { return s[0] === "pct-desc"; }) && (KPI === "penjualan" || KPI === "noo" || KPI === "nop") ? "pct-desc" : "value-desc";
    sel.value = sortBy;
    sel.onchange = function () { sortBy = sel.value; render(filter.state); };
    filter = AF.renderFilterBar(document.getElementById("filter-bar"), { third: KPI === "ro-item" ? "item" : "outlet" }, render);
  });
})();
