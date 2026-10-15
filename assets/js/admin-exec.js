// Executive Dashboard Admin Pusat + halaman turunannya (Peta Outlet, Tren Penjualan, Kesehatan Outlet).
(function () {
  if (!window.AF) return;
  const AF = window.AF, D = AF.D;
  let filter;
  let trendGrain = "monthly";
  let trendType = "bar";
  let trendDrillActive = false;
  let regionChartType = "doughnut";
  let performerTab = "toko";
  let lastExecState = null;
  let lastOutlets = null;
  let lastInfo = null;
  let lastItems = null;

  function scopeKey(state) { return state.region + "|" + state.area + "|" + state.outlet; }
  function short(name) { return name.replace("Teh Dandang ", ""); }

  // ---------- Tentukan warna status KPI (hijau/kuning/merah) berdasarkan pct ----------
  function kpiStatusClass(pct) {
    if (pct >= 100) return "kpi-status-green";
    if (pct >= 85) return "kpi-status-yellow";
    return "kpi-status-red";
  }

  // ---------- Kartu KPI dengan naik/turun ----------
  function kpiCard(o) {
    const tone = AF.deltaTone(o.dl, o.invert);
    const tag = o.href ? "a" : "article";
    const link = o.href ? ' data-keep-filter data-base="' + o.href + '" href="' + o.href + AF.stateQuery(filter.state) + '"' : "";
    const bar = o.bar === undefined || o.bar === null ? "" :
      '<div class="kpi-bar' + (o.bar >= 100 ? " hit" : "") + '"><span style="width:' + Math.min(o.bar, 100) + '%"></span></div>';
    const statusCls = o.statusPct !== undefined ? " " + kpiStatusClass(o.statusPct) : "";
    return "<" + tag + ' class="card kpi' + (o.href ? " kpi-link" : "") + " trend-" + tone + statusCls + '"' + link + ">" +
      '<h2 class="kpi-label">' + o.label + '</h2><div class="kpi-value">' + o.value + "</div>" +
      '<div class="kpi-top">' + AF.deltaPill(o.dl, "Dibanding " + o.prevRange, o.invert) + '<span class="kpi-prev">vs periode lalu</span></div>' +
      bar + (o.sub ? '<span class="kpi-sub">' + o.sub + "</span>" : "") + "</" + tag + ">";
  }

  // ---------- Peta outlet (dipakai Executive dan halaman Peta Outlet) ----------
  const KINDS = [
    { key: "NOO", label: "NOO", color: "#10b981", radius: 8 },
    { key: "NOP", label: "NOP", color: "#8b5cf6", radius: 7 },
    { key: "Aktif", label: "Outlet aktif", color: "#E31E24", radius: 4 },
    { key: "Tidak aktif", label: "Tidak aktif", color: "#94a3b8", radius: 4 }
  ];
  const KIND = {};
  for (const k of KINDS) KIND[k.key] = k;

  function kindOf(o, nooSet, nopSet) {
    if (nooSet.has(o.id)) return "NOO";
    if (nopSet.has(o.id)) return "NOP";
    return o.status === "Inactive" ? "Tidak aktif" : "Aktif";
  }

  function outletHref(o) {
    const st = Object.assign({}, filter.state, { region: o.region, area: o.area, outlet: o.id, item: "all" });
    return "penjualan.html" + AF.stateQuery(st);
  }

  let map, layer;
  function drawMap(outlets, kindMap, show, onEmptyClick, maxZoom) {
    const el = document.getElementById("sales-map");
    if (typeof L === "undefined") {
      el.innerHTML = '<p class="map-fallback">Peta tidak dapat dimuat (perlu koneksi internet).</p>';
      return;
    }
    if (!map) {
      el.innerHTML = "";
      map = L.map(el, { scrollWheelZoom: !onEmptyClick, preferCanvas: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap" }).addTo(map);
      if (onEmptyClick) map.on("click", onEmptyClick);
      window.salesMap = map;
    }
    if (layer) layer.remove();
    layer = L.layerGroup().addTo(map);
    const pts = [];
    const order = { "Tidak aktif": 0, "Aktif": 1, "NOP": 2, "NOO": 3 };
    const sorted = outlets.filter(function (o) { return show[kindMap[o.id]]; })
      .sort(function (a, b) { return order[kindMap[a.id]] - order[kindMap[b.id]]; });
    for (const o of sorted) {
      const k = KIND[kindMap[o.id]];
      const mk = L.circleMarker([o.lat, o.lng], { radius: k.radius, color: "#fff", weight: 1.5, fillColor: k.color, fillOpacity: .9, bubblingMouseEvents: false });
      // Semua titik NOO/NOP wajib punya label permanen
      const isSpecial = kindMap[o.id] === "NOO" || kindMap[o.id] === "NOP";
      if (isSpecial) {
        mk.bindTooltip(kindMap[o.id], { permanent: true, direction: "top", className: "map-label map-label-" + kindMap[o.id].toLowerCase(), offset: [0, -k.radius - 2] });
      }
      mk.bindPopup("<strong>" + AF.esc(o.name) + "</strong><br/>" + k.label + " · " + AF.esc(AF.AREA[o.area].name) + (isSpecial ? "<br/><span class='badge'>" + kindMap[o.id] + "</span>" : ""), { maxWidth: 220 });
      mk.on("click", function () { location.href = outletHref(o); });
      mk.addTo(layer);
      pts.push([o.lat, o.lng]);
    }
    if (pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [24, 24], maxZoom: maxZoom || 13 });
  }

  function kindSets(m) {
    return { noo: new Set(m.nooList.map(function (o) { return o.id; })), nop: new Set(m.nopList.map(function (o) { return o.id; })) };
  }

  // ================================================================ EXECUTIVE
  function execRender(state) {
    const info = AF.periodInfo(state);
    const outlets = AF.scopeOutlets(state);
    const m = AF.metrics(outlets, info.factor);
    const p = AF.prevMetrics(outlets, info, scopeKey(state));
    document.getElementById("scope-label").textContent = info.range;

    const items = D.products.map(function (x) { return { p: x, u: m.units[x.code], pu: p.units[x.code] }; }).sort(function (a, b) { return b.u - a.u; });
    const pr = info.prevRange;

    // Hitung RO outlet (outlet yang repeat order di periode ini)
    const roOutletActual = Math.round(m.active * 0.72);    // 72% dari outlet aktif
    const roOutletTarget = Math.round(m.outlets * 0.75);   // target 75%
    const roOutletPct = roOutletTarget ? roOutletActual / roOutletTarget * 100 : 0;
    const prevRoOutletActual = Math.round(p.active * 0.70);

    // Hitung RO Item (rata-rata SKU per outlet yang order)
    const roItemActual = items.filter(function (x) { return x.u > 0; }).length;
    const roItemTarget = D.products.length;
    const roItemPct = roItemTarget ? roItemActual / roItemTarget * 100 : 0;
    const prevRoItemActual = Math.max(1, roItemActual - 1);

    // Outlet aktif detail untuk card NOO
    const nooSub = "<b>" + AF.pct(m.nooPct) + "</b> dari target · Outlet aktif: <b>" + AF.num(m.active) + "</b>";

    document.getElementById("exec-kpis").innerHTML = [
      // 1. Aktual Penjualan vs Target — dengan warna status
      kpiCard({ href: "penjualan.html", label: "Aktual Penjualan", value: AF.rupiah(m.actual),
        dl: AF.delta(m.actual, p.actual), prevRange: pr,
        bar: m.salesPct, statusPct: m.salesPct,
        sub: "<b>" + AF.pct(m.salesPct) + "</b> dari target " + AF.rupiah(m.target) }),
      // 2. Effective Call
      kpiCard({ href: "effective-call.html", label: "Effective Call", value: AF.pct(m.ecPct),
        dl: AF.delta(m.ecPct, p.ecPct, true), prevRange: pr,
        bar: m.ecPct, statusPct: m.ecPct,
        sub: AF.num(m.visitsDone) + " / " + AF.num(m.visitsPlan) + " kunjungan" }),
      // 3. NOO — dengan outlet aktif
      kpiCard({ href: "noo.html", label: "Outlet Baru (NOO)", value: AF.num(m.nooActual) + "<small> / " + AF.num(m.nooTarget) + "</small>",
        dl: AF.delta(m.nooActual, p.nooActual), prevRange: pr,
        bar: m.nooPct, statusPct: m.nooPct, sub: nooSub }),
      // 4. NOP — Produk Baru
      kpiCard({ href: "nop.html", label: "Produk Baru (NOP)", value: AF.num(m.nopActual) + "<small> / " + AF.num(m.nopTarget) + "</small>",
        dl: AF.delta(m.nopActual, p.nopActual), prevRange: pr,
        bar: m.nopPct, statusPct: m.nopPct,
        sub: "<b>" + AF.pct(m.nopPct) + "</b> dari target" }),
      // 5. Item Repeat Order (RO Item)
      kpiCard({ href: "ro-item.html", label: "Item Repeat Order", value: AF.num(roItemActual) + "<small> SKU</small>",
        dl: AF.delta(roItemActual, prevRoItemActual), prevRange: pr,
        bar: roItemPct, statusPct: roItemPct,
        sub: "<b>" + AF.pct(roItemPct) + "</b> SKU aktif terjual" }),
      // 6. Outlet Repeat Order (RO Outlet)
      kpiCard({ href: "roa.html", label: "Outlet Repeat Order", value: AF.num(roOutletActual) + "<small> / " + AF.num(roOutletTarget) + "</small>",
        dl: AF.delta(roOutletActual, prevRoOutletActual), prevRange: pr,
        bar: roOutletPct, statusPct: roOutletPct,
        sub: "<b>" + AF.pct(roOutletPct) + "</b> dari target" })
    ].join("");

    // Peta
    const sets = kindSets(m);
    const kindMap = {}, counts = { "NOO": 0, "NOP": 0, "Aktif": 0, "Tidak aktif": 0 };
    for (const o of outlets) { const k = kindOf(o, sets.noo, sets.nop); kindMap[o.id] = k; counts[k]++; }
    document.getElementById("map-legend").innerHTML = KINDS.map(function (k) {
      return '<span><i style="background:' + k.color + '"></i>' + k.label + " <b>" + AF.num(counts[k.key]) + "</b></span>";
    }).join("");
    const card = document.getElementById("sales-map").closest(".card");
    drawMap(outlets, kindMap, { "NOO": 1, "NOP": 1, "Aktif": 1, "Tidak aktif": 1 }, function () { location.href = card.dataset.href; });

    lastExecState = state;
    lastOutlets = outlets;
    lastInfo = info;
    lastItems = items;

    // 1. Tren Penjualan dengan granularitas harian/mingguan/bulanan & tipe bar/line
    renderTrendChart(state);

    // 2. Kontribusi Penjualan per Wilayah (Pie, Donut, Bar + interaktif + Tertinggi/Terendah/Rata-rata)
    renderRegionContrib(state, outlets, info);

    // 3. Top & Bottom Performer (Tabs Toko, Produk, Salesman)
    renderPerformers(state, outlets, info, items);

    // Produk paling laku
    const qi = AF.stateQuery(state, { item: "{i}" }).replace("%7Bi%7D", "{i}");
    refreshAdminChart(document.getElementById("product-chart"), {
      type: "bar", axis: "y", clickHref: "ro-item.html" + qi, clickValues: items.map(function (x) { return x.p.code; }),
      labels: items.map(function (x) { return short(x.p.name); }),
      datasets: [{ label: "Unit terjual", data: items.map(function (x) { return x.u; }), backgroundColor: ["#570B10", "#A9141B", "#C91820", "#E31E24", "#FFDADA"], borderRadius: 4 }]
    });

    // Kesehatan outlet
    const healthy = m.active - m.atRisk;
    const qh = AF.stateQuery(state);
    refreshAdminChart(document.getElementById("health-chart"), {
      type: "doughnut", labels: ["Sehat", "Berisiko", "Tidak aktif"], clickHref: "kesehatan-outlet.html" + qh + (qh ? "&" : "?") + "status={i}",
      clickValues: ["all", "At Risk", "Inactive"],
      datasets: [{ data: [healthy, m.atRisk, m.inactive], backgroundColor: ["#10b981", "#f59e0b", "#ef4444"], borderWidth: 0 }]
    });
    document.getElementById("health-center").innerHTML = "<strong>" + AF.num(m.outlets) + "</strong><span>outlet</span>";
    const pHealthy = p.active - p.atRisk;
    const row = function (color, label, v, pv, invert) {
      return '<li><span><i class="swatch" style="background:' + color + '"></i>' + label + "</span><strong>" + AF.num(v) + " " + AF.deltaPill(AF.delta(v, pv), "Dibanding " + pr, invert) + "</strong></li>";
    };
    document.getElementById("health-list").innerHTML =
      row("#10b981", "Sehat", healthy, pHealthy) + row("#f59e0b", "Berisiko", m.atRisk, p.atRisk, true) + row("#ef4444", "Tidak aktif", m.inactive, p.inactive, true);
  }

  // ================================================================ GRAFIK TREN (Harian, Mingguan, Bulanan + Line/Bar + Drilldown)
  function renderTrendChart(state) {
    const canvas = document.getElementById("trend-chart");
    if (!canvas) return;

    let labels, actual, target, lastYear;
    if (trendGrain === "daily") {
      labels = ["30 Sep", "1 Okt", "2 Okt", "3 Okt", "4 Okt", "5 Okt", "6 Okt", "7 Okt", "8 Okt", "9 Okt", "10 Okt", "11 Okt", "12 Okt", "13 Okt"];
      actual = [88, 95, 104, 91, 112, 118, 102, 87, 105, 120, 126, 110, 98, 114]; // Juta Rp
      target = [95, 95, 100, 100, 100, 100, 100, 100, 105, 105, 105, 105, 105, 105];
      lastYear = [78, 82, 86, 79, 93, 96, 84, 76, 89, 97, 101, 92, 85, 94];
    } else if (trendGrain === "weekly") {
      labels = ["Mgg 33", "Mgg 34", "Mgg 35", "Mgg 36", "Mgg 37", "Mgg 38", "Mgg 39", "Mgg 40", "Mgg 41", "Mgg 42"];
      actual = [0.62, 0.65, 0.69, 0.64, 0.71, 0.73, 0.70, 0.74, 0.72, 0.69]; // Miliar Rp
      target = [0.63, 0.65, 0.67, 0.68, 0.70, 0.71, 0.72, 0.73, 0.73, 0.74];
      lastYear = [0.55, 0.57, 0.60, 0.58, 0.62, 0.63, 0.61, 0.64, 0.65, 0.62];
    } else {
      // Bulanan (default)
      const t = D.trend;
      labels = t.labels;
      actual = t.actual;
      target = t.target;
      lastYear = t.lastYear;
    }

    const datasets = trendType === "line" ? [
      { type: "line", label: "Aktual Penjualan", data: actual, borderColor: "#E31E24", backgroundColor: "rgba(227, 30, 36, 0.12)", fill: true, borderWidth: 3, pointRadius: 4, pointBackgroundColor: "#E31E24", tension: .3, order: 1 },
      { type: "line", label: "Target", data: target, borderColor: "#f59e0b", backgroundColor: "#fff", pointBorderColor: "#f59e0b", pointBorderWidth: 2, pointRadius: 4, tension: .3, order: 2 },
      { type: "line", label: "Tahun Lalu", data: lastYear, borderColor: "#94a3b8", borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0, tension: .3, order: 3 }
    ] : [
      { type: "bar", label: "Aktual Penjualan", data: actual, backgroundColor: "#E31E24", borderRadius: 6, maxBarThickness: 44, order: 2 },
      { type: "line", label: "Target", data: target, borderColor: "#f59e0b", backgroundColor: "#fff", pointBorderColor: "#f59e0b", pointBorderWidth: 2, pointRadius: 4, tension: .3, order: 1 },
      { type: "line", label: "Tahun Lalu", data: lastYear, borderColor: "#94a3b8", borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0, tension: .3, order: 1 }
    ];

    refreshAdminChart(canvas, {
      type: trendType,
      legend: "top",
      labels: labels,
      datasets: datasets
    });

    setTimeout(function () {
      if (canvas && canvas._chart) {
        canvas._chart.options.onClick = function (_e, elements) {
          if (elements.length) {
            const idx = elements[0].index;
            openExecDrilldown(trendGrain === "monthly" ? idx : 9);
            const drillSec = document.getElementById("exec-drilldown-section");
            if (drillSec) drillSec.scrollIntoView({ behavior: "smooth" });
          }
        };
        canvas._chart.update("none");
      }
    }, 100);

    // Cek URL param ?drillbulan= jika ada
    const qp = new URLSearchParams(location.search);
    const dBulan = qp.get("drillbulan");
    if (dBulan !== null) openExecDrilldown(Number(dBulan));
  }

  // ================================================================ KONTRIBUSI PENJUALAN PER WILAYAH
  function renderRegionContrib(state, outlets, info) {
    const regSales = {};
    for (const r of D.regions) regSales[r.code] = { code: r.code, name: r.name, short: r.short, actual: 0, target: 0 };
    for (const o of outlets) {
      if (regSales[o.region]) {
        regSales[o.region].actual += AF.outletActual(o) * info.factor;
        regSales[o.region].target += (o.target || 0) * info.factor;
      }
    }
    const regList = D.regions.map(function (r) { return regSales[r.code]; });
    const sorted = regList.slice().sort(function (a, b) { return b.actual - a.actual; });
    const highest = sorted[0];
    const lowest = sorted[sorted.length - 1];
    const totalSales = regList.reduce(function (s, r) { return s + r.actual; }, 0);
    const avgSales = totalSales / (regList.length || 1);

    const hiVal = document.getElementById("region-highest-val");
    const hiName = document.getElementById("region-highest-name");
    const loVal = document.getElementById("region-lowest-val");
    const loName = document.getElementById("region-lowest-name");
    const avgVal = document.getElementById("region-avg-val");
    const avgSub = document.getElementById("region-avg-sub");

    if (hiVal) hiVal.textContent = AF.rupiah(highest.actual);
    if (hiName) hiName.textContent = highest.name;
    if (loVal) loVal.textContent = AF.rupiah(lowest.actual);
    if (loName) loName.textContent = lowest.name;
    if (avgVal) avgVal.textContent = AF.rupiah(avgSales);
    if (avgSub) avgSub.textContent = "Total 5 Region: " + AF.rupiah(totalSales);

    const regColors = ["#570B10", "#A9141B", "#C91820", "#E31E24", "#FFDADA"];
    const labels = regList.map(function (r) { return r.short; });
    const dataVals = regList.map(function (r) { return Math.round(r.actual / 1e6); }); // Juta Rp

    const canvas = document.getElementById("region-contrib-chart");
    if (!canvas) return;

    if (regionChartType === "bar") {
      refreshAdminChart(canvas, {
        type: "bar", axis: "y", labels: labels,
        datasets: [{ label: "Penjualan (Juta Rp)", data: dataVals, backgroundColor: regColors, borderRadius: 4 }]
      });
    } else {
      refreshAdminChart(canvas, {
        type: regionChartType, // "doughnut" or "pie"
        legend: "bottom",
        labels: labels,
        datasets: [{ data: dataVals, backgroundColor: regColors, borderWidth: 2, borderColor: "#fff" }]
      });
    }

    // Interaktif: Klik segmen wilayah untuk filter wilayah tersebut
    setTimeout(function () {
      if (canvas && canvas._chart) {
        canvas._chart.options.onClick = function (_e, elements) {
          if (elements.length && filter) {
            const idx = elements[0].index;
            const clicked = regList[idx];
            if (clicked) {
              filter.set({ region: clicked.code, area: "all", outlet: "all" });
            }
          }
        };
        canvas._chart.update("none");
      }
    }, 100);
  }

  // ================================================================ TOP & BOTTOM PERFORMER
  function renderPerformers(state, outlets, info, items) {
    const topListEl = document.getElementById("top-performer-list");
    const botListEl = document.getElementById("bottom-performer-list");
    const topTitle = document.getElementById("top-title");
    const botTitle = document.getElementById("bottom-title");
    if (!topListEl || !botListEl) return;

    let topData = [], botData = [];

    if (performerTab === "produk") {
      if (topTitle) topTitle.textContent = "Top 5 Produk Terlaris";
      if (botTitle) botTitle.textContent = "Bottom Produk Terendah";
      const sorted = items.slice().sort(function (a, b) { return (b.u * b.p.price) - (a.u * a.p.price); });
      topData = sorted.slice(0, 5).map(function (x, i) {
        return {
          rank: i + 1,
          name: short(x.p.name),
          sub: AF.num(x.u) + " unit terjual · Rp " + (x.p.price || 0).toLocaleString("id-ID") + "/unit",
          val: AF.rupiah(x.u * x.p.price),
          subVal: AF.num(x.u) + " unit"
        };
      });
      botData = sorted.slice(-5).reverse().map(function (x, i) {
        return {
          rank: i + 1,
          name: short(x.p.name),
          sub: AF.num(x.u) + " unit terjual",
          val: AF.rupiah(x.u * x.p.price),
          subVal: AF.num(x.u) + " unit"
        };
      });
    } else if (performerTab === "salesman") {
      if (topTitle) topTitle.textContent = "Top 5 Salesman";
      if (botTitle) botTitle.textContent = "Bottom 5 Salesman";
      const salesMap = {};
      for (const s of D.sales) salesMap[s.id] = { id: s.id, name: s.name, region: s.region, area: s.area, actual: 0, count: 0 };
      for (const o of outlets) {
        if (salesMap[o.sales]) {
          salesMap[o.sales].actual += AF.outletActual(o) * info.factor;
          salesMap[o.sales].count++;
        }
      }
      const sorted = Object.values(salesMap).sort(function (a, b) { return b.actual - a.actual; });
      topData = sorted.slice(0, 5).map(function (x, i) {
        return {
          rank: i + 1,
          name: x.name,
          sub: (AF.REGION[x.region] ? AF.REGION[x.region].short : x.region) + " · " + (AF.AREA[x.area] ? AF.AREA[x.area].name : x.area) + " (" + x.count + " toko)",
          val: AF.rupiah(x.actual),
          subVal: x.count + " toko aktif"
        };
      });
      botData = sorted.slice(-5).reverse().map(function (x, i) {
        return {
          rank: i + 1,
          name: x.name,
          sub: (AF.REGION[x.region] ? AF.REGION[x.region].short : x.region) + " · " + (AF.AREA[x.area] ? AF.AREA[x.area].name : x.area) + " (" + x.count + " toko)",
          val: AF.rupiah(x.actual),
          subVal: x.count + " toko aktif"
        };
      });
    } else {
      // Toko (default)
      if (topTitle) topTitle.textContent = "Top 5 Toko";
      if (botTitle) botTitle.textContent = "Bottom 5 Toko";
      const sorted = outlets.slice().sort(function (a, b) {
        return (AF.outletActual(b) * info.factor) - (AF.outletActual(a) * info.factor);
      });
      topData = sorted.slice(0, 5).map(function (o, i) {
        return {
          rank: i + 1,
          name: o.name,
          sub: (AF.REGION[o.region] ? AF.REGION[o.region].short : o.region) + " · " + (AF.AREA[o.area] ? AF.AREA[o.area].name : o.area),
          val: AF.rupiah(AF.outletActual(o) * info.factor),
          subVal: "Target: " + AF.rupiah((o.target || 0) * info.factor)
        };
      });
      botData = sorted.slice(-5).reverse().map(function (o, i) {
        return {
          rank: i + 1,
          name: o.name,
          sub: (AF.REGION[o.region] ? AF.REGION[o.region].short : o.region) + " · " + (AF.AREA[o.area] ? AF.AREA[o.area].name : o.area),
          val: AF.rupiah(AF.outletActual(o) * info.factor),
          subVal: "Target: " + AF.rupiah((o.target || 0) * info.factor)
        };
      });
    }

    function renderList(list, isTop) {
      if (!list.length) return '<li class="table-empty">Tidak ada data</li>';
      return list.map(function (item) {
        return '<li class="performer-item">' +
          '<div class="performer-info">' +
          '<span class="performer-rank ' + (isTop && item.rank === 1 ? "rank-1" : "") + '">#' + item.rank + '</span>' +
          '<div class="performer-meta"><strong class="performer-name">' + AF.esc(item.name) + '</strong><span class="performer-sub">' + AF.esc(item.sub) + '</span></div>' +
          '</div>' +
          '<div class="performer-val"><strong>' + item.val + '</strong><span>' + item.subVal + '</span></div>' +
          '</li>';
      }).join("");
    }

    topListEl.innerHTML = renderList(topData, true);
    botListEl.innerHTML = renderList(botData, false);
  }

  // ================================================================ EVENT LISTENERS CONTROLS
  function setupExecControls() {
    // 1. Granularitas Periode Tren (Harian, Mingguan, Bulanan)
    const grainBtns = document.querySelectorAll("#trend-grain-toggles .btn-toggle");
    grainBtns.forEach(function (btn) {
      btn.onclick = function () {
        grainBtns.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        trendGrain = btn.dataset.grain;
        if (lastExecState) renderTrendChart(lastExecState);
      };
    });

    // 2. Tipe Grafik Tren (Bar, Line)
    const typeBtns = document.querySelectorAll("#trend-type-toggles .btn-toggle");
    typeBtns.forEach(function (btn) {
      btn.onclick = function () {
        typeBtns.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        trendType = btn.dataset.type;
        if (lastExecState) renderTrendChart(lastExecState);
      };
    });

    // 3. Switch Drill Down Tren
    const drillBtn = document.getElementById("trend-drill-btn");
    if (drillBtn) {
      drillBtn.onclick = function () {
        trendDrillActive = !trendDrillActive;
        drillBtn.classList.toggle("active", trendDrillActive);
        drillBtn.setAttribute("aria-pressed", trendDrillActive);
        const span = drillBtn.querySelector("span");
        if (span) span.textContent = trendDrillActive ? "Drill Down: Aktif" : "Drill Down";
        const drillSec = document.getElementById("exec-drilldown-section");
        if (trendDrillActive && drillSec) {
          openExecDrilldown(9);
          drillSec.scrollIntoView({ behavior: "smooth" });
        }
      };
    }

    // 4. Tipe Grafik Kontribusi Wilayah (Donut, Pie, Bar)
    const regTypeBtns = document.querySelectorAll("#region-type-toggles .btn-toggle");
    regTypeBtns.forEach(function (btn) {
      btn.onclick = function () {
        regTypeBtns.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        regionChartType = btn.dataset.type;
        if (lastExecState && lastOutlets && lastInfo) {
          renderRegionContrib(lastExecState, lastOutlets, lastInfo);
        }
      };
    });

    // 5. Tabs Top & Bottom Performer (Toko, Produk, Salesman)
    const perfBtns = document.querySelectorAll("#performer-tab-toggles .btn-toggle");
    perfBtns.forEach(function (btn) {
      btn.onclick = function () {
        perfBtns.forEach(function (b) { b.classList.remove("active"); });
        btn.classList.add("active");
        performerTab = btn.dataset.tab;
        if (lastExecState && lastOutlets && lastInfo && lastItems) {
          renderPerformers(lastExecState, lastOutlets, lastInfo, lastItems);
        }
      };
    });
  }

  // ================================================================ INLINE DRILLDOWN (di Executive Dashboard)
  let execDrillState = null;

  function openExecDrilldown(bulan) {
    const month = Math.min(9, Math.max(0, Number(bulan) || 0));
    if (typeof buildAFTree !== "function") {
      document.getElementById("exec-drilldown-placeholder").hidden = false;
      document.getElementById("exec-drilldown-content").hidden = true;
      return;
    }
    execDrillState = [buildAFTree(month)];
    renderExecDrill();
  }

  function execDrillDown(label) {
    if (!execDrillState) return;
    const node = execDrillState[execDrillState.length - 1];
    if (node.isLowest || (node.depth || 1) >= 7) return;
    let child = node.children && node.children[label];
    if (!child) child = { title: label, levelName: "Detail", depth: (node.depth || 1) + 1, isLowest: true, items: node.items.slice(0, 5) };
    execDrillState.push(child);
    renderExecDrill();
  }

  function execDrillBack() {
    if (execDrillState && execDrillState.length > 1) execDrillState.pop();
    renderExecDrill();
  }

  function execDrillReset() {
    if (execDrillState) execDrillState = execDrillState.slice(0, 1);
    renderExecDrill();
  }

  // Expose ke global (dipanggil dari HTML onclick)
  window.execDrillDown = execDrillDown;
  window.execDrillBack = execDrillBack;
  window.execDrillReset = execDrillReset;

  function renderExecDrill() {
    if (!execDrillState) return;
    const placeholder = document.getElementById("exec-drilldown-placeholder");
    const content = document.getElementById("exec-drilldown-content");
    if (!placeholder || !content) return;
    placeholder.hidden = true;
    content.hidden = false;

    const node = execDrillState[execDrillState.length - 1];
    const items = node.items || [];
    const lowest = !!node.isLowest || (node.depth || 1) >= 7;
    const depth = node.depth || execDrillState.length;

    const totalTarget = items.reduce(function (s, i) { return s + i.target; }, 0);
    const totalActual = items.reduce(function (s, i) { return s + i.actual; }, 0);
    const ach = totalTarget ? totalActual / totalTarget * 100 : 0;

    // Summary cards
    const sum = document.getElementById("exec-drill-summary");
    if (sum) {
      sum.innerHTML = [
        '<article class="card kpi"><h2 class="kpi-label">Level Saat Ini</h2><div class="kpi-value location">' + AF.esc(node.levelName || "–") + '</div><span class="subtext">' + AF.esc(node.title) + '</span></article>',
        '<article class="card kpi"><h2 class="kpi-label">Total Target</h2><div class="kpi-value location">' + formatRupiah(totalTarget) + '</div><span class="subtext">' + items.length + ' item</span></article>',
        '<article class="card kpi ' + (ach >= 100 ? "kpi-status-green" : ach >= 85 ? "kpi-status-yellow" : "kpi-status-red") + '"><h2 class="kpi-label">Aktual Penjualan</h2><div class="kpi-value location">' + formatRupiah(totalActual) + '</div><span class="subtext">Capaian ' + ach.toFixed(1) + '%</span></article>'
      ].join("");
    }

    // Depth badge + nav
    const depthEl = document.getElementById("exec-drill-depth");
    if (depthEl) depthEl.textContent = "Level " + depth + " dari 7";
    const backBtn = document.getElementById("exec-drill-back");
    const resetBtn = document.getElementById("exec-drill-reset");
    if (backBtn) backBtn.disabled = execDrillState.length <= 1;
    if (resetBtn) resetBtn.disabled = execDrillState.length <= 1;

    // Tabel
    const tbody = document.getElementById("exec-drill-rows");
    if (tbody) {
      tbody.innerHTML = items.map(function (i) {
        const gap = i.actual - i.target;
        const action = lowest ? '<span class="subtext">Level terbawah</span>' :
          '<button class="detail-button" onclick="execDrillDown(' + JSON.stringify(i.label) + ')">Drill</button>';
        return '<tr><td><strong>' + AF.esc(i.label) + '</strong></td>' +
          '<td class="numeric">' + formatRupiah(i.target) + '</td>' +
          '<td class="numeric">' + formatRupiah(i.actual) + '</td>' +
          '<td class="numeric mono ' + (gap >= 0 ? "up-text" : "down-text") + '">' + (gap >= 0 ? "+" : "−") + formatRupiah(Math.abs(gap)) + '</td>' +
          '<td class="numeric mono">' + i.achievement.toFixed(1) + '%</td>' +
          '<td>' + (i.statusEmoji === "🔴" ? '<span class="badge danger">Kritis</span>' : i.statusEmoji === "🟡" ? '<span class="badge warning">Waspada</span>' : '<span class="badge">Baik</span>') + '</td>' +
          '<td>' + action + '</td></tr>';
      }).join("") || '<tr><td class="table-empty" colspan="7">Tidak ada data.</td></tr>';
    }

    // Grafik drilldown inline
    const canvas = document.getElementById("exec-drill-chart");
    if (canvas && window.createChart) {
      const labels = items.map(function (i) { return i.label; });
      const colors = items.map(function (i) { return i.color || "#E31E24"; });
      const actual = items.map(function (i) { return i.actual / 1e6; });
      const target = items.map(function (i) { return i.target / 1e6; });
      createChart(canvas, {
        type: "bar",
        data: {
          labels: labels,
          datasets: [
            { label: "Aktual (Juta Rp)", data: actual, backgroundColor: colors, borderRadius: 4, order: 1, grouped: false, barPercentage: 0.42 },
            { label: "Target (Juta Rp)", data: target, backgroundColor: "#dbe3ee", borderColor: "#bac8da", borderWidth: 1, borderRadius: 4, order: 2, grouped: false, barPercentage: 0.65, valueLabel: false }
          ]
        },
        options: {
          responsive: true, maintainAspectRatio: false, animation: false,
          plugins: {
            legend: { position: "top" },
            valueLabels: { format: function (v) { return Math.round(v).toLocaleString("id-ID"); } }
          },
          scales: { y: { beginAtZero: true, ticks: { callback: function (v) { return "Rp " + v + " Jt"; } } } },
          layout: { padding: { top: 18 } },
          onClick: function (_e, elements) {
            if (elements.length && !lowest) execDrillDown(labels[elements[0].index]);
          }
        }
      });
    }
  }

  // ================================================================ PETA OUTLET
  const show = { "NOO": true, "NOP": true, "Aktif": true, "Tidak aktif": true };
  function mapPageRender(state) {
    const info = AF.periodInfo(state);
    const outlets = AF.scopeOutlets(state);
    const m = AF.metrics(outlets, info.factor);
    const sets = kindSets(m);
    const kindMap = {}, counts = { "NOO": 0, "NOP": 0, "Aktif": 0, "Tidak aktif": 0 };
    for (const o of outlets) { const k = kindOf(o, sets.noo, sets.nop); kindMap[o.id] = k; counts[k]++; }
    const tg = document.getElementById("map-toggles");
    tg.innerHTML = KINDS.map(function (k) {
      return '<label><input type="checkbox" data-kind="' + k.key + '"' + (show[k.key] ? " checked" : "") + '/><i style="background:' + k.color + '"></i>' + k.label + " <b>" + AF.num(counts[k.key]) + "</b></label>";
    }).join("");
    for (const c of tg.querySelectorAll("input")) c.onchange = function () { show[c.dataset.kind] = c.checked; drawMap(outlets, kindMap, show, null, 15); };
    drawMap(outlets, kindMap, show, null, 15);

    const g = AF.childGroups(state);
    document.getElementById("map-group-title").textContent = "Per " + g.level;
    const gt = document.getElementById("map-groups");
    gt.querySelector("thead").innerHTML = '<tr><th scope="col">' + g.level + '</th><th scope="col">Outlet</th><th scope="col">NOO</th><th scope="col">NOP</th><th scope="col">Tidak aktif</th></tr>';
    gt.querySelector("tbody").innerHTML = g.groups.map(function (x, i) {
      const c = { "NOO": 0, "NOP": 0, "Tidak aktif": 0 };
      for (const o of x.outlets) if (kindMap[o.id] && c[kindMap[o.id]] !== undefined) c[kindMap[o.id]]++;
      return '<tr data-i="' + i + '" class="row-link"><td><strong>' + AF.esc(x.name) + '</strong></td><td class="numeric mono">' + x.outlets.length + '</td><td class="numeric mono">' + c.NOO +
        '</td><td class="numeric mono">' + c.NOP + '</td><td class="numeric mono">' + c["Tidak aktif"] + "</td></tr>";
    }).join("");
    for (const tr of gt.querySelectorAll("tbody tr")) tr.onclick = function () {
      const x = g.groups[Number(tr.dataset.i)];
      if (g.key === "wilayah") filter.set({ region: x.id, area: "all", outlet: "all" });
      else if (g.key === "area") filter.set({ area: x.id, outlet: "all" });
      else location.href = outletHref(x.outlet);
    };

    const list = outlets.filter(function (o) { return kindMap[o.id] === "NOO" || kindMap[o.id] === "NOP"; });
    document.getElementById("map-list-title").textContent = "NOO & NOP (" + list.length + ")";
    document.querySelector("#map-list tbody").innerHTML = list.map(function (o) {
      const k = kindMap[o.id];
      return '<tr data-href="' + outletHref(o) + '"><td><strong>' + AF.esc(o.name) + '</strong></td><td><span class="badge ' + (k === "NOO" ? "" : "neutral") + '">' + k + "</span></td><td>" +
        AF.esc(AF.AREA[o.area].name) + '</td><td class="numeric">' + AF.rupiah(AF.outletActual(o) * info.factor) + "</td></tr>";
    }).join("") + '<tr class="filter-empty" hidden><td class="table-empty" colspan="4">Tidak ada data yang sesuai.</td></tr>';
    if (document.getElementById("search").value) searchTables();
  }

  // ================================================================ TREN PENJUALAN
  function trendPage() {
    const t = D.trend, n = t.actual.length;
    const sum = function (a) { return a.reduce(function (s, v) { return s + v; }, 0); };
    const ytd = sum(t.actual), ytdT = sum(t.target), ytdLY = sum(t.lastYear);
    let best = 0;
    t.actual.forEach(function (v, i) { if (v > t.actual[best]) best = i; });
    const mrd = function (v) { return "Rp " + v.toLocaleString("id-ID", { maximumFractionDigits: 2 }) + " M"; };
    document.getElementById("trend-kpis").innerHTML = [
      '<article class="card kpi trend-' + AF.deltaTone(AF.delta(ytd, ytdLY)) + '"><h2 class="kpi-label">Aktual Jan–' + t.labels[n - 1] + '</h2><div class="kpi-value">' + mrd(ytd) + '</div><div class="kpi-top">' + AF.deltaPill(AF.delta(ytd, ytdLY)) + '<span class="kpi-prev">vs tahun lalu</span></div></article>',
      '<article class="card kpi trend-' + (ytd >= ytdT ? "up" : "down") + '"><h2 class="kpi-label">Capaian Target</h2><div class="kpi-value">' + AF.pct(ytd / ytdT * 100) + '</div><span class="kpi-sub">Target ' + mrd(ytdT) + "</span></article>",
      '<article class="card kpi trend-' + AF.deltaTone(AF.delta(t.actual[n - 1], t.actual[n - 2])) + '"><h2 class="kpi-label">' + t.labels[n - 1] + " 2026</h2><div class=\"kpi-value\">" + mrd(t.actual[n - 1]) + '</div><div class="kpi-top">' + AF.deltaPill(AF.delta(t.actual[n - 1], t.actual[n - 2])) + '<span class="kpi-prev">vs ' + t.labels[n - 2] + "</span></div></article>",
      '<article class="card kpi trend-flat"><h2 class="kpi-label">Bulan Terbaik</h2><div class="kpi-value">' + t.labels[best] + '</div><span class="kpi-sub">' + mrd(t.actual[best]) + "</span></article>"
    ].join("");
    refreshAdminChart(document.getElementById("trend-big"), {
      type: "bar", legend: "top", clickHref: "drilldown.html?bulan={i}", labels: t.labels,
      datasets: [
        { type: "bar", label: "Aktual Penjualan", data: t.actual, backgroundColor: "#E31E24", borderRadius: 6, maxBarThickness: 56, order: 2 },
        { type: "line", label: "Target", data: t.target, borderColor: "#f59e0b", backgroundColor: "#fff", pointBorderColor: "#f59e0b", pointBorderWidth: 2, pointRadius: 4, tension: .3, order: 1 },
        { type: "line", label: "Tahun Lalu", data: t.lastYear, borderColor: "#94a3b8", borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0, tension: .3, order: 1 }
      ]
    });
    const arrow = function (d) { return '<span class="delta ' + AF.deltaTone(d) + '">' + d.text + "</span>"; };
    document.querySelector("#trend-table tbody").innerHTML = t.labels.map(function (l, i) {
      const cap = t.actual[i] / t.target[i] * 100;
      return '<tr data-href="drilldown.html?bulan=' + i + '"><td><strong>' + l + ' 2026</strong></td><td class="numeric"><strong>' + mrd(t.actual[i]) + '</strong></td><td class="numeric">' + mrd(t.target[i]) +
        '</td><td><span class="badge ' + (cap >= 100 ? "" : cap >= 90 ? "warning" : "danger") + '">' + AF.pct(cap) + '</span></td><td class="numeric">' + mrd(t.lastYear[i]) +
        "</td><td>" + arrow(AF.delta(t.actual[i], t.lastYear[i])) + "</td><td>" + (i ? arrow(AF.delta(t.actual[i], t.actual[i - 1])) : "–") + "</td></tr>";
    }).reverse().join("") + '<tr class="filter-empty" hidden><td class="table-empty" colspan="7">Tidak ada data yang sesuai.</td></tr>';
  }

  // ================================================================ KESEHATAN OUTLET
  let healthStatus = new URLSearchParams(location.search).get("status") || "all";
  function healthRender(state) {
    const info = AF.periodInfo(state);
    const outlets = AF.scopeOutlets(state);
    const m = AF.metrics(outlets, info.factor);
    const p = AF.prevMetrics(outlets, info, scopeKey(state));
    const healthy = m.active - m.atRisk, pHealthy = p.active - p.atRisk;
    const pr = info.prevRange;
    document.getElementById("health-kpis").innerHTML = [
      kpiCard({ label: "Total Outlet", value: AF.num(m.outlets), dl: { dir: "flat", text: "0,0%" }, prevRange: pr }),
      kpiCard({ label: "Sehat", value: AF.num(healthy), dl: AF.delta(healthy, pHealthy), prevRange: pr, sub: AF.pct(m.outlets ? healthy / m.outlets * 100 : 0) + " dari total" }),
      kpiCard({ label: "Berisiko", value: AF.num(m.atRisk), dl: AF.delta(m.atRisk, p.atRisk), invert: true, prevRange: pr, sub: "Order turun di bawah target" }),
      kpiCard({ label: "Tidak Aktif", value: AF.num(m.inactive), dl: AF.delta(m.inactive, p.inactive), invert: true, prevRange: pr, sub: "Tidak order di periode ini" })
    ].join("");
    refreshAdminChart(document.getElementById("health-big"), {
      type: "doughnut", legend: "bottom", labels: ["Sehat", "Berisiko", "Tidak aktif"],
      datasets: [{ data: [healthy, m.atRisk, m.inactive], backgroundColor: ["#10b981", "#f59e0b", "#ef4444"], borderWidth: 0 }]
    });
    document.getElementById("health-big-center").innerHTML = "<strong>" + AF.num(m.outlets) + "</strong><span>outlet</span>";
    const causes = {};
    for (const o of outlets) if (o.risk) causes[o.risk] = (causes[o.risk] || 0) + 1;
    const keys = Object.keys(causes).sort(function (a, b) { return causes[b] - causes[a]; });
    refreshAdminChart(document.getElementById("cause-chart"), {
      type: "bar", axis: "y", labels: keys,
      datasets: [{ label: "Outlet", data: keys.map(function (k) { return causes[k]; }), backgroundColor: "#f59e0b", borderRadius: 4 }]
    });
    healthTable(outlets, info);
  }

  function healthTable(outlets, info) {
    const list = outlets.filter(function (o) { return o.status !== "Active" && (healthStatus === "all" || o.status === healthStatus); });
    for (const b of document.querySelectorAll("[data-status]")) b.setAttribute("aria-pressed", b.dataset.status === healthStatus);
    document.getElementById("health-table-title").textContent = "Outlet Perlu Perhatian (" + list.length + ")";
    document.querySelector("#health-table tbody").innerHTML = list.map(function (o) {
      const st = o.status === "Inactive" ? '<span class="badge danger">Tidak aktif</span>' : '<span class="badge warning">Berisiko</span>';
      return '<tr data-href="' + outletHref(o) + '"><td><strong>' + AF.esc(o.name) + '</strong><span class="subtext mono">' + o.id + "</span></td><td>" + AF.esc(AF.REGION[o.region].short) +
        '<span class="subtext">' + AF.esc(AF.AREA[o.area].name) + "</span></td><td>" + AF.esc(AF.SALES[o.sales].name) + "</td><td>" + st + "</td><td>" + AF.esc(o.risk || "-") +
        '</td><td class="numeric">' + AF.rupiah(AF.outletActual(o) * info.factor) + "</td></tr>";
    }).join("") + '<tr class="filter-empty" hidden><td class="table-empty" colspan="6">Tidak ada outlet berisiko atau tidak aktif.</td></tr>';
    if (document.getElementById("search").value) searchTables();
  }

  document.addEventListener("DOMContentLoaded", function () {
    const bar = document.getElementById("filter-bar");
    if (document.getElementById("exec-kpis")) {
      setupExecControls();
      filter = AF.renderFilterBar(bar, {}, execRender);
    }
    else if (document.getElementById("map-page")) filter = AF.renderFilterBar(bar, {}, mapPageRender);
    else if (document.getElementById("health-page")) {
      filter = AF.renderFilterBar(bar, {}, healthRender);
      for (const b of document.querySelectorAll("[data-status]")) b.onclick = function () {
        healthStatus = b.dataset.status;
        healthRender(filter.state);
      };
    } else if (document.getElementById("trend-page")) {
      filter = { state: AF.readState() };
      trendPage();
    }
  });
})();
