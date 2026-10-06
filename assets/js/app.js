// JavaScript hanya untuk pencarian, popup, chart, dan drilldown.
let currentChart = null;
let chartType = "vertical";

function searchTables() {
  const keyword = document.getElementById("search").value.toLowerCase().trim();
  const tables = document.querySelectorAll("table[data-filterable]");

  for (const table of tables) {
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

  if (currentChart) currentChart.destroy();
  currentChart = new Chart(canvas, settings);
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
          backgroundColor: "#d8e2dd",
          borderRadius: 3,
          grouped: false,
          barPercentage: 0.65,
          order: 2
        },
        {
          label: "Realisasi / Actual",
          data: data.actual.slice(start, end),
          backgroundColor: "#10a578",
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
  let selected = null;

  for (const node of nodes) {
    node.hidden = node.dataset.drillNode !== name;
    if (!node.hidden) selected = node;
  }

  if (!selected) return;
  if (currentChart) {
    currentChart.destroy();
    currentChart = null;
  }
  drawDrillChart();
  selected.querySelector(".drill-breadcrumbs button:last-of-type").focus();
}

function changeChartType(type) {
  chartType = type;
  drawDrillChart();
}

function drawDrillChart() {
  const node = document.querySelector(".drill-node:not([hidden])");
  if (!node) return;
  const canvas = node.querySelector("canvas");
  if (!canvas) return;

  const rows = JSON.parse(canvas.dataset.chart);
  const children = JSON.parse(canvas.dataset.children);
  const labels = [];
  const actual = [];
  const target = [];

  for (const row of rows) {
    labels.push(row.name);
    actual.push(row.actual);
    target.push(row.target);
  }

  for (const button of node.querySelectorAll("[data-chart-type]")) {
    button.setAttribute("aria-pressed", button.dataset.chartType === chartType);
  }

  const settings = {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        { label: "Realisasi (Miliar Rp)", data: actual, backgroundColor: ["#10b981", "#4f46e5", "#f59e0b", "#06b6d4"], borderRadius: 5 },
        { label: "Target (Miliar Rp)", data: target, backgroundColor: "#e2e8f0", borderColor: "#a3b5cc", borderWidth: 1, borderRadius: 5 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      indexAxis: "x",
      plugins: {
        legend: { position: "top" },
        tooltip: {
          callbacks: {
            label: function (item) {
              let value = item.parsed.y;
              if (chartType === "horizontal") value = item.parsed.x;
              if (chartType === "donut") value = item.parsed;
              return item.dataset.label + ": Rp " + value.toFixed(3) + " M";
            }
          }
        }
      },
      scales: { y: { beginAtZero: true } },
      onClick: function (event, bars) {
        if (bars.length > 0) showDrill(children[bars[0].index]);
      }
    }
  };

  if (chartType === "horizontal") {
    settings.options.indexAxis = "y";
    settings.options.scales = { x: { beginAtZero: true } };
  }

  if (chartType === "donut") {
    settings.type = "doughnut";
    settings.data.datasets = [settings.data.datasets[0]];
    delete settings.options.scales;
  }

  createChart(canvas, settings);
}

// Data tabel grafik tetap bisa dibuka lewat elemen details HTML.
if (typeof Chart !== "undefined") {
  for (const details of document.querySelectorAll(".chart-data")) details.open = false;
}
drawMonthlyChart();
drawDrillChart();
