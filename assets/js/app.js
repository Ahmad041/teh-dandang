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
