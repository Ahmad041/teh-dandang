// Operasional: Jadwal Kunjungan, Peminjaman Kendaraan, Riwayat Produksi.
// Data perubahan (pengajuan jadwal, peminjaman) disimpan di browser (localStorage) lewat AF.store.
(function () {
  if (!window.AF) return;
  const AF = window.AF, D = AF.D, ROLE = AF.ROLE;
  const IS_SALES = ROLE.key === "sales", IS_ASM = ROLE.key === "asm";
  let filter;

  function toast(msg) { if (window.showToast) window.showToast(msg); }
  function dayOf(iso) { return Math.round((AF.fromIso(iso) - AF.SNAPSHOT) / 864e5); }
  function isoOf(day) { return AF.isoDate(AF.dayFromSnapshot(day)); }
  function dayText(day) { return AF.fmtDay(AF.dayFromSnapshot(day)) + " " + AF.dayFromSnapshot(day).getFullYear(); }
  function rel(day) { return day === 0 ? "hari ini" : day === 1 ? "besok" : day === -1 ? "kemarin" : day > 0 ? day + " hari lagi" : -day + " hari lalu"; }
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967296; }
  function kpi(label, value, sub, tone) {
    return '<article class="card kpi trend-' + (tone || "flat") + '"><h2 class="kpi-label">' + label + '</h2><div class="kpi-value">' + value + "</div>" + (sub ? '<span class="kpi-sub">' + sub + "</span>" : "") + "</article>";
  }
  function areasInScope(state) {
    return D.areas.filter(function (a) {
      return (state.pulau === "all" || a.pulau === state.pulau) && (state.region === "all" || a.region === state.region) && (state.area === "all" || a.id === state.area);
    });
  }
  function closeRows(cls) { for (const r of document.querySelectorAll("." + cls)) r.remove(); }
  function toggleRow(tr, cls, cols, html) {
    const next = tr.nextElementSibling, open = next && next.classList.contains(cls);
    closeRows(cls);
    if (open) return null;
    const row = document.createElement("tr");
    row.className = cls;
    row.innerHTML = '<td colspan="' + cols + '">' + html + "</td>";
    tr.after(row);
    return row;
  }
  function outletLink(o) {
    const st = Object.assign({}, filter.state, { pulau: o.pulau, region: o.region, area: o.area, sales: o.sales, outlet: o.id, item: "all" });
    return "penjualan.html" + AF.stateQuery(st);
  }
  const VSTATUS = [["Terlewat", "danger"], ["Dikunjungi, tanpa transaksi", "warning"], ["Transaksi (effective call)", ""]];

  // ================================================================ JADWAL KUNJUNGAN
  let tab = new URLSearchParams(location.search).get("tab") || "mendatang";
  let histFilter = "all";

  function visitHistory(o) {
    const v = o.visits || [], out = [];
    for (let i = 0; i < v.length; i += 2) out.push({ day: v[i], s: v[i + 1] });
    return out;
  }

  function jadwalRender(state) {
    const outlets = AF.scopeOutlets(state);
    const j = AF.jadwalStore();
    const up = AF.schedule(outlets, 0, 14);
    // riwayat 28 hari terakhir
    const hist = [];
    for (const o of outlets) for (const h of visitHistory(o)) if (h.day <= 0 && h.day >= -28) hist.push({ o: o, day: h.day, s: h.s });
    hist.sort(function (a, b) { return b.day - a.day || a.o.name.localeCompare(b.o.name); });
    const missed = hist.filter(function (h) { return h.s === 0; }).length;
    const done = hist.length - missed, trx = hist.filter(function (h) { return h.s === 2; }).length;
    const ids = {};
    for (const o of outlets) ids[o.id] = o;
    const reqs = j.requests.filter(function (r) { return ids[r.oid]; });
    const pending = reqs.filter(function (r) { return r.status === "pending"; }).length;
    const visitPct = hist.length ? done / hist.length * 100 : 0, ecPct = done ? trx / done * 100 : 0;

    document.getElementById("jadwal-kpis").innerHTML = [
      kpi("Jadwal 14 Hari ke Depan", AF.num(up.length), "kunjungan ke " + AF.num(new Set(up.map(function (x) { return x.o.id; })).size) + " toko"),
      kpi("Kunjungan Terlaksana", AF.pct(visitPct), AF.num(done) + " dari " + AF.num(hist.length) + " jadwal · 28 hari", visitPct < 80 ? "down" : "up"),
      kpi("Effective Call", AF.pct(ecPct), AF.num(trx) + " transaksi dari " + AF.num(done) + " kunjungan", ecPct < 80 ? "down" : "up"),
      kpi("Jadwal Terlewat", AF.num(missed), missed ? "sudah dijadwalkan, belum dikunjungi" : "tidak ada", missed ? "down" : "up"),
      kpi(IS_ASM ? "Pengajuan Menunggu" : "Pengajuan Saya", AF.num(IS_ASM ? pending : reqs.length), IS_ASM ? "perlu disetujui / ditolak" : AF.num(pending) + " menunggu persetujuan ASM", pending ? "flat" : "up")
    ].join("");

    const tabs = [["mendatang", "Mendatang (" + up.length + ")"], ["riwayat", "Riwayat (" + hist.length + ")"], ["pengajuan", "Pengajuan" + (pending ? " (" + pending + ")" : "")]];
    document.getElementById("jadwal-tabs").innerHTML = tabs.map(function (t) {
      return '<button type="button" role="tab" class="tab' + (tab === t[0] ? " active" : "") + '" aria-selected="' + (tab === t[0]) + '" data-tab="' + t[0] + '">' + t[1] + "</button>";
    }).join("");
    for (const b of document.querySelectorAll("#jadwal-tabs [data-tab]")) b.onclick = function () { tab = b.dataset.tab; jadwalRender(state); };
    const addBtn = document.getElementById("jadwal-add");
    addBtn.hidden = !IS_SALES;
    addBtn.onclick = function () { requestForm(null, state, outlets); };

    const box = document.getElementById("jadwal-body");
    if (tab === "mendatang") box.innerHTML = upcomingTable(up);
    else if (tab === "riwayat") box.innerHTML = historyTable(hist);
    else box.innerHTML = requestTable(reqs);

    if (tab === "mendatang") {
      for (const tr of box.querySelectorAll("tr[data-i]")) tr.onclick = function (e) {
        if (e.target.closest("button, a")) return;
        const x = up[Number(tr.dataset.i)];
        toggleRow(tr, "detail-row", 6, outletDetail(x.o, x));
      };
      for (const b of box.querySelectorAll(".act-change")) b.onclick = function () {
        const x = up[Number(b.dataset.i)];
        if (IS_ASM) asmChange(b.closest("tr"), x, state);
        else requestForm(x, state, outlets, b.closest("tr"));
      };
    } else if (tab === "riwayat") {
      const sel = document.getElementById("hist-filter");
      sel.value = histFilter;
      sel.onchange = function () { histFilter = sel.value; jadwalRender(state); };
      for (const tr of box.querySelectorAll("tr[data-i]")) tr.onclick = function (e) {
        if (e.target.closest("button, a")) return;
        const h = hist.filter(histMatch)[Number(tr.dataset.i)];
        toggleRow(tr, "detail-row", 5, outletDetail(h.o, null));
      };
    } else {
      for (const b of box.querySelectorAll("[data-decide]")) b.onclick = function () { decide(b.dataset.id, b.dataset.decide, b.closest("tr"), state); };
    }
    if (document.getElementById("search") && document.getElementById("search").value && window.searchTables) window.searchTables();
  }

  function histMatch(h) { return histFilter === "all" || String(h.s) === histFilter; }

  function upcomingTable(up) {
    if (!up.length) return '<p class="muted pad">Tidak ada jadwal kunjungan dalam 14 hari ke depan.</p>';
    let last = null, rows = "";
    up.forEach(function (x, i) {
      if (x.day !== last) { rows += '<tr class="group-row"><th colspan="6" scope="rowgroup">' + dayText(x.day) + ' <span class="subtext inline">' + rel(x.day) + "</span></th></tr>"; last = x.day; }
      const st = x.o.status === "Inactive" ? '<span class="badge danger">RO tidak ROA</span>' : x.o.status === "At Risk" ? '<span class="badge warning">Berisiko</span>' : '<span class="badge">Aktif</span>';
      const note = x.extra ? "Jadwal tambahan · " + AF.esc(x.extra.note || "") : x.changed ? "Diubah dari " + AF.fmtDay(AF.dayFromSnapshot(x.base)) + " oleh " + AF.esc(x.changed.by) + (x.changed.note ? " · " + AF.esc(x.changed.note) : "") : "Rutin 2 minggu sekali";
      rows += '<tr data-i="' + i + '" class="row-click"><td><strong>' + AF.esc(x.o.name) + '</strong><span class="subtext mono">' + x.o.id + "</span></td><td>" + AF.esc(AF.SALES[x.o.sales].name) +
        "</td><td>" + st + "</td><td>" + note + '</td><td class="num">' + AF.rupiah(AF.outletActual(x.o)) +
        '</td><td><button type="button" class="detail-button act-change" data-i="' + i + '">' + (IS_ASM ? "Ubah jadwal" : IS_SALES ? "Ajukan perubahan" : "Detail") + "</button></td></tr>";
    });
    return '<div class="table-scroll limit"><table id="jadwal-table" data-filterable=""><thead><tr><th scope="col">Toko</th><th scope="col">Sales</th><th scope="col">Status Toko</th><th scope="col">Keterangan</th><th scope="col" class="num">Penjualan Bulan Ini</th><th scope="col"><span class="sr-only">Aksi</span></th></tr></thead><tbody>' + rows +
      '<tr class="filter-empty" hidden><td class="table-empty" colspan="6">Tidak ada jadwal yang cocok.</td></tr></tbody></table></div>';
  }

  function historyTable(hist) {
    const list = hist.filter(histMatch);
    const rows = list.map(function (h, i) {
      const s = VSTATUS[h.s];
      return '<tr data-i="' + i + '" class="row-click tone-row-' + (h.s === 0 ? "bad" : h.s === 1 ? "mid" : "good") + '"><td>' + dayText(h.day) + '<span class="subtext">' + rel(h.day) + "</span></td><td><strong>" + AF.esc(h.o.name) + '</strong><span class="subtext mono">' + h.o.id + "</span></td><td>" +
        AF.esc(AF.SALES[h.o.sales].name) + '</td><td><span class="badge ' + s[1] + '">' + s[0] + "</span></td><td>" + (h.s === 2 ? "Tanggal order sama dengan tanggal kunjungan" : h.s === 1 ? "Toko dikunjungi, tidak ada order di hari itu" : "Jadwal tidak dijalankan") + "</td></tr>";
    }).join("");
    return '<div class="table-tools"><div class="filter-field sort-field"><label for="hist-filter">Hasil</label><select id="hist-filter"><option value="all">Semua</option><option value="0">Terlewat</option><option value="1">Dikunjungi, tanpa transaksi</option><option value="2">Transaksi (effective call)</option></select></div></div>' +
      '<div class="table-scroll limit"><table id="hist-table" data-filterable=""><thead><tr><th scope="col">Tanggal</th><th scope="col">Toko</th><th scope="col">Sales</th><th scope="col">Hasil</th><th scope="col">Keterangan</th></tr></thead><tbody>' +
      (rows || '<tr><td class="table-empty" colspan="5">Tidak ada riwayat.</td></tr>') + '<tr class="filter-empty" hidden><td class="table-empty" colspan="5">Tidak ada riwayat yang cocok.</td></tr></tbody></table></div>';
  }

  const RSTATUS = { pending: ["Menunggu ASM", "warning"], approved: ["Disetujui", ""], rejected: ["Ditolak", "danger"] };
  function requestTable(reqs) {
    const list = reqs.slice().sort(function (a, b) { return (a.status !== "pending") - (b.status !== "pending") || (b.created || 0) - (a.created || 0); });
    if (!list.length) return '<p class="muted pad">' + (IS_SALES ? "Belum ada pengajuan. Pakai tombol “Ajukan Jadwal” untuk meminta kunjungan tambahan, atau “Ajukan perubahan” di tab Mendatang." : "Belum ada pengajuan jadwal dari sales.") + "</p>";
    return '<div class="table-scroll limit"><table id="req-table" data-filterable=""><thead><tr><th scope="col">Diajukan</th><th scope="col">Toko</th><th scope="col">Jenis</th><th scope="col">Tanggal Diminta</th><th scope="col">Alasan</th><th scope="col">Status</th>' + (IS_ASM ? '<th scope="col"><span class="sr-only">Aksi</span></th>' : "") + "</tr></thead><tbody>" +
      list.map(function (r) {
        const o = AF.OUTLET[r.oid], st = RSTATUS[r.status];
        return "<tr><td>" + AF.esc(r.by) + '<span class="subtext">' + r.at + "</span></td><td><strong>" + AF.esc(o.name) + '</strong><span class="subtext mono">' + o.id + "</span></td><td>" + (r.type === "ubah" ? "Ubah jadwal<span class=\"subtext\">semula " + AF.fmtDay(AF.dayFromSnapshot(r.fromDay)) + "</span>" : "Kunjungan tambahan") +
          "</td><td>" + dayText(r.day) + "</td><td>" + AF.esc(r.reason) + '</td><td><span class="badge ' + st[1] + '">' + st[0] + "</span>" +
          (r.decidedBy ? '<span class="subtext">' + AF.esc(r.decidedBy) + " · " + r.decidedAt + (r.decisionNote ? " · " + AF.esc(r.decisionNote) : "") + "</span>" : "") + "</td>" +
          (IS_ASM ? "<td>" + (r.status === "pending" ? '<div class="btn-row"><button type="button" class="detail-button" data-decide="approved" data-id="' + r.id + '">Setujui</button><button type="button" class="detail-button danger" data-decide="rejected" data-id="' + r.id + '">Tolak</button></div>' : "") + "</td>" : "") + "</tr>";
      }).join("") + '<tr class="filter-empty" hidden><td class="table-empty" colspan="7">Tidak ada pengajuan yang cocok.</td></tr></tbody></table></div>';
  }

  function outletDetail(o, x) {
    const hist = visitHistory(o).map(function (h) { return "<li><span>" + dayText(h.day) + '</span><span class="badge ' + VSTATUS[h.s][1] + '">' + VSTATUS[h.s][0] + "</span></li>"; }).join("");
    const top = D.products.map(function (p) { return { p: p, u: o.units[p.code] }; }).filter(function (y) { return y.u > 0; }).sort(function (a, b) { return b.u - a.u; }).slice(0, 4)
      .map(function (y) { return "<li><span>" + AF.esc(y.p.name) + "</span><strong>" + AF.num(y.u) + " unit</strong></li>"; }).join("");
    return '<div class="fu-box"><div><span class="popup-label">Riwayat kunjungan</span><ul class="stat-list">' + (hist || "<li>-</li>") + "</ul>" +
      (x ? '<p class="muted">Kunjungan berikutnya: <b>' + dayText(x.day) + "</b> (" + rel(x.day) + ")</p>" : "") + "</div>" +
      '<div><span class="popup-label">Produk dibeli bulan ini</span><ul class="stat-list">' + (top || "<li>Belum ada pembelian</li>") + "</ul>" +
      '<p class="muted">Sales: ' + AF.esc(AF.SALES[o.sales].name) + " · Area " + AF.esc(AF.AREA[o.area].name) + (o.slow ? " · stok slow moving " + AF.num(o.slow) + " unit" : "") + '</p><a class="detail-button" href="' + outletLink(o) + '">Buka detail toko</a></div></div>';
  }

  // Sales: ajukan kunjungan tambahan (x = null) atau perubahan jadwal (x = baris jadwal)
  function requestForm(x, state, outlets, tr) {
    const own = outlets.slice().sort(function (a, b) { return a.name.localeCompare(b.name); });
    const html = '<form class="ops-form fu-form"><div class="form-grid">' +
      (x ? "<label>Toko<input type=\"text\" value=\"" + AF.esc(x.o.name) + "\" disabled/></label>" :
        '<label>Toko<select name="oid" required>' + own.map(function (o) { return '<option value="' + o.id + '">' + AF.esc(o.name) + "</option>"; }).join("") + "</select></label>") +
      '<label>Tanggal kunjungan<input type="date" name="day" required min="' + isoOf(0) + '" max="' + isoOf(60) + '" value="' + isoOf(x ? x.day + 1 : 1) + '"/></label></div>' +
      '<label>Alasan<textarea name="reason" rows="2" required placeholder="' + (x ? "Contoh: pemilik toko minta diundur, tutup hari itu" : "Contoh: toko minta tambah stok sebelum akhir bulan") + '"></textarea></label>' +
      '<div class="fu-actions"><button type="submit" class="button primary">Kirim ke ASM</button><button type="button" class="button fu-cancel">Batal</button><span class="muted">ASM ' + AF.esc(AF.AREA[(x ? x.o : own[0]).area].asm) + " akan menyetujui atau mengubah jadwal.</span></div></form>";
    let host;
    if (tr) host = toggleRow(tr, "fu-row", 6, html);
    else {
      host = document.getElementById("jadwal-form");
      if (!host.hidden) { host.hidden = true; host.innerHTML = ""; return; }
      host.innerHTML = '<h3 class="form-title">Ajukan jadwal kunjungan</h3>' + html;
      host.hidden = false;
    }
    if (!host) return;
    const f = host.querySelector("form");
    f.querySelector(".fu-cancel").onclick = function () { if (tr) host.remove(); else { host.hidden = true; host.innerHTML = ""; } };
    f.onsubmit = function (e) {
      e.preventDefault();
      const fd = new FormData(f), day = dayOf(fd.get("day"));
      const j = AF.jadwalStore();
      j.requests.push({ id: "REQ-" + Date.now().toString(36).toUpperCase(), oid: x ? x.o.id : fd.get("oid"), type: x ? "ubah" : "baru", key: x ? x.key : null, fromDay: x ? x.day : null,
        day: day, reason: String(fd.get("reason")).trim(), by: AF.who(), at: AF.nowText(), created: Date.now(), status: "pending" });
      AF.store.set("jadwal", j);
      toast("Pengajuan terkirim ke ASM");
      tab = "pengajuan";
      if (!tr) { host.hidden = true; host.innerHTML = ""; }
      jadwalRender(state);
    };
  }

  // ASM: ubah jadwal langsung
  function asmChange(tr, x, state) {
    const row = toggleRow(tr, "fu-row", 6, '<form class="ops-form fu-form"><div class="form-grid"><label>Tanggal baru<input type="date" name="day" required min="' + isoOf(0) + '" max="' + isoOf(60) + '" value="' + isoOf(x.day) + '"/></label>' +
      '<label>Catatan untuk sales<input type="text" name="note" placeholder="Contoh: digabung dengan rute Selasa"/></label></div>' +
      '<div class="fu-actions"><button type="submit" class="button primary">Simpan jadwal</button>' + (x.changed ? '<button type="button" class="button fu-reset">Kembalikan ke jadwal rutin</button>' : "") + '<button type="button" class="button fu-cancel">Batal</button></div></form>');
    if (!row) return;
    const f = row.querySelector("form");
    f.querySelector(".fu-cancel").onclick = function () { row.remove(); };
    const rs = f.querySelector(".fu-reset");
    if (rs) rs.onclick = function () { const j = AF.jadwalStore(); delete j.changes[x.o.id]; AF.store.set("jadwal", j); toast("Jadwal dikembalikan"); jadwalRender(state); };
    f.onsubmit = function (e) {
      e.preventDefault();
      const fd = new FormData(f), day = dayOf(fd.get("day")), j = AF.jadwalStore();
      if (x.extra) { for (const ex of j.extras) if (ex.id === x.extra.id) { ex.day = day; ex.note = fd.get("note") || ex.note; } }
      else j.changes[x.o.id] = { day: day, by: AF.who(), at: AF.nowText(), note: String(fd.get("note") || "") };
      AF.store.set("jadwal", j);
      toast("Jadwal diubah");
      jadwalRender(state);
    };
  }

  function decide(id, status, tr, state) {
    const row = toggleRow(tr, "fu-row", 7, '<form class="ops-form fu-form"><label>Catatan ' + (status === "approved" ? "persetujuan" : "penolakan") + ' (opsional)<input type="text" name="note"/></label>' +
      (status === "approved" ? '<label>Tanggal disetujui<input type="date" name="day"/></label>' : "") +
      '<div class="fu-actions"><button type="submit" class="button primary">' + (status === "approved" ? "Setujui" : "Tolak") + '</button><button type="button" class="button fu-cancel">Batal</button></div></form>');
    if (!row) return;
    const j = AF.jadwalStore(), r = j.requests.find(function (q) { return q.id === id; });
    const f = row.querySelector("form");
    if (f.day) f.day.value = isoOf(r.day);
    f.querySelector(".fu-cancel").onclick = function () { row.remove(); };
    f.onsubmit = function (e) {
      e.preventDefault();
      const note = String(new FormData(f).get("note") || "").trim();
      r.status = status; r.decidedBy = AF.who(); r.decidedAt = AF.nowText(); r.decisionNote = note;
      if (status === "approved") {
        const day = f.day && f.day.value ? dayOf(f.day.value) : r.day;
        r.day = day;
        const by = r.by.split(" · ").pop();
        if (r.type === "ubah") {
          const ex = r.key && j.extras.find(function (q) { return q.id === r.key; });
          if (ex) ex.day = day;
          else j.changes[r.oid] = { day: day, by: AF.who(), at: r.decidedAt, note: "pengajuan " + by + ": " + r.reason };
        } else j.extras.push({ id: "EX-" + r.id, oid: r.oid, day: day, by: by, note: "pengajuan " + by + ": " + r.reason });
      }
      AF.store.set("jadwal", j);
      toast(status === "approved" ? "Pengajuan disetujui" : "Pengajuan ditolak");
      jadwalRender(state);
    };
  }

  // ================================================================ PEMINJAMAN KENDARAAN
  // Kendaraan milik area, dipakai bergantian oleh beberapa sales (1 kendaraan untuk ±3 sales).
  const PLATE = { R1: "AD", R2: "H", R3: "AB", R4: "AE", R5: "P", R6: "D", R7: "B" };
  const VTYPE = ["Motor Box", "Motor Box", "Pick Up", "Motor Box", "Canter Box"];
  let VEH = null;
  function vehicles() {
    if (VEH) return VEH;
    VEH = [];
    for (const a of D.areas) {
      const sales = D.sales.filter(function (x) { return x.area === a.id; });
      const n = Math.ceil(sales.length / 3);
      for (let i = 0; i < n; i++) {
        const h = hash(a.id + "v" + i);
        const plate = (PLATE[a.region] || "B") + " " + (1000 + Math.floor(h * 8999)) + " " + String.fromCharCode(65 + Math.floor(hash(a.id + i) * 26)) + String.fromCharCode(65 + Math.floor(hash(i + a.id) * 26));
        const v = { id: a.id + "-K" + (i + 1), plate: plate, type: VTYPE[Math.floor(hash(a.id + "t" + i) * VTYPE.length)], area: a.id, region: a.region, pulau: a.pulau,
          users: sales.filter(function (_, k) { return k % n === i; }).map(function (x) { return x.id; }), service: hash(a.id + "s" + i) < .06 };
        // riwayat 14 hari terakhir: tiap hari kerja dipakai salah satu sales penggunanya
        v.hist = [];
        for (let d = -14; d <= 0; d++) {
          const wd = AF.dayFromSnapshot(d).getDay();
          if (wd === 0 || (v.service && d > -3)) continue;
          if (hash(v.id + "u" + d) < (d === 0 ? .5 : .15)) continue;
          const s = v.users[Math.floor(hash(v.id + "w" + d) * v.users.length)];
          const km = 25 + Math.floor(hash(v.id + "k" + d) * 70);
          v.hist.push({ id: v.id + "@" + d, day: d, sales: s, start: "07:" + (10 + Math.floor(hash(v.id + "m" + d) * 40)), end: d === 0 ? null : (15 + Math.floor(hash(v.id + "e" + d) * 3)) + ":" + (10 + Math.floor(hash(v.id + "n" + d) * 40)), km: d === 0 ? null : km, purpose: "Kunjungan rute" });
        }
        VEH.push(v);
      }
    }
    return VEH;
  }
  function loanStore() { const s = AF.store.get("kendaraan", {}); s.loans = s.loans || []; s.returned = s.returned || {}; return s; }
  // pinjaman aktif kendaraan (hari ini): dari data dasar (dipakai hari ini) atau dari pinjaman yang dibuat di browser
  function vehicleState(v, st) {
    if (v.service) return { status: "service" };
    const mine = st.loans.filter(function (l) { return l.vid === v.id; });
    const act = mine.find(function (l) { return !l.end && l.day <= 0; });
    if (act) return { status: "dipakai", loan: act, local: true };
    const base = v.hist.find(function (h) { return h.day === 0 && !h.end; });
    if (base && !st.returned[base.id]) return { status: "dipakai", loan: base };
    const booked = mine.find(function (l) { return !l.end && l.day > 0; });
    if (booked) return { status: "dipesan", loan: booked, local: true };
    return { status: "tersedia" };
  }
  const VS = { tersedia: ["Tersedia", ""], dipakai: ["Sedang dipakai", "warning"], dipesan: ["Dipesan", "neutral"], service: ["Servis", "danger"] };

  function kendaraanRender(state) {
    const areas = areasInScope(state), aset = new Set(areas.map(function (a) { return a.id; }));
    let list = vehicles().filter(function (v) { return aset.has(v.area); });
    // sales boleh meminjam kendaraan mana pun di areanya; filter sales (Owner/ASM) = kendaraan yang biasa dipakai sales tsb
    if (state.sales !== "all" && !IS_SALES) list = list.filter(function (v) { return v.users.indexOf(state.sales) >= 0; });
    const st = loanStore();
    const rows = list.map(function (v) { return { v: v, s: vehicleState(v, st) }; });
    const cnt = { tersedia: 0, dipakai: 0, dipesan: 0, service: 0 };
    for (const r of rows) cnt[r.s.status]++;
    const sharedBy = list.reduce(function (n, v) { return n + v.users.length; }, 0);
    document.getElementById("veh-kpis").innerHTML = [
      kpi("Total Kendaraan", AF.num(list.length), "dipakai bergantian oleh " + AF.num(sharedBy) + " sales"),
      kpi("Tersedia", AF.num(cnt.tersedia + cnt.dipesan), cnt.dipesan ? AF.num(cnt.dipesan) + " sudah dipesan untuk hari lain" : "bisa dipinjam hari ini", "up"),
      kpi("Sedang Dipakai", AF.num(cnt.dipakai), "keluar untuk kunjungan"),
      kpi("Servis", AF.num(cnt.service), cnt.service ? "tidak bisa dipinjam" : "semua kendaraan siap", cnt.service ? "down" : "up")
    ].join("");

    const me = IS_SALES ? AF.LOCK.sales : null;
    document.querySelector("#veh-table tbody").innerHTML = rows.map(function (r, i) {
      const v = r.v, s = VS[r.s.status], l = r.s.loan;
      const who = l ? AF.esc(AF.SALES[l.sales].name) + '<span class="subtext">' + (l.day > 0 ? "untuk " + dayText(l.day) : "sejak " + (l.start || l.at)) + (l.purpose ? " · " + AF.esc(l.purpose) : "") + "</span>" : "-";
      let act = "";
      if (IS_SALES) {
        if (r.s.status === "tersedia") act = '<button type="button" class="detail-button v-borrow" data-i="' + i + '">Pinjam</button>';
        if (l && l.sales === me && r.s.status !== "service") act = '<button type="button" class="detail-button v-return" data-i="' + i + '">' + (r.s.status === "dipesan" ? "Batalkan" : "Kembalikan") + "</button>";
      } else if (IS_ASM && r.s.status === "dipakai") act = '<button type="button" class="detail-button v-return" data-i="' + i + '">Tandai kembali</button>';
      return '<tr data-i="' + i + '" class="row-click"><td><strong class="mono">' + v.plate + '</strong><span class="subtext">' + v.type + "</span></td><td>" + AF.esc(AF.AREA[v.area].name) + '<span class="subtext">' + AF.esc(AF.REGION[v.region].name) + "</span></td><td>" +
        v.users.map(function (id) { return AF.esc(AF.SALES[id].name); }).join(", ") + '</td><td><span class="badge ' + s[1] + '">' + s[0] + "</span></td><td>" + who + "</td><td>" + act + "</td></tr>";
    }).join("") + '<tr class="filter-empty" hidden><td class="table-empty" colspan="6">Tidak ada kendaraan yang cocok.</td></tr>';
    for (const tr of document.querySelectorAll("#veh-table tr[data-i]")) tr.onclick = function (e) {
      if (e.target.closest("button, a")) return;
      toggleRow(tr, "detail-row", 6, vehHistory(rows[Number(tr.dataset.i)].v, st));
    };
    for (const b of document.querySelectorAll(".v-borrow")) b.onclick = function () { borrowForm(b.closest("tr"), rows[Number(b.dataset.i)].v, state); };
    for (const b of document.querySelectorAll(".v-return")) b.onclick = function () {
      const r = rows[Number(b.dataset.i)], s2 = loanStore();
      if (r.s.local) { for (const l of s2.loans) if (l.id === r.s.loan.id) { l.end = AF.nowText(); l.endBy = AF.who(); } }
      else s2.returned[r.s.loan.id] = { at: AF.nowText(), by: AF.who() };
      AF.store.set("kendaraan", s2);
      toast(r.s.status === "dipesan" ? "Peminjaman dibatalkan" : "Kendaraan dikembalikan");
      kendaraanRender(state);
    };
    // riwayat peminjaman di cakupan ini
    const hist = [];
    for (const v of list) {
      for (const h of v.hist) hist.push({ v: v, day: h.day, sales: h.sales, purpose: h.purpose, start: h.start, end: h.end || (st.returned[h.id] ? st.returned[h.id].at : null), km: h.km });
      for (const l of st.loans) if (l.vid === v.id) hist.push({ v: v, day: l.day, sales: l.sales, purpose: l.purpose, start: l.at, end: l.end, km: null, local: true });
    }
    hist.sort(function (a, b) { return b.day - a.day; });
    document.getElementById("loan-count").textContent = AF.num(hist.length) + " peminjaman";
    document.querySelector("#loan-table tbody").innerHTML = hist.slice(0, 300).map(function (h) {
      return "<tr><td>" + dayText(h.day) + '</td><td class="mono">' + h.v.plate + "</td><td>" + AF.esc(AF.SALES[h.sales].name) + "</td><td>" + AF.esc(h.purpose) + "</td><td>" + (h.start || "-") + "</td><td>" + (h.end || '<span class="badge warning">' + (h.day > 0 ? "Dipesan" : "Belum kembali") + "</span>") + '</td><td class="num">' + (h.km ? h.km + " km" : "-") + "</td></tr>";
    }).join("") + '<tr class="filter-empty" hidden><td class="table-empty" colspan="7">Tidak ada riwayat.</td></tr>';
    if (document.getElementById("search") && document.getElementById("search").value && window.searchTables) window.searchTables();
  }

  function vehHistory(v, st) {
    const items = v.hist.slice().reverse().slice(0, 8).map(function (h) {
      return "<li><span>" + dayText(h.day) + " · " + AF.esc(AF.SALES[h.sales].name) + '</span><span class="muted">' + h.start + " – " + (h.end || (st.returned[h.id] ? "kembali" : "dipakai")) + (h.km ? " · " + h.km + " km" : "") + "</span></li>";
    }).join("");
    return '<div class="fu-box"><div><span class="popup-label">Pemakaian terakhir</span><ul class="stat-list">' + (items || "<li>-</li>") + '</ul></div><div><span class="popup-label">Dipakai bergantian oleh</span><ul class="stat-list">' +
      v.users.map(function (id) { const n = v.hist.filter(function (h) { return h.sales === id; }).length; return "<li><span>" + AF.esc(AF.SALES[id].name) + "</span><strong>" + n + " hari</strong></li>"; }).join("") + "</ul>" +
      (v.service ? '<p class="muted">Sedang servis rutin, kembali dipakai setelah selesai.</p>' : "") + "</div></div>";
  }

  function borrowForm(tr, v, state) {
    const row = toggleRow(tr, "fu-row", 6, '<form class="ops-form fu-form"><div class="form-grid"><label>Tanggal pakai<input type="date" name="day" required min="' + isoOf(0) + '" max="' + isoOf(14) + '" value="' + isoOf(0) + '"/></label>' +
      '<label>Keperluan<select name="purpose"><option>Kunjungan rute</option><option>Kunjungan tambahan</option><option>Antar barang / retur</option><option>Pasang MMT / geber</option></select></label></div>' +
      '<div class="fu-actions"><button type="submit" class="button primary">Pinjam ' + v.plate + '</button><button type="button" class="button fu-cancel">Batal</button></div></form>');
    if (!row) return;
    const f = row.querySelector("form");
    f.querySelector(".fu-cancel").onclick = function () { row.remove(); };
    f.onsubmit = function (e) {
      e.preventDefault();
      const fd = new FormData(f), s = loanStore();
      s.loans.push({ id: "L-" + Date.now().toString(36), vid: v.id, sales: AF.LOCK.sales, day: dayOf(fd.get("day")), purpose: fd.get("purpose"), at: AF.nowText(), end: null });
      AF.store.set("kendaraan", s);
      toast("Kendaraan " + v.plate + " dipinjam");
      kendaraanRender(state);
    };
  }

  // ================================================================ RIWAYAT PRODUKSI
  let prodStatus = "all";
  function batchInfo(b) {
    if (!b.exp) return { days: null, st: ["Fast moving · tanpa kedaluwarsa", "neutral"], key: "fast" };
    const days = dayOf(b.exp);
    if (days < 0) return { days: days, st: ["Kedaluwarsa", "danger"], key: "exp" };
    if (days < 60) return { days: days, st: ["< 60 hari lagi", "warning"], key: "soon" };
    return { days: days, st: ["Aman", ""], key: "ok" };
  }
  function produksiRender(state) {
    const outlets = AF.scopeOutlets(state);
    const per = {};
    for (const o of outlets) if (o.batch >= 0) { const x = per[o.batch] || (per[o.batch] = { toko: [], units: 0 }); x.toko.push(o); x.units += o.slow; }
    const PN = {};
    for (const p of D.products) PN[p.code] = p.name;
    let list = D.batches.map(function (b, i) { return { b: b, i: i, info: batchInfo(b), at: per[i] || { toko: [], units: 0 } }; })
      .filter(function (x) { return state.item === "all" || x.b.code === state.item; });
    const cnt = { exp: 0, soon: 0, tokoRisk: 0, unitRisk: 0 };
    for (const x of list) if (x.info.key === "exp" || x.info.key === "soon") { cnt[x.info.key]++; cnt.tokoRisk += x.at.toko.length; cnt.unitRisk += x.at.units; }
    document.getElementById("prod-kpis").innerHTML = [
      kpi("Batch Diproduksi", AF.num(list.length), "Nov 2025 – Okt 2026 · " + AF.num(list.reduce(function (n, x) { return n + x.b.qty; }, 0)) + " unit"),
      kpi("Batch Kedaluwarsa", AF.num(cnt.exp), "slow moving lewat masa simpan 10 bulan", cnt.exp ? "down" : "up"),
      kpi("Kedaluwarsa < 60 Hari", AF.num(cnt.soon), "perlu didorong / ditarik", cnt.soon ? "down" : "up"),
      kpi("Toko Masih Menyimpan", AF.num(cnt.tokoRisk), AF.num(cnt.unitRisk) + " unit dari batch berisiko", cnt.tokoRisk ? "down" : "up")
    ].join("");
    const sel = document.getElementById("prod-status");
    sel.value = prodStatus;
    sel.onchange = function () { prodStatus = sel.value; produksiRender(state); };
    if (prodStatus !== "all") list = list.filter(function (x) { return prodStatus === "risk" ? x.info.key === "exp" || x.info.key === "soon" : x.info.key === prodStatus; });
    list.sort(function (a, b) { return a.b.prod < b.b.prod ? 1 : a.b.prod > b.b.prod ? -1 : a.b.code.localeCompare(b.b.code); });
    document.querySelector("#prod-table tbody").innerHTML = list.map(function (x, k) {
      const b = x.b, tone = x.info.key === "exp" ? "bad" : x.info.key === "soon" ? "mid" : "";
      return '<tr data-k="' + k + '" class="row-click' + (tone ? " tone-row-" + tone : "") + '"><td class="mono">' + b.id + "</td><td>" + AF.esc(PN[b.code]) + "</td><td>" + AF.fmtDate(AF.fromIso(b.prod)) + '</td><td class="num">' + AF.num(b.qty) + "</td><td>" +
        (b.exp ? AF.fmtDate(AF.fromIso(b.exp)) + '<span class="subtext">' + (x.info.days < 0 ? "lewat " + -x.info.days + " hari" : x.info.days + " hari lagi") + "</span>" : "-") +
        '</td><td><span class="badge ' + x.info.st[1] + '">' + x.info.st[0] + '</span></td><td class="num">' + (b.exp ? AF.num(x.at.toko.length) + " toko<span class=\"subtext\">" + AF.num(x.at.units) + " unit</span>" : "-") + "</td></tr>";
    }).join("") + '<tr class="filter-empty" hidden><td class="table-empty" colspan="7">Tidak ada batch yang cocok.</td></tr>';
    for (const tr of document.querySelectorAll("#prod-table tr[data-k]")) tr.onclick = function () {
      const x = list[Number(tr.dataset.k)];
      if (!x.b.exp) { toggleRow(tr, "detail-row", 7, '<p class="muted">Produk fast moving tidak punya masa kedaluwarsa, jadi tidak dipantau per toko.</p>'); return; }
      const toko = x.at.toko.slice().sort(function (a, b) { return b.slow - a.slow; });
      toggleRow(tr, "detail-row", 7, toko.length ? '<span class="popup-label">Toko yang masih menyimpan batch ' + x.b.id + " (" + toko.length + ")</span>" +
        '<div class="table-scroll mini"><table><thead><tr><th>Toko</th><th>Area</th><th>Sales</th><th class="num">Stok</th></tr></thead><tbody>' +
        toko.slice(0, 60).map(function (o) { return '<tr><td><a href="' + outletLink(o) + '">' + AF.esc(o.name) + "</a></td><td>" + AF.esc(AF.AREA[o.area].name) + "</td><td>" + AF.esc(AF.SALES[o.sales].name) + '</td><td class="num">' + AF.num(o.slow) + " unit</td></tr>"; }).join("") +
        "</tbody></table></div>" + (toko.length > 60 ? '<p class="muted">60 dari ' + toko.length + " toko ditampilkan.</p>" : "") + (x.info.key !== "ok" ? '<a class="detail-button" href="early-warning.html?jenis=exp">Tindak lanjut di Peringatan Dini</a>' : "")
        : '<p class="muted">Tidak ada toko di cakupan ini yang menyimpan batch ini.</p>');
    };
    if (document.getElementById("search") && document.getElementById("search").value && window.searchTables) window.searchTables();
  }

  document.addEventListener("DOMContentLoaded", function () {
    const bar = document.getElementById("filter-bar");
    if (!bar) return;
    if (document.getElementById("jadwal-page")) filter = AF.renderFilterBar(bar, { noDate: true }, jadwalRender);
    else if (document.getElementById("veh-page")) filter = AF.renderFilterBar(bar, { noDate: true, third: "sales" }, kendaraanRender);
    else if (document.getElementById("prod-page")) filter = AF.renderFilterBar(bar, { noDate: true, third: "item" }, produksiRender);
  });
})();
