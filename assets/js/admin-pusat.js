// Interaksi khusus halaman ADMIN PUSAT (meniru prototipe PHP). Data statis, tanpa backend.

/* ---------- Filter tabel (select + pencarian) ---------- */
function filterTable(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;
  const selects = document.querySelectorAll('[data-filter-table="' + tableId + '"]');
  const searchInput = document.getElementById("search");
  const keyword = searchInput ? searchInput.value.toLowerCase().trim() : "";
  let total = 0;

  for (const row of table.querySelectorAll("tbody tr:not(.filter-empty)")) {
    let match = true;
    for (const select of selects) {
      const value = select.value;
      if (value !== "all" && row.dataset[select.dataset.filterAttr] !== value) match = false;
    }
    const text = row.textContent.replace(/\s+/g, " ").toLowerCase();
    row.hidden = !match || !text.includes(keyword);
    if (!row.hidden) total++;
  }
  const empty = table.querySelector(".filter-empty");
  if (empty) empty.hidden = total > 0;
}

function setFilter(tableId, attr, value) {
  const select = document.querySelector('[data-filter-table="' + tableId + '"][data-filter-attr="' + attr + '"]');
  if (select) select.value = value;
  filterTable(tableId);
}

function resetFilters(tableId) {
  for (const select of document.querySelectorAll('[data-filter-table="' + tableId + '"]')) select.value = "all";
  filterTable(tableId);
}

document.addEventListener("input", function (event) {
  if (event.target.id !== "search") return;
  for (const table of document.querySelectorAll("table[data-admin-filter]")) filterTable(table.id);
  if (window.drillState) renderDrill();
});

function followUp(id) {
  showToast("Aksi investigasi untuk ID " + id + " telah dipicu.");
}

function showToast(message) {
  let toast = document.getElementById("admin-toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "admin-toast";
    toast.className = "toast";
    toast.setAttribute("role", "status");
    document.body.appendChild(toast);
  }
  toast.textContent = message + " (demo)";
  toast.hidden = false;
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(function () { toast.hidden = true; }, 3500);
}

function formatRupiah(value) {
  if (!value) return "Rp 0";
  if (value >= 1000000000) return "Rp " + (value / 1000000000).toFixed(2) + " M";
  if (value >= 1000000) return "Rp " + (value / 1000000).toFixed(1) + " Jt";
  return "Rp " + value.toLocaleString("id-ID");
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, function (c) {
    return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
  });
}

/* ---------- Grafik Drilldown 7 Level ---------- */
const DRILL_LEVELS = ["Nasional", "Region", "Area", "Kabupaten", "Kecamatan", "Salesperson", "Outlet (SKU)", "Produk SKU"];
let drillChartType = "bar";

function drillStatusBadge(item) {
  if (item.statusEmoji === "🔴") return '<span class="badge danger">Kritis</span>';
  if (item.statusEmoji === "🟡") return '<span class="badge warning">Waspada</span>';
  return '<span class="badge">Baik</span>';
}

function drillGenerateItems(parentLabel, isLowest) {
  // Sama dengan generateSubItems() di versi PHP untuk cabang yang belum punya data rinci.
  if (isLowest) return window.drillDefaultSku;
  return [
    { label: parentLabel + " - Sektor Utara", target: 1200000000, actual: 1380000000, achievement: 115.0, growth: 14.0, statusEmoji: "🟢", color: "#10b981" },
    { label: parentLabel + " - Sektor Selatan", target: 950000000, actual: 1045000000, achievement: 110.0, growth: 12.0, statusEmoji: "🟢", color: "#6366f1" },
    { label: parentLabel + " - Sektor Timur", target: 800000000, actual: 840000000, achievement: 105.0, growth: 8.0, statusEmoji: "🟢", color: "#06b6d4" },
    { label: parentLabel + " - Sektor Barat", target: 600000000, actual: 630000000, achievement: 105.0, growth: 7.0, statusEmoji: "🟢", color: "#f59e0b" }
  ];
}

function initDrill() {
  const source = document.getElementById("drill-data");
  if (!source) return;
  if (window.AF) {
    // data Region 1-5 (revisi 13 Okt): level teratas = wilayah, bisa per bulan
    const q = new URLSearchParams(location.search);
    const month = Math.min(9, Math.max(0, Number(q.get("bulan") || 9)));
    const sel = document.getElementById("drill-month");
    sel.innerHTML = window.AF.D.trend.labels.map(function (l, i) { return '<option value="' + i + '"' + (i === month ? " selected" : "") + ">" + l + " 2026</option>"; }).join("");
    document.getElementById("drill-month-field").hidden = false;
    window.drillState = [buildAFTree(month)];
    const reg = q.get("wilayah");
    if (reg && window.AF.REGION[reg]) drillDown(window.AF.REGION[reg].name);
    else renderDrill();
    return;
  }
  const data = JSON.parse(source.textContent);
  window.drillDefaultSku = data.defaultSku;
  window.drillState = [data.tree];
  renderDrill();
}

function setDrillMonth(value) {
  const path = window.drillState.map(function (n) { return n.title; });
  window.drillState = [buildAFTree(Number(value))];
  // pertahankan posisi drill sejauh label masih ada
  const labels = window.drillPath || [];
  for (const label of labels) {
    const node = drillCurrent();
    if (node.children && node.children[label]) window.drillState.push(node.children[label]);
    else break;
  }
  const q = new URLSearchParams(location.search);
  q.set("bulan", value);
  history.replaceState(null, "", location.pathname + "?" + q.toString());
  renderDrill();
  return path;
}

function buildAFTree(month) {
  const AF = window.AF, D = AF.D, t = D.trend;
  const COLORS = ["#2563eb", "#10b981", "#f59e0b", "#8b5cf6", "#06b6d4", "#ec4899", "#84cc16", "#f97316", "#14b8a6", "#6366f1"];
  const mName = t.labels[month] + " 2026";
  function factor(o, m) {
    if (m < 0) return t.lastYear[0] / t.actual[9];
    // variasi per toko per bulan (stabil) supaya growth tiap baris berbeda
    const n = 1 + (((o.seq || 0) * 31 + m * 17) % 21 - 10) / 100;
    return t.actual[m] / t.actual[9] * D.monthNoise[o.region][m] * (m === 9 ? 1 : n);
  }
  function tfactor(m) { return t.target[m] / t.target[9]; }
  function sum(outlets, m) {
    let a = 0, tg = 0;
    for (const o of outlets) { a += AF.outletActual(o) * factor(o, m); tg += o.target * tfactor(Math.max(m, 0)); }
    return { a: a, t: tg };
  }
  function item(label, outlets, i) {
    const now = sum(outlets, month), prev = sum(outlets, month - 1);
    const ach = now.t ? now.a / now.t * 100 : 0;
    return { label: label, target: Math.round(now.t), actual: Math.round(now.a), achievement: ach, growth: prev.a ? (now.a / prev.a - 1) * 100 : 0,
      statusEmoji: ach >= 100 ? "🟢" : ach >= 90 ? "🟡" : "🔴", color: COLORS[i % COLORS.length] };
  }
  function node(title, levelName, depth, groups, childFn) {
    const n = { title: title, levelName: levelName, depth: depth, items: [], children: {} };
    groups.forEach(function (g, i) {
      n.items.push(item(g.label, g.outlets, i));
      if (childFn) n.children[g.label] = childFn(g);
    });
    if (!childFn) n.isLowest = true;
    return n;
  }
  function productNode(o) {
    const n = { title: "Toko: " + o.name + " · " + mName, levelName: "Produk SKU", depth: 7, isLowest: true, items: [] };
    D.products.forEach(function (p, i) {
      const f = factor(o, month);
      const a = o.units[p.code] * p.price * f;
      const share = AF.outletActual(o) ? o.units[p.code] * p.price / AF.outletActual(o) : 1 / D.products.length;
      const tg = o.target * tfactor(month) * share;
      const prevA = o.units[p.code] * p.price * factor(o, month - 1);
      const ach = tg ? a / tg * 100 : 0;
      n.items.push({ label: p.name, target: Math.round(tg), actual: Math.round(a), achievement: ach, growth: prevA ? (a / prevA - 1) * 100 : 0,
        statusEmoji: ach >= 100 ? "🟢" : ach >= 90 ? "🟡" : "🔴", color: COLORS[i % COLORS.length] });
    });
    return n;
  }
  const by = function (list, key, id) { return list.filter(function (o) { return o[key] === id; }); };
  return node("Semua Wilayah · " + mName, "Semua Wilayah", 1, D.regions.map(function (r) { return { label: r.name, id: r.code, outlets: by(D.outlets, "region", r.code) }; }), function (rg) {
    return node(rg.label + " · " + mName, "Wilayah", 2, D.areas.filter(function (a) { return a.region === rg.id; }).map(function (a) { return { label: a.name, id: a.id, outlets: by(rg.outlets, "area", a.id) }; }), function (ag) {
      return node("Area " + ag.label + " · " + mName, "Area", 3, D.kecamatan.filter(function (k) { return k.area === ag.id; }).map(function (k) { return { label: "Kec. " + k.name, id: k.id, outlets: by(ag.outlets, "kecamatan", k.id) }; }), function (kg) {
        return node(kg.label + " · " + mName, "Kecamatan", 4, D.sales.filter(function (s) { return s.kecamatan === kg.id; }).map(function (s) { return { label: "Sales: " + s.name, id: s.id, outlets: by(kg.outlets, "sales", s.id) }; }), function (sg) {
          const segs = ["GT", "MT", "HOREKA"].filter(function (s) { return sg.outlets.some(function (o) { return o.segment === s; }); });
          return node(sg.label + " · " + mName, "Salesperson", 5, segs.map(function (s) { return { label: "Segmen " + s, id: s, outlets: by(sg.outlets, "segment", s) }; }), function (seg) {
            return node(sg.label + " · " + seg.label + " · " + mName, "Segmen", 6, seg.outlets.map(function (o) { return { label: o.name, id: o.id, outlets: [o], o: o }; }), function (og) {
              return productNode(og.o);
            });
          });
        });
      });
    });
  });
}

function drillCurrent() {
  return window.drillState[window.drillState.length - 1];
}

function drillIsLowest() {
  const node = drillCurrent();
  return !!node.isLowest || (node.depth || 1) >= 7;
}

function drillDown(label) {
  if (drillIsLowest()) return;
  const node = drillCurrent();
  let child = node.children && node.children[label];
  if (!child) {
    const index = DRILL_LEVELS.indexOf(node.levelName);
    const depth = (node.depth || 1) + 1;
    child = { title: node.levelName + ": " + label, levelName: DRILL_LEVELS[index + 1] || "Detail SKU", depth: depth, isLowest: depth >= 7, items: drillGenerateItems(label, depth >= 7) };
  }
  window.drillState.push(child);
  renderDrill();
}

function drillBack() {
  if (window.drillState.length > 1) window.drillState.pop();
  renderDrill();
}

function drillJump(index) {
  window.drillState = window.drillState.slice(0, index + 1);
  renderDrill();
}

function drillReset() {
  window.drillState = window.drillState.slice(0, 1);
  renderDrill();
}

function setDrillChartType(type) {
  drillChartType = type;
  renderDrill();
}

function renderDrill() {
  window.drillPath = window.drillState.slice(1).map(function (n, i) {
    const parent = window.drillState[i];
    for (const k in (parent.children || {})) if (parent.children[k] === n) return k;
    return null;
  }).filter(Boolean);
  const node = drillCurrent();
  const items = node.items || [];
  const lowest = drillIsLowest();
  const depth = node.depth || window.drillState.length;
  const totalTarget = items.reduce(function (sum, i) { return sum + i.target; }, 0);
  const totalActual = items.reduce(function (sum, i) { return sum + i.actual; }, 0);

  document.getElementById("drill-depth").textContent = "Level " + depth + " dari 7";
  document.getElementById("drill-back").disabled = window.drillState.length <= 1;
  document.getElementById("drill-reset").disabled = window.drillState.length <= 1;

  document.getElementById("drill-breadcrumbs").innerHTML = window.drillState.map(function (item, index) {
    const current = index === window.drillState.length - 1 ? ' aria-current="location"' : "";
    return '<button type="button"' + current + ' onclick="drillJump(' + index + ')">' + escapeHtml(item.title) + " <span>" + escapeHtml(item.levelName) + "</span></button>";
  }).join("");

  document.getElementById("drill-level-title").textContent = node.title;
  document.getElementById("drill-level-name").textContent = "Tingkat Hierarki: " + node.levelName;
  document.getElementById("drill-total-target").textContent = formatRupiah(totalTarget);
  document.getElementById("drill-count").textContent = items.length + " item data";
  document.getElementById("drill-total-actual").textContent = formatRupiah(totalActual);
  document.getElementById("drill-achievement").textContent = "Capaian: " + (totalTarget ? (totalActual / totalTarget * 100).toFixed(1) : 0) + "%";
  if (document.getElementById("drill-status")) document.getElementById("drill-status").textContent = lowest ? "Level terbawah (Produk SKU)" : "Level " + depth + " (bisa diklik)";
  document.getElementById("drill-chart-title").textContent = "Grafik Penjualan: " + node.title;
  document.getElementById("drill-instruction").textContent = lowest ? "Level terbawah" : "Klik batang untuk turun ke level " + (depth + 1);

  for (const button of document.querySelectorAll("[data-drill-type]")) button.setAttribute("aria-pressed", button.dataset.drillType === drillChartType);

  const searchInput = document.getElementById("search");
  const keyword = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const rows = items.filter(function (i) { return i.label.toLowerCase().includes(keyword); });
  const body = document.getElementById("drill-rows");
  body.innerHTML = rows.map(function (i) {
    const growth = (i.growth > 0 ? "+" : "") + i.growth.toFixed(1) + "%";
    const action = lowest ? '<span class="subtext">Level terbawah</span>' : '<button class="detail-button" onclick="drillDown(' + escapeHtml(JSON.stringify(i.label)) + ')">Drill Down</button>';
    const gap = i.actual - i.target;
    const share = totalActual ? i.actual / totalActual * 100 : 0;
    return '<tr class="drill-row"><td><strong>' + escapeHtml(i.label) + '</strong></td><td class="numeric">' + formatRupiah(i.target) + '</td><td class="numeric">' + formatRupiah(i.actual) +
      '</td><td class="numeric mono ' + (gap >= 0 ? "up-text" : "down-text") + '">' + (gap >= 0 ? "+" : "−") + formatRupiah(Math.abs(gap)) + '</td><td class="numeric mono">' + share.toFixed(1) +
      '%</td><td class="numeric mono">' + i.achievement.toFixed(1) + '%</td><td class="numeric mono ' + (i.growth >= 0 ? "up-text" : "down-text") + '">' + (i.growth >= 0 ? "▲ " : "▼ ") + growth.replace(/^[+-]/, "") + "</td><td>" + drillStatusBadge(i) + "</td><td>" + action + "</td></tr>";
  }).join("") || '<tr><td class="table-empty" colspan="9">Tidak ada data yang sesuai. Ubah kata pencarian.</td></tr>';

  const canvas = document.getElementById("drill-chart");
  const horizontal = drillChartType === "horizontal";
  const donut = drillChartType === "donut";
  const labels = items.map(function (i) { return i.label; });
  const colors = items.map(function (i) { return i.color || "#2563eb"; });
  const actual = items.map(function (i) { return i.actual / 1000000; });
  const target = items.map(function (i) { return i.target / 1000000; });
  const datasets = donut
    ? [{ label: "Aktual (Juta Rp)", data: actual, backgroundColor: colors }]
    : [
      { label: "Aktual (Juta Rp)", data: actual, backgroundColor: colors, borderRadius: 3, grouped: false, barPercentage: 0.42, order: 1 },
      { label: "Target (Juta Rp)", data: target, backgroundColor: "#dbe3ee", borderColor: "#bac8da", borderWidth: 1, borderRadius: 3, grouped: false, barPercentage: 0.65, order: 2, valueLabel: false }
    ];
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    indexAxis: horizontal ? "y" : "x",
    plugins: {
      legend: { position: "top" },
      tooltip: { callbacks: { label: function (item) {
        let value = item.parsed.y;
        if (horizontal) value = item.parsed.x;
        if (donut) value = item.parsed;
        return item.dataset.label + ": Rp " + value.toLocaleString("id-ID") + " Jt";
      } } }
    },
    onClick: function (_event, elements) {
      if (elements.length && !lowest) drillDown(labels[elements[0].index]);
    }
  };
  if (donut) options.cutout = "60%";
  else {
    const axis = { beginAtZero: true, ticks: { callback: function (v) { return "Rp " + v.toLocaleString("id-ID") + " Jt"; } } };
    options.scales = horizontal ? { x: axis } : { y: axis };
    labelRoom(options);
  }
  options.plugins.valueLabels = { format: function (v) { return Math.round(v).toLocaleString("id-ID"); } };
  createChart(canvas, { type: donut ? "doughnut" : "bar", data: { labels: labels, datasets: datasets }, options: options });
}

/* ---------- Area Dashboard (Region → Area → Kabupaten → Kecamatan) ---------- */
const areaState = { region: null, area: null, kab: "all", kec: "all" };

function initArea() {
  const source = document.getElementById("area-data");
  if (!source) return;
  window.areaData = JSON.parse(source.textContent);
  areaState.region = window.areaData[0].region;
  areaState.area = window.areaData[0].areas[0].name;
  renderArea();
}

function areaRegion() {
  return window.areaData.find(function (r) { return r.region === areaState.region; });
}

function areaCurrent() {
  return areaRegion().areas.find(function (a) { return a.name === areaState.area; });
}

function selectRegion(name) {
  areaState.region = name;
  areaState.area = areaRegion().areas[0].name;
  areaState.kab = "all";
  areaState.kec = "all";
  renderArea();
}

function selectArea(name) {
  areaState.area = name;
  areaState.kab = "all";
  areaState.kec = "all";
  renderArea();
}

function selectKab(value) {
  areaState.kab = value;
  areaState.kec = "all";
  renderArea();
}

function selectKec(value) {
  areaState.kec = value;
  renderArea();
}

function resetArea() {
  areaState.kab = "all";
  areaState.kec = "all";
  renderArea();
}

function areaStatusBadge(emoji, text) {
  const cls = emoji === "🔴" ? "danger" : emoji === "🟡" ? "warning" : "";
  return '<span class="badge ' + cls + '">' + escapeHtml(text) + "</span>";
}

function renderArea() {
  const region = areaRegion();
  const area = areaCurrent();

  document.getElementById("area-regions").innerHTML = window.areaData.map(function (r) {
    const selected = r.region === areaState.region;
    return '<button type="button" role="tab" aria-selected="' + selected + '" onclick="selectRegion(' + escapeHtml(JSON.stringify(r.region)) + ')">' + escapeHtml(r.region) + " · " + r.areas.length + " Area</button>";
  }).join("");

  document.getElementById("area-step2").textContent = "2. Pilih area di " + region.region;
  document.getElementById("area-cards").innerHTML = region.areas.map(function (a) {
    const selected = a.name === areaState.area;
    const cls = a.status_color === "🔴" ? "danger" : a.status_color === "🟡" ? "warning" : "";
    return '<button type="button" class="region-card area-pick' + (selected ? " selected" : "") + '" aria-pressed="' + selected + '" onclick="selectArea(' + escapeHtml(JSON.stringify(a.name)) + ')">' +
      '<div class="region-top"><h3>' + escapeHtml(a.name) + '</h3><span class="badge ' + cls + '">' + a.achievement + '%</span></div><p>Achievement</p></button>';
  }).join("");

  const kabSelect = document.getElementById("area-kab");
  kabSelect.innerHTML = '<option value="all">Semua Kabupaten di ' + escapeHtml(area.name) + "</option>" + area.kabupaten.map(function (k) {
    return '<option value="' + escapeHtml(k.name) + '">' + escapeHtml(k.name) + " (" + k.kecamatan.length + " Kec)</option>";
  }).join("");
  kabSelect.value = areaState.kab;

  const kabs = area.kabupaten.filter(function (k) { return areaState.kab === "all" || k.name === areaState.kab; });
  const kecSelect = document.getElementById("area-kec");
  kecSelect.innerHTML = '<option value="all">Semua Kecamatan</option>' + kabs.map(function (k) {
    return k.kecamatan.map(function (c) { return '<option value="' + escapeHtml(c.name) + '">' + escapeHtml(c.name) + " (" + escapeHtml(k.name) + ")</option>"; }).join("");
  }).join("");
  kecSelect.value = areaState.kec;

  document.getElementById("area-path").textContent = region.region.toUpperCase() + " → AREA: " + area.name.toUpperCase();
  document.getElementById("area-name").textContent = area.name;
  document.getElementById("area-status").innerHTML = areaStatusBadge(area.status_color, "Status: " + area.status);
  document.getElementById("area-target").textContent = "Rp " + area.target.toLocaleString("id-ID");
  document.getElementById("area-actual").textContent = "Rp " + area.actual.toLocaleString("id-ID");
  document.getElementById("area-achievement").textContent = area.achievement + "%";
  document.getElementById("area-growth").textContent = (area.growth > 0 ? "+" : "") + area.growth + "%";
  document.getElementById("area-ro").textContent = area.ro + "%";
  document.getElementById("area-roa").textContent = area.roa + "%";
  document.getElementById("area-ec").textContent = area.ec + "%";
  document.getElementById("area-progress").style.setProperty("--value", Math.min(area.achievement, 100) + "%");
  document.getElementById("area-table-title").textContent = "Breakdown outlet & coverage per kecamatan di " + area.name;
  document.getElementById("area-filter-label").textContent = "Filter: " + (areaState.kab === "all" ? "Semua" : areaState.kab) + " / " + (areaState.kec === "all" ? "Semua" : areaState.kec);

  const rows = [];
  for (const k of kabs) {
    for (const c of k.kecamatan) {
      if (areaState.kec !== "all" && c.name !== areaState.kec) continue;
      const rate = c.target_outlets ? c.actual_outlets / c.target_outlets * 100 : 0;
      const status = rate >= 90 ? '<span class="badge">Excellent</span>' : rate >= 75 ? '<span class="badge warning">Good</span>' : '<span class="badge danger">Low</span>';
      rows.push("<tr><td>" + escapeHtml(k.name) + "</td><td><strong>" + escapeHtml(c.name) + '</strong></td><td class="numeric mono">' + c.target_outlets + ' Toko</td><td class="numeric mono">' + c.actual_outlets +
        ' Toko</td><td class="numeric mono">' + (Math.round(rate * 10) / 10) + "%</td><td>" + status + "</td></tr>");
    }
  }
  document.getElementById("area-rows").innerHTML = rows.join("") || '<tr><td class="table-empty" colspan="6">Tidak ada kecamatan.</td></tr>';
}

document.addEventListener("DOMContentLoaded", initDrill);
initArea();

/* ---------- Angka langsung di grafik (tanpa perlu hover) ---------- */
function compactNumber(v) {
  const a = Math.abs(v);
  if (a >= 1e9) return (v / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 2 }) + " M";
  if (a >= 1e6) return (v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " jt";
  if (a >= 1e5) return (v / 1e3).toLocaleString("id-ID", { maximumFractionDigits: 0 }) + " rb";
  return Number(v).toLocaleString("id-ID", { maximumFractionDigits: 2 });
}

const valueLabelPlugin = {
  id: "valueLabels",
  afterDatasetsDraw: function (chart, _args, opts) {
    if (opts && opts.display === false) return;
    const ctx = chart.ctx;
    const horizontal = chart.options.indexAxis === "y";
    const fmt = (opts && opts.format) || compactNumber;
    ctx.save();
    ctx.font = "600 11px 'Segoe UI', Arial, sans-serif";
    chart.data.datasets.forEach(function (ds, di) {
      if (ds.valueLabel === false || !chart.isDatasetVisible(di)) return;
      const meta = chart.getDatasetMeta(di);
      if (meta.type === "doughnut" || meta.type === "pie") {
        const total = ds.data.reduce(function (s, v) { return s + (Number(v) || 0); }, 0);
        meta.data.forEach(function (arc, i) {
          const v = Number(ds.data[i]) || 0;
          if (!total || v / total < .05) return;
          const p = arc.tooltipPosition();
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(fmt(v), p.x, p.y);
        });
        return;
      }
      if (meta.type !== "bar") return;
      const stacked = !!ds.stack;
      meta.data.forEach(function (bar, i) {
        const v = Number(ds.data[i]);
        if (!v) return;
        const text = fmt(v);
        const w = ctx.measureText(text).width;
        if (stacked) {
          const size = horizontal ? Math.abs(bar.x - bar.base) : Math.abs(bar.base - bar.y);
          if (size < (horizontal ? w + 6 : 14)) return;
          ctx.fillStyle = "#fff";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(text, horizontal ? (bar.x + bar.base) / 2 : bar.x, horizontal ? bar.y : (bar.y + bar.base) / 2);
          return;
        }
        ctx.fillStyle = "#0f172a";
        if (horizontal) {
          ctx.textAlign = "left";
          ctx.textBaseline = "middle";
          ctx.fillText(text, bar.x + 4, bar.y);
        } else {
          ctx.textAlign = "center";
          ctx.textBaseline = "bottom";
          ctx.fillText(text, bar.x, bar.y - 3);
        }
      });
    });
    ctx.restore();
  }
};
if (window.Chart) Chart.register(valueLabelPlugin);

// Ruang di ujung batang supaya angka tidak terpotong.
function labelRoom(options) {
  const horizontal = options.indexAxis === "y";
  options.layout = { padding: horizontal ? { right: 44 } : { top: 18 } };
  return options;
}

/* ---------- Grafik Admin Pusat ---------- */
function drawAdminChart(canvas) {
  const cfg = JSON.parse(canvas.dataset.adminChart);
  const donut = cfg.type === "doughnut";
  const horizontal = cfg.axis === "y";
  const card = canvas.closest(".card");
  const options = {
    responsive: true,
    maintainAspectRatio: false,
    animation: false,
    indexAxis: horizontal ? "y" : "x",
    plugins: {
      legend: cfg.legend ? { position: cfg.legend, align: "end", labels: { boxWidth: 10, color: "#334155", font: { size: 12 } } } : { display: false },
      valueLabels: cfg.labelUnit ? { format: function (v) { return Number(v).toLocaleString("id-ID", { maximumFractionDigits: 2 }) + cfg.labelUnit; } } : {}
    },
    onHover: function (event, elements) {
      event.native.target.style.cursor = elements.length && cfg.clickHref ? "pointer" : (card && card.dataset.href ? "pointer" : "default");
    },
    onClick: function (_event, elements) {
      if (elements.length && cfg.clickHref) {
        const i = elements[0].index;
        location.href = cfg.clickHref.replace("{i}", cfg.clickValues ? cfg.clickValues[i] : i);
        return;
      }
      if (card && card.dataset.href) location.href = card.dataset.href;
    }
  };
  if (donut) options.cutout = "62%";
  else {
    const valueAxis = { beginAtZero: true, max: cfg.yMax, ticks: { color: "#475569", font: { size: 11 } }, grid: { color: "#eef2f7" } };
    const catAxis = { grid: { display: false }, ticks: { color: "#1e293b", font: { size: 12 } } };
    options.scales = horizontal ? { x: valueAxis, y: catAxis } : { x: catAxis, y: valueAxis };
    labelRoom(options);
  }
  createChart(canvas, { type: cfg.type, data: { labels: cfg.labels, datasets: cfg.datasets }, options: options });
}

function drawAdminCharts() {
  for (const canvas of document.querySelectorAll("canvas[data-admin-chart]")) drawAdminChart(canvas);
}

// Ganti data grafik (mis. setelah filter berubah).
function refreshAdminChart(canvas, cfg) {
  canvas.dataset.adminChart = JSON.stringify(cfg);
  drawAdminChart(canvas);
}

// Kartu yang bisa diklik (data-href): klik di mana saja selain tautan, grafik, atau peta.
document.addEventListener("click", function (event) {
  const card = event.target.closest(".card-click[data-href]");
  if (!card || event.target.closest("a, button, select, input, canvas, .sales-map")) return;
  location.href = card.dataset.href;
});
document.addEventListener("keydown", function (event) {
  if (event.key !== "Enter") return;
  const card = event.target.closest && event.target.closest(".card-click[data-href]");
  if (card && event.target === card) location.href = card.dataset.href;
});

// Baris tabel yang bisa diklik
document.addEventListener("click", function (event) {
  const row = event.target.closest("tr[data-href]");
  if (row && !event.target.closest("a, button")) location.href = row.dataset.href;
});

drawAdminCharts();

/* ---------- Detail Sales & Detail Outlet (dibaca dari ?npk= / ?code=) ---------- */
function rupiahFull(value) {
  return "Rp " + Number(value).toLocaleString("id-ID");
}

function roBadge(status) {
  const cls = status === "Inactive" ? "danger" : status === "Warning" ? "warning" : "";
  return '<span class="badge ' + cls + '">' + escapeHtml(status) + "</span>";
}

function definitionList(pairs) {
  return pairs.map(function (p) { return "<div><dt>" + p[0] + "</dt><dd>" + p[1] + "</dd></div>"; }).join("");
}

function initSalesDetail() {
  const source = document.getElementById("sales-detail-data");
  if (!source) return;
  const data = JSON.parse(source.textContent);
  const npk = new URLSearchParams(location.search).get("npk") || data.sales[0].npk;
  const s = data.sales.find(function (x) { return x.npk === npk; });
  if (!s) {
    document.getElementById("page-title").textContent = "Sales tidak ditemukan";
    document.getElementById("page-description").textContent = "NPK " + npk + " tidak ada di data.";
    document.getElementById("sales-detail").hidden = true;
    return;
  }
  document.title = "Detail Sales - " + s.name + " | Teh Dandang ADMIN PUSAT";
  document.getElementById("page-title").textContent = s.name + " (NPK: " + s.npk + ")";
  document.getElementById("breadcrumb").textContent = "Detail Sales";
  document.getElementById("page-description").textContent = "SAP SlpCode: " + s.slp_code + " · Area: " + s.area + " (" + s.region + ")";
  document.getElementById("sd-actual").textContent = rupiahFull(s.actual);
  document.getElementById("sd-ach").textContent = "Achievement: " + s.achievement + "% dari target " + rupiahFull(s.target);
  document.getElementById("sd-ro").textContent = s.ro_rate + "%";
  document.getElementById("sd-roa").textContent = s.roa_rate + "%";
  document.getElementById("sd-ec").textContent = s.ec_rate + "%";
  const outlets = data.outlets.filter(function (o) { return o.sales_name.toLowerCase() === s.name.toLowerCase(); });
  document.getElementById("sd-count").textContent = outlets.length + " Outlets";
  document.getElementById("sd-profile").innerHTML = definitionList([
    ["ASM Supervisor", escapeHtml(s.asm)], ["Manager", escapeHtml(s.manager)], ["Nomor Telepon", escapeHtml(s.phone)],
    ["Plat Kendaraan", escapeHtml(s.vehicle_plate)], ["Status", escapeHtml(s.status)], ["Jumlah Outlet Assigned", outlets.length + " Outlets"]
  ]);
  document.getElementById("sd-outlets").innerHTML = outlets.map(function (o) {
    return '<tr><td class="mono">' + o.card_code + "</td><td><strong>" + escapeHtml(o.card_name) + '</strong></td><td><span class="badge neutral">' + o.market + "</span></td><td>" +
      escapeHtml(o.address) + "</td><td>" + roBadge(o.ro_status) + '</td><td><a class="detail-button" href="outlet-detail.html?code=' + o.card_code + '">Lihat</a></td></tr>';
  }).join("") || '<tr><td class="table-empty" colspan="6">Belum ada outlet yang di-assign ke sales ini.</td></tr>';
}

function initOutletDetail() {
  const source = document.getElementById("outlet-detail-data");
  if (!source) return;
  const data = JSON.parse(source.textContent);
  const code = new URLSearchParams(location.search).get("code") || data.outlets[0].card_code;
  const o = data.outlets.find(function (x) { return x.card_code === code; });
  if (!o) {
    document.getElementById("page-title").textContent = "Outlet tidak ditemukan";
    document.getElementById("page-description").textContent = "CardCode " + code + " tidak ada di data.";
    document.getElementById("outlet-detail").hidden = true;
    return;
  }
  document.title = "Detail Outlet - " + o.card_name + " | Teh Dandang ADMIN PUSAT";
  document.getElementById("page-title").textContent = o.card_name;
  document.getElementById("breadcrumb").textContent = "Detail Outlet";
  document.getElementById("page-description").textContent = "SAP CardCode: " + o.card_code + " · Market: " + o.market + " · Sales: " + o.sales_name;
  document.getElementById("od-ro").innerHTML = roBadge("RO Status: " + o.ro_status).replace('class="badge "', 'class="badge ' + (o.ro_status === "Inactive" ? "danger" : o.ro_status === "Warning" ? "warning" : "") + '"');
  document.getElementById("od-profile").innerHTML = definitionList([
    ["CardType", o.card_type], ["GroupCode", o.group_code], ["SlpCode Sales", o.slp_code + " (" + escapeHtml(o.sales_name) + ")"],
    ["Telepon / Email", escapeHtml(o.phone) + "<br/>" + escapeHtml(o.email)], ["Alamat Lengkap", escapeHtml(o.address + ", " + o.kecamatan + ", " + o.city)],
    ["Last Order Date", o.last_order_date], ["Jumlah RO", o.ro_count + "x"]
  ]);
  document.getElementById("od-map-name").textContent = o.card_name;
  document.getElementById("od-map-coord").textContent = "Lat: " + o.latitude + " | Lng: " + o.longitude;
  document.getElementById("od-map-link").href = "https://www.google.com/maps?q=" + o.latitude + "," + o.longitude;
  document.getElementById("od-skus").innerHTML = o.products_purchased.map(function (sku) {
    const p = data.products.find(function (x) { return x.item_code === sku; });
    return "<li><span><strong>" + escapeHtml(p ? p.item_name : "Teh Dandang Active Item") + '</strong><span class="subtext mono">SKU Code: ' + sku + '</span></span><span class="badge">Active</span></li>';
  }).join("");
  const orders = data.orders.filter(function (x) { return x.card_code === o.card_code; });
  document.getElementById("od-orders").innerHTML = orders.map(function (x) {
    return '<tr><td class="mono">#' + x.doc_num + '</td><td class="mono">' + x.sap_doc_entry + '</td><td class="mono">' + x.doc_date + "</td><td>" + escapeHtml(x.slp_name) +
      '</td><td class="numeric">' + rupiahFull(x.subtotal) + '</td><td class="numeric"><strong>' + rupiahFull(x.doc_total) + '</strong></td><td><span class="badge">' + escapeHtml(x.sap_status) + "</span></td></tr>";
  }).join("") || '<tr><td class="table-empty" colspan="7">Belum ada sales order untuk outlet ini.</td></tr>';
}

initSalesDetail();
initOutletDetail();

// Sembunyikan kolom pencarian di halaman yang tidak punya tabel untuk dicari.
if (!document.querySelector("table[data-filterable]") && !document.getElementById("drill-data") && !document.getElementById("live-map")) {
  const toolbar = document.querySelector(".toolbar");
  if (toolbar) toolbar.hidden = true;
}

/* ---------- Peta persebaran sales (Leaflet) ---------- */
function achColor(ach) {
  return ach >= 90 ? "#10b981" : ach >= 75 ? "#f59e0b" : "#ef4444";
}

function initSalesMap() {
  const el = document.getElementById("sales-map");
  const source = document.getElementById("sales-map-data");
  if (!el || !source) return;
  if (typeof L === "undefined") {
    el.querySelector(".map-fallback").textContent = "Peta tidak dapat dimuat (perlu koneksi internet). Data tetap ada di tabel saat kartu diperbesar.";
    return;
  }
  const regions = JSON.parse(source.textContent);
  el.innerHTML = "";
  const map = L.map(el, { scrollWheelZoom: false, attributionControl: true });
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18,
    attribution: "&copy; OpenStreetMap"
  }).addTo(map);
  const points = [];
  for (const r of regions) {
    const color = achColor(r.ach);
    const marker = L.circleMarker([r.lat, r.lng], {
      radius: 8 + r.sales / 25, color: color, weight: 2, fillColor: color, fillOpacity: .35
    }).addTo(map);
    marker.bindTooltip(r.code + " · " + r.ach + "%", { permanent: true, direction: "top", className: "map-label" });
    marker.bindPopup("<strong>" + escapeHtml(r.name) + "</strong><br/>Achievement: <b>" + r.ach + "%</b><br/>Sales online: " + r.online + " / " + r.sales +
      "<br/>Visit: " + r.visit + "% · New Outlet: " + r.outlet + "%<br/>Score: " + r.score);
    points.push([r.lat, r.lng]);
  }
  window.salesMap = map;
  window.salesMapBounds = L.latLngBounds(points);
  map.fitBounds(window.salesMapBounds, { padding: [30, 30] });
}

document.addEventListener("DOMContentLoaded", initSalesMap);

