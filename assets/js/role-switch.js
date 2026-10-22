// Menu profil di header: info akun, ganti role, keluar.
(function () {
  var DATA = {"roles": [{"key": "owner", "label": "Owner", "folder": "dashboard OWNER", "name": "Bpk. Hadi Santoso", "scope": "Seluruh perusahaan"}, {"key": "gm", "label": "GM", "folder": "dashboard GM", "name": "Sri Pohan", "scope": "Jawa"}, {"key": "rsm", "label": "RSM", "folder": "dashboard RSM", "name": "Dian Halim", "scope": "Solo Raya"}, {"key": "asm", "label": "ASM", "folder": "dashboard ASM", "name": "Putri Simanjuntak", "scope": "Kota Surakarta"}, {"key": "sales", "label": "Sales", "folder": "dashboard SALES", "name": "Hendra Siregar", "scope": "Kota Surakarta"}], "pages": {"dashboard OWNER": ["achievement.html", "asset.html", "audit.html", "drilldown.html", "early-warning.html", "effective-call.html", "fleet.html", "gps.html", "index.html", "kendaraan.html", "kesehatan-outlet.html", "live-tracking.html", "master-area.html", "master-outlet.html", "master-product.html", "master-route.html", "master-sales.html", "master-vehicle.html", "noo.html", "nop.html", "notifikasi.html", "orders.html", "outlet-detail.html", "outlets.html", "penjualan.html", "peta-outlet.html", "products.html", "produksi.html", "regions.html", "ro-item.html", "ro.html", "roa.html", "sales-dashboard.html", "sales-detail.html", "tren-penjualan.html", "vehicles.html", "visits.html"], "dashboard GM": ["drilldown.html", "early-warning.html", "effective-call.html", "index.html", "kendaraan.html", "kesehatan-outlet.html", "live-tracking.html", "noo.html", "nop.html", "notifikasi.html", "penjualan.html", "peta-outlet.html", "produksi.html", "ro-item.html", "roa.html", "tren-penjualan.html"], "dashboard RSM": ["drilldown.html", "early-warning.html", "effective-call.html", "index.html", "kendaraan.html", "kesehatan-outlet.html", "live-tracking.html", "noo.html", "nop.html", "notifikasi.html", "penjualan.html", "peta-outlet.html", "produksi.html", "ro-item.html", "roa.html", "tren-penjualan.html"], "dashboard ASM": ["drilldown.html", "early-warning.html", "effective-call.html", "index.html", "jadwal.html", "kendaraan.html", "kesehatan-outlet.html", "live-tracking.html", "noo.html", "nop.html", "notifikasi.html", "penjualan.html", "peta-outlet.html", "produksi.html", "ro-item.html", "roa.html", "tren-penjualan.html"], "dashboard SALES": ["drilldown.html", "early-warning.html", "effective-call.html", "index.html", "jadwal.html", "kendaraan.html", "kesehatan-outlet.html", "noo.html", "nop.html", "notifikasi.html", "penjualan.html", "peta-outlet.html", "produksi.html", "ro-item.html", "roa.html", "tren-penjualan.html"]}};
  function current() {
    var m = decodeURIComponent(location.pathname).match(/(dashboard [A-Z ]+)\/([^\/]*)$/);
    return m ? { folder: m[1], page: m[2] || "index.html" } : null;
  }
  function initials(n) { return n.replace(/^Bpk\.\s*/, "").split(/\s+/).slice(0, 2).map(function (w) { return w[0]; }).join("").toUpperCase(); }
  function esc(t) { return String(t).replace(/[&<>"]/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]; }); }
  // sembunyikan / tampilkan sidebar, diingat di browser
  var KEY = "td-sidebar-hidden";
  try { if (localStorage.getItem(KEY) === "1") document.documentElement.classList.add("sb-hidden"); } catch (e) {}
  function desktop() { return window.matchMedia("(min-width: 1025px)").matches; }
  function setHidden(h) {
    document.documentElement.classList.toggle("sb-hidden", h);
    try { localStorage.setItem(KEY, h ? "1" : "0"); } catch (e) {}
    setTimeout(function () { window.dispatchEvent(new Event("resize")); }, 220);
  }
  document.addEventListener("DOMContentLoaded", function () {
    var brand = document.querySelector(".sidebar .brand");
    if (brand && !brand.querySelector(".sb-hide")) {
      var hb = document.createElement("button");
      hb.type = "button"; hb.className = "sb-hide"; hb.setAttribute("aria-label", "Sembunyikan menu"); hb.title = "Sembunyikan menu";
      hb.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 6l-6 6 6 6"/></svg>';
      hb.onclick = function (e) {
        e.preventDefault(); e.stopPropagation();
        if (desktop()) setHidden(true);
        else { var t = document.getElementById("nav-toggle"); if (t) t.checked = false; }
      };
      brand.appendChild(hb);
    }
    var mt = document.querySelector(".menu-toggle");
    if (mt) mt.addEventListener("click", function (e) {
      if (desktop() && document.documentElement.classList.contains("sb-hidden")) { e.preventDefault(); setHidden(false); }
    });
  });
  document.addEventListener("DOMContentLoaded", function () {
    var cur = current(), bar = document.querySelector(".topbar-right");
    if (!cur || !bar) return;
    var me = DATA.roles.filter(function (r) { return r.folder === cur.folder; })[0];
    if (!me) return;
    var css = document.createElement("style");
    css.textContent =
      ".sidebar-profile{display:none!important}" +
      ".pm{position:relative}" +
      ".pm-btn{display:flex;align-items:center;gap:10px;background:none;border:1px solid transparent;border-radius:10px;padding:4px 8px 4px 4px;cursor:pointer;font:inherit;color:inherit;text-align:left}" +
      ".pm-btn:hover,.pm-btn[aria-expanded=true]{background:#f1f5f9;border-color:#e2e8f0}" +
      ".pm-av{width:36px;height:36px;border-radius:50%;background:#FDE3E4;color:#8F0F16;font-weight:700;font-size:13px;display:grid;place-items:center;flex:none}" +
      ".pm-txt strong{display:block;font-size:14px;line-height:1.2;color:#0f172a;white-space:nowrap}" +
      ".pm-txt small{display:block;font-size:11px;letter-spacing:.04em;text-transform:uppercase;color:#475569;white-space:nowrap}" +
      ".pm-caret{color:#64748b;font-size:11px}" +
      ".pm-menu{position:absolute;right:0;top:calc(100% + 6px);width:270px;background:#fff;border:1px solid #e2e8f0;border-radius:12px;box-shadow:0 12px 32px rgba(15,23,42,.14);padding:6px;z-index:1000}" +
      ".pm-menu[hidden]{display:none}" +
      ".pm-head{padding:10px 10px 8px;border-bottom:1px solid #e2e8f0;margin-bottom:4px}" +
      ".pm-head strong{display:block;font-size:14px;color:#0f172a}.pm-head span{font-size:12px;color:#475569}" +
      ".pm-label{display:block;padding:8px 10px 4px;font-size:11px;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:#64748b}" +
      ".pm-item{display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;padding:8px 10px;border-radius:8px;font-size:14px;color:#0f172a;text-decoration:none;background:none;border:0;text-align:left;cursor:pointer}" +
      ".pm-item:hover{background:#f1f5f9}.pm-item small{color:#64748b;font-size:12px}" +
      ".pm-item.on{background:#FFF1F1;color:#C8141C;font-weight:600}.pm-item.on::after{content:'✓'}" +
      ".pm-item.out{color:#b91c1c;border-top:1px solid #e2e8f0;border-radius:0 0 8px 8px;margin-top:4px}" +
      "@media (max-width:640px){.pm-txt,.pm-caret{display:none}.pm-btn{padding:2px}}";
    document.head.appendChild(css);
    var roles = DATA.roles.map(function (r) {
      var pages = DATA.pages[r.folder] || [];
      var target = pages.indexOf(cur.page) >= 0 ? cur.page : "index.html";
      var on = r.folder === cur.folder;
      return '<a class="pm-item' + (on ? " on" : "") + '" role="menuitem" href="../' + encodeURIComponent(r.folder) + "/" + target + '"><span>' + esc(r.label) +
        (r.key !== "owner" ? " <small>· " + esc(r.scope) + "</small>" : "") + "</span></a>";
    }).join("");
    var wrap = document.createElement("div");
    wrap.className = "pm";
    wrap.innerHTML = '<button type="button" class="pm-btn" aria-haspopup="menu" aria-expanded="false"><span class="pm-av">' + initials(me.name) + '</span>' +
      '<span class="pm-txt"><strong>' + esc(me.name) + "</strong><small>" + esc(me.label) + (me.key !== "owner" ? " · " + esc(me.scope) : "") + '</small></span><span class="pm-caret" aria-hidden="true">▾</span></button>' +
      '<div class="pm-menu" role="menu" hidden><div class="pm-head"><strong>' + esc(me.name) + "</strong><span>" + esc(me.label) + (me.key !== "owner" ? " · " + esc(me.scope) : "") + "</span></div>" +
      '<span class="pm-label">Ganti role</span>' + roles + '<a class="pm-item out" role="menuitem" href="../index.html">Keluar</a></div>';
    var old = bar.querySelectorAll("#role-badge, .badge.blue, .avatar, .role-switch");
    for (var i = 0; i < old.length; i++) old[i].remove();
    bar.appendChild(wrap);
    var btn = wrap.querySelector(".pm-btn"), menu = wrap.querySelector(".pm-menu");
    function close() { menu.hidden = true; btn.setAttribute("aria-expanded", "false"); }
    btn.onclick = function (e) { e.stopPropagation(); var open = menu.hidden; menu.hidden = !open; btn.setAttribute("aria-expanded", String(open)); };
    document.addEventListener("click", function (e) { if (!wrap.contains(e.target)) close(); });
    document.addEventListener("keydown", function (e) { if (e.key === "Escape") close(); });
  });
})();
