// Executive Dashboard Admin Pusat + halaman turunannya (Peta Outlet, Tren Penjualan, Kesehatan Outlet).
(function () {
  if (!window.AF) return;
  const AF = window.AF, D = AF.D;
  let filter;

  function scopeKey(state) { return state.region + "|" + state.area + "|" + state.outlet; }
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
      '<div class="kpi-top">' + AF.deltaPill(o.dl, "Dibanding " + o.prevRange, o.invert) + '<span class="kpi-prev">vs periode lalu</span></div>' +
      bar + (o.sub ? '<span class="kpi-sub">' + o.sub + "</span>" : "") + "</" + tag + ">";
  }

  // ---------- Peta outlet (dipakai Executive dan halaman Peta Outlet) ----------
  const KINDS = [
    { key: "NOO", label: "NOO", color: "#10b981", radius: 7 },
    { key: "NOP", label: "NOP", color: "#8b5cf6", radius: 6 },
    { key: "Aktif", label: "Outlet aktif", color: "#2563eb", radius: 4 },
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
      const mk = L.circleMarker([o.lat, o.lng], { radius: k.radius, color: "#fff", weight: 1, fillColor: k.color, fillOpacity: .92, bubblingMouseEvents: false });
      mk.bindTooltip("<strong>" + AF.esc(o.name) + "</strong><br/>" + k.label + " · " + AF.esc(AF.AREA[o.area].name), { direction: "top" });
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
    const totalUnits = items.reduce(function (s, x) { return s + x.u; }, 0);
    const top = items[0];
    const pr = info.prevRange;
    document.getElementById("exec-kpis").innerHTML = [
      kpiCard({ href: "penjualan.html", label: "Volume Penjualan", value: AF.rupiah(m.actual), dl: AF.delta(m.actual, p.actual), prevRange: pr,
        bar: m.salesPct, sub: "<b>" + AF.pct(m.salesPct) + "</b> dari target " + AF.rupiah(m.target) }),
      kpiCard({ href: "effective-call.html", label: "Effective Call", value: AF.pct(m.ecPct), dl: AF.delta(m.ecPct, p.ecPct, true), prevRange: pr,
        bar: m.ecPct, sub: AF.num(m.visitsDone) + " / " + AF.num(m.visitsPlan) + " kunjungan" }),
      kpiCard({ href: "noo.html", label: "NOO", value: AF.num(m.nooActual) + "<small> / " + AF.num(m.nooTarget) + "</small>", dl: AF.delta(m.nooActual, p.nooActual), prevRange: pr,
        bar: m.nooPct, sub: "<b>" + AF.pct(m.nooPct) + "</b> dari target" }),
      kpiCard({ href: "nop.html", label: "NOP", value: AF.num(m.nopActual) + "<small> / " + AF.num(m.nopTarget) + "</small>", dl: AF.delta(m.nopActual, p.nopActual), prevRange: pr,
        bar: m.nopPct, sub: "<b>" + AF.pct(m.nopPct) + "</b> dari target" }),
      kpiCard({ href: "roa.html", label: "Outlet ROA", value: AF.pct(m.roaPct), dl: AF.delta(m.roaPct, p.roaPct, true), prevRange: pr,
        bar: m.roaPct, sub: AF.num(m.active) + " / " + AF.num(m.outlets) + " outlet order" }),
      kpiCard({ href: "ro-item.html", label: "Item RO Terbanyak", value: '<span class="kpi-item">' + AF.esc(short(top.p.name)) + "</span>", dl: AF.delta(top.u, top.pu), prevRange: pr,
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
    const t = D.trend;
    const q = AF.stateQuery(state, { bulan: "{i}" }).replace("%7Bi%7D", "{i}");
    refreshAdminChart(document.getElementById("trend-chart"), {
      type: "bar", legend: "top", clickHref: "drilldown.html" + q, labels: t.labels,
      datasets: [
        { type: "bar", label: "Aktual Penjualan", data: t.actual, backgroundColor: "#2563eb", borderRadius: 6, maxBarThickness: 44, order: 2 },
        { type: "line", label: "Target", data: t.target, borderColor: "#f59e0b", backgroundColor: "#fff", pointBorderColor: "#f59e0b", pointBorderWidth: 2, pointRadius: 4, tension: .3, order: 1 },
        { type: "line", label: "Tahun Lalu", data: t.lastYear, borderColor: "#94a3b8", borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0, tension: .3, order: 1 }
      ]
    });

    // produk paling laku
    const qi = AF.stateQuery(state, { item: "{i}" }).replace("%7Bi%7D", "{i}");
    refreshAdminChart(document.getElementById("product-chart"), {
      type: "bar", axis: "y", clickHref: "ro-item.html" + qi, clickValues: items.map(function (x) { return x.p.code; }),
      labels: items.map(function (x) { return short(x.p.name); }),
      datasets: [{ label: "Unit terjual", data: items.map(function (x) { return x.u; }), backgroundColor: ["#1d4ed8", "#2563eb", "#3b82f6", "#60a5fa", "#93c5fd"], borderRadius: 4 }]
    });

    // kesehatan outlet
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

    // per wilayah / area / toko
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
      return '<tr data-href="' + outletHref(o) + '"><td><strong>' + AF.esc(o.name) + '</strong></td><td><span class="badge ' + (k === "NOO" ? "" : "blue") + '">' + k + "</span></td><td>" +
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
        { type: "bar", label: "Aktual Penjualan", data: t.actual, backgroundColor: "#2563eb", borderRadius: 6, maxBarThickness: 56, order: 2 },
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
    if (document.getElementById("exec-kpis")) filter = AF.renderFilterBar(bar, {}, execRender);
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
