// Live Tracking GPS (simulasi): posisi kendaraan sales bergerak di antara outlet rute hari ini.
(function () {
  if (!window.AF || !document.getElementById("live-map")) return;
  const AF = window.AF, D = AF.D;
  const PLATE = { R1: "AD", R2: "H", R3: "AB", R4: "L", R5: "B", R6: "BK", R7: "KT", R8: "DK", R9: "DD" };
  const TYPES = ["GrandMax", "Blindvan", "Canter Box", "Motor Box"];
  const STATUS = {
    moving: { label: "Bergerak", color: "#ED1B24", badge: "blue" },
    visit: { label: "Sedang kunjungan", color: "#10b981", badge: "" },
    idle: { label: "Diam", color: "#f59e0b", badge: "warning" },
    offline: { label: "Tidak terhubung", color: "#94a3b8", badge: "neutral" },
    offroute: { label: "Keluar rute", color: "#ef4444", badge: "danger" }
  };

  // satu kendaraan untuk setiap 4 sales (urut), rute = toko sales tsb
  let seed = 7;
  function rnd() { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }
  const vehicles = [];
  const LK = AF.LOCK;
  const inScope = function (s) { return (!LK.pulau || s.pulau === LK.pulau) && (!LK.region || s.region === LK.region) && (!LK.area || s.area === LK.area); };
  const every = LK.area ? 1 : LK.region ? 2 : 4; // area kecil: semua sales tampil
  D.sales.forEach(function (s, i) {
    if (!inScope(s) || i % every) return;
    const stops = D.outlets.filter(function (o) { return o.sales === s.id; });
    if (!stops.length) return;
    const r = rnd();
    const status = r < .5 ? "moving" : r < .72 ? "visit" : r < .84 ? "idle" : r < .93 ? "offline" : "offroute";
    vehicles.push({
      id: "V" + (i + 1), plate: PLATE[s.region] + " " + (1000 + Math.floor(rnd() * 8999)) + " TD", type: TYPES[Math.floor(rnd() * TYPES.length)],
      sales: s, region: s.region, stops: stops, leg: Math.floor(rnd() * (stops.length - 1)), t: rnd(), status: status,
      speed: 0, battery: 35 + Math.floor(rnd() * 64), trail: []
    });
  });

  function pos(v) {
    const a = v.stops[v.leg], b = v.stops[Math.min(v.leg + 1, v.stops.length - 1)];
    let lat = a.lat + (b.lat - a.lat) * v.t, lng = a.lng + (b.lng - a.lng) * v.t;
    if (v.status === "offroute") { lat += .06; lng += .05; }
    return [lat, lng];
  }

  function step() {
    for (const v of vehicles) {
      if (v.status === "moving" || v.status === "offroute") {
        v.t += .18 + rnd() * .12;
        v.speed = 20 + Math.floor(rnd() * 30);
        if (v.t >= 1) {
          v.t = 0;
          v.leg = Math.min(v.leg + 1, v.stops.length - 2);
          if (v.status === "moving" && rnd() < .35) v.status = "visit";
        }
      } else if (v.status === "visit") {
        v.speed = 0;
        if (rnd() < .3) v.status = "moving";
      } else v.speed = 0;
      v.trail.push(pos(v));
      if (v.trail.length > 30) v.trail.shift();
    }
  }

  let map, markers = {}, routeLayer, selected = null;
  const regionSel = document.getElementById("lt-region");
  const statusSel = document.getElementById("lt-status");
  if (LK.region) regionSel.closest(".filter-field").hidden = true;
  for (const pl of D.pulau.filter(function (p) { return !LK.pulau || p.code === LK.pulau; })) regionSel.insertAdjacentHTML("beforeend", '<optgroup label="' + AF.esc(pl.name) + '">' + D.regions.filter(function (r) { return r.pulau === pl.code; }).map(function (r) {
    return '<option value="' + r.code + '">' + AF.esc(r.name) + "</option>"; }).join("") + "</optgroup>");

  function visible() {
    const kw = (document.getElementById("search").value || "").toLowerCase();
    return vehicles.filter(function (v) {
      return (regionSel.value === "all" || v.region === regionSel.value) && (statusSel.value === "all" || v.status === statusSel.value) &&
        (!kw || (v.plate + " " + v.sales.name).toLowerCase().includes(kw));
    });
  }

  function renderKpis(list) {
    const c = { moving: 0, visit: 0, idle: 0, offline: 0, offroute: 0 };
    for (const v of list) c[v.status]++;
    document.getElementById("lt-kpis").innerHTML = [
      ["Kendaraan dipantau", list.length, "neutral"], ["Bergerak / kunjungan", c.moving + c.visit, "good"],
      ["Diam / tidak terhubung", c.idle + c.offline, c.idle + c.offline ? "warn" : "good"], ["Keluar rute", c.offroute, c.offroute ? "bad" : "good"]
    ].map(function (k) { return '<article class="card kpi tone-' + k[2] + '"><h2 class="kpi-label">' + k[0] + '</h2><div class="kpi-value">' + k[1] + "</div></article>"; }).join("");
    document.getElementById("lt-legend").innerHTML = Object.keys(STATUS).map(function (k) {
      return '<span><i style="background:' + STATUS[k].color + '"></i>' + STATUS[k].label + " <b>" + c[k] + "</b></span>";
    }).join("");
  }

  function renderList(list) {
    document.getElementById("lt-list").innerHTML = list.map(function (v) {
      const st = STATUS[v.status];
      const next = v.stops[Math.min(v.leg + 1, v.stops.length - 1)];
      return '<button type="button" class="vehicle-row' + (selected === v ? " selected" : "") + '" data-id="' + v.id + '"><span class="dot-status" style="background:' + st.color + '"></span>' +
        '<span class="vehicle-main"><strong class="mono">' + v.plate + "</strong> · " + AF.esc(v.sales.name) + '<span class="subtext">' + AF.esc(AF.REGION[v.region].short) + " · menuju " + AF.esc(next.name) +
        '</span></span><span class="vehicle-meta"><span class="badge ' + st.badge + '">' + st.label + '</span><span class="subtext mono">' + v.speed + " km/jam · baterai " + v.battery + "%</span></span></button>";
    }).join("") || '<p class="muted">Tidak ada kendaraan sesuai filter.</p>';
    for (const b of document.querySelectorAll(".vehicle-row")) b.onclick = function () { select(vehicles.find(function (x) { return x.id === b.dataset.id; })); };
  }

  function renderMap(list, fit) {
    if (typeof L === "undefined") {
      document.getElementById("live-map").innerHTML = '<p class="map-fallback">Peta tidak dapat dimuat (perlu koneksi internet). Daftar kendaraan tetap diperbarui.</p>';
      return;
    }
    if (!map) {
      document.getElementById("live-map").innerHTML = "";
      map = L.map("live-map", { preferCanvas: true });
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { maxZoom: 18, attribution: "&copy; OpenStreetMap" }).addTo(map);
    }
    const ids = new Set(list.map(function (v) { return v.id; }));
    for (const id in markers) if (!ids.has(id)) { markers[id].remove(); delete markers[id]; }
    const pts = [];
    for (const v of list) {
      const p = pos(v), st = STATUS[v.status];
      if (!markers[v.id]) {
        markers[v.id] = L.circleMarker(p, { radius: 7, color: "#fff", weight: 2, fillOpacity: 1 }).addTo(map);
        markers[v.id].on("click", function () { select(v); });
      }
      markers[v.id].setLatLng(p).setStyle({ fillColor: st.color });
      markers[v.id].bindTooltip(v.plate + " · " + v.sales.name + " (" + st.label + ")");
      pts.push(p);
    }
    if (fit && pts.length) map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 12 });
    drawRoute();
  }

  function drawRoute() {
    if (!map) return;
    if (routeLayer) routeLayer.remove();
    if (!selected) return;
    routeLayer = L.layerGroup().addTo(map);
    const plan = selected.stops.map(function (o) { return [o.lat, o.lng]; });
    L.polyline(plan, { color: "#64748b", weight: 2, dashArray: "6 6" }).addTo(routeLayer);
    selected.stops.forEach(function (o, i) {
      L.circleMarker([o.lat, o.lng], { radius: 5, color: "#64748b", weight: 2, fillColor: i <= selected.leg ? "#10b981" : "#fff", fillOpacity: 1 })
        .bindTooltip("#" + (i + 1) + " " + o.name).addTo(routeLayer);
    });
    if (selected.trail.length > 1) L.polyline(selected.trail, { color: STATUS[selected.status].color, weight: 4 }).addTo(routeLayer);
  }

  function renderDetail() {
    const box = document.getElementById("lt-detail");
    if (!selected) { box.hidden = true; return; }
    const v = selected;
    box.hidden = false;
    document.getElementById("lt-detail-title").textContent = v.plate + " · " + v.sales.name;
    document.getElementById("lt-detail-sub").textContent = v.type + " · " + AF.REGION[v.region].name + " · GPS Concox GT06N · baterai " + v.battery + "% · " + STATUS[v.status].label;
    document.getElementById("lt-stops").innerHTML = v.stops.map(function (o, i) {
      let st = i < v.leg + 1 ? ["Terkunjungi", ""] : i === v.leg + 1 ? ["Tujuan berikutnya", "blue"] : ["Terjadwal", "neutral"];
      if (v.status === "offroute" && i === v.leg + 1) st = ["Keluar rute", "danger"];
      const jam = String(8 + Math.floor(i * 1.2)).padStart(2, "0") + ":" + (i % 2 ? "30" : "00");
      const dist = i < v.leg + 1 ? (8 + (i * 37) % 120) + " m" : "-";
      return '<tr><td class="mono">' + (i + 1) + "</td><td><strong>" + AF.esc(o.name) + '</strong><span class="subtext mono">' + o.id + '</span></td><td class="mono">' + jam + '</td><td><span class="badge ' + st[1] + '">' + st[0] + '</span></td><td class="mono">' + dist + "</td></tr>";
    }).join("");
  }

  function select(v) {
    selected = selected === v ? null : v;
    renderAll(false);
    if (selected && map) map.setView(pos(selected), 13);
    if (selected) document.getElementById("lt-detail").scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function renderAll(fit) {
    const list = visible();
    renderKpis(list);
    renderList(list);
    renderMap(list, fit);
    renderDetail();
    const now = new Date();
    document.getElementById("lt-clock").textContent = "Update terakhir " + now.toLocaleTimeString("id-ID");
  }

  document.addEventListener("DOMContentLoaded", function () {
    for (let i = 0; i < 3; i++) step();
    renderAll(true);
    regionSel.onchange = statusSel.onchange = function () { selected = null; renderAll(true); };
    document.getElementById("search").addEventListener("input", function () { renderAll(false); });
    setInterval(function () {
      if (!document.getElementById("lt-play").checked) return;
      step();
      renderAll(false);
    }, 5000);
  });
})();
