// Filter & agregasi data dashboard (periode, wilayah, area, sales, toko/item). Dipakai Dashboard Utama dan halaman detail.
(function () {
  const D = window.ADMIN_DATA;
  if (!D) return;

  const SNAPSHOT = new Date(D.snapshot + "T00:00:00");
  const PRICE = {};
  for (const p of D.products) PRICE[p.code] = p.price;
  const PULAU = {};
  for (const p of D.pulau) PULAU[p.code] = p;
  const REGION = {};
  for (const r of D.regions) REGION[r.code] = r;
  const AREA = {};
  for (const a of D.areas) AREA[a.id] = a;

  // buka data ringkas (array) menjadi objek
  if (Array.isArray(D.sales[0])) {
    D.sales = D.sales.map(function (x) { const a = D.areas[x[2]]; return { id: x[0], name: x[1], area: a.id, region: a.region, pulau: a.pulau }; });
    const codes = D.products.map(function (p) { return p.code; });
    const STATUS = ["Active", "At Risk", "Inactive"];
    const RISK = [null, "Belum dikunjungi > 14 hari", "Tidak beli > 1 bulan"];
    D.outlets = D.outlets.map(function (x) {
      const s = D.sales[x[4]], units = {};
      codes.forEach(function (c, i) { units[c] = x[5][i]; });
      return { id: x[0], name: x[1], lat: x[2], lng: x[3], sales: s.id, area: s.area, region: s.region, pulau: s.pulau, units: units, target: x[6],
        visits_plan: 2, visits_done: x[7], noo: !!x[8], nop: x[9] >= 0 ? codes[x[9]] : null, status: STATUS[x[10]], risk: RISK[x[10]], slow: x[11] };
    });
  }
  const SALES = {};
  for (const s of D.sales) SALES[s.id] = s;

  // Cakupan terkunci sesuai role (dashboard GM / RSM / ASM / Sales). Owner: tanpa kunci.
  const ROLE = window.ROLE || { key: "owner" };
  const LOCK = {};
  if (ROLE.sales) { const x = SALES[ROLE.sales]; LOCK.sales = x.id; LOCK.area = x.area; LOCK.region = x.region; LOCK.pulau = x.pulau; }
  else if (ROLE.area) { const a = AREA[ROLE.area]; LOCK.area = a.id; LOCK.region = a.region; LOCK.pulau = a.pulau; }
  else if (ROLE.region) { LOCK.region = ROLE.region; LOCK.pulau = REGION[ROLE.region].pulau; }
  else if (ROLE.pulau) LOCK.pulau = ROLE.pulau;
  function applyLock(st) { for (const k in LOCK) st[k] = LOCK[k]; return st; }
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
  const DEFAULT_PRESET = "1m";
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
      pulau: q.get("pulau") || "all",
      region: q.get("wilayah") || "all",
      area: q.get("area") || "all",
      sales: q.get("sales") || "all",
      outlet: q.get("toko") || "all",
      item: q.get("item") || "all"
    };
    if (st.region !== "all" && REGION[st.region]) st.pulau = REGION[st.region].pulau;
    if (st.period !== "custom" && !PRESET[st.period]) st.period = DEFAULT_PRESET;
    if (st.period === "custom" && (!st.from || !st.to)) st.period = DEFAULT_PRESET;
    return applyLock(st);
  }

  function stateQuery(state, extra) {
    const q = new URLSearchParams();
    if (state.period !== DEFAULT_PRESET) q.set("periode", state.period);
    if (state.period === "custom") {
      q.set("dari", state.from);
      q.set("sampai", state.to);
    }
    if (state.pulau !== "all" && !LOCK.pulau) q.set("pulau", state.pulau);
    if (state.region !== "all" && !LOCK.region) q.set("wilayah", state.region);
    if (state.area !== "all" && !LOCK.area) q.set("area", state.area);
    if (state.sales !== "all" && !LOCK.sales) q.set("sales", state.sales);
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
      if (state.pulau !== "all" && o.pulau !== state.pulau) return false;
      if (state.region !== "all" && o.region !== state.region) return false;
      if (state.area !== "all" && o.area !== state.area) return false;
      if (state.sales !== "all" && o.sales !== state.sales) return false;
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

  // level anak sesuai filter: semua -> pulau -> wilayah (region) -> area -> sales -> toko
  function childGroups(state) {
    const outlets = scopeOutlets(state, true);
    const by = function (key, id) { return outlets.filter(function (o) { return o[key] === id; }); };
    if (state.pulau === "all" && state.region === "all") {
      return { level: "Pulau", key: "pulau", groups: D.pulau.map(function (p) { return { id: p.code, name: p.name, sub: "GM " + p.gm, outlets: by("pulau", p.code) }; }) };
    }
    if (state.region === "all") {
      return { level: "Wilayah", key: "wilayah", groups: D.regions.filter(function (r) { return r.pulau === state.pulau; }).map(function (r) {
        return { id: r.code, name: r.name, sub: "RSM " + r.rsm, outlets: by("region", r.code) };
      }) };
    }
    if (state.area === "all") {
      return { level: "Area", key: "area", groups: D.areas.filter(function (a) { return a.region === state.region; }).map(function (a) {
        return { id: a.id, name: a.name, sub: "ASM " + a.asm, outlets: by("area", a.id) };
      }) };
    }
    if (state.sales === "all") {
      return { level: "Sales", key: "sales", groups: D.sales.filter(function (x) { return x.area === state.area; }).map(function (x) {
        return { id: x.id, name: x.name, sub: x.id, outlets: by("sales", x.id) };
      }) };
    }
    return { level: "Toko", key: "toko", groups: outlets.map(function (o) {
      return { id: o.id, name: o.name, outlets: [o], outlet: o };
    }) };
  }

  // set filter ke satu grup hasil childGroups
  function drillPatch(key, id) {
    if (key === "pulau") return { pulau: id, region: "all", area: "all", sales: "all", outlet: "all" };
    if (key === "wilayah") return { pulau: REGION[id].pulau, region: id, area: "all", sales: "all", outlet: "all" };
    if (key === "area") return { area: id, sales: "all", outlet: "all" };
    if (key === "sales") return { sales: id, outlet: "all" };
    return { outlet: id };
  }

  function scopeName(state) {
    if (state.outlet !== "all") return OUTLET[state.outlet].name;
    if (state.sales !== "all") return SALES[state.sales].name;
    if (state.area !== "all") return AREA[state.area].name;
    if (state.region !== "all") return REGION[state.region].name;
    if (state.pulau !== "all") return PULAU[state.pulau].name;
    return "Semua Wilayah";
  }

  // Tren bulanan sesuai cakupan (porsi cakupan terhadap total), satuan miliar atau juta
  let TOTAL_A = 0, TOTAL_T = 0;
  function scopedTrend(outlets) {
    if (!TOTAL_A) for (const o of D.outlets) { TOTAL_A += outletActual(o); TOTAL_T += o.target; }
    let a = 0, t = 0;
    for (const o of outlets) { a += outletActual(o); t += o.target; }
    const sa = a / TOTAL_A, st = t / TOTAL_T;
    const juta = D.trend.actual[D.trend.actual.length - 1] * sa < 1;
    const k = juta ? 1000 : 1, r = function (v) { return Math.round(v * k * 100) / 100; };
    return {
      labels: D.trend.labels, unit: juta ? " jt" : " M",
      actual: D.trend.actual.map(function (v) { return r(v * sa); }),
      target: D.trend.target.map(function (v) { return r(v * st); }),
      lastYear: D.trend.lastYear.map(function (v) { return r(v * sa); })
    };
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
    let searchField = null;
    function draw() {
      // kolom cari disimpan dulu supaya tidak ikut terhapus saat filter digambar ulang
      searchField = searchField || document.querySelector(".toolbar .search-field");
      if (searchField && searchField.hidden) searchField = null;
      if (searchField && searchField.parentNode) searchField.parentNode.removeChild(searchField);
      // Wilayah: Jawa / Luar Jawa (semua region di dalamnya) atau satu region
      const wil = state.region !== "all" ? state.region : state.pulau !== "all" ? "P:" + state.pulau : "all";
      const wilOpts = (LOCK.pulau ? "" : '<option value="all">Semua Wilayah</option>') + D.pulau.filter(function (p) { return !LOCK.pulau || p.code === LOCK.pulau; }).map(function (p) {
        return '<optgroup label="' + esc(p.name) + '"><option value="P:' + p.code + '"' + (wil === "P:" + p.code ? " selected" : "") + ">Semua " + esc(p.name) + "</option>" +
          D.regions.filter(function (r) { return r.pulau === p.code; }).map(function (r) {
            return '<option value="' + r.code + '"' + (wil === r.code ? " selected" : "") + ">" + esc(r.name) + "</option>";
          }).join("") + "</optgroup>";
      }).join("");
      const areas = state.region === "all" ? [] : D.areas.filter(function (a) { return a.region === state.region; });
      const sales = state.area === "all" ? [] : D.sales.filter(function (x) { return x.area === state.area; });
      const outlets = state.sales === "all" ? [] : D.outlets.filter(function (o) { return o.sales === state.sales; }).map(function (o) { return { id: o.id, name: o.name }; });
      const items = D.products.map(function (p) { return { id: p.code, name: p.name }; });
      const dirty = state.period !== DEFAULT_PRESET || (state.region !== (LOCK.region || "all")) || (state.pulau !== (LOCK.pulau || "all")) || state.area !== (LOCK.area || "all") ||
        state.sales !== (LOCK.sales || "all") || state.outlet !== "all" || state.item !== "all";
      const hide = function (k) { return LOCK[k] ? " hidden" : ""; };
      container.innerHTML =
        '<div class="filter-bar">' +
        '<div class="dp" id="f-date"></div>' +
        '<div class="filter-field"' + hide("region") + '><label class="sr-only" for="f-region">Wilayah</label><select id="f-region">' + wilOpts + "</select></div>" +
        '<div class="filter-field"' + hide("area") + '><label class="sr-only" for="f-area">Area</label><select id="f-area"' + (state.region === "all" ? " disabled" : "") + ">" + opts(areas, state.area, "Semua Area") + "</select></div>" +
        (third === "item"
          ? '<div class="filter-field"><label class="sr-only" for="f-item">Produk</label><select id="f-item">' + opts(items, state.item, "Semua Produk") + "</select></div>"
          : third === "none" ? ""
          : '<div class="filter-field"' + hide("sales") + '><label class="sr-only" for="f-sales">Sales</label><select id="f-sales"' + (state.area === "all" ? " disabled" : "") + ">" + opts(sales, state.sales, "Semua Sales") + "</select></div>" +
            '<div class="filter-field"><label class="sr-only" for="f-outlet">Toko</label><select id="f-outlet"' + (state.sales === "all" ? " disabled" : "") + ">" + opts(outlets, state.outlet, "Semua Toko") + "</select></div>") +
        (dirty ? '<button type="button" class="button ghost" id="f-reset">Reset</button>' : "") +
        "</div>";
      // kolom cari ikut di baris filter (satu kartu)
      const sf = searchField;
      if (sf && !sf.hidden) container.querySelector(".filter-bar").appendChild(sf);
      const tb = document.querySelector(".toolbar");
      if (tb && !tb.children.length) tb.hidden = true;
      datePicker(container.querySelector("#f-date"), state, function (patch) {
        for (const k in patch) state[k] = patch[k];
        commit();
      });
      container.querySelector("#f-region").onchange = function () {
        const v = this.value;
        state.pulau = v === "all" ? "all" : v.indexOf("P:") === 0 ? v.slice(2) : REGION[v].pulau;
        state.region = v === "all" || v.indexOf("P:") === 0 ? "all" : v;
        state.area = "all"; state.sales = "all"; state.outlet = "all"; commit();
      };
      container.querySelector("#f-area").onchange = function () { state.area = this.value; state.sales = "all"; state.outlet = "all"; commit(); };
      const sl = container.querySelector("#f-sales");
      if (sl) sl.onchange = function () { state.sales = this.value; state.outlet = "all"; commit(); };
      const o = container.querySelector("#f-outlet");
      if (o) o.onchange = function () { state.outlet = this.value; commit(); };
      const it = container.querySelector("#f-item");
      if (it) it.onchange = function () { state.item = this.value; commit(); };
      const rs = container.querySelector("#f-reset");
      if (rs) rs.onclick = function () {
        state.period = DEFAULT_PRESET; state.from = ""; state.to = ""; state.pulau = "all"; state.region = "all"; state.area = "all"; state.sales = "all"; state.outlet = "all"; state.item = "all"; applyLock(state); commit();
      };
    }
    function syncLinks() {
      for (const a of document.querySelectorAll("[data-keep-filter]")) {
        const url = a.dataset.base + stateQuery(state);
        if (a.tagName === "A") a.href = url; else a.dataset.href = url;
      }
    }
    function commit() {
      applyLock(state);
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
    D: D, PRICE: PRICE, PULAU: PULAU, REGION: REGION, AREA: AREA, SALES: SALES, OUTLET: OUTLET, MONTHS: MONTHS,
    readState: readState, stateQuery: stateQuery, periodInfo: periodInfo, scopeOutlets: scopeOutlets, outletActual: outletActual,
    metrics: metrics, prevMetrics: prevMetrics, delta: delta, deltaPill: deltaPill, deltaTone: deltaTone, LOCK: LOCK, ROLE: ROLE, scopedTrend: scopedTrend, childGroups: childGroups, drillPatch: drillPatch, scopeName: scopeName, renderFilterBar: renderFilterBar,
    rupiah: rupiah, num: num, pct: pct, tone: tone, esc: esc
  };
})();
