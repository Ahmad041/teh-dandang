// Dashboard Utama + halaman turunannya (Peta Outlet, Tren Penjualan, Status Outlet, Peringatan Dini).
(function () {
  if (!window.AF) return;
  const AF = window.AF, D = AF.D;
  let filter;

  function scopeKey(state) { return state.pulau + "|" + state.region + "|" + state.area + "|" + state.sales + "|" + state.outlet; }
  function short(name) { return name.replace("Teh Dandang ", ""); }

  // ---------- Kartu KPI dengan naik/turun ----------
  function kpiCard(o) {
    const tone = AF.deltaTone(o.dl, o.invert);
    const tag = o.href ? "a" : "article";
    const link = o.href ? ' data-keep-filter data-base="' + o.href + '" href="' + o.href + AF.stateQuery(filter.state) + '"' : "";
    const bar = o.bar === undefined || o.bar === null ? "" :
      '<div class="kpi-bar' + (o.bar >= 100 ? " hit" : "") + '"><span style="width:' + Math.min(o.bar, 100) + '%"></span></div>';
    return "<" + tag + ' class="card kpi' + (o.href ? " kpi-link" : "") + " trend-" + tone + '"' + link + ">" +
      '<h2 class="kpi-label">' + o.label + '</h2><div class="kpi-value">' + o.value + "</div>" +
      '<div class="kpi-top">' + AF.deltaPill(o.dl, "Dibanding " + o.prevRange, o.invert) + "</div>" +
      bar + (o.sub ? '<span class="kpi-sub">' + o.sub + "</span>" : "") + "</" + tag + ">";
  }

  // ---------- Peta outlet (dipakai Executive dan halaman Peta Outlet) ----------
  const KINDS = [
    { key: "NOO", label: "NOO", color: "#10b981", radius: 7 },
    { key: "NOP", label: "NOP", color: "#8b5cf6", radius: 6 },
    { key: "Aktif", label: "ROA", color: "#ED1B24", radius: 4 },
    { key: "Tidak aktif", label: "RO tidak ROA", color: "#94a3b8", radius: 4 }
  ];
  const KIND = {};
  for (const k of KINDS) KIND[k.key] = k;

  function kindOf(o, nooSet, nopSet) {
    if (nooSet.has(o.id)) return "NOO";
    if (nopSet.has(o.id)) return "NOP";
    return o.status === "Inactive" ? "Tidak aktif" : "Aktif";
  }

  function outletHref(o) {
    const st = Object.assign({}, filter.state, { pulau: o.pulau, region: o.region, area: o.area, sales: o.sales, outlet: o.id, item: "all" });
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
      const mk = L.circleMarker([o.lat, o.lng], { radius: k.radius, color: "#fff", weight: 1, fillColor: k.color, fillOpacity: .92, bubblingMouseEvents: false });
      mk.bindTooltip("<strong>" + AF.esc(o.name) + "</strong><br/>" + k.label + " · " + AF.esc(AF.AREA[o.area].name), { direction: "top" });
      mk.on("click", function () { location.href = outletHref(o); });
      mk.addTo(layer);
      pts.push([o.lat, o.lng]);
    }
    if (pts.length) {
      // ukuran peta dihitung ulang dulu supaya titik-titik benar-benar di tengah
      const fit = function () { map.invalidateSize(); map.fitBounds(L.latLngBounds(pts), { padding: [24, 24], maxZoom: maxZoom || 13 }); };
      fit();
      setTimeout(fit, 250);
    }
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
    renderTeam(state, outlets, info);

    const items = D.products.map(function (x) { return { p: x, u: m.units[x.code], pu: p.units[x.code] }; }).sort(function (a, b) { return b.u - a.u; });
    const totalUnits = items.reduce(function (s, x) { return s + x.u; }, 0);
    const top = items[0];
    const pr = info.prevRange;
    document.getElementById("exec-kpis").innerHTML = [
      kpiCard({ href: "penjualan.html", label: "Volume Penjualan", value: AF.rupiah(m.actual), dl: AF.delta(m.actual, p.actual), prevRange: pr,
        bar: m.salesPct, sub: "<b>" + AF.pct(m.salesPct) + "</b> dari target " + AF.rupiah(m.target) }),
      kpiCard({ href: "effective-call.html", label: "Effective Call", value: AF.pct(m.ecPct), dl: AF.delta(m.ecPct, p.ecPct, true), prevRange: pr,
        bar: m.ecPct, sub: AF.num(m.visitsOrder) + " transaksi / " + AF.num(m.visitsDone) + " kunjungan · terlaksana " + AF.pct(m.visitPct) }),
      kpiCard({ href: "noo.html", label: "NOO", value: AF.num(m.nooActual) + "<small> / " + AF.num(m.nooTarget) + "</small>", dl: AF.delta(m.nooActual, p.nooActual), prevRange: pr,
        bar: m.nooPct, sub: "<b>" + AF.pct(m.nooPct) + "</b> dari target" }),
      kpiCard({ href: "nop.html", label: "NOP", value: AF.num(m.nopActual) + "<small> / " + AF.num(m.nopTarget) + "</small>", dl: AF.delta(m.nopActual, p.nopActual), prevRange: pr,
        bar: m.nopPct, sub: "<b>" + AF.pct(m.nopPct) + "</b> dari target" }),
      kpiCard({ href: "roa.html", label: "ROA", value: AF.pct(m.roaPct), dl: AF.delta(m.roaPct, p.roaPct, true), prevRange: pr,
        bar: m.roaPct, sub: AF.num(m.active) + " dari " + AF.num(m.outlets) + " RO beli bulan ini" }),
      kpiCard({ href: "ro-item.html", label: AF.ROLE.key === "sales" ? "Penjualan" : "Produk Paling Laku", value: '<span class="kpi-item">' + AF.esc(short(top.p.name)) + "</span>", dl: AF.delta(top.u, top.pu), prevRange: pr,
        sub: AF.num(top.u) + " unit · " + AF.pct(totalUnits ? top.u / totalUnits * 100 : 0) })
    ].join("");

    // peta
    const sets = kindSets(m);
    const kindMap = {}, counts = { "NOO": 0, "NOP": 0, "Aktif": 0, "Tidak aktif": 0 };
    for (const o of outlets) { const k = kindOf(o, sets.noo, sets.nop); kindMap[o.id] = k; counts[k]++; }
    document.getElementById("map-legend").innerHTML = KINDS.map(function (k) {
      return '<span><i style="background:' + k.color + '"></i>' + k.label + " <b>" + AF.num(counts[k.key]) + "</b></span>";
    }).join("");
    const card = document.getElementById("sales-map").closest(".card");
    drawMap(outlets, kindMap, { "NOO": 1, "NOP": 1, "Aktif": 1, "Tidak aktif": 1 }, function () { location.href = card.dataset.href; });

    // tren
    const t = AF.scopedTrend(outlets);
    const q = AF.stateQuery(state, { bulan: "{i}" }).replace("%7Bi%7D", "{i}");
    refreshAdminChart(document.getElementById("trend-chart"), {
      type: "bar", legend: "top", clickHref: "drilldown.html" + q, labels: t.labels, tickPrefix: "Rp ", tickSuffix: t.unit,
      datasets: [
        { type: "bar", label: "Aktual Penjualan", data: t.actual, backgroundColor: "#ED1B24", borderRadius: 6, maxBarThickness: 44, order: 2 },
        { type: "line", label: "Target", data: t.target, borderColor: "#f59e0b", backgroundColor: "#fff", pointBorderColor: "#f59e0b", pointBorderWidth: 2, pointRadius: 4, tension: .3, order: 1 },
        { type: "line", label: "Tahun Lalu", data: t.lastYear, borderColor: "#94a3b8", borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0, tension: .3, order: 1 }
      ]
    });

    // produk paling laku
    const qi = AF.stateQuery(state, { item: "{i}" }).replace("%7Bi%7D", "{i}");
    refreshAdminChart(document.getElementById("product-chart"), {
      type: "bar", axis: "y", clickHref: "ro-item.html" + qi, clickValues: items.map(function (x) { return x.p.code; }),
      labels: items.map(function (x) { return short(x.p.name); }),
      datasets: [{ label: "Unit terjual", data: items.map(function (x) { return x.u; }), backgroundColor: ["#B9141B", "#ED1B24", "#F0444B", "#F47A7F", "#F8A9AC"], borderRadius: 4 }]
    });

    // kesehatan outlet
    const healthy = m.active - m.atRisk;
    const qh = AF.stateQuery(state);
    refreshAdminChart(document.getElementById("health-chart"), {
      type: "doughnut", labels: ["ROA", "Belum dikunjungi", "RO tidak ROA"], clickHref: "kesehatan-outlet.html" + qh + (qh ? "&" : "?") + "status={i}",
      clickValues: ["all", "At Risk", "Inactive"],
      datasets: [{ data: [healthy, m.atRisk, m.inactive], backgroundColor: ["#10b981", "#f59e0b", "#ef4444"], borderWidth: 0 }]
    });
    document.getElementById("health-center").innerHTML = "<strong>" + AF.num(m.outlets) + "</strong><span>outlet</span>";
    const pHealthy = p.active - p.atRisk;
    const row = function (color, label, v, pv, invert) {
      return '<li><span><i class="swatch" style="background:' + color + '"></i>' + label + "</span><strong>" + AF.num(v) + " " + AF.deltaPill(AF.delta(v, pv), "Dibanding " + pr, invert) + "</strong></li>";
    };
    document.getElementById("health-list").innerHTML =
      row("#10b981", "ROA, kunjungan rutin", healthy, pHealthy) + row("#f59e0b", "Belum dikunjungi > 14 hari", m.atRisk, p.atRisk, true) + row("#ef4444", "RO tidak ROA", m.inactive, p.inactive, true);
  }

  // ---------- Kartu tim (GM/RSM/ASM) & jadwal kunjungan (Sales) ----------
  function renderTeam(state, outlets, info) {
    const box = document.getElementById("team-list");
    if (box) {
      const L = AF.LOCK;
      const areas = D.areas.filter(function (a) { return (state.pulau === "all" || a.pulau === state.pulau) && (state.region === "all" || a.region === state.region) && (state.area === "all" || a.id === state.area); });
      const regions = D.regions.filter(function (r) { return areas.some(function (a) { return a.region === r.code; }); });
      const sales = D.sales.filter(function (x) { return areas.some(function (a) { return a.id === x.area; }); });
      const admins = areas.reduce(function (n, a) { return n + a.admins; }, 0);
      const rows = [];
      if (!L.region) rows.push(["RSM", regions.length]);
      if (!L.area) rows.push(["ASM", areas.length]);
      rows.push(["Sales", sales.length], ["Admin &amp; admin gudang", admins]);
      // sales dengan EC terendah di cakupan ini
      const per = {};
      for (const o of outlets) { const x = per[o.sales] || (per[o.sales] = { t: 0, d: 0 }); x.t += o.orders; x.d += o.visits_done; }
      const low = Object.keys(per).map(function (id) { return { s: AF.SALES[id], ec: per[id].d ? per[id].t / per[id].d * 100 : 0 }; }).sort(function (a, b) { return a.ec - b.ec; }).slice(0, 3);
      box.innerHTML = rows.map(function (r) { return "<li><span>" + r[0] + "</span><strong>" + AF.num(r[1]) + "</strong></li>"; }).join("") +
        '<li class="list-head"><span>EC terendah</span><span></span></li>' +
        low.map(function (x) { return "<li><span>" + AF.esc(x.s.name) + '<span class="subtext">' + AF.esc(AF.AREA[x.s.area].name) + '</span></span><span class="badge ' + (x.ec >= 90 ? "" : x.ec >= 80 ? "warning" : "danger") + '">' + AF.pct(x.ec) + "</span></li>"; }).join("");
    }
    const vbox = document.getElementById("visit-list");
    if (vbox) {
      const up = AF.schedule(outlets, 0, 14);
      document.getElementById("visit-count").textContent = up.length + " kunjungan · 14 hari";
      vbox.innerHTML = up.slice(0, 7).map(function (x) {
        const st = x.o.status === "Inactive" ? '<span class="badge danger">RO tidak ROA</span>' : x.o.status === "At Risk" ? '<span class="badge warning">Berisiko</span>' : "";
        return '<li><a href="jadwal.html"><span>' + AF.esc(x.o.name) + '<span class="subtext">' + AF.fmtDay(AF.dayFromSnapshot(x.day)) + (x.changed || x.extra ? " · diubah" : "") + "</span></span></a><span>" + st + "</span></li>";
      }).join("") + '<li><a class="link-more" href="jadwal.html">Lihat semua jadwal →</a></li>';
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

    // Satu tabel: per wilayah/area (klik nama = filter, klik panah = buka toko NOO/NOP), di level area langsung daftar toko
    const g = AF.childGroups(state);
    const gt = document.getElementById("map-groups");
    const isNew = function (o) { return kindMap[o.id] === "NOO" || kindMap[o.id] === "NOP"; };
    const tokoRow = function (o, parent) {
      const k = kindMap[o.id];
      const badge = k === "NOO" ? '<span class="badge">NOO</span>' : k === "NOP" ? '<span class="badge blue">NOP</span>' : k === "Tidak aktif" ? '<span class="badge danger">RO tidak ROA</span>' : '<span class="badge neutral">ROA</span>';
      return '<tr class="child-row" data-href="' + outletHref(o) + '"' + (parent !== undefined ? ' data-parent="' + parent + '" hidden' : "") + '><td><strong>' + AF.esc(o.name) +
        '</strong><span class="subtext">' + AF.esc(AF.AREA[o.area].name) + '</span></td><td colspan="3" class="center">' + badge + '</td><td class="center">' + AF.rupiah(AF.outletActual(o) * info.factor) + "</td></tr>";
    };
    if (g.key === "toko") {
      const list = outlets.slice().sort(function (a, b) { return isNew(b) - isNew(a); });
      document.getElementById("map-group-title").textContent = "Toko (" + list.length + ")";
      gt.querySelector("thead").innerHTML = '<tr><th scope="col">Toko</th><th scope="col" colspan="3" class="center">Status</th><th scope="col" class="center">Aktual</th></tr>';
      gt.querySelector("tbody").innerHTML = list.map(function (o) { return tokoRow(o); }).join("");
    } else {
      document.getElementById("map-group-title").textContent = "Per " + g.level;
      gt.querySelector("thead").innerHTML = '<tr><th scope="col">' + g.level + '</th><th scope="col" class="center">Outlet</th><th scope="col" class="center">NOO</th><th scope="col" class="center">NOP</th><th scope="col" class="center">RO tidak ROA</th></tr>';
      gt.querySelector("tbody").innerHTML = g.groups.map(function (x, i) {
        const c = { "NOO": 0, "NOP": 0, "Tidak aktif": 0 };
        for (const o of x.outlets) if (c[kindMap[o.id]] !== undefined) c[kindMap[o.id]]++;
        const items = x.outlets.filter(isNew);
        return '<tr class="group-row" data-g="' + i + '" aria-expanded="false"><td><button type="button" class="chev" aria-label="Buka toko NOO dan NOP ' + AF.esc(x.name) + '">▸</button>' +
          '<button type="button" class="group-name" title="Filter ke ' + AF.esc(x.name) + '">' + AF.esc(x.name) + '</button>' + (x.sub ? '<span class="subtext group-sub">' + AF.esc(x.sub) + "</span>" : "") + '</td><td class="center mono">' + x.outlets.length +
          '</td><td class="center mono">' + c.NOO + '</td><td class="center mono">' + c.NOP + '</td><td class="center mono">' + c["Tidak aktif"] + "</td></tr>" +
          items.map(function (o) { return tokoRow(o, i); }).join("");
      }).join("");
      for (const tr of gt.querySelectorAll(".group-row")) {
        const x = g.groups[Number(tr.dataset.g)];
        tr.querySelector(".chev").onclick = function () {
          const open = tr.getAttribute("aria-expanded") !== "true";
          tr.setAttribute("aria-expanded", open);
          for (const c of gt.querySelectorAll('[data-parent="' + tr.dataset.g + '"]')) c.hidden = !open;
        };
        tr.querySelector(".group-name").onclick = function () {
          filter.set(AF.drillPatch(g.key, x.id));
        };
      }
    }
    if (document.getElementById("search").value) searchTables();
  }

  // ================================================================ TREN PENJUALAN
  function trendPage() {
    const t = AF.scopedTrend(AF.scopeOutlets(AF.readState())), n = t.actual.length;
    const sum = function (a) { return a.reduce(function (s, v) { return s + v; }, 0); };
    const ytd = sum(t.actual), ytdT = sum(t.target), ytdLY = sum(t.lastYear);
    let best = 0;
    t.actual.forEach(function (v, i) { if (v > t.actual[best]) best = i; });
    const mrd = function (v) { return "Rp " + v.toLocaleString("id-ID", { maximumFractionDigits: 2 }) + t.unit; };
    document.getElementById("trend-kpis").innerHTML = [
      '<article class="card kpi trend-' + AF.deltaTone(AF.delta(ytd, ytdLY)) + '"><h2 class="kpi-label">Aktual Jan–' + t.labels[n - 1] + '</h2><div class="kpi-value">' + mrd(ytd) + '</div><div class="kpi-top">' + AF.deltaPill(AF.delta(ytd, ytdLY)) + '<span class="kpi-prev">vs tahun lalu</span></div></article>',
      '<article class="card kpi trend-' + (ytd >= ytdT ? "up" : "down") + '"><h2 class="kpi-label">Capaian Target</h2><div class="kpi-value">' + AF.pct(ytd / ytdT * 100) + '</div><span class="kpi-sub">Target ' + mrd(ytdT) + "</span></article>",
      '<article class="card kpi trend-' + AF.deltaTone(AF.delta(t.actual[n - 1], t.actual[n - 2])) + '"><h2 class="kpi-label">' + t.labels[n - 1] + " 2026</h2><div class=\"kpi-value\">" + mrd(t.actual[n - 1]) + '</div><div class="kpi-top">' + AF.deltaPill(AF.delta(t.actual[n - 1], t.actual[n - 2])) + '<span class="kpi-prev">vs ' + t.labels[n - 2] + "</span></div></article>",
      '<article class="card kpi trend-flat"><h2 class="kpi-label">Bulan Terbaik</h2><div class="kpi-value">' + t.labels[best] + '</div><span class="kpi-sub">' + mrd(t.actual[best]) + "</span></article>"
    ].join("");
    refreshAdminChart(document.getElementById("trend-big"), {
      type: "bar", legend: "top", clickHref: "drilldown.html?bulan={i}", labels: t.labels, tickPrefix: "Rp ", tickSuffix: t.unit,
      datasets: [
        { type: "bar", label: "Aktual Penjualan", data: t.actual, backgroundColor: "#ED1B24", borderRadius: 6, maxBarThickness: 56, order: 2 },
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
      kpiCard({ label: "Total RO", value: AF.num(m.outlets), dl: { dir: "flat", text: "0,0%" }, prevRange: pr }),
      kpiCard({ label: "ROA, Kunjungan Rutin", value: AF.num(healthy), dl: AF.delta(healthy, pHealthy), prevRange: pr, sub: AF.pct(m.outlets ? healthy / m.outlets * 100 : 0) + " dari RO" }),
      kpiCard({ label: "Belum Dikunjungi > 14 Hari", value: AF.num(m.atRisk), dl: AF.delta(m.atRisk, p.atRisk), invert: true, prevRange: pr, sub: "Wajib kunjungan tiap 2 minggu" }),
      kpiCard({ label: "RO Tidak ROA", value: AF.num(m.inactive), dl: AF.delta(m.inactive, p.inactive), invert: true, prevRange: pr, sub: "Tidak beli > 1 bulan" })
    ].join("");
    refreshAdminChart(document.getElementById("health-big"), {
      type: "doughnut", legend: "bottom", labels: ["ROA", "Belum dikunjungi", "RO tidak ROA"],
      datasets: [{ data: [healthy, m.atRisk, m.inactive], backgroundColor: ["#10b981", "#f59e0b", "#ef4444"], borderWidth: 0 }]
    });
    document.getElementById("health-big-center").innerHTML = "<strong>" + AF.num(m.outlets) + "</strong><span>outlet</span>";
    const g = AF.childGroups(state);
    const gs = g.key === "toko" ? [] : g.groups;
    document.getElementById("cause-title").textContent = "Per " + (g.key === "toko" ? "Toko" : g.level);
    refreshAdminChart(document.getElementById("cause-chart"), {
      type: "bar", axis: "y", legend: "top", stacked: true, labels: gs.map(function (x) { return x.name; }),
      datasets: [
        { label: "Belum dikunjungi", data: gs.map(function (x) { return x.outlets.filter(function (o) { return o.status === "At Risk"; }).length; }), backgroundColor: "#f59e0b", stack: "s" },
        { label: "RO tidak ROA", data: gs.map(function (x) { return x.outlets.filter(function (o) { return o.status === "Inactive"; }).length; }), backgroundColor: "#ef4444", stack: "s" }
      ]
    });
    healthTable(outlets, info);
  }

  function healthTable(outlets, info) {
    const list = outlets.filter(function (o) { return o.status !== "Active" && (healthStatus === "all" || o.status === healthStatus); });
    for (const b of document.querySelectorAll("[data-status]")) b.setAttribute("aria-pressed", b.dataset.status === healthStatus);
    document.getElementById("health-table-title").textContent = "Outlet Perlu Perhatian (" + list.length + ")";
    document.querySelector("#health-table tbody").innerHTML = list.map(function (o) {
      const st = o.status === "Inactive" ? '<span class="badge danger">RO tidak ROA</span>' : '<span class="badge warning">Belum dikunjungi</span>';
      return '<tr data-href="' + outletHref(o) + '"><td><strong>' + AF.esc(o.name) + '</strong><span class="subtext mono">' + o.id + "</span></td><td>" + AF.esc(AF.REGION[o.region].short) +
        '<span class="subtext">' + AF.esc(AF.AREA[o.area].name) + "</span></td><td>" + AF.esc(AF.SALES[o.sales].name) + "</td><td>" + st + "</td><td>" + AF.esc(o.risk || "-") +
        '</td><td class="numeric">' + AF.rupiah(AF.outletActual(o) * info.factor) + "</td></tr>";
    }).join("") + '<tr class="filter-empty" hidden><td class="table-empty" colspan="6">Semua RO sudah ROA dan dikunjungi rutin.</td></tr>';
    if (document.getElementById("search").value) searchTables();
  }

  // ================================================================ PERINGATAN DINI
  // jadwal kunjungan terlewat, RO tidak ROA, risiko kedaluwarsa (dari riwayat produksi), sales EC / kunjungan < 80%
  let warnType = new URLSearchParams(location.search).get("jenis") || "all";
  const WARN = {
    visit: { label: "Jadwal terlewat", badge: "warning", title: "Jadwal Kunjungan Terlewat", sub: "Sudah dijadwalkan, belum dikunjungi" },
    roa: { label: "RO tidak ROA", badge: "danger", title: "RO Tidak ROA", sub: "Tidak beli > 1 bulan" },
    exp: { label: "Risiko kedaluwarsa", badge: "danger", title: "Risiko Kedaluwarsa", sub: "Produk slow moving, batch hampir / sudah kedaluwarsa" },
    kinerja: { label: "Kinerja sales", badge: "warning", title: "Sales di Bawah 80%", sub: "Effective call atau kunjungan terlaksana < 80%" }
  };
  const FU = { open: ["Belum ditindaklanjuti", "neutral"], progress: ["Sedang ditindaklanjuti", "warning"], done: ["Selesai", ""] };

  function prodName(code) { for (const p of D.products) if (p.code === code) return p.name; return code; }

  function warnList(state) {
    const outlets = AF.scopeOutlets(state);
    const list = [];
    for (const o of outlets) {
      const v = o.visits || [];
      for (let i = 0; i < v.length; i += 2) if (v[i + 1] === 0) {
        const d = AF.dayFromSnapshot(v[i]);
        list.push({ id: "visit-" + o.id + "-" + v[i], t: "visit", o: o, note: "Jadwal " + AF.fmtDay(d) + " belum dikunjungi (" + (-v[i]) + " hari lalu)" });
      }
      if (o.status === "Inactive") list.push({ id: "roa-" + o.id, t: "roa", o: o, note: "Tidak beli > 1 bulan" });
      if (o.slow && o.batch >= 0) {
        const b = D.batches[o.batch], days = Math.round((AF.fromIso(b.exp) - AF.SNAPSHOT) / 864e5);
        if (days < 60) list.push({ id: "exp-" + o.id, t: "exp", o: o, code: b.code, note: prodName(b.code) + " " + AF.num(o.slow) + " unit · batch " + b.id + " (produksi " + AF.fmtDate(AF.fromIso(b.prod)) + ") " +
          (days < 0 ? "sudah kedaluwarsa " + (-days) + " hari" : "kedaluwarsa " + days + " hari lagi"), days: days });
      }
    }
    const per = {};
    for (const o of outlets) { const x = per[o.sales] || (per[o.sales] = { p: 0, d: 0, t: 0 }); x.p += o.visits_plan; x.d += o.visits_done; x.t += o.orders; }
    for (const id in per) {
      const x = per[id], ec = x.d ? x.t / x.d * 100 : 0, vp = x.p ? x.d / x.p * 100 : 0;
      if (ec < 80 || vp < 80) list.push({ id: "kinerja-" + id, t: "kinerja", s: AF.SALES[id], ec: ec, vp: vp,
        note: (ec < 80 ? "Effective call " + AF.pct(ec) : "") + (ec < 80 && vp < 80 ? " · " : "") + (vp < 80 ? "Kunjungan terlaksana " + AF.pct(vp) : "") + " (batas 80%)" });
    }
    return list;
  }

  function fuBadge(f) { const x = FU[(f && f.status) || "open"]; return '<span class="badge ' + x[1] + '">' + x[0] + "</span>"; }

  // satu dropdown: peringatan untuk Outlet / Produk / Sales
  const GROUP = { outlet: ["visit", "roa"], produk: ["exp"], sales: ["kinerja"] };
  let warnGroup = new URLSearchParams(location.search).get("untuk") || "all";
  function inGroup(t) { return warnGroup === "all" || GROUP[warnGroup].indexOf(t) >= 0; }

  function warnRender(state) {
    const sel = document.getElementById("warn-group");
    sel.value = warnGroup;
    if (warnType !== "all" && !inGroup(warnType)) warnType = "all";
    const list = warnList(state).filter(function (w) { return inGroup(w.t); });
    const fu = AF.store.get("followup", {});
    const n = { visit: 0, roa: 0, exp: 0, kinerja: 0 }, done = { visit: 0, roa: 0, exp: 0, kinerja: 0 };
    for (const w of list) { n[w.t]++; if (fu[w.id] && fu[w.id].status === "done") done[w.t]++; }
    const kinds = Object.keys(WARN).filter(inGroup);
    document.getElementById("warn-kpis").className = "kpi-grid " + (kinds.length === 1 ? "one" : kinds.length === 2 ? "two" : "four");
    document.getElementById("warn-kpis").innerHTML = kinds.map(function (t) {
      return '<button type="button" class="card kpi warn-card' + (warnType === t ? " selected" : "") + " trend-" + (t === "visit" || t === "kinerja" ? "flat" : "down") + '" data-jenis="' + t + '"><h2 class="kpi-label">' + WARN[t].title +
        '</h2><div class="kpi-value">' + AF.num(n[t]) + '</div><span class="kpi-sub">' + WARN[t].sub + (done[t] ? " · " + done[t] + " selesai" : "") + "</span></button>";
    }).join("");
    for (const b of document.querySelectorAll("[data-jenis]")) b.onclick = function () { warnType = warnType === b.dataset.jenis ? "all" : b.dataset.jenis; warnRender(state); };
    const fuFilter = document.getElementById("fu-filter").value;
    const rows = list.filter(function (w) {
      const st = (fu[w.id] && fu[w.id].status) || "open";
      return (warnType === "all" || w.t === warnType) && (fuFilter === "all" || st === fuFilter);
    });
    document.getElementById("warn-title").textContent = (warnType !== "all" ? WARN[warnType].title : warnGroup === "all" ? "Semua Peringatan" : "Peringatan " + { outlet: "Outlet", produk: "Produk", sales: "Sales" }[warnGroup]) + " (" + AF.num(rows.length) + ")";
    document.querySelector("#warn-table tbody").innerHTML = rows.slice(0, 400).map(function (w, i) {
      const f = fu[w.id], last = f && f.notes && f.notes.length ? f.notes[f.notes.length - 1] : null;
      const who = w.o ? "<strong>" + AF.esc(w.o.name) + '</strong><span class="subtext mono">' + w.o.id + "</span>" : "<strong>" + AF.esc(w.s.name) + '</strong><span class="subtext mono">' + w.s.id + "</span>";
      const area = w.o || w.s;
      return '<tr data-i="' + i + '"><td><span class="badge ' + WARN[w.t].badge + '">' + WARN[w.t].label + "</span></td><td>" + who + "</td><td>" + AF.esc(AF.REGION[area.region].name) + '<span class="subtext">' + AF.esc(AF.AREA[area.area].name) +
        "</span></td><td>" + AF.esc(w.o ? AF.SALES[w.o.sales].name : w.s.name) + '<span class="subtext">ASM ' + AF.esc(AF.AREA[area.area].asm) + "</span></td><td>" + w.note +
        (last ? '<span class="subtext">Catatan: ' + AF.esc(last.text) + " — " + AF.esc(last.by) + ", " + last.at + "</span>" : "") + "</td><td>" + fuBadge(f) +
        '</td><td><button type="button" class="detail-button fu-btn" data-i="' + i + '">Tindak lanjut</button></td></tr>';
    }).join("") + (rows.length > 400 ? '<tr><td class="table-empty" colspan="7">Menampilkan 400 dari ' + AF.num(rows.length) + " peringatan. Persempit filter untuk melihat sisanya.</td></tr>" : "") +
      '<tr class="filter-empty" hidden><td class="table-empty" colspan="7">Tidak ada peringatan.</td></tr>';
    for (const b of document.querySelectorAll(".fu-btn")) b.onclick = function () { openFollowUp(b.closest("tr"), rows[Number(b.dataset.i)], state); };
    if (document.getElementById("search").value) searchTables();
  }

  // form tindak lanjut di bawah baris peringatan (status + catatan, tersimpan di browser)
  function openFollowUp(tr, w, state) {
    const next = tr.nextElementSibling;
    if (next && next.classList.contains("fu-row")) { next.remove(); return; }
    for (const r of document.querySelectorAll(".fu-row")) r.remove();
    const fu = AF.store.get("followup", {}), f = fu[w.id] || { status: "open", notes: [] };
    const hist = f.notes.map(function (n) { return "<li><span>" + AF.esc(n.text) + '</span><span class="subtext">' + AF.esc(n.by) + " · " + n.at + (n.status ? " · " + FU[n.status][0] : "") + "</span></li>"; }).join("");
    const link = w.o ? '<a class="detail-button" href="' + outletHref(w.o) + '">Buka detail toko</a>' : "";
    const row = document.createElement("tr");
    row.className = "fu-row";
    row.innerHTML = '<td colspan="7"><div class="fu-box"><div class="fu-form"><label>Status<select class="fu-status">' + Object.keys(FU).map(function (k) { return '<option value="' + k + '"' + (f.status === k ? " selected" : "") + ">" + FU[k][0] + "</option>"; }).join("") +
      '</select></label><label>Catatan<textarea class="fu-note" rows="3" placeholder="Contoh: sudah ditelepon, toko minta dikunjungi Kamis"></textarea></label>' +
      '<div class="fu-actions"><button type="button" class="button primary fu-save">Simpan</button><button type="button" class="button fu-cancel">Tutup</button>' + link + "</div></div>" +
      '<div class="fu-hist"><span class="popup-label">Riwayat tindak lanjut</span>' + (hist ? '<ul class="stat-list">' + hist + "</ul>" : '<p class="muted">Belum ada catatan.</p>') + "</div></div></td>";
    tr.after(row);
    row.querySelector(".fu-cancel").onclick = function () { row.remove(); };
    row.querySelector(".fu-save").onclick = function () {
      const text = row.querySelector(".fu-note").value.trim(), st = row.querySelector(".fu-status").value;
      if (!text && st === f.status) { row.querySelector(".fu-note").focus(); return; }
      f.status = st;
      f.notes.push({ text: text || "Status diubah", by: AF.who(), at: AF.nowText(), status: st });
      fu[w.id] = f;
      AF.store.set("followup", fu);
      showToast("Tindak lanjut tersimpan");
      warnRender(state);
    };
    row.querySelector(".fu-note").focus();
  }

  document.addEventListener("DOMContentLoaded", function () {
    const bar = document.getElementById("filter-bar");
    if (document.getElementById("exec-kpis")) filter = AF.renderFilterBar(bar, {}, execRender);
    else if (document.getElementById("map-page")) filter = AF.renderFilterBar(bar, {}, mapPageRender);
    else if (document.getElementById("warn-page")) {
      filter = AF.renderFilterBar(bar, {}, warnRender);
      document.getElementById("fu-filter").onchange = function () { warnRender(filter.state); };
      document.getElementById("warn-group").onchange = function () { warnGroup = this.value; warnType = "all"; warnRender(filter.state); };
    }
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
