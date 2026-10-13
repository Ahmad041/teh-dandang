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
  const data = JSON.parse(source.textContent);
  window.drillDefaultSku = data.defaultSku;
  window.drillState = [data.tree];
  renderDrill();
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
  document.getElementById("drill-status").textContent = lowest ? "Level terbawah (Produk SKU)" : "Level " + depth + " (bisa diklik)";
  document.getElementById("drill-chart-title").textContent = "Grafik Penjualan: " + node.title;
  document.getElementById("drill-instruction").textContent = lowest
    ? "Ini adalah level terbawah (Rincian Produk SKU). Anda sudah melihat detail paling spesifik."
    : "Klik batang grafik atau tombol Drill Down untuk masuk ke level " + (depth + 1) + ".";

  for (const button of document.querySelectorAll("[data-drill-type]")) button.setAttribute("aria-pressed", button.dataset.drillType === drillChartType);

  const searchInput = document.getElementById("search");
  const keyword = searchInput ? searchInput.value.toLowerCase().trim() : "";
  const rows = items.filter(function (i) { return i.label.toLowerCase().includes(keyword); });
  const body = document.getElementById("drill-rows");
  body.innerHTML = rows.map(function (i) {
    const growth = (i.growth > 0 ? "+" : "") + i.growth.toFixed(1) + "%";
    const action = lowest ? '<span class="subtext">Level terbawah</span>' : '<button class="detail-button" onclick="drillDown(' + escapeHtml(JSON.stringify(i.label)) + ')">Drill Down</button>';
    return '<tr class="drill-row"><td><strong>' + escapeHtml(i.label) + '</strong></td><td class="numeric">' + formatRupiah(i.target) + '</td><td class="numeric">' + formatRupiah(i.actual) +
      '</td><td class="numeric mono">' + i.achievement.toFixed(1) + '%</td><td class="numeric mono">' + growth + "</td><td>" + drillStatusBadge(i) + "</td><td>" + action + "</td></tr>";
  }).join("") || '<tr><td class="table-empty" colspan="7">Tidak ada data yang sesuai. Ubah kata pencarian.</td></tr>';

  const canvas = document.getElementById("drill-chart");
  const horizontal = drillChartType === "horizontal";
  const donut = drillChartType === "donut";
  const labels = items.map(function (i) { return i.label; });
  const colors = items.map(function (i) { return i.color || "#2563eb"; });
  const actual = items.map(function (i) { return i.actual / 1000000; });
  const target = items.map(function (i) { return i.target / 1000000; });
  const datasets = donut
    ? [{ label: "Realisasi (Juta Rp)", data: actual, backgroundColor: colors }]
    : [
      { label: "Realisasi (Juta Rp)", data: actual, backgroundColor: colors, borderRadius: 3, grouped: false, barPercentage: 0.42, order: 1 },
      { label: "Target (Juta Rp)", data: target, backgroundColor: "#dbe3ee", borderColor: "#bac8da", borderWidth: 1, borderRadius: 3, grouped: false, barPercentage: 0.65, order: 2 }
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
      const card = canvas.closest(".card");
      if (elements.length && !lowest) drillDown(labels[elements[0].index]);
      else if (!card.classList.contains("is-expanded")) expandChartCard(card);
    }
  };
  if (donut) options.cutout = "60%";
  else {
    const axis = { beginAtZero: true, ticks: { callback: function (v) { return "Rp " + v.toLocaleString("id-ID") + " Jt"; } } };
    options.scales = horizontal ? { x: axis } : { y: axis };
  }
  createChart(canvas, { type: donut ? "doughnut" : "bar", data: { labels: labels, datasets: datasets }, options: options });
  renderDrillExpandDetail(node, items, totalTarget, totalActual, lowest);
}

function renderDrillExpandDetail(node, items, totalTarget, totalActual, lowest) {
  const box = document.getElementById("drill-expand-detail");
  if (!box || !items.length) return;
  const sorted = items.slice().sort(function (a, b) { return b.achievement - a.achievement; });
  const best = sorted[0];
  const worst = sorted[sorted.length - 1];
  const below = items.filter(function (i) { return i.achievement < 100; });
  const pct = totalTarget ? totalActual / totalTarget * 100 : 0;
  const note = node.title + ": realisasi " + formatRupiah(totalActual) + " dari target " + formatRupiah(totalTarget) + " (" + pct.toFixed(1) + "%). " +
    best.label + " paling tinggi (" + best.achievement.toFixed(1) + "%)" + (items.length > 1 ? ", " + worst.label + " paling rendah (" + worst.achievement.toFixed(1) + "%)" : "") + ". " +
    (below.length ? below.length + " dari " + items.length + " item masih di bawah target." : "Semua item sudah mencapai target.");
  const stats = [["Total target", formatRupiah(totalTarget)], ["Total realisasi", formatRupiah(totalActual)], ["Capaian", pct.toFixed(1) + "%"],
    ["Selisih", (totalActual >= totalTarget ? "+" : "−") + formatRupiah(Math.abs(totalActual - totalTarget))], ["Tertinggi", best.label], ["Di bawah target", below.length + " item"]];
  const rows = items.map(function (i) {
    const share = totalActual ? i.actual / totalActual * 100 : 0;
    const gap = i.actual - i.target;
    const action = lowest ? "" : '<button class="detail-button" onclick="drillDown(' + escapeHtml(JSON.stringify(i.label)) + ')">Drill Down</button>';
    return '<tr><td><span class="swatch" style="background:' + (i.color || "#2563eb") + '"></span><strong>' + escapeHtml(i.label) + '</strong></td><td class="numeric">' + formatRupiah(i.target) +
      '</td><td class="numeric">' + formatRupiah(i.actual) + '</td><td class="numeric mono">' + (gap >= 0 ? "+" : "−") + formatRupiah(Math.abs(gap)) +
      '</td><td class="numeric mono">' + share.toFixed(1) + '%</td><td>' + drillStatusBadge(i) + ' <span class="mono">' + i.achievement.toFixed(1) + '%</span></td><td class="numeric mono">' +
      (i.growth > 0 ? "+" : "") + i.growth.toFixed(1) + "%</td><td>" + action + "</td></tr>";
  }).join("");
  box.innerHTML = '<p class="expand-note">' + escapeHtml(note) + "</p>" +
    '<div class="popup-stats expand-stats">' + stats.map(function (s) { return "<div><span>" + s[0] + "</span><strong>" + escapeHtml(s[1]) + "</strong></div>"; }).join("") + "</div>" +
    '<span class="popup-label">Data level ' + escapeHtml(node.levelName) + " (" + items.length + " item)</span>" +
    '<div class="table-scroll"><table><thead><tr><th scope="col">Nama</th><th scope="col">Target</th><th scope="col">Realisasi</th><th scope="col">Selisih</th><th scope="col">Porsi</th><th scope="col">Capaian</th><th scope="col">Growth</th><th scope="col">Aksi</th></tr></thead><tbody>' +
    rows + "</tbody></table></div>";
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

initDrill();
initArea();

/* ---------- Grafik Executive (legend & center label seperti versi PHP) ---------- */
function drawAdminCharts() {
  for (const canvas of document.querySelectorAll("canvas[data-admin-chart]")) {
    const cfg = JSON.parse(canvas.dataset.adminChart);
    const donut = cfg.type === "doughnut";
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: cfg.legend ? { position: cfg.legend, align: "end", labels: { boxWidth: 10, font: { size: 10 } } } : { display: false } },
      onClick: function (_event, elements) {
        const card = canvas.closest(".card");
        if (!card.classList.contains("is-expanded")) expandChartCard(card);
        else if (cfg.popup && elements.length) openPopup(cfg.popup);
      }
    };
    if (donut) options.cutout = "72%";
    else options.scales = {
      x: { grid: { display: false }, ticks: { font: { size: 10 } } },
      y: { beginAtZero: true, max: cfg.yMax, ticks: { font: { size: 10 } }, grid: { color: "#f1f5f9" } }
    };
    createChart(canvas, { type: cfg.type, data: { labels: cfg.labels, datasets: cfg.datasets }, options: options });
  }
}

function kpiKey(event, key) {
  if (event.key === "Enter" || event.key === " ") {
    event.preventDefault();
    openPopup(key);
  }
}

drawAdminCharts();
setupExpandableCharts();

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
if (!document.querySelector("table[data-filterable]") && !document.getElementById("drill-data")) {
  const toolbar = document.querySelector(".toolbar");
  if (toolbar) toolbar.hidden = true;
}

/* ---------- Klik grafik: kartu membesar + detail + tabel data ---------- */
function formatChartValue(value, unit) {
  const text = Number(value).toLocaleString("id-ID", { maximumFractionDigits: 2 });
  return unit === "Miliar Rp" ? "Rp " + text + " M" : unit === "% bobot" ? text + "%" : text + (unit ? " " + unit : "");
}

function buildChartDetail(cfg) {
  const unit = cfg.unit || "";
  const labels = cfg.labels;
  const sets = cfg.datasets;
  let stats = [];
  let head = "<th scope=\"col\">Label</th>";
  let rows = "";

  if (cfg.type === "doughnut") {
    const data = sets[0].data;
    const total = data.reduce(function (a, b) { return a + b; }, 0);
    const maxIndex = data.indexOf(Math.max.apply(null, data));
    stats = [["Total", formatChartValue(total, unit)], ["Terbesar", labels[maxIndex]], ["Porsi terbesar", (data[maxIndex] / total * 100).toFixed(1) + "%"]];
    head += "<th scope=\"col\">Nilai</th><th scope=\"col\">Porsi</th>";
    rows = labels.map(function (label, i) {
      return '<tr><td><span class="swatch" style="background:' + sets[0].backgroundColor[i] + '"></span>' + escapeHtml(label) + '</td><td class="numeric mono">' +
        formatChartValue(data[i], unit) + '</td><td class="numeric mono">' + (data[i] / total * 100).toFixed(1) + "%</td></tr>";
    }).join("");
  } else {
    const actual = sets[0].data;
    const target = cfg.targetIndex !== undefined ? sets[cfg.targetIndex].data : null;
    const sum = actual.reduce(function (a, b) { return a + b; }, 0);
    const maxIndex = actual.indexOf(Math.max.apply(null, actual));
    const minIndex = actual.indexOf(Math.min.apply(null, actual));
    const last = actual.length - 1;
    stats = [["Total " + sets[0].label, formatChartValue(sum, unit)], ["Rata-rata", formatChartValue(sum / actual.length, unit)],
      ["Tertinggi", labels[maxIndex] + " · " + formatChartValue(actual[maxIndex], unit)], ["Terendah", labels[minIndex] + " · " + formatChartValue(actual[minIndex], unit)]];
    if (target) stats.push(["Pencapaian " + labels[last], (actual[last] / target[last] * 100).toFixed(1) + "%"]);
    head += sets.map(function (d) { return '<th scope="col">' + escapeHtml(d.label) + "</th>"; }).join("");
    if (target) head += '<th scope="col">Capaian</th>';
    rows = labels.map(function (label, i) {
      let cells = sets.map(function (d) { return '<td class="numeric mono">' + formatChartValue(d.data[i], unit) + "</td>"; }).join("");
      if (target) {
        const pct = actual[i] / target[i] * 100;
        cells += '<td><span class="badge ' + (pct >= 100 ? "" : pct >= 90 ? "warning" : "danger") + '">' + pct.toFixed(1) + "%</span></td>";
      }
      return "<tr><td><strong>" + escapeHtml(label) + "</strong></td>" + cells + "</tr>";
    }).join("");
  }

  const statHtml = stats.map(function (s) { return "<div><span>" + s[0] + "</span><strong>" + escapeHtml(s[1]) + "</strong></div>"; }).join("");
  return '<div class="expand-detail" hidden>' +
    (cfg.detail ? '<p class="expand-note">' + escapeHtml(cfg.detail) + "</p>" : "") +
    '<div class="popup-stats expand-stats">' + statHtml + "</div>" +
    '<span class="popup-label">Data grafik' + (unit ? " (" + unit + ")" : "") + "</span>" +
    '<div class="table-scroll"><table><thead><tr>' + head + "</tr></thead><tbody>" + rows + "</tbody></table></div>" +
    (cfg.popup ? '<div class="card-link"><button class="detail-button" onclick=\'openPopup("' + cfg.popup + '")\'>Lihat detail lengkap</button></div>' : "") +
    "</div>";
}

function setupExpandableCharts() {
  for (const canvas of document.querySelectorAll("canvas[data-admin-chart]")) {
    const card = canvas.closest(".card");
    if (!card || card.dataset.expandReady) continue;
    const cfg = JSON.parse(canvas.dataset.adminChart);
    card.dataset.expandReady = "true";
    card.classList.add("chart-card");
    card.insertAdjacentHTML("afterbegin",
      '<button type="button" class="expand-toggle" aria-label="Perbesar grafik dan tampilkan data" onclick="toggleChartCard(this.closest(\'.card\'))">' +
      '<span class="expand-open">Perbesar</span><span class="expand-close">Tutup ✕</span></button>');
    card.insertAdjacentHTML("beforeend", buildChartDetail(cfg));
    canvas.title = "Klik untuk memperbesar dan melihat data";
  }
  const drillCanvas = document.getElementById("drill-chart");
  const drillCard = drillCanvas && drillCanvas.closest(".card");
  if (drillCard && !drillCard.dataset.expandReady) {
    drillCard.dataset.expandReady = "true";
    drillCard.classList.add("chart-card", "always-toggle");
    drillCard.insertAdjacentHTML("afterbegin",
      '<button type="button" class="expand-toggle" aria-label="Perbesar grafik dan tampilkan data" onclick="toggleChartCard(this.closest(\'.card\'))">' +
      '<span class="expand-open">Perbesar</span><span class="expand-close">Tutup ✕</span></button>');
    drillCanvas.title = "Klik batang untuk drill down, klik area kosong untuk memperbesar";
  }
  const mapEl = document.getElementById("sales-map");
  const mapCard = mapEl && mapEl.closest(".card");
  if (mapCard && !mapCard.dataset.expandReady) {
    mapCard.dataset.expandReady = "true";
    mapCard.classList.add("chart-card");
    mapCard.insertAdjacentHTML("afterbegin",
      '<button type="button" class="expand-toggle" aria-label="Perbesar peta dan tampilkan data" onclick="toggleChartCard(this.closest(\'.card\'))">' +
      '<span class="expand-open">Perbesar</span><span class="expand-close">Tutup ✕</span></button>');
  }
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
  map.on("click", function () {
    const card = el.closest(".card");
    if (!card.classList.contains("is-expanded")) expandChartCard(card);
  });
}

document.addEventListener("DOMContentLoaded", initSalesMap);

function toggleChartCard(card) {
  if (card.classList.contains("is-expanded")) collapseChartCard(card);
  else expandChartCard(card);
}

function resizeChartsIn(card, showLegend) {
  const drillCanvas = card.querySelector("#drill-chart");
  if (drillCanvas && chartInstances.get(drillCanvas)) chartInstances.get(drillCanvas).resize();
  if (window.salesMap && card.contains(document.getElementById("sales-map"))) {
    window.salesMap.invalidateSize();
    window.salesMap.fitBounds(window.salesMapBounds, { padding: [30, 30] });
  }
  for (const canvas of card.querySelectorAll("canvas[data-admin-chart]")) {
    const chart = chartInstances.get(canvas);
    if (!chart) continue;
    const cfg = JSON.parse(canvas.dataset.adminChart);
    chart.options.plugins.legend = showLegend && cfg.type !== "doughnut"
      ? { display: true, position: "top", labels: { boxWidth: 12, font: { size: 12 } } }
      : (cfg.legend ? { position: cfg.legend, align: "end", labels: { boxWidth: 10, font: { size: 10 } } } : { display: false });
    chart.resize();
    chart.update();
  }
}

function expandChartCard(card) {
  const open = document.querySelector(".card.is-expanded");
  if (open && open !== card) collapseChartCard(open);
  let backdrop = document.getElementById("expand-backdrop");
  if (!backdrop) {
    backdrop = document.createElement("div");
    backdrop.id = "expand-backdrop";
    backdrop.className = "expand-backdrop";
    backdrop.addEventListener("click", function () {
      const current = document.querySelector(".card.is-expanded");
      if (current) collapseChartCard(current);
    });
    document.body.appendChild(backdrop);
  }
  backdrop.hidden = false;
  card.classList.add("is-expanded");
  card.querySelector(".expand-detail").hidden = false;
  document.body.classList.add("has-expanded-card");
  requestAnimationFrame(function () { resizeChartsIn(card, true); });
  if (window.salesMap && card.contains(document.getElementById("sales-map"))) window.salesMap.scrollWheelZoom.enable();
  card.querySelector(".expand-toggle").focus();
}

function collapseChartCard(card) {
  card.classList.remove("is-expanded");
  card.querySelector(".expand-detail").hidden = true;
  const backdrop = document.getElementById("expand-backdrop");
  if (backdrop) backdrop.hidden = true;
  document.body.classList.remove("has-expanded-card");
  requestAnimationFrame(function () { resizeChartsIn(card, false); });
  if (window.salesMap && card.contains(document.getElementById("sales-map"))) window.salesMap.scrollWheelZoom.disable();
}

document.addEventListener("keydown", function (event) {
  if (event.key !== "Escape") return;
  if (document.getElementById("detail-dialog") && document.getElementById("detail-dialog").open) return;
  const current = document.querySelector(".card.is-expanded");
  if (current) collapseChartCard(current);
});
