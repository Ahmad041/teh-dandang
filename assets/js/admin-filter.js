// Filter & agregasi data Admin Pusat (periode, wilayah, area, toko/item). Dipakai Executive dan halaman detail KPI.
(function () {
  const D = window.ADMIN_DATA;
  if (!D) return;

  const SNAPSHOT = new Date(D.snapshot + "T00:00:00");
  const PRICE = {};
  for (const p of D.products) PRICE[p.code] = p.price;
  const REGION = {};
  for (const r of D.regions) REGION[r.code] = r;
  const AREA = {};
  for (const a of D.areas) AREA[a.id] = a;
  const KEC = {};
  for (const k of D.kecamatan) KEC[k.id] = k;
  const SALES = {};
  for (const s of D.sales) SALES[s.id] = s;
  const OUTLET = {};
  D.outlets.forEach(function (o, i) {
    OUTLET[o.id] = o;
    // urutan pseudo-acak yang stabil untuk memilih NOO/NOP saat periode lebih panjang
    o.seq = (i * 7919) % 1009;
  });
  const REGION_COUNT = {};
  for (const o of D.outlets) REGION_COUNT[o.region] = (REGION_COUNT[o.region] || 0) + 1;

  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
  const MONTHS_LONG = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
  const DAY = 864e5;
  const MIN_DATE = new Date(SNAPSHOT.getFullYear() - 1, 0, 1);

  function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
  function addMonths(d, n) { return new Date(d.getFullYear(), d.getMonth() + n, d.getDate()); }
  function fromIso(s) { const p = s.split("-"); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function dayCount(a, b) { return Math.round((b - a) / DAY) + 1; }

  // Preset seperti Stockbit, dihitung dari tanggal data terakhir
  const PRESETS = [
    ["latest", "Hari Ini", function (S) { return [S, S]; }],
    ["prevday", "Kemarin", function (S) { const d = addDays(S, -1); return [d, d]; }],
    ["7d", "7 Hari", function (S) { return [addDays(S, -6), S]; }],
    ["thismonth", "Bulan Ini", function (S) { return [new Date(S.getFullYear(), S.getMonth(), 1), S]; }],
    ["prevmonth", "Bulan Lalu", function (S) { return [new Date(S.getFullYear(), S.getMonth() - 1, 1), new Date(S.getFullYear(), S.getMonth(), 0)]; }],
    ["1m", "1 Bulan", function (S) { return [addDays(addMonths(S, -1), 1), S]; }],
    ["3m", "3 Bulan", function (S) { return [addDays(addMonths(S, -3), 1), S]; }],
    ["6m", "6 Bulan", function (S) { return [addDays(addMonths(S, -6), 1), S]; }],
    ["ytd", "Tahun Ini", function (S) { return [new Date(S.getFullYear(), 0, 1), S]; }],
    ["1y", "1 Tahun", function (S) { return [addDays(addMonths(S, -12), 1), S]; }]
  ];
  const PRESET = {};
  for (const p of PRESETS) PRESET[p[0]] = { key: p[0], label: p[1], range: p[2] };
  const DEFAULT_PRESET = "1m"; // Default: 30 hari terakhir (sesuai revisi dashboard)

  const OLD = { "7": "7d", "30": "1m", "90": "3m", "ytd": "ytd" };

  function fmtDate(d) {
    return d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  function fmtRange(a, b) {
    if (+a === +b) return fmtDate(a);
    if (a.getFullYear() === b.getFullYear()) return a.getDate() + " " + MONTHS[a.getMonth()] + " – " + fmtDate(b);
    return fmtDate(a) + " – " + fmtDate(b);
  }

  function isoDate(d) {
    return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
  }

  function readState() {
    const q = new URLSearchParams(location.search);
    let period = q.get("periode") || DEFAULT_PRESET;
    if (OLD[period]) period = OLD[period];
    const st = {
      period: period,
      from: q.get("dari") || "",
      to: q.get("sampai") || "",
      region: q.get("wilayah") || "all",
      area: q.get("area") || "all",
      outlet: q.get("toko") || "all",
      item: q.get("item") || "all"
    };
    if (st.period !== "custom" && !PRESET[st.period]) st.period = DEFAULT_PRESET;
    if (st.period === "custom" && (!st.from || !st.to)) st.period = DEFAULT_PRESET;
    return st;
  }

  function stateQuery(state, extra) {
    const q = new URLSearchParams();
    if (state.period !== DEFAULT_PRESET) q.set("periode", state.period);
    if (state.period === "custom") {
      q.set("dari", state.from);
      q.set("sampai", state.to);
    }
    if (state.region !== "all") q.set("wilayah", state.region);
    if (state.area !== "all") q.set("area", state.area);
    if (state.outlet !== "all") q.set("toko", state.outlet);
    if (state.item !== "all") q.set("item", state.item);
    if (extra) for (const k in extra) q.set(k, extra[k]);
    const s = q.toString();
    return s ? "?" + s : "";
  }

  // Nilai penjualan harian dari tren bulanan (miliar Rp / hari). Nov–Des tahun lalu diperkirakan.
  const LAST_YEAR = D.trend.lastYear.concat([2.6, 2.75]);
  function dailyValue(d) {
    const dim = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
    const v = d.getFullYear() === SNAPSHOT.getFullYear() ? D.trend.actual[d.getMonth()] : LAST_YEAR[d.getMonth()];
    return (v || 0) / dim;
  }
  function rangeValue(a, b) {
    let s = 0;
    for (let d = a; d <= b; d = addDays(d, 1)) s += dailyValue(d);
    return s;
  }
  const BASE = rangeValue(addDays(SNAPSHOT, -29), SNAPSHOT); // data outlet = 30 hari terakhir

  function rangeOf(state) {
    if (state.period === "custom") {
      let a = fromIso(state.from), b = fromIso(state.to);
      if (b < a) { const x = a; a = b; b = x; }
      if (b > SNAPSHOT) b = SNAPSHOT;
      if (a < MIN_DATE) a = MIN_DATE;
      return [a, b];
    }
    return PRESET[state.period].range(SNAPSHOT);
  }

  function periodInfo(state) {
    const r = rangeOf(state), start = r[0], end = r[1];
    const days = dayCount(start, end);
    const prevEnd = addDays(start, -1), prevStart = addDays(prevEnd, -(days - 1));
    return {
      factor: rangeValue(start, end) / BASE,
      prevFactor: rangeValue(prevStart, prevEnd) / BASE,
      label: state.period === "custom" ? days + " hari" : PRESET[state.period].label,
      range: fmtRange(start, end),
      prevRange: fmtRange(prevStart, prevEnd),
      start: start, end: end, days: days
    };
  }

  function scopeOutlets(state, ignoreOutlet) {
    return D.outlets.filter(function (o) {
      if (state.region !== "all" && o.region !== state.region) return false;
      if (state.area !== "all" && o.area !== state.area) return false;
      if (!ignoreOutlet && state.outlet !== "all" && o.id !== state.outlet) return false;
      return true;
    });
  }

  function outletActual(o) {
    let a = 0;
    for (const k in o.units) a += o.units[k] * PRICE[k];
    return a;
  }

  // NOO/NOP untuk periode: 30 hari = yang ditandai; lebih pendek = sebagian; lebih panjang = ditambah outlet lain (urutan stabil)
  function flaggedSet(outlets, key, factor) {
    const flagged = outlets.filter(function (o) { return key === "noo" ? o.noo : !!o.nop; }).sort(function (a, b) { return a.seq - b.seq; });
    const want = Math.round(flagged.length * factor);
    if (want <= flagged.length) return flagged.slice(0, want);
    const extra = outlets.filter(function (o) { return o.status !== "Inactive" && !(key === "noo" ? o.noo : o.nop) && !(key === "nop" && o.noo); })
      .sort(function (a, b) { return b.seq - a.seq; });
    return flagged.concat(extra.slice(0, want - flagged.length));
  }

  function targetShare(outlets, field, factor) {
    const perRegion = {};
    for (const o of outlets) perRegion[o.region] = (perRegion[o.region] || 0) + 1;
    let t = 0;
    for (const r in perRegion) t += REGION[r][field] * perRegion[r] / REGION_COUNT[r];
    return Math.max(outlets.length ? 1 : 0, Math.round(t * factor));
  }

  function metrics(outlets, factor) {
    const m = { outlets: outlets.length, actual: 0, target: 0, visitsPlan: 0, visitsDone: 0, units: {}, active: 0, atRisk: 0, inactive: 0 };
    for (const p of D.products) m.units[p.code] = 0;
    for (const o of outlets) {
      m.actual += outletActual(o) * factor;
      m.target += o.target * factor;
      m.visitsPlan += o.visits_plan * factor;
      m.visitsDone += o.visits_done * factor;
      for (const k in o.units) m.units[k] += o.units[k] * factor;
      if (o.status === "Inactive") m.inactive++;
      else { m.active++; if (o.status === "At Risk") m.atRisk++; }
    }
    m.visitsPlan = Math.round(m.visitsPlan);
    m.visitsDone = Math.round(m.visitsDone);
    for (const k in m.units) m.units[k] = Math.round(m.units[k]);
    m.nooList = flaggedSet(outlets, "noo", factor);
    m.nopList = flaggedSet(outlets, "nop", factor);
    m.nooActual = m.nooList.length;
    m.nopActual = m.nopList.length;
    m.nooTarget = targetShare(outlets, "noo_target", factor);
    m.nopTarget = targetShare(outlets, "nop_target", factor);
    m.salesPct = m.target ? m.actual / m.target * 100 : 0;
    m.ecPct = m.visitsPlan ? m.visitsDone / m.visitsPlan * 100 : 0;
    m.nooPct = m.nooTarget ? m.nooActual / m.nooTarget * 100 : 0;
    m.nopPct = m.nopTarget ? m.nopActual / m.nopTarget * 100 : 0;
    m.roaPct = m.outlets ? m.active / m.outlets * 100 : 0;
    return m;
  }

  // Angka periode sebelumnya (panjang sama, tepat sebelum periode aktif). Variasi kecil yang stabil per cakupan
  // supaya rasio (EC, ROA) juga bergerak naik/turun seperti data sungguhan.
  function noise(key) {
    let h = 2166136261;
    for (let i = 0; i < key.length; i++) { h ^= key.charCodeAt(i); h = Math.imul(h, 16777619); }
    return ((h >>> 0) % 2001) / 1000 - 1; // -1 .. 1
  }

  function prevMetrics(outlets, info, scopeKey) {
    const p = metrics(outlets, info.prevFactor);
    const k = (scopeKey || "") + "|" + isoDate(info.start) + "|" + info.days;
    // nilai per outlet supaya total wilayah = jumlah area = jumlah toko
    const t = "|" + isoDate(info.start) + "|" + info.days;
    let act = 0, done = 0;
    for (const c in p.units) p.units[c] = 0;
    for (const o of outlets) {
      const f = info.prevFactor * (1 + noise(o.id + t) * .12);
      act += outletActual(o) * f;
      done += Math.min(o.visits_plan, o.visits_done * (1 + noise(o.id + t + "v") * .1)) * info.prevFactor;
      for (const c in o.units) p.units[c] += o.units[c] * f;
    }
    for (const c in p.units) p.units[c] = Math.round(p.units[c]);
    p.actual = act;
    p.visitsDone = Math.min(p.visitsPlan, Math.round(done));
    p.active = Math.min(p.outlets, Math.max(0, Math.round(p.active * (1 + noise(k + "r") * .04))));
    p.inactive = p.outlets - p.active;
    p.atRisk = Math.min(p.active, Math.max(0, Math.round(p.atRisk * (1 + noise(k + "k") * .2))));
    p.nooActual = Math.max(0, Math.round(p.nooActual * (1 + noise(k + "n") * .2)));
    p.nopActual = Math.max(0, Math.round(p.nopActual * (1 + noise(k + "p") * .2)));
    p.salesPct = p.target ? p.actual / p.target * 100 : 0;
    p.ecPct = p.visitsPlan ? p.visitsDone / p.visitsPlan * 100 : 0;
    p.roaPct = p.outlets ? p.active / p.outlets * 100 : 0;
    return p;
  }

  // Perubahan vs periode sebelumnya. rate=true -> selisih poin persen.
  function delta(cur, prev, rate) {
    const d = rate ? cur - prev : (prev ? (cur - prev) / prev * 100 : 0);
    const dir = Math.abs(d) < .05 ? "flat" : d > 0 ? "up" : "down";
    const txt = (dir === "up" ? "▲ " : dir === "down" ? "▼ " : "") +
      Math.abs(d).toLocaleString("id-ID", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + (rate ? " poin" : "%");
    return { dir: dir, value: d, text: txt };
  }

  // invert=true untuk angka yang lebih baik kalau turun (mis. outlet berisiko)
  function deltaTone(dl, invert) {
    if (dl.dir === "flat") return "flat";
    return (dl.dir === "up") !== !!invert ? "up" : "down";
  }

  function deltaPill(dl, title, invert) {
    return '<span class="delta ' + deltaTone(dl, invert) + '"' + (title ? ' title="' + esc(title) + '"' : "") + ">" + dl.text + "</span>";
  }

  // level anak sesuai filter: semua -> wilayah, wilayah -> area, area -> toko
  function childGroups(state) {
    const outlets = scopeOutlets(state, true);
    if (state.region === "all") {
      return { level: "Wilayah", key: "wilayah", groups: D.regions.map(function (r) {
        return { id: r.code, name: r.name, outlets: outlets.filter(function (o) { return o.region === r.code; }) };
      }) };
    }
    if (state.area === "all") {
      return { level: "Area", key: "area", groups: D.areas.filter(function (a) { return a.region === state.region; }).map(function (a) {
        return { id: a.id, name: a.name, outlets: outlets.filter(function (o) { return o.area === a.id; }) };
      }) };
    }
    return { level: "Toko", key: "toko", groups: outlets.map(function (o) {
      return { id: o.id, name: o.name, outlets: [o], outlet: o };
    }) };
  }

  function rupiah(v, short) {
    if (short !== false) {
      if (Math.abs(v) >= 1e9) return "Rp " + (v / 1e9).toLocaleString("id-ID", { maximumFractionDigits: 2 }) + " M";
      if (Math.abs(v) >= 1e6) return "Rp " + (v / 1e6).toLocaleString("id-ID", { maximumFractionDigits: 1 }) + " Jt";
    }
    return "Rp " + Math.round(v).toLocaleString("id-ID");
  }

  function num(v) {
    return Math.round(v).toLocaleString("id-ID");
  }

  function pct(v) {
    return v.toLocaleString("id-ID", { maximumFractionDigits: 1, minimumFractionDigits: 1 }) + "%";
  }

  function tone(p) {
    return p >= 100 ? "good" : p >= 90 ? "warn" : "bad";
  }

  function esc(t) {
    return String(t).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; });
  }

  // ---------- Pemilih tanggal (gaya Stockbit: 2 bulan + preset) ----------
  const CAL_ICON = '<svg aria-hidden="true" class="icon" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="1.8" viewBox="0 0 24 24"><path d="M4 5h16v16H4z M4 10h16 M8 3v4 M16 3v4"></path></svg>';

  function datePicker(container, state, onPick) {
    let open = false, pending = null, hover = null;
    const sel = rangeOf(state);
    let view = new Date(sel[1].getFullYear(), sel[1].getMonth() - 1, 1); // bulan kiri

    function inRange(d, a, b) { return a && b && d >= a && d <= b; }

    function month(first) {
      const y = first.getFullYear(), m = first.getMonth();
      const lead = (first.getDay() + 6) % 7; // Senin di kolom pertama
      const dim = new Date(y, m + 1, 0).getDate();
      let cells = "";
      for (let i = 0; i < lead; i++) cells += "<span></span>";
      let a = sel[0], b = sel[1];
      if (pending) { a = pending; b = hover && hover >= pending ? hover : pending; }
      for (let d = 1; d <= dim; d++) {
        const day = new Date(y, m, d);
        const iso = isoDate(day);
        const cls = ["dp-day"];
        const disabled = day > SNAPSHOT || day < MIN_DATE;
        if (inRange(day, a, b)) cls.push("in");
        if (+day === +a) cls.push("start");
        if (+day === +b) cls.push("end");
        if (+day === +SNAPSHOT) cls.push("today");
        cells += '<button type="button" class="' + cls.join(" ") + '" data-d="' + iso + '"' + (disabled ? " disabled" : "") + ' aria-label="' + fmtDate(day) + '">' + d + "</button>";
      }
      return '<div class="dp-month"><div class="dp-grid dp-week"><span>Sen</span><span>Sel</span><span>Rab</span><span>Kam</span><span>Jum</span><span>Sab</span><span>Min</span></div><div class="dp-grid">' + cells + "</div></div>";
    }

    function draw() {
      const info = periodInfo(state);
      const right = new Date(view.getFullYear(), view.getMonth() + 1, 1);
      const canNext = right < new Date(SNAPSHOT.getFullYear(), SNAPSHOT.getMonth(), 1);
      const canPrev = view > MIN_DATE;
      container.innerHTML =
        '<button type="button" class="dp-trigger" aria-haspopup="true" aria-expanded="' + open + '">' + CAL_ICON +
        '<span class="dp-range">' + info.range + '</span><span class="dp-preset">' + info.label + "</span></button>" +
        (open ? '<div class="dp-panel" role="group" aria-label="Pilih periode">' +
          '<div class="dp-head"><span class="dp-nav"><button type="button" data-nav="-12" aria-label="Tahun sebelumnya"' + (canPrev ? "" : " disabled") + '>«</button><button type="button" data-nav="-1" aria-label="Bulan sebelumnya"' + (canPrev ? "" : " disabled") + ">‹</button></span>" +
          "<strong>" + MONTHS_LONG[view.getMonth()] + " " + view.getFullYear() + '</strong><strong class="dp-second">' + MONTHS_LONG[right.getMonth()] + " " + right.getFullYear() + "</strong>" +
          '<span class="dp-nav"><button type="button" data-nav="1" aria-label="Bulan berikutnya"' + (canNext ? "" : " disabled") + '>›</button><button type="button" data-nav="12" aria-label="Tahun berikutnya"' + (canNext ? "" : " disabled") + ">»</button></span></div>" +
          '<div class="dp-months">' + month(view) + '<div class="dp-second">' + month(right) + "</div></div>" +
          '<div class="dp-presets">' + PRESETS.map(function (p) {
            return '<button type="button" data-preset="' + p[0] + '"' + (state.period === p[0] ? ' class="active"' : "") + ">" + p[1] + "</button>";
          }).join("") + "</div>" +
          (pending ? '<p class="dp-hint">Pilih tanggal akhir</p>' : "") +
          "</div>" : "");
      container.querySelector(".dp-trigger").onclick = function () { open = !open; pending = null; draw(); };
      if (!open) return;
      for (const b of container.querySelectorAll("[data-nav]")) b.onclick = function () {
        const n = Number(b.dataset.nav);
        view = new Date(view.getFullYear(), view.getMonth() + n, 1);
        const maxLeft = new Date(SNAPSHOT.getFullYear(), SNAPSHOT.getMonth() - 1, 1);
        if (view > maxLeft) view = maxLeft;
        if (view < MIN_DATE) view = new Date(MIN_DATE);
        draw();
      };
      for (const b of container.querySelectorAll("[data-preset]")) b.onclick = function () {
        open = false; pending = null;
        onPick({ period: b.dataset.preset, from: "", to: "" });
      };
      const grid = container.querySelector(".dp-months");
      grid.onclick = function (e) {
        const b = e.target.closest(".dp-day");
        if (!b || b.disabled) return;
        const d = fromIso(b.dataset.d);
        if (!pending) { pending = d; hover = d; draw(); return; }
        let a = pending, z = d;
        if (z < a) { const x = a; a = z; z = x; }
        open = false; pending = null;
        onPick({ period: "custom", from: isoDate(a), to: isoDate(z) });
      };
      grid.onmouseover = function (e) {
        const b = e.target.closest(".dp-day");
        if (!pending || !b || b.disabled) return;
        const d = fromIso(b.dataset.d);
        if (+d === +hover) return;
        hover = d;
        for (const x of grid.querySelectorAll(".dp-day")) {
          const xd = fromIso(x.dataset.d);
          const lo = d < pending ? d : pending, hi = d < pending ? pending : d;
          x.classList.toggle("in", xd >= lo && xd <= hi);
          x.classList.toggle("start", +xd === +lo);
          x.classList.toggle("end", +xd === +hi);
        }
      };
    }

    function outside(e) {
      if (open && !container.contains(e.target)) { open = false; pending = null; draw(); }
    }
    document.addEventListener("mousedown", outside);
    document.addEventListener("keydown", function (e) { if (e.key === "Escape" && open) { open = false; pending = null; draw(); } });
    draw();
  }

  // ---------- Filter bar ----------
  function renderFilterBar(container, options, onChange) {
    const state = readState();
    const third = options.third || "outlet"; // "outlet", "item", atau "none"
    function opts(list, value, allLabel) {
      return '<option value="all">' + allLabel + "</option>" + list.map(function (x) {
        return '<option value="' + esc(x.id) + '"' + (x.id === value ? " selected" : "") + ">" + esc(x.name) + "</option>";
      }).join("");
    }
    function draw() {
      const regions = D.regions.map(function (r) { return { id: r.code, name: r.name }; });
      const areas = state.region === "all" ? [] : D.areas.filter(function (a) { return a.region === state.region; });
      const outlets = state.area === "all" ? [] : D.outlets.filter(function (o) { return o.area === state.area; }).map(function (o) { return { id: o.id, name: o.name }; });
      const items = D.products.map(function (p) { return { id: p.code, name: p.name }; });
      const dirty = state.period !== DEFAULT_PRESET || state.region !== "all" || state.area !== "all" || state.outlet !== "all" || state.item !== "all";
      container.innerHTML =
        '<div class="filter-bar">' +
        '<div class="dp" id="f-date"></div>' +
        '<div class="filter-field"><label class="sr-only" for="f-region">Wilayah</label><select id="f-region">' + opts(regions, state.region, "Semua Wilayah") + "</select></div>" +
        '<div class="filter-field"><label class="sr-only" for="f-area">Area</label><select id="f-area"' + (state.region === "all" ? " disabled" : "") + ">" + opts(areas, state.area, "Semua Area") + "</select></div>" +
        (third === "item"
          ? '<div class="filter-field"><label class="sr-only" for="f-item">Item</label><select id="f-item">' + opts(items, state.item, "Semua Item") + "</select></div>"
          : third === "none" ? ""
          : '<div class="filter-field"><label class="sr-only" for="f-outlet">Toko</label><select id="f-outlet"' + (state.area === "all" ? " disabled" : "") + ">" + opts(outlets, state.outlet, "Semua Toko") + "</select></div>") +
        (dirty ? '<button type="button" class="button ghost" id="f-reset">Reset</button>' : "") +
        "</div>";
      datePicker(container.querySelector("#f-date"), state, function (patch) {
        for (const k in patch) state[k] = patch[k];
        commit();
      });
      container.querySelector("#f-region").onchange = function () { state.region = this.value; state.area = "all"; state.outlet = "all"; commit(); };
      container.querySelector("#f-area").onchange = function () { state.area = this.value; state.outlet = "all"; commit(); };
      const o = container.querySelector("#f-outlet");
      if (o) o.onchange = function () { state.outlet = this.value; commit(); };
      const it = container.querySelector("#f-item");
      if (it) it.onchange = function () { state.item = this.value; commit(); };
      const rs = container.querySelector("#f-reset");
      if (rs) rs.onclick = function () {
        state.period = DEFAULT_PRESET; state.from = ""; state.to = ""; state.region = "all"; state.area = "all"; state.outlet = "all"; state.item = "all"; commit();
      };
    }
    function syncLinks() {
      for (const a of document.querySelectorAll("[data-keep-filter]")) {
        const url = a.dataset.base + stateQuery(state);
        if (a.tagName === "A") a.href = url; else a.dataset.href = url;
      }
    }
    function commit() {
      history.replaceState(null, "", location.pathname + stateQuery(state) + location.hash);
      draw();
      onChange(state);
      syncLinks();
    }
    draw();
    syncLinks();
    // render pertama setelah objek filter dikembalikan ke pemanggil
    Promise.resolve().then(function () { onChange(state); });
    return {
      state: state,
      set: function (patch) { for (const k in patch) state[k] = patch[k]; commit(); }
    };
  }

  window.AF = {
    D: D, PRICE: PRICE, REGION: REGION, AREA: AREA, KEC: KEC, SALES: SALES, OUTLET: OUTLET, MONTHS: MONTHS,
    readState: readState, stateQuery: stateQuery, periodInfo: periodInfo, scopeOutlets: scopeOutlets, outletActual: outletActual,
    metrics: metrics, prevMetrics: prevMetrics, delta: delta, deltaPill: deltaPill, deltaTone: deltaTone, childGroups: childGroups, renderFilterBar: renderFilterBar,
    rupiah: rupiah, num: num, pct: pct, tone: tone, esc: esc
  };
})();
