/* ============================================================
   SMC Academy — app logic
   Renders modules, library, playbook, glossary + inline/modal players
   ============================================================ */

(function () {
  "use strict";

  var DATA = window.SMC_DATA;
  var VIDEOS = DATA.VIDEOS;
  var CATEGORIES = DATA.CATEGORIES;

  /* ---------- tiny helpers ---------- */
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function make(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function catOf(key) {
    for (var i = 0; i < CATEGORIES.length; i++) if (CATEGORIES[i].key === key) return CATEGORIES[i];
    return null;
  }
  function videoById(id) {
    for (var i = 0; i < VIDEOS.length; i++) if (VIDEOS[i].id === id) return VIDEOS[i];
    return null;
  }
  function embedUrl(id, autoplay) {
    return "https://www.youtube-nocookie.com/embed/" + id + "?rel=0&modestbranding=1" + (autoplay ? "&autoplay=1" : "");
  }
  function watchUrl(id) { return "https://www.youtube.com/watch?v=" + id; }

  var PLAY_ICON =
    '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l11-6.5z"/></svg>';
  var ARROW_ICON =
    '<svg width="14" height="14" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14m-6-6 6 6-6 6" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  /* ---------- state ---------- */
  var state = { cat: "all", query: "" };
  var results = VIDEOS.slice();   // current filtered list
  var activeId = VIDEOS[0].id;    // inline player video

  /* ============================================================
     HEADER / nav
     ============================================================ */
  var header = $("#siteHeader");
  var progress = $("#scrollProgress");

  function onScroll() {
    var y = window.scrollY || 0;
    if (header) header.classList.toggle("scrolled", y > 12);
    if (progress) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.transform = "scaleX(" + (max > 0 ? Math.min(1, y / max) : 0) + ")";
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* IntersectionObserver → highlight current nav section */
  var navLinks = $$(".main-nav a");
  var sections = ["start", "modules", "library", "playbook", "glossary"]
    .map(function (id) { return document.getElementById(id); })
    .filter(Boolean);
  if ("IntersectionObserver" in window) {
    var spy = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var id = entry.target.id;
        navLinks.forEach(function (a) {
          a.classList.toggle("active", a.getAttribute("href") === "#" + id);
        });
      });
    }, { rootMargin: "-30% 0px -60% 0px" });
    sections.forEach(function (s) { spy.observe(s); });
  }

  /* ============================================================
     STATS + numbers
     ============================================================ */
  function fillStats() {
    var elV = $("#statVideos");
    var elM = $("#statModules");
    var elNav = $("#navVideoCount");
    if (elV) elV.textContent = VIDEOS.length;
    if (elM) elM.textContent = DATA.MODULES.length;
    if (elNav) elNav.textContent = VIDEOS.length + " free videos";
    var year = $("#footerYear");
    if (year) year.textContent = new Date().getFullYear();
  }

  /* ============================================================
     START-HERE watchlist + inline player
     ============================================================ */
  var mainPlayer = $("#mainPlayer");
  var playerWhy = $("#playerWhy");
  var playerOpen = $("#playerOpenLink");

  function playInline(id) {
    var v = videoById(id);
    if (!v || !mainPlayer) return;
    activeId = id;
    mainPlayer.src = embedUrl(id, false);
    if (playerOpen) playerOpen.href = watchUrl(id);
    $$(".watch-item button").forEach(function (b) {
      b.classList.toggle("active", b.getAttribute("data-id") === id);
    });
    if (playerWhy) {
      var wl = DATA.WATCHLIST.filter(function (w) { return w.id === id; })[0];
      var why = (wl && wl.why) || "Now playing: " + v.title;
      playerWhy.textContent = "▶ Now playing — " + v.channel + ". " + why;
    }
  }

  function renderWatchlist() {
    var box = $("#watchlist");
    if (!box) return;
    box.innerHTML = "";
    DATA.WATCHLIST.forEach(function (w, i) {
      var v = videoById(w.id);
      if (!v) return;
      var li = make("li", "watch-item");
      var btn = make("button");
      btn.type = "button";
      btn.setAttribute("data-id", v.id);
      btn.setAttribute("aria-label", "Play " + v.title);
      if (i === 0) btn.classList.add("active");
      var num = make("span", "watch-num", String(i + 1));
      var info = make("span", "watch-info");
      info.appendChild(make("h3", null, v.title));
      info.appendChild(make("p", null, v.channel + " · " + v.level));
      btn.appendChild(num);
      btn.appendChild(info);
      btn.addEventListener("click", function () { playInline(v.id); });
      li.appendChild(btn);
      box.appendChild(li);
    });
  }

  /* ============================================================
     LEARNING MODULES
     ============================================================ */
  function renderModules() {
    var grid = $("#modulesGrid");
    if (!grid) return;
    grid.innerHTML = "";
    DATA.MODULES.forEach(function (m) {
      var count = VIDEOS.filter(function (v) { return v.cat === m.cat; }).length;
      var cat = catOf(m.cat);

      var card = make("article", "mod-card");
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", m.title + " — " + count + " videos");
      card.setAttribute("data-cat", m.cat);

      var top = make("div", "mod-top");
      top.appendChild(make("span", "mod-num", "0" + m.n));
      top.appendChild(make("span", "mod-count", count + " video" + (count === 1 ? "" : "s")));

      var body = make("div", "mod-body");
      body.appendChild(make("h3", null, m.title));
      body.appendChild(make("p", null, m.text));

      var cta = make("span", "mod-cta");
      cta.appendChild(document.createTextNode("Open in library"));
      cta.insertAdjacentHTML("beforeend", ARROW_ICON);

      card.appendChild(top);
      card.appendChild(body);
      card.appendChild(cta);

      function go() {
        setCategory(cat ? cat.key : "all");
        $("#library").scrollIntoView({ behavior: "smooth" });
      }
      card.addEventListener("click", go);
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); go(); }
      });
      grid.appendChild(card);
    });
  }

  /* ============================================================
     LIBRARY — chips, search, grid
     ============================================================ */
  function filterList() {
    var q = state.query.trim().toLowerCase();
    results = VIDEOS.filter(function (v) {
      if (state.cat !== "all" && v.cat !== state.cat) return false;
      if (!q) return true;
      var hay = (v.title + " " + v.channel + " " + v.desc + " " + v.level + " " + v.lang + " " + v.tags.join(" ")).toLowerCase();
      return hay.indexOf(q) !== -1;
    });
    return results;
  }

  function renderChips() {
    var box = $("#filterChips");
    if (!box) return;
    box.innerHTML = "";

    var all = make("button", "chip" + (state.cat === "all" ? " active" : ""), "All videos");
    all.type = "button";
    all.setAttribute("data-cat", "all");
    var allCount = make("span", "chip-count", String(VIDEOS.length));
    all.appendChild(allCount);
    all.addEventListener("click", function () { setCategory("all"); });
    box.appendChild(all);

    CATEGORIES.forEach(function (c) {
      var n = VIDEOS.filter(function (v) { return v.cat === c.key; }).length;
      var chip = make("button", "chip" + (state.cat === c.key ? " active" : ""), c.label);
      chip.type = "button";
      chip.setAttribute("data-cat", c.key);
      var cnt = make("span", "chip-count", String(n));
      chip.appendChild(cnt);
      chip.addEventListener("click", function () { setCategory(c.key); });
      box.appendChild(chip);
    });
  }

  function setCategory(key) {
    state.cat = key;
    renderChips();
    renderGrid();
  }

  function flagClassFor(level) {
    var lv = (level || "").toLowerCase();
    if (lv.indexOf("beginner") !== -1) return "flag-beginner";
    if (lv.indexOf("intermediate") !== -1) return "flag-intermediate";
    return "flag-advanced";
  }

  function renderGrid() {
    var grid = $("#videoGrid");
    var countEl = $("#resultCount");
    var empty = $("#emptyState");
    if (!grid) return;

    var list = filterList();

    grid.innerHTML = "";
    list.forEach(function (v, i) {
      var card = make("article", "v-card");
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.setAttribute("aria-label", "Play video: " + v.title);
      card.dataset.idx = String(i);

      var thumb = make("div", "v-thumb");
      var img = make("img");
      img.alt = "";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.src = "https://i.ytimg.com/vi/" + v.id + "/hqdefault.jpg";
      img.addEventListener("error", function () {
        thumb.classList.add("thumb-fallback");
        img.remove();
      });

      var flags = make("div", "v-flags");
      var langFlag = make("span", "v-flag flag-lang", v.lang);
      var lvlFlag = make("span", "v-flag " + flagClassFor(v.level), v.level);
      flags.appendChild(langFlag);
      flags.appendChild(lvlFlag);

      var play = make("div", "v-play");
      var pb = make("span");
      pb.innerHTML = PLAY_ICON;
      play.appendChild(pb);

      thumb.appendChild(img);
      thumb.appendChild(flags);
      thumb.appendChild(play);

      var body = make("div", "v-body");
      body.appendChild(make("h3", "v-title", v.title));
      body.appendChild(make("p", "v-channel", v.channel));
      var tags = make("div", "v-tags");
      v.tags.slice(0, 3).forEach(function (t) { tags.appendChild(make("span", "tag", t)); });
      body.appendChild(tags);

      card.appendChild(thumb);
      card.appendChild(body);

      function open() { openModal(v.id); }
      card.addEventListener("click", open);
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") { e.preventDefault(); open(); }
      });
      grid.appendChild(card);
    });

    /* result count */
    if (countEl) {
      countEl.innerHTML = "";
      countEl.appendChild(document.createTextNode("Showing "));
      var b = make("strong", null, String(list.length));
      countEl.appendChild(b);
      var label = state.cat === "all" ? "videos" : catOf(state.cat).label + " videos";
      countEl.appendChild(document.createTextNode(" of " + VIDEOS.length + " — " + label + (state.query.trim() ? " · search: “" + state.query.trim() + "”" : "")));
    }

    /* empty state */
    if (empty) empty.hidden = list.length !== 0;
  }

  function bindSearch() {
    var input = $("#searchInput");
    if (!input) return;
    input.addEventListener("input", function () {
      state.query = input.value;
      renderGrid();
    });
    var resetBtn = $("#emptyReset");
    if (resetBtn) {
      resetBtn.addEventListener("click", function () {
        state.query = "";
        if (input) input.value = "";
        setCategory("all");
      });
    }
    /* footer quick links */
    document.addEventListener("click", function (e) {
      var chipLink = e.target.closest('a[data-chip]');
      if (chipLink) {
        e.preventDefault();
        setCategory(chipLink.getAttribute("data-chip"));
        $("#library").scrollIntoView({ behavior: "smooth" });
        setTimeout(function () { var inp = $("#searchInput"); if (inp) inp.focus({ preventScroll: true }); }, 450);
      }
    });
  }

  /* ============================================================
     PLAYBOOK + GLOSSARY
     ============================================================ */
  function renderPlaybook() {
    var list = $("#playbookList");
    if (!list) return;
    list.innerHTML = "";
    DATA.PLAYBOOK.forEach(function (p) {
      var li = make("li", "pb-item");
      li.appendChild(make("div", "pb-num", p.step));
      var txt = make("div");
      txt.appendChild(make("h3", null, p.title));
      txt.appendChild(make("p", null, p.text));
      li.appendChild(txt);
      list.appendChild(li);
    });
  }

  function renderGlossary() {
    var box = $("#glossaryList");
    if (!box) return;
    box.innerHTML = "";
    DATA.TERMS.forEach(function (t) {
      var g = make("div", "g-term");
      g.appendChild(make("h3", null, t.term));
      g.appendChild(make("p", null, t.def));
      box.appendChild(g);
    });
  }

  /* ============================================================
     MODAL PLAYER
     ============================================================ */
  var modal = $("#playerModal");
  var modalIframe = $("#modalIframe");
  var modalTitle = $("#modalTitle");
  var modalCat = $("#modalCat");
  var modalChannel = $("#modalChannel");
  var modalDesc = $("#modalDesc");
  var modalWatch = $("#modalWatch");
  var openIndex = 0;

  function refreshModalFromList(dir) {
    if (!results.length) return;
    openIndex = (openIndex + dir + results.length) % results.length;
    loadVideoInModal(results[openIndex]);
  }

  function loadVideoInModal(v) {
    openIndex = results.indexOf(v);
    if (openIndex < 0) openIndex = 0;
    modalTitle.textContent = v.title;
    var cat = catOf(v.cat);
    modalCat.textContent = (cat ? cat.label : v.cat) + "  ·  " + v.level + "  ·  " + v.lang;
    modalChannel.textContent = "Channel — " + v.channel;
    modalDesc.textContent = v.desc;
    modalWatch.href = watchUrl(v.id);
    modalIframe.src = embedUrl(v.id, true);
    if (mainPlayer) mainPlayer.src = embedUrl(activeId, false); // stop inline audio
  }

  function openModal(id) {
    var v = videoById(id);
    if (!v || !modal) return;
    /* keep the list position from the last filter for prev/next */
    loadVideoInModal(v);
    modal.hidden = false;
    document.body.classList.add("modal-open");
    var closeBtn = $(".modal-close");
    if (closeBtn) closeBtn.focus();
  }

  function closeModal() {
    if (!modal) return;
    modal.hidden = true;
    document.body.classList.remove("modal-open");
    if (modalIframe) modalIframe.src = "about:blank";
    if (mainPlayer) mainPlayer.src = embedUrl(activeId, false); // restore inline player
  }

  function bindModal() {
    if (!modal) return;
    $$("[data-close-modal]", modal).forEach(function (el) {
      el.addEventListener("click", closeModal);
    });
    $("#modalPrev").addEventListener("click", function () { refreshModalFromList(-1); });
    $("#modalNext").addEventListener("click", function () { refreshModalFromList(1); });
    document.addEventListener("keydown", function (e) {
      if (modal.hidden) return;
      if (e.key === "Escape") closeModal();
      if (e.key === "ArrowLeft") refreshModalFromList(-1);
      if (e.key === "ArrowRight") refreshModalFromList(1);
    });
  }

  /* ============================================================
     KEYBOARD SHORTCUT "/" focuses search
     ============================================================ */
  document.addEventListener("keydown", function (e) {
    if (e.key !== "/") return;
    var tag = (document.activeElement && document.activeElement.tagName) || "";
    if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") return;
    if (!modal.hidden) return;
    e.preventDefault();
    var inp = $("#searchInput");
    if (inp) inp.focus();
  });

  /* ============================================================
     HERO CHART — annotated smart-money diagram
     Candle tuples = [open, close, high, low] in px, where a
     LARGER y value means a LOWER price (standard SVG coords).
     ============================================================ */
  function drawChart() {
    var svg = $("#heroChart");
    if (!svg) return;
    var NS = "http://www.w3.org/2000/svg";
    var W = 760, H = 400, padL = 45, padR = 18, step = 30;

    function S(tag, attrs) {
      var n = document.createElementNS(NS, tag);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      return n;
    }
    function text(x, y, str, cls, anchor) {
      var t = S("text", { x: x, y: y, class: cls, "text-anchor": anchor || "start" });
      t.textContent = str;
      return t;
    }

    /* 20 candles: early distribution → SSL sweep → displacement → FVG retest → markup to BSL */
    var C = [
      [224, 240, 216, 246],   /* 0  downtrend leg */
      [240, 234, 232, 248],
      [234, 252, 230, 258],
      [252, 246, 244, 260],
      [246, 262, 240, 268],
      [262, 254, 254, 272],
      [254, 272, 250, 278],
      [272, 266, 264, 284],
      [266, 284, 262, 290],
      [284, 296, 280, 304],
      [308, 250, 240, 352],   /* 10 sweep of SSL + bullish reclaim */
      [252, 196, 190, 258],   /* 11 displacement */
      [198, 160, 154, 206],   /* 12 displacement */
      [162, 196, 158, 282],   /* 13 pullback taps the FVG */
      [196, 164, 158, 274],   /* 14 second tap, resumes */
      [166, 146, 140, 180],   /* 15 markup */
      [148, 136, 132, 172],
      [138, 126, 122, 168],
      [128, 118, 112, 134],   /* 18 reaches BSL */
      [120, 124, 116, 132]    /* 19 distribution at premium */
    ];

    var x0 = padL + step / 2;
    var candles = C.map(function (c, i) { return { o: c[0], cl: c[1], h: c[2], l: c[3], x: x0 + i * step }; });

    function zoneRect(x1, x2, y1, y2, cls) {
      return S("rect", { x: x1, y: y1, width: Math.max(0, x2 - x1), height: Math.max(0, y2 - y1), class: cls, rx: 4 });
    }

    /* faint background grid */
    for (var gy = 90; gy <= 360; gy += 45) {
      svg.appendChild(S("line", { x1: padL, y1: gy, x2: W - padR, y2: gy, class: "grid-line" }));
    }

    /* ---- institutional zones (behind candles) ---- */
    var OB = zoneRect(candles[8].x - 30, candles[11].x + 6, 270, 316, "zone-ob");      /* accumulation zone  */
    var FVG = zoneRect(candles[11].x + 8, candles[13].x + 10, 210, 288, "zone-fvg");   /* imbalance retested */
    var CE = S("line", { x1: candles[11].x + 8, y1: 249, x2: candles[13].x + 10, y2: 249, class: "ce-line" });
    svg.appendChild(OB);
    svg.appendChild(FVG);
    svg.appendChild(CE);

    /* ---- liquidity levels ---- */
    var BSL = S("line", { x1: padL, y1: 112, x2: W - padR, y2: 112, class: "liq-line liq-bsl" });
    var SSL = S("line", { x1: padL, y1: 322, x2: W - padR, y2: 322, class: "liq-line liq-ssl" });
    svg.appendChild(BSL);
    svg.appendChild(SSL);

    /* prior swing high (broken by the markup) */
    svg.appendChild(S("line", { x1: padL, y1: 240, x2: W - padR, y2: 240, class: "swing-line" }));

    /* ---- candles ---- */
    var bodyW = 13;
    candles.forEach(function (c) {
      var bull = c.cl <= c.o;
      var col = bull ? "#2dd4a7" : "#f87171";
      svg.appendChild(S("line", { x1: c.x, y1: c.h, x2: c.x, y2: c.l, class: "wick", stroke: col }));
      var top = Math.min(c.o, c.cl), bot = Math.max(c.o, c.cl);
      svg.appendChild(S("rect", { x: c.x - bodyW / 2, y: top, width: bodyW, height: Math.max(2, bot - top), rx: 1.5, class: "body", fill: col }));
    });

    /* ---- callout markers ---- */
    svg.appendChild(S("line", { x1: candles[10].x + 15, y1: 238, x2: candles[10].x + 15, y2: 356, class: "callout-line" }));
    svg.appendChild(S("line", { x1: candles[12].x + 15, y1: 156, x2: candles[12].x + 15, y2: 356, class: "callout-line" }));

    /* ---- labels ---- */
    svg.appendChild(text(padL + 2, 100, "BUY-SIDE LIQUIDITY (BSL)", "lbl lbl-bsl", "start"));
    svg.appendChild(text(padL + 2, 344, "SELL-SIDE LIQUIDITY (SSL)", "lbl lbl-ssl", "start"));
    svg.appendChild(text(456, 98, "markup → BSL", "lbl lbl-mkup", "start"));
    svg.appendChild(text(302, 358, "OB · accumulation zone", "lbl lbl-ob", "middle"));
    svg.appendChild(text(candles[11].x + 16, 224, "FVG — imbalance", "lbl lbl-fvg", "start"));
    svg.appendChild(text(452, 247, "CE 50%", "lbl lbl-ce", "start"));
    svg.appendChild(text(308, 232, "prior swing high", "lbl lbl-sh", "middle"));
    svg.appendChild(text(408, 378, "sweep → CHoCH · displacement → BOS · FVG retest", "lbl lbl-flow", "middle"));
  }

  /* ============================================================
     INIT
     ============================================================ */
  function init() {
    fillStats();
    renderWatchlist();
    renderModules();
    renderChips();
    renderGrid();
    bindSearch();
    renderPlaybook();
    renderGlossary();
    bindModal();
    drawChart();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
