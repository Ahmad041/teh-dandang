// Halaman detail 6 KPI Dashboard Utama (Volume Penjualan, Effective Call, NOO, NOP, ROA, Produk Paling Laku).
(function () {
  const root = document.getElementById("kpi-detail");
  if (!root || !window.AF) return;
  const AF = window.AF, D = AF.D, KPI = root.dataset.kpi;
  const PNAME = {};
  for (const p of D.products) PNAME[p.code] = p.name;
  let filter;

  function setText(id, html) { document.getElementById(id).innerHTML = html; }
  function short(name) { return name.replace("Teh Dandang ", ""); }

  function roaTone(p) { return p >= 90 ? "good" : p >= 80 ? "warn" : "bad"; }

  let INFO;
  function summaryCard(label, value, sub, dl, invert) {
    const tone = dl ? AF.deltaTone(dl, invert) : "flat";
    const pill = dl ? '<div class="kpi-top">' + AF.deltaPill(dl, "Dibanding " + INFO.prevRange, invert) + "</div>" : "";
    return '<article class="card kpi trend-' + tone + '"><h2 class="kpi-label">' + label + '</h2><div class="kpi-value">' + value + "</div>" + pill + (sub ? '<span class="kpi-sub">' + sub + "</span>" : "") + "</article>";
  }

  // perubahan nilai utama tiap KPI vs periode sebelumnya
  function mainDelta(m, p) {
    if (KPI === "penjualan") return AF.delta(m.actual, p.actual);
    if (KPI === "effective-call") return AF.delta(m.ecPct, p.ecPct, true);
    if (KPI === "noo") return AF.delta(m.nooActual, p.nooActual);
    if (KPI === "nop") return AF.delta(m.nopActual, p.nopActual);
    if (KPI === "roa") return AF.delta(m.roaPct, p.roaPct, true);
    const item = filter.state.item;
    const sum = function (u) { return Object.values(u).reduce(function (a, b) { return a + b; }, 0); };
    return item === "all" ? AF.delta(sum(m.units), sum(p.units)) : AF.delta(m.units[item], p.units[item]);
  }

  function crumbs(state) {
    const parts = ['<button type="button" data-go="all">Semua Wilayah</button>'];
    if (state.pulau !== "all") parts.push('<button type="button" data-go="pulau">' + AF.esc(AF.PULAU[state.pulau].name) + "</button>");
    if (state.region !== "all") parts.push('<button type="button" data-go="region">' + AF.esc(AF.REGION[state.region].name) + "</button>");
    if (state.area !== "all") parts.push('<button type="button" data-go="area">' + AF.esc(AF.AREA[state.area].name) + "</button>");
    if (state.sales !== "all" && KPI !== "ro-item") parts.push('<button type="button" data-go="sales">' + AF.esc(AF.SALES[state.sales].name) + "</button>");
    if (state.outlet !== "all" && KPI !== "ro-item") parts.push('<button type="button" data-go="outlet">' + AF.esc(AF.OUTLET[state.outlet].name) + "</button>");
    const el = document.getElementById("scope-crumbs");
    el.innerHTML = parts.join('<span aria-hidden="true">›</span>');
    const last = el.querySelectorAll("button");
    last[last.length - 1].setAttribute("aria-current", "location");
    for (const b of last) b.onclick = function () {
      const g = b.dataset.go;
      if (g === "all") filter.set({ pulau: "all", region: "all", area: "all", sales: "all", outlet: "all" });
      if (g === "pulau") filter.set({ region: "all", area: "all", sales: "all", outlet: "all" });
      if (g === "region") filter.set({ area: "all", sales: "all", outlet: "all" });
      if (g === "area") filter.set({ sales: "all", outlet: "all" });
      if (g === "sales") filter.set({ outlet: "all" });
    };
  }

  const LEVEL_KEY = { Pulau: "pulau", Wilayah: "wilayah", Area: "area", Sales: "sales" };
  function drill(group, level) {
    if (LEVEL_KEY[level]) filter.set(AF.drillPatch(LEVEL_KEY[level], group.id));
    else if (level === "Toko") filter.set({ outlet: filter.state.outlet === group.id ? "all" : group.id });
    else if (level === "Produk") filter.set({ item: filter.state.item === group.id ? "all" : group.id });
  }

  // nilai per unit untuk tiap KPI
  function unitValue(m, outlets) {
    if (KPI === "penjualan") return { pct: m.salesPct, tone: AF.tone(m.salesPct), main: AF.rupiah(m.actual), sub: "Target " + AF.rupiah(m.target) };
    if (KPI === "effective-call") return { pct: m.ecPct, tone: AF.tone(m.ecPct / .95), main: AF.pct(m.ecPct), sub: AF.num(m.visitsDone) + " / " + AF.num(m.visitsPlan) + " kunjungan" };
    if (KPI === "noo") return { pct: m.nooPct, tone: AF.tone(m.nooPct), main: AF.num(m.nooActual) + " / " + AF.num(m.nooTarget), sub: "NOO aktual / target" };
    if (KPI === "nop") return { pct: m.nopPct, tone: AF.tone(m.nopPct), main: AF.num(m.nopActual) + " / " + AF.num(m.nopTarget), sub: "NOP aktual / target" };
    if (KPI === "roa") return { pct: m.roaPct, tone: roaTone(m.roaPct), main: AF.pct(m.roaPct), sub: AF.num(m.active) + " / " + AF.num(m.outlets) + " RO" };
    const item = filter.state.item;
    const u = item === "all" ? Object.values(m.units).reduce(function (a, b) { return a + b; }, 0) : m.units[item];
    return { pct: null, tone: "neutral", main: AF.num(u) + " unit", sub: item === "all" ? "Semua produk" : short(PNAME[item]) };
  }

  function renderSummary(m, outlets, p) {
    let cards;
    if (KPI === "penjualan") {
      const gap = m.actual - m.target;
      cards = [summaryCard("Aktual Penjualan", AF.rupiah(m.actual), AF.rupiah(m.actual, false), AF.delta(m.actual, p.actual)),
        summaryCard("Target", AF.rupiah(m.target), AF.rupiah(m.target, false)),
        summaryCard("Capaian", AF.pct(m.salesPct), "", AF.delta(m.salesPct, p.salesPct, true)),
        summaryCard("Selisih", (gap >= 0 ? "+" : "−") + AF.rupiah(Math.abs(gap)), gap >= 0 ? "Di atas target" : "Kurang dari target")];
    } else if (KPI === "effective-call") {
      cards = [summaryCard("Kunjungan Terjadwal", AF.num(m.visitsPlan), ""),
        summaryCard("Kunjungan Terlaksana", AF.num(m.visitsDone), "", AF.delta(m.visitsDone, p.visitsDone)),
        summaryCard("Effective Call", AF.pct(m.ecPct), "", AF.delta(m.ecPct, p.ecPct, true)),
        summaryCard("Tidak Terlaksana", AF.num(m.visitsPlan - m.visitsDone), "", AF.delta(m.visitsPlan - m.visitsDone, p.visitsPlan - p.visitsDone), true)];
    } else if (KPI === "noo" || KPI === "nop") {
      const a = KPI === "noo" ? m.nooActual : m.nopActual, t = KPI === "noo" ? m.nooTarget : m.nopTarget, pc = KPI === "noo" ? m.nooPct : m.nopPct;
      const list = KPI === "noo" ? m.nooList : m.nopList;
      const stillActive = list.filter(function (o) { return o.status !== "Inactive"; }).length;
      const pa = KPI === "noo" ? p.nooActual : p.nopActual;
      cards = [summaryCard(KPI.toUpperCase() + " Aktual", AF.num(a), "", AF.delta(a, pa)),
        summaryCard(KPI.toUpperCase() + " Target", AF.num(t), ""),
        summaryCard("Capaian", AF.pct(pc), ""),
        summaryCard("ROA", AF.num(m.active) + "<small> / " + AF.num(m.outlets) + " RO</small>", stillActive + " " + KPI.toUpperCase() + " masih beli bulan ini", AF.delta(m.active, p.active))];
    } else if (KPI === "roa") {
      cards = [summaryCard("RO (Registered Outlet)", AF.num(m.outlets), ""),
        summaryCard("ROA (Registered Outlet Active)", AF.num(m.active), "Beli rutin dalam 1 bulan", AF.delta(m.active, p.active)),
        summaryCard("RO Tidak ROA", AF.num(m.inactive), "Tidak beli > 1 bulan", AF.delta(m.inactive, p.inactive), true),
        summaryCard("ROA", AF.pct(m.roaPct), "", AF.delta(m.roaPct, p.roaPct, true))];
    } else {
      const items = D.products.map(function (p) { return { p: p, u: m.units[p.code] }; }).sort(function (a, b) { return b.u - a.u; });
      const total = items.reduce(function (s, x) { return s + x.u; }, 0);
      const sel = filter.state.item;
      const selUnits = sel === "all" ? total : m.units[sel];
      const buyers = outlets.filter(function (o) { return sel === "all" ? AF.outletActual(o) > 0 : o.units[sel] > 0; }).length;
      const ptotal = Object.values(p.units).reduce(function (s, x) { return s + x; }, 0);
      cards = [summaryCard("Total Unit Order", AF.num(selUnits), sel === "all" ? "Semua produk" : short(PNAME[sel]), AF.delta(selUnits, sel === "all" ? ptotal : p.units[sel])),
        summaryCard("Produk Paling Laku", short(items[0].p.name), AF.num(items[0].u) + " unit · " + AF.pct(total ? items[0].u / total * 100 : 0), AF.delta(items[0].u, p.units[items[0].p.code])),
        summaryCard("Toko yang Beli", AF.num(buyers), "dari " + AF.num(outlets.length) + " RO"),
        summaryCard("Nilai Order", AF.rupiah(sel === "all" ? m.actual : m.units[sel] * AF.PRICE[sel]), "", AF.delta(sel === "all" ? m.actual : m.units[sel], sel === "all" ? p.actual : p.units[sel]))];
    }
    setText("detail-kpis", cards.join(""));
  }

  function itemGroups(m) {
    return D.products.map(function (p) {
      return { id: p.code, name: short(p.name), units: m.units[p.code], value: m.units[p.code] * AF.PRICE[p.code] };
    }).sort(function (a, b) { return b.units - a.units; });
  }

  function renderUnits(state, factor) {
    const cg = AF.childGroups(state);
    let level = cg.level, groups = cg.groups;
    // Item RO: wilayah -> area -> item
    const itemMode = KPI === "ro-item" && state.area !== "all";
    const scopeM = AF.metrics(AF.scopeOutlets(state, true), factor);
    let cards, rows, tokoTable = "";
    if (itemMode) {
      level = "Produk";
      const items = itemGroups(scopeM);
      const total = items.reduce(function (s, x) { return s + x.units; }, 0);
      cards = items.map(function (it, i) {
        const sel = state.item === it.id ? " selected" : "";
        return '<button type="button" class="unit-card trend-flat' + sel + '" data-i="' + i + '"><span class="unit-rank">#' + (i + 1) + "</span><strong>" + AF.esc(it.name) +
          '</strong><span class="unit-main">' + AF.num(it.units) + ' unit</span><span class="unit-sub">' + AF.pct(total ? it.units / total * 100 : 0) + " dari total · " + AF.rupiah(it.value) + "</span></button>";
      });
      groups = items;
      rows = items.map(function (it, i) {
        return { name: it.name, cells: [AF.num(it.units), AF.rupiah(it.value), AF.pct(total ? it.units / total * 100 : 0)], tone: "neutral", id: it.id, rank: i + 1 };
      });
    } else {
      const computed = groups.map(function (g) {
        const gm = AF.metrics(g.outlets, factor);
        const gp = AF.prevMetrics(g.outlets, INFO, g.id);
        return { g: g, m: gm, v: unitValue(gm, g.outlets), d: mainDelta(gm, gp) };
      });
      if (KPI === "ro-item") computed.sort(function (a, b) { return parseInt(b.v.main.replace(/\D/g, "")) - parseInt(a.v.main.replace(/\D/g, "")); });
      groups = computed.map(function (c) { return c.g; });
      cards = computed.map(function (c, i) {
        const sel = state.outlet === c.g.id ? " selected" : "";
        const pctBadge = c.v.pct === null ? "" : '<span class="unit-pct">' + AF.pct(c.v.pct) + "</span>";
        return '<button type="button" class="unit-card trend-' + AF.deltaTone(c.d) + sel + '" data-i="' + i + '"><strong>' + AF.esc(c.g.name) + "</strong>" + (c.g.sub && level !== "Sales" ? '<span class="unit-rank">' + AF.esc(c.g.sub) + "</span>" : "") + pctBadge +
          '<span class="unit-main">' + c.v.main + '</span><span class="unit-sub">' + c.v.sub + '</span><span class="unit-delta">' + AF.deltaPill(c.d, "Dibanding " + INFO.prevRange) + "</span></button>";
      });
      rows = computed.map(function (c) { return { name: c.g.name, m: c.m, v: c.v, id: c.g.id, outlet: c.g.outlet }; });
      if (level === "Toko") {
        const head = { penjualan: ["Aktual", "Target"], "effective-call": ["Effective Call", "Kunjungan"], noo: ["NOO / Target", "Keterangan"], nop: ["NOP / Target", "Keterangan"], roa: ["ROA", "RO"], "ro-item": ["Unit", "Produk"] }[KPI];
        tokoTable = '<div class="table-scroll"><table class="toko-table" data-filterable=""><thead><tr><th scope="col">Toko</th><th scope="col">' + head[0] + '</th><th scope="col">' + head[1] +
          '</th><th scope="col">Capaian</th><th scope="col">vs Periode Lalu</th></tr></thead><tbody>' +
          computed.map(function (c, i) {
            const sel = state.outlet === c.g.id ? ' class="selected"' : "";
            return "<tr" + sel + ' data-i="' + i + '"><td><strong>' + AF.esc(c.g.name) + '</strong><span class="subtext mono">' + c.g.id + '</span></td><td class="numeric"><strong>' + c.v.main +
              '</strong></td><td class="numeric">' + c.v.sub.replace(/^Target /, "") + '</td><td class="numeric">' + (c.v.pct === null ? "–" : badgeFor(c.v.tone, AF.pct(c.v.pct))) +
              "</td><td>" + AF.deltaPill(c.d, "Dibanding " + INFO.prevRange) + "</td></tr>";
          }).join("") + '<tr class="filter-empty" hidden><td class="table-empty" colspan="5">Tidak ada toko yang sesuai.</td></tr></tbody></table></div>';
      }
    }
    setText("unit-title", "Per " + level + " (" + groups.length + ")");
    const box = document.getElementById("unit-cards");
    box.classList.toggle("as-table", !!tokoTable);
    box.innerHTML = tokoTable || cards.join("") || '<p class="muted">Tidak ada data.</p>';
    for (const b of box.querySelectorAll(".unit-card, tbody tr[data-i]")) b.onclick = function () { drill(groups[Number(b.dataset.i)], level); };
    return { level: level, rows: rows, groups: groups };
  }

  function renderChart(units) {
    const canvas = document.getElementById("detail-chart");
    const wrap = canvas.parentElement;
    wrap.style.height = "";
    // Level toko: satu batang per toko = % capaian target, urut tertinggi ke terendah
    if (units.level === "Toko" && units.rows.length && units.rows[0].v.pct !== null) {
      const order = units.rows.map(function (r, i) { return i; }).sort(function (a, b) { return units.rows[b].v.pct - units.rows[a].v.pct; });
      const rows = order.map(function (i) { return units.rows[i]; });
      const COLOR = { good: "#10b981", warn: "#f59e0b", bad: "#ef4444" };
      setText("chart-title", "Capaian Target per Toko");
      setText("chart-sub", "% dari target, urut tertinggi · garis = 100%");
      wrap.style.height = Math.max(300, rows.length * 24 + 50) + "px";
      const max = Math.max(110, Math.ceil(Math.max.apply(null, rows.map(function (r) { return r.v.pct; })) / 10) * 10 + 10);
      const target100 = {
        id: "target100",
        afterDatasetsDraw: function (chart) {
          const x = chart.scales.x.getPixelForValue(100), a = chart.chartArea, ctx = chart.ctx;
          ctx.save(); ctx.strokeStyle = "#0f172a"; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.2;
          ctx.beginPath(); ctx.moveTo(x, a.top); ctx.lineTo(x, a.bottom); ctx.stroke();
          ctx.setLineDash([]); ctx.fillStyle = "#0f172a"; ctx.font = "600 11px 'Segoe UI', Arial, sans-serif"; ctx.textAlign = "center";
          ctx.fillText("Target 100%", x, a.top - 6); ctx.restore();
        }
      };
      createChart(canvas, {
        type: "bar",
        data: { labels: rows.map(function (r) { return r.name.slice(0, 30); }),
          datasets: [{ label: "Capaian", data: rows.map(function (r) { return Math.round(r.v.pct * 10) / 10; }), backgroundColor: rows.map(function (r) { return COLOR[r.v.tone] || "#2563eb"; }), borderRadius: 3, barThickness: 14 }] },
        plugins: [target100],
        options: {
          responsive: true, maintainAspectRatio: false, animation: false, indexAxis: "y",
          plugins: { legend: { display: false }, valueLabels: { format: function (v) { return v.toLocaleString("id-ID", { maximumFractionDigits: 1 }) + "%"; } },
            tooltip: { callbacks: { label: function (it) { const r = rows[it.dataIndex]; return r.v.main + " · " + it.parsed.x.toLocaleString("id-ID") + "% dari target"; } } } },
          scales: { x: { min: 0, max: max, grid: { color: "#eef2f7" }, ticks: { color: "#475569", font: { size: 11 }, callback: function (v) { return v + "%"; } } },
            y: { grid: { display: false }, ticks: { color: "#1e293b", font: { size: 11 }, autoSkip: false } } },
          layout: { padding: { right: 48, top: 18 } },
          onClick: function (_e, els) { if (els.length) drill(units.groups[order[els[0].index]], units.level); }
        }
      });
      return;
    }
    const labels = units.rows.map(function (r) { return r.name.replace(/^Region \d · /, "").slice(0, 28); });
    let datasets, title, sub, horizontal = units.rows.length > 7;
    if (units.level === "Produk") {
      title = "Produk Paling Laku"; sub = "";
      datasets = [{ label: "Unit", data: units.groups.map(function (g) { return g.units; }), backgroundColor: "#2563eb", borderRadius: 4 }];
      horizontal = true;
    } else if (KPI === "penjualan") {
      title = "Aktual vs Target per " + units.level; sub = "Juta Rp";
      datasets = [{ label: "Aktual Penjualan", data: units.rows.map(function (r) { return Math.round(r.m.actual / 1e6); }), backgroundColor: "#2563eb", borderRadius: 3, order: 1, grouped: false, barPercentage: .45 },
        { label: "Target", data: units.rows.map(function (r) { return Math.round(r.m.target / 1e6); }), backgroundColor: "#dbe3ee", borderRadius: 3, order: 2, grouped: false, barPercentage: .7, valueLabel: false }];
    } else if (KPI === "effective-call") {
      title = "Terlaksana vs Terjadwal per " + units.level; sub = "Kunjungan";
      datasets = [{ label: "Terlaksana", data: units.rows.map(function (r) { return r.m.visitsDone; }), backgroundColor: "#2563eb", borderRadius: 3, order: 1, grouped: false, barPercentage: .45 },
        { label: "Terjadwal", data: units.rows.map(function (r) { return r.m.visitsPlan; }), backgroundColor: "#dbe3ee", borderRadius: 3, order: 2, grouped: false, barPercentage: .7, valueLabel: false }];
    } else if (KPI === "noo" || KPI === "nop") {
      const K = KPI === "noo" ? "noo" : "nop";
      title = K.toUpperCase() + " Aktual vs Target per " + units.level; sub = "Outlet";
      datasets = [{ label: "Aktual", data: units.rows.map(function (r) { return r.m[K + "Actual"]; }), backgroundColor: "#2563eb", borderRadius: 3, order: 1, grouped: false, barPercentage: .45 },
        { label: "Target", data: units.rows.map(function (r) { return r.m[K + "Target"]; }), backgroundColor: "#dbe3ee", borderRadius: 3, order: 2, grouped: false, barPercentage: .7, valueLabel: false }];
    } else if (KPI === "roa") {
      title = "ROA vs RO Tidak ROA per " + units.level; sub = "";
      datasets = [{ label: "ROA", data: units.rows.map(function (r) { return r.m.active; }), backgroundColor: "#10b981", stack: "s" },
        { label: "RO tidak ROA", data: units.rows.map(function (r) { return r.m.inactive; }), backgroundColor: "#ef4444", stack: "s" }];
    } else {
      title = "Unit Order per " + units.level; sub = filter.state.item === "all" ? "" : short(PNAME[filter.state.item]);
      datasets = [{ label: "Unit", data: units.rows.map(function (r) { return parseInt(r.v.main.replace(/\D/g, "")); }), backgroundColor: "#2563eb", borderRadius: 4 }];
    }
    setText("chart-title", title);
    setText("chart-sub", sub);
    const valueAxis = { beginAtZero: true, stacked: KPI === "roa", grid: { color: "#eef2f7" }, ticks: { color: "#475569", font: { size: 11 } } };
    if (KPI === "penjualan" && units.level !== "Produk") valueAxis.ticks.callback = function (v) { return "Rp " + Number(v).toLocaleString("id-ID") + " jt"; };
    const catAxis = { stacked: KPI === "roa", grid: { display: false }, ticks: { color: "#1e293b", font: { size: 11 } } };
    createChart(canvas, {
      type: "bar",
      data: { labels: labels, datasets: datasets },
      options: {
        responsive: true, maintainAspectRatio: false, animation: false, indexAxis: horizontal ? "y" : "x",
        plugins: { legend: { position: "top", align: "end", labels: { boxWidth: 10, color: "#334155", font: { size: 12 } } } },
        scales: horizontal ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis },
        layout: horizontal ? { padding: { right: 44 } } : { padding: { top: 18 } },
        onClick: function (_e, els) { if (els.length) drill(units.groups[els[0].index], units.level); }
      }
    });
  }

  function productRanking(m) {
    const items = itemGroups(m);
    const max = items.length ? items[0].units : 1;
    return '<ul class="rank-list">' + items.map(function (it, i) {
      return '<li><span class="rank-name"><b>#' + (i + 1) + "</b> " + AF.esc(it.name) + '</span><span class="rank-bar"><i style="width:' + (max ? it.units / max * 100 : 0) + '%"></i></span><span class="rank-val">' + AF.num(it.units) + " unit</span></li>";
    }).join("") + "</ul>";
  }

  function outletDetail(o, factor) {
    const m = AF.metrics([o], factor);
    const sales = AF.SALES[o.sales];
    return '<dl class="definition-list">' +
      "<div><dt>Toko</dt><dd>" + AF.esc(o.name) + " (" + o.id + ")</dd></div>" +
      "<div><dt>Wilayah / Area</dt><dd>" + AF.esc(AF.REGION[o.region].short) + " · " + AF.esc(AF.AREA[o.area].name) + "</dd></div>" +
      "<div><dt>Sales</dt><dd>" + AF.esc(sales.name) + " (" + sales.id + ")</dd></div>" +
      "<div><dt>ASM / RSM</dt><dd>" + AF.esc(AF.AREA[o.area].asm) + " / " + AF.esc(AF.REGION[o.region].rsm) + "</dd></div>" +
      "<div><dt>Status</dt><dd>" + (o.status === "Active" ? '<span class="badge">ROA</span>' : o.status === "At Risk" ? '<span class="badge warning">ROA · belum dikunjungi &gt; 14 hari</span>' : '<span class="badge danger">RO tidak ROA</span>') + "</dd></div>" +
      (o.slow ? "<div><dt>Risiko kedaluwarsa</dt><dd>" + AF.num(o.slow) + " unit produk slow moving</dd></div>" : "") +
      "<div><dt>NOO / NOP</dt><dd>" + (o.noo ? '<span class="badge">NOO</span> ' : "") + (o.nop ? '<span class="badge blue">NOP: ' + AF.esc(short(PNAME[o.nop])) + "</span>" : "") + (!o.noo && !o.nop ? "-" : "") + "</dd></div>" +
      "<div><dt>Aktual / Target</dt><dd>" + AF.rupiah(m.actual) + " / " + AF.rupiah(m.target) + " (" + AF.pct(m.salesPct) + ")</dd></div>" +
      "<div><dt>Kunjungan</dt><dd>" + m.visitsDone + " / " + m.visitsPlan + " terlaksana</dd></div>" +
      "<div><dt>Koordinat</dt><dd>" + o.lat + ", " + o.lng + "</dd></div></dl>" +
      '<span class="popup-label">Produk di-order</span>' + productRanking(m);
  }

  function renderSide(state, m, outlets, factor) {
    let title, sub, html;
    if (state.outlet !== "all" && KPI !== "ro-item") {
      title = "Detail Toko"; sub = "Toko yang dipilih.";
      html = outletDetail(AF.OUTLET[state.outlet], factor);
    } else if (KPI === "penjualan" || KPI === "ro-item") {
      title = "Produk Paling Laku"; sub = "Unit terjual di cakupan ini.";
      html = productRanking(m);
    } else if (KPI === "effective-call") {
      title = "Sales dengan EC Terendah"; sub = "5 sales yang paling banyak melewatkan kunjungan.";
      const per = {};
      for (const o of outlets) {
        const s = per[o.sales] || (per[o.sales] = { plan: 0, done: 0 });
        s.plan += o.visits_plan * factor; s.done += o.visits_done * factor;
      }
      const list = Object.keys(per).map(function (id) { return { s: AF.SALES[id], p: per[id].plan ? per[id].done / per[id].plan * 100 : 0, plan: per[id].plan, done: per[id].done }; })
        .sort(function (a, b) { return a.p - b.p; }).slice(0, 5);
      html = '<ul class="stat-list">' + list.map(function (x) {
        return "<li><span>" + AF.esc(x.s.name) + '<span class="subtext">' + AF.esc(AF.AREA[x.s.area].name) + " · " + Math.round(x.done) + "/" + Math.round(x.plan) + ' kunjungan</span></span><span class="badge ' +
          { good: "", warn: "warning", bad: "danger" }[AF.tone(x.p / .95)] + '">' + AF.pct(x.p) + "</span></li>";
      }).join("") + "</ul>";
    } else if (KPI === "noo") {
      title = "Status RO"; sub = "";
      const atRisk = m.atRisk, healthy = m.active - m.atRisk;
      const nooActive = m.nooList.filter(function (o) { return o.status !== "Inactive"; }).length;
      html = '<ul class="stat-list"><li><span><i class="swatch" style="background:#10b981"></i>ROA, kunjungan rutin</span><strong>' + AF.num(healthy) + "</strong></li>" +
        '<li><span><i class="swatch" style="background:#f59e0b"></i>Belum dikunjungi &gt; 14 hari</span><strong>' + AF.num(atRisk) + "</strong></li>" +
        '<li><span><i class="swatch" style="background:#ef4444"></i>RO tidak ROA</span><strong>' + AF.num(m.inactive) + "</strong></li>" +
        "<li><span>ROA (ROA / RO)</span><strong>" + AF.pct(m.roaPct) + "</strong></li>" +
        "<li><span>NOO yang masih beli</span><strong>" + nooActive + " / " + m.nooActual + "</strong></li></ul>";
    } else if (KPI === "nop") {
      title = "Produk Baru yang Ditambahkan"; sub = "Varian yang paling sering jadi NOP.";
      const c = {};
      for (const o of m.nopList) if (o.nop) c[o.nop] = (c[o.nop] || 0) + 1;
      html = '<ul class="stat-list">' + Object.keys(c).sort(function (a, b) { return c[b] - c[a]; }).map(function (k) {
        return "<li><span>" + AF.esc(short(PNAME[k])) + "</span><strong>" + c[k] + " outlet</strong></li>";
      }).join("") + "</ul>";
    } else {
      title = "Peringatan"; sub = "";
      const c = {};
      for (const o of outlets) if (o.risk) c[o.risk] = (c[o.risk] || 0) + 1;
      const slow = outlets.filter(function (o) { return o.slow > 0; }).length;
      html = '<ul class="stat-list">' + Object.keys(c).sort(function (a, b) { return c[b] - c[a]; }).map(function (k) {
        return "<li><span>" + AF.esc(k) + "</span><strong>" + c[k] + "</strong></li>";
      }).join("") + "<li><span>Risiko kedaluwarsa (produk slow moving)</span><strong>" + slow + "</strong></li></ul>" +
        '<div class="card-link"><a class="detail-button" data-keep-filter data-base="early-warning.html" href="early-warning.html' + AF.stateQuery(state) + '">Peringatan Dini →</a></div>';
    }
    setText("side-title", title);
    setText("side-body", html);
  }

  function table(headers, rows, empty) {
    const t = document.getElementById("detail-table");
    t.setAttribute("data-filterable", "");
    t.querySelector("thead").innerHTML = "<tr>" + headers.map(function (h) { return '<th scope="col">' + h + "</th>"; }).join("") + "</tr>";
    t.querySelector("tbody").innerHTML = rows.join("") + '<tr class="filter-empty" hidden><td class="table-empty" colspan="' + headers.length + '">' + (empty || "Tidak ada data yang sesuai.") + "</td></tr>";
  }

  function badgeFor(t, text) {
    return '<span class="badge ' + { good: "", warn: "warning", bad: "danger", neutral: "neutral" }[t] + '">' + text + "</span>";
  }

  function renderTable(state, m, units, factor) {
    const lvl = units.level;
    // di level toko tabel per toko sudah ada di atas, tabel bawah tidak perlu
    document.getElementById("detail-table").closest(".card").hidden = lvl === "Toko" && KPI !== "noo" && KPI !== "nop";
    if (KPI === "noo" || KPI === "nop") {
      const list = KPI === "noo" ? m.nooList : m.nopList;
      setText("table-title", "Daftar " + KPI.toUpperCase() + " (" + list.length + " outlet)");
      table(["Toko", "Wilayah / Area", "Sales", KPI === "noo" ? "Produk Pertama" : "Produk Tambahan", "Status", "Aktual"], list.map(function (o) {
        const st = o.status === "Inactive" ? badgeFor("bad", "RO tidak ROA") : o.status === "At Risk" ? badgeFor("warn", "Belum dikunjungi") : badgeFor("good", "ROA");
        return "<tr><td><strong>" + AF.esc(o.name) + '</strong><span class="subtext mono">' + o.id + "</span></td><td>" + AF.esc(AF.REGION[o.region].name) + '<span class="subtext">' + AF.esc(AF.AREA[o.area].name) +
          "</span></td><td>" + AF.esc(AF.SALES[o.sales].name) + "</td><td>" + (KPI === "noo" ? AF.esc(Object.keys(o.units).filter(function (k) { return o.units[k] > 0; }).map(function (k) { return short(PNAME[k]); }).join(", ") || "-") : AF.esc(short(PNAME[o.nop] || "-"))) + "</td><td>" + st + '</td><td class="numeric">' + AF.rupiah(AF.outletActual(o) * factor) + "</td></tr>";
      }), "Belum ada " + KPI.toUpperCase() + " di periode ini.");
      return;
    }
    if (lvl === "Produk") {
      setText("table-title", "Produk di " + AF.AREA[state.area].name);
      table(["#", "Produk", "Unit", "Nilai", "Porsi"], units.rows.map(function (r) {
        return '<tr><td class="mono">' + r.rank + "</td><td><strong>" + AF.esc(r.name) + '</strong></td><td class="numeric mono">' + r.cells[0] + '</td><td class="numeric">' + r.cells[1] + '</td><td class="numeric mono">' + r.cells[2] + "</td></tr>";
      }));
      return;
    }
    setText("table-title", "Data per " + lvl);
    let headers, fn;
    if (KPI === "penjualan") {
      headers = [lvl, "Target", "Aktual Penjualan", "Selisih", "Capaian", "Outlet"];
      fn = function (r) { const g = r.m.actual - r.m.target; return [AF.rupiah(r.m.target), "<strong>" + AF.rupiah(r.m.actual) + "</strong>", (g >= 0 ? "+" : "−") + AF.rupiah(Math.abs(g)), badgeFor(r.v.tone, AF.pct(r.m.salesPct)), AF.num(r.m.outlets)]; };
    } else if (KPI === "effective-call") {
      headers = [lvl, "Terjadwal", "Terlaksana", "Tidak terlaksana", "Effective Call"];
      fn = function (r) { return [AF.num(r.m.visitsPlan), AF.num(r.m.visitsDone), AF.num(r.m.visitsPlan - r.m.visitsDone), badgeFor(r.v.tone, AF.pct(r.m.ecPct))]; };
    } else if (KPI === "roa") {
      headers = [lvl, "RO", "ROA", "Belum Dikunjungi", "RO Tidak ROA", "ROA %"];
      fn = function (r) {
        if (r.outlet) { const o = r.outlet; return ["1", o.status !== "Inactive" ? "1" : "0", o.status === "At Risk" ? "1" : "0", o.status === "Inactive" ? "1" : "0", o.status === "Inactive" ? badgeFor("bad", "RO tidak ROA") : badgeFor(o.status === "At Risk" ? "warn" : "good", o.status === "At Risk" ? "Belum dikunjungi" : "ROA")]; }
        return [AF.num(r.m.outlets), AF.num(r.m.active), AF.num(r.m.atRisk), AF.num(r.m.inactive), badgeFor(r.v.tone, AF.pct(r.m.roaPct))];
      };
    } else {
      headers = [lvl].concat(D.products.map(function (p) { return short(p.name); })).concat(["Total unit"]);
      fn = function (r) { const u = r.m.units; let t = 0; const c = D.products.map(function (p) { t += u[p.code]; return AF.num(u[p.code]); }); return c.concat(["<strong>" + AF.num(t) + "</strong>"]); };
    }
    table(headers, units.rows.map(function (r) {
      return "<tr><td><strong>" + AF.esc(r.name) + "</strong></td>" + fn(r).map(function (c) { return '<td class="numeric">' + c + "</td>"; }).join("") + "</tr>";
    }));
  }

  function render(state) {
    const info = AF.periodInfo(state);
    const outlets = AF.scopeOutlets(state, KPI === "ro-item");
    const m = AF.metrics(outlets, info.factor);
    INFO = info;
    const p = AF.prevMetrics(outlets, info, state.pulau + "|" + state.region + "|" + state.area + "|" + state.sales + "|" + state.outlet);
    crumbs(state);
    renderSummary(m, outlets, p);
    const units = renderUnits(state, info.factor);
    renderChart(units);
    renderSide(state, m, outlets, info.factor);
    renderTable(state, m, units, info.factor);
    if (document.getElementById("search").value) searchTables();
  }

  document.addEventListener("DOMContentLoaded", function () {
    filter = AF.renderFilterBar(document.getElementById("filter-bar"), { third: KPI === "ro-item" ? "item" : "outlet" }, render);
  });
})();
