// JavaScript hanya untuk pencarian, popup, chart, dan drilldown.
const chartInstances = new Map();
let chartType = "vertical";

function searchTables() {
  const keyword = document.getElementById("search").value.toLowerCase().trim();
  const tables = document.querySelectorAll("table[data-filterable]");

  for (const table of tables) {
    if (keyword && table.closest('details')) table.closest('details').open = true;
    const rows = table.querySelectorAll("tbody tr:not(.filter-empty)");
    let total = 0;

    for (const row of rows) {
      const text = row.textContent.replace(/\s+/g, " ").toLowerCase();
      row.hidden = !text.includes(keyword);
      if (!row.hidden) total++;
    }

    table.querySelector(".filter-empty").hidden = total > 0;
  }
}

function openPopup(name) {
  const templates = document.querySelectorAll("template[data-popup]");

  for (const template of templates) {
    if (template.dataset.popup === name) {
      document.getElementById("dialog-title").textContent = template.dataset.title;
      document.getElementById("dialog-content").innerHTML = template.innerHTML;
      document.getElementById("detail-dialog").showModal();
      break;
    }
  }
}

function closePopup() {
  document.getElementById("detail-dialog").close();
}

function createChart(canvas, settings) {
  if (typeof Chart === "undefined") {
    canvas.parentElement.querySelector("[data-chart-error]").hidden = false;
    const details = canvas.closest(".card").querySelector(".chart-data");
    if (details) details.open = true;
    return;
  }

  const previous = chartInstances.get(canvas);
  if (previous) previous.destroy();
  chartInstances.set(canvas, new Chart(canvas, settings));
}

function drawMonthlyChart() {
  const canvas = document.querySelector('canvas[data-chart-kind="monthly"]');
  if (!canvas) return;

  const data = JSON.parse(canvas.dataset.chart);
  const card = canvas.closest(".card");
  const period = card.querySelector("[data-chart-period]").value;
  let start = 0;
  let end = 12;

  if (period === "ytd") end = 10;
  if (period === "quarter") {
    start = 6;
    end = 9;
  }

  const tableRows = card.querySelectorAll("[data-chart-table] tbody tr");
  for (let i = 0; i < tableRows.length; i++) {
    tableRows[i].hidden = i < start || i >= end;
  }

  createChart(canvas, {
    type: "bar",
    data: {
      labels: data.months.slice(start, end),
      datasets: [
        {
          label: "Target / Plan",
          data: data.plan.slice(start, end),
          backgroundColor: "#dbe3ee",
          borderRadius: 3,
          grouped: false,
          barPercentage: 0.65,
          order: 2
        },
        {
          label: "Realisasi / Actual",
          data: data.actual.slice(start, end),
          backgroundColor: "#2563eb",
          borderRadius: 3,
          grouped: false,
          barPercentage: 0.42,
          order: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: "index", intersect: false },
      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            label: function (item) {
              return item.dataset.label + ": Rp " + item.parsed.y.toFixed(2) + " M";
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false } },
        y: {
          beginAtZero: true,
          ticks: {
            callback: function (value) { return "Rp " + value + " M"; }
          }
        }
      }
    }
  });
}

function showDrill(name) {
  const nodes = document.querySelectorAll(".drill-node");
  for (const node of nodes) node.hidden = node.dataset.drillNode !== name;
  drawDrillChart();
  const selected = document.querySelector(".drill-node:not([hidden])");
  if (selected) selected.querySelector(".drill-breadcrumbs button:last-of-type").focus();
}

function changeChartType(type) {
  chartType = type;
  drawDrillChart();
}

function drillNumbers(row, product) {
  if (product === "all" || !row.products) return row;
  return row.products[Number(product)];
}

function openDrillProduct(key) {
  openPopup(key);
  const node = document.querySelector(".drill-node:not([hidden])");
  const rows = JSON.parse(node.querySelector("canvas").dataset.chart);
  for (const row of rows) {
    if (row.key === key) {
      document.getElementById("popup-product-units").textContent = row.units.toLocaleString("id-ID") + " unit";
      document.getElementById("popup-product-actual").textContent = "Rp " + row.actual.toLocaleString("id-ID");
      document.getElementById("popup-product-target").textContent = "Rp " + row.target.toLocaleString("id-ID");
    }
  }
}

function drawDrillChart() {
  const node = document.querySelector(".drill-node:not([hidden])");
  if (!node) return;
  const canvas = node.querySelector("canvas");
  const rows = JSON.parse(canvas.dataset.chart);
  const mode = document.getElementById("drill-mode").value;
  const product = document.getElementById("drill-product").value;
  const terminal = canvas.dataset.terminal === "true";
  const labels = [];
  const actual = [];
  const target = [];
  const keys = [];
  const colors = [];
  const borders = [];
  const tableRows = node.querySelectorAll("[data-drill-row]");

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const hidden = terminal && product !== "all" && row.product !== Number(product);
    tableRows[i].hidden = hidden;
    if (hidden) continue;
    const values = drillNumbers(row, product);
    labels.push(row.name);
    actual.push(mode === "units" ? values.units : values.actual);
    target.push(values.target);
    keys.push(row.key);
    colors.push(terminal ? row.color : "#2563eb");
    borders.push(terminal ? row.color : "transparent");
    tableRows[i].querySelector(".drill-target").textContent = "Rp " + values.target.toLocaleString("id-ID");
    tableRows[i].querySelector(".drill-actual").textContent = "Rp " + values.actual.toLocaleString("id-ID");
    tableRows[i].querySelector(".drill-units").textContent = values.units.toLocaleString("id-ID");
    tableRows[i].querySelector(".drill-achievement").textContent = (values.actual / values.target * 100).toFixed(1) + "%";
  }

  const totals = drillNumbers(JSON.parse(node.dataset.summary), product);
  node.querySelector('[data-total="target"]').textContent = "Rp " + (totals.target / 1000000).toFixed(2) + " Jt";
  node.querySelector('[data-total="actual"]').textContent = "Rp " + (totals.actual / 1000000).toFixed(2) + " Jt";
  node.querySelector('[data-total="units"]').textContent = totals.units.toLocaleString("id-ID") + " unit";
  node.querySelector(".drill-filter-summary").textContent = document.querySelector("#drill-mode option:checked").textContent + " · " + document.querySelector("#drill-product option:checked").textContent + " · Data demo";
  for (const button of node.querySelectorAll("[data-chart-type]")) button.setAttribute("aria-pressed", button.dataset.chartType === chartType);

  const datasets = [{ label: mode === "units" ? "Barang Terjual (Unit)" : "Realisasi (Rp)", data: actual, backgroundColor: colors, borderColor: borders, borderWidth: terminal ? 1.5 : 0, borderRadius: 3, grouped: false, barPercentage: 0.42, order: 1 }];
  if (mode === "revenue" && chartType !== "donut") datasets.push({ label: "Target (Rp)", data: target, backgroundColor: "#dbe3ee", borderColor: "#bac8da", borderWidth: 1, borderRadius: 3, grouped: false, barPercentage: 0.65, order: 2 });

  const settings = {
    type: chartType === "donut" ? "doughnut" : "bar",
    data: { labels: labels, datasets: datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      indexAxis: chartType === "horizontal" ? "y" : "x",
      plugins: {
        legend: { position: "top" },
        tooltip: { callbacks: { label: function (item) {
          let value = item.parsed.y;
          if (chartType === "horizontal") value = item.parsed.x;
          if (chartType === "donut") value = item.parsed;
          return item.dataset.label + ": " + (mode === "revenue" ? "Rp " : "") + value.toLocaleString("id-ID") + (mode === "units" ? " unit" : "");
        } } }
      },
      onClick: function (event, bars) {
        if (bars.length === 0) return;
        if (terminal) openDrillProduct(keys[bars[0].index]);
        else showDrill(keys[bars[0].index]);
      }
    }
  };
  if (chartType !== "donut") {
    const axis = { beginAtZero: true, ticks: { callback: function (value) {
      return mode === "units" ? value.toLocaleString("id-ID") : "Rp " + (value / 1000000).toFixed(1) + " Jt";
    } } };
    if (chartType === "horizontal") settings.options.scales = { x: axis };
    else settings.options.scales = { y: axis };
  }
  createChart(canvas, settings);
}

if (typeof Chart !== "undefined") {
  for (const details of document.querySelectorAll(".chart-data")) details.open = false;
}
drawMonthlyChart();
drawDrillChart();

function drawOverviewCharts() {
  for (const canvas of document.querySelectorAll('[data-overview-chart]')) {
    const data = JSON.parse(canvas.dataset.overviewChart);
    const donut = data.type === 'doughnut';
    const options = {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: { legend: { position: 'bottom' } },
      onClick: function (_event, elements) {
        if (data.keys && elements.length) openPopup(data.keys[elements[0].index]);
      }
    };
    if (donut) options.cutout = '65%';
    else {
      options.indexAxis = data.axis || 'x';
      options.scales = {
        [data.axis === 'y' ? 'x' : 'y']: { beginAtZero: true },
        [data.axis === 'y' ? 'y' : 'x']: { grid: { display: false } }
      };
    }
    createChart(canvas, { type: data.type, data: { labels: data.labels, datasets: data.datasets }, options });
  }
}
drawOverviewCharts();

// Universal Top-Right Profile Widget & Role Switcher (Tetap di Header, Tidak Melayang)
function setupTopRightProfile() {
  // 1. Bersihkan floating widget lama jika pernah terbuat di document.body agar tidak melayang
  const floatingWidget = document.getElementById('topRightProfileWidget');
  if (floatingWidget && floatingWidget.parentElement === document.body) {
    floatingWidget.remove();
  }

  // 2. Tentukan data path dan role aktif
  const path = decodeURIComponent(window.location.pathname).toLowerCase();
  const isSubFolder = path.includes('/dashboard');
  const prefix = isSubFolder ? '../' : '';

  const adminHref = prefix + 'dashboard ADMIN PUSAT/index.html';
  const gmHref = prefix + 'dashboard GM/index.html';
  const rsmHref = prefix + 'dashboard RSM/index.html';
  const asmHref = prefix + 'dashboard ASM/index.html';

  let roleKey = 'admin';
  let roleName = 'Dewan Direksi & Owner';
  let roleTitle = 'Owner / Admin Pusat';
  let avatar = 'OW';

  if (path.includes('dashboard gm')) {
    roleKey = 'gm';
    roleName = 'Ir. H. Gunawan W.';
    roleTitle = 'General Manager (GM)';
    avatar = 'GM';
  } else if (path.includes('dashboard rsm')) {
    roleKey = 'rsm';
    roleName = 'Bambang Trihatmodjo';
    roleTitle = 'RSM Jawa Tengah';
    avatar = 'RS';
  } else if (path.includes('dashboard asm')) {
    roleKey = 'asm';
    roleName = 'Hendra Kurniawan';
    roleTitle = 'ASM Solo Raya';
    avatar = 'AS';
  } else if (path.includes('dashboard owner')) {
    roleKey = 'owner';
    roleName = 'Bpk. Hadi Santoso';
    roleTitle = 'Owner / Komisaris';
    avatar = 'HS';
  }

  // 3. Cari container di header halaman yang sudah ada
  let container = document.getElementById('profileDropdownContainer');

  // Jika belum ada di HTML (misal sub-halaman khusus), taruh di header dalam flow halaman (bukan melayang)
  if (!container) {
    const headerHost = document.querySelector('.page-heading') ||
                       document.querySelector('.d-flex.justify-content-between') ||
                       document.querySelector('main header') ||
                       document.querySelector('main');
    if (!headerHost) return;

    container = document.createElement('div');
    container.id = 'profileDropdownContainer';
    container.className = 'position-relative';
    container.style.position = 'relative';

    container.innerHTML = `
      <button type="button" id="profileDropdownBtn" class="sidebar-profile-pill" aria-expanded="false" aria-haspopup="true">
        <span class="avatar-circle">${avatar}</span>
        <div class="profile-info">
          <strong>${roleName}</strong>
          <small>${roleTitle}</small>
        </div>
        <svg class="chevron-icon ms-1" width="16" height="16" fill="none" stroke="#ffffff" stroke-width="2.5" viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"></path></svg>
      </button>

      <!-- Dropdown Menu Pilih Role -->
      <div id="roleDropdownMenu" class="role-dropdown-card">
        <div class="px-2 py-2 border-bottom mb-1" style="border-bottom:1px solid #e2e8f0; margin-bottom:4px; padding-bottom:6px;">
          <div style="font-size: 10.5px; text-transform: uppercase; font-weight: 800; color: #94a3b8; letter-spacing: 0.5px;">Ganti Peran (Role)</div>
          <div style="font-size: 11.5px; color: #475569;">Pilih level akses manajemen:</div>
        </div>
        
        <a href="${adminHref}" class="role-menu-item ${roleKey === 'admin' || roleKey === 'owner' ? 'active' : ''}">
          <span class="role-avatar-badge" style="background: ${roleKey === 'admin' || roleKey === 'owner' ? '#9B1C1C' : '#f1f5f9'}; color: ${roleKey === 'admin' || roleKey === 'owner' ? '#fff' : '#334155'};">OW</span>
          <div class="flex-grow-1" style="flex-grow:1;">
            <strong style="font-size: 12.5px; display: block; color: ${roleKey === 'admin' || roleKey === 'owner' ? '#9B1C1C' : '#1e293b'};">Owner / Admin Pusat</strong>
            <small style="font-size: 11px; color: #64748b;">Direksi &amp; Konsolidasi Nasional</small>
          </div>
          ${roleKey === 'admin' || roleKey === 'owner' ? '<svg width="18" height="18" fill="none" stroke="#9B1C1C" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"></path></svg>' : ''}
        </a>

        <a href="${gmHref}" class="role-menu-item ${roleKey === 'gm' ? 'active' : ''}">
          <span class="role-avatar-badge" style="background: ${roleKey === 'gm' ? '#9B1C1C' : '#f1f5f9'}; color: ${roleKey === 'gm' ? '#fff' : '#334155'};">GM</span>
          <div class="flex-grow-1" style="flex-grow:1;">
            <strong style="font-size: 12.5px; display: block; color: ${roleKey === 'gm' ? '#9B1C1C' : '#1e293b'};">General Manager (GM)</strong>
            <small style="font-size: 11px; color: #64748b;">Agregat, ASM, Pareto &amp; Armada</small>
          </div>
          ${roleKey === 'gm' ? '<svg width="18" height="18" fill="none" stroke="#9B1C1C" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"></path></svg>' : ''}
        </a>

        <a href="${rsmHref}" class="role-menu-item ${roleKey === 'rsm' ? 'active' : ''}">
          <span class="role-avatar-badge" style="background: ${roleKey === 'rsm' ? '#9B1C1C' : '#f1f5f9'}; color: ${roleKey === 'rsm' ? '#fff' : '#334155'};">RS</span>
          <div class="flex-grow-1" style="flex-grow:1;">
            <strong style="font-size: 12.5px; display: block; color: ${roleKey === 'rsm' ? '#9B1C1C' : '#1e293b'};">Regional Sales Manager (RSM)</strong>
            <small style="font-size: 11px; color: #64748b;">Pengawasan 5 Region Operasional</small>
          </div>
          ${roleKey === 'rsm' ? '<svg width="18" height="18" fill="none" stroke="#9B1C1C" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"></path></svg>' : ''}
        </a>

        <a href="${asmHref}" class="role-menu-item ${roleKey === 'asm' ? 'active' : ''}">
          <span class="role-avatar-badge" style="background: ${roleKey === 'asm' ? '#9B1C1C' : '#f1f5f9'}; color: ${roleKey === 'asm' ? '#fff' : '#334155'};">AS</span>
          <div class="flex-grow-1" style="flex-grow:1;">
            <strong style="font-size: 12.5px; display: block; color: ${roleKey === 'asm' ? '#9B1C1C' : '#1e293b'};">Area Sales Manager (ASM)</strong>
            <small style="font-size: 11px; color: #64748b;">Operasional 90 Area, Toko &amp; Sales</small>
          </div>
          ${roleKey === 'asm' ? '<svg width="18" height="18" fill="none" stroke="#9B1C1C" stroke-width="2.5" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7"></path></svg>' : ''}
        </a>
      </div>
    `;
    headerHost.appendChild(container);
  }

  // 4. Inisialisasi event listener interaktif pada button dan menu
  const profileBtn = container.querySelector('#profileDropdownBtn') || document.getElementById('profileDropdownBtn');
  const roleMenu = container.querySelector('#roleDropdownMenu') || document.getElementById('roleDropdownMenu');

  if (profileBtn && roleMenu) {
    if (profileBtn.dataset.listenerAttached === 'true') return;
    profileBtn.dataset.listenerAttached = 'true';

    profileBtn.addEventListener('click', function (e) {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = roleMenu.classList.contains('show') || roleMenu.style.display === 'block';
      if (isOpen) {
        roleMenu.classList.remove('show');
        roleMenu.style.display = 'none';
        profileBtn.setAttribute('aria-expanded', 'false');
        const chevron = profileBtn.querySelector('.chevron-icon');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
      } else {
        roleMenu.classList.add('show');
        roleMenu.style.display = 'block';
        profileBtn.setAttribute('aria-expanded', 'true');
        const chevron = profileBtn.querySelector('.chevron-icon');
        if (chevron) chevron.style.transform = 'rotate(180deg)';
      }
    });

    // Delegasi klik pada semua link role di dalam dropdown agar PASTI berpindah halaman
    roleMenu.querySelectorAll('.role-menu-item').forEach(function(item) {
      item.addEventListener('click', function(e) {
        e.stopPropagation();
        const targetHref = this.getAttribute('href');
        if (targetHref && targetHref !== '#') {
          window.location.href = targetHref;
        }
      });
    });

    // Klik di luar menutup dropdown
    document.addEventListener('click', function (e) {
      if (!profileBtn.contains(e.target) && !roleMenu.contains(e.target)) {
        roleMenu.classList.remove('show');
        roleMenu.style.display = 'none';
        profileBtn.setAttribute('aria-expanded', 'false');
        const chevron = profileBtn.querySelector('.chevron-icon');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
      }
    });

    // Tombol ESC menutup dropdown
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') {
        roleMenu.classList.remove('show');
        roleMenu.style.display = 'none';
        profileBtn.setAttribute('aria-expanded', 'false');
        const chevron = profileBtn.querySelector('.chevron-icon');
        if (chevron) chevron.style.transform = 'rotate(0deg)';
      }
    });
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupTopRightProfile);
} else {
  setupTopRightProfile();
}

