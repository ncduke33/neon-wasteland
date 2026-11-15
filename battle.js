/* NEON WASTELAND: SIEGE PROTOCOL
   Six screens: dashboard, base camp, lanes/battle, upgrade portal,
   character inventory, multiplayer maps. Free game-icons art only. */
(function () {
  var D = window.NW_DATA;
  if (!D) return;

  var AB_KEYS = Object.keys(window.NW_ICON_SRC || {}).filter(function (k) {
    return k.indexOf("ab-") === 0 && k !== "ab-buy" && k !== "ab-circuit";
  }).sort();
  var HERO_KEYS = Object.keys(window.NW_ICON_SRC || {}).filter(function (k) { return k.indexOf("hero-") === 0; }).sort();
  var AB_INDEX = {};
  D.abilities.slice().sort(function (a, b) { return a.ability_id < b.ability_id ? -1 : 1; })
    .forEach(function (a, i) { AB_INDEX[a.ability_id] = AB_KEYS[i % AB_KEYS.length]; });

  function icon(name) { return (window.NW_ICON_SRC || {})[name] || ""; }
  function abIcon(a) { return icon(AB_INDEX[a.ability_id] || "ab-circuit"); }
  function heroIcon(h) { return icon(ICON_FOR_CLASS[h.class] || "hero-cyborg-face"); }
  function unitIconName(u) { return ICON_FOR_CLASS[u.class] || "hero-cyborg-face"; }
  var ICON_FOR_CLASS = {
    Solo: "hero-skull-mask", Netrunner: "hero-cyber-eye", Techie: "hero-mechanic-garage",
    Medtech: "hero-doctor-face", Nomad: "hero-full-motorcycle-helmet",
    Corpo: "hero-briefcase", Cyberpsycho: "hero-brute"
  };
  function el(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function money(n) { return Math.round(n).toLocaleString("en-US"); }
  function pad(n) { return n < 10 ? "0" + n : "" + n; }

  /* ---------------- maps ---------------- */
  var MAPS = [
    { id: "core", name: "Megablock Core", lanes: 3, diff: 1.0, payout: 1.0, squad: 4,
      note: "Three lanes converge on the Core Spire. Standard defense.",
      paths: [
        [[-0.06, 0.13], [0.26, 0.13], [0.26, 0.40], [0.485, 0.48]],
        [[-0.06, 0.87], [0.26, 0.87], [0.26, 0.60], [0.485, 0.52]],
        [[1.06, 0.50], [0.74, 0.50], [0.515, 0.50]]
      ] },
    { id: "span", name: "Skybridge Span", lanes: 2, diff: 1.15, payout: 1.2, squad: 2,
      note: "Narrow span. Fewer lanes but every hostile hits harder.",
      paths: [
        [[-0.06, 0.22], [0.34, 0.22], [0.34, 0.45], [0.485, 0.48]],
        [[1.06, 0.78], [0.66, 0.78], [0.66, 0.55], [0.515, 0.52]]
      ] },
    { id: "depths", name: "Arcology Depths", lanes: 4, diff: 0.95, payout: 1.15, squad: 4,
      note: "Four service tunnels. Thin spread, constant pressure.",
      paths: [
        [[-0.06, 0.10], [0.24, 0.10], [0.24, 0.34], [0.48, 0.46]],
        [[-0.06, 0.90], [0.24, 0.90], [0.24, 0.66], [0.48, 0.54]],
        [[1.06, 0.14], [0.76, 0.14], [0.76, 0.38], [0.52, 0.47]],
        [[1.06, 0.86], [0.76, 0.86], [0.76, 0.62], [0.52, 0.53]]
      ] },
    { id: "bazaar", name: "Chrome Bazaar", lanes: 3, diff: 1.3, payout: 1.55, squad: 3,
      note: "Swarm district. Hostiles come in numbers and pay well.",
      paths: [
        [[-0.06, 0.18], [0.30, 0.18], [0.30, 0.44], [0.485, 0.48]],
        [[-0.06, 0.82], [0.30, 0.82], [0.30, 0.56], [0.485, 0.52]],
        [[0.50, -0.06], [0.50, 0.20], [0.515, 0.46]]
      ] },
    { id: "vault", name: "Datacenter Vault", lanes: 1, diff: 1.6, payout: 2.0, squad: 1,
      note: "One long corridor, elite escorts, biggest payout in the sprawl.",
      paths: [
        [[-0.06, 0.72], [0.22, 0.72], [0.22, 0.36], [0.40, 0.36], [0.40, 0.62], [0.485, 0.52]]
      ] }
  ];
  function mapById(id) { return MAPS.filter(function (m) { return m.id === id; })[0] || MAPS[0]; }

  /* ---------------- save ---------------- */
  var KEY = "nw_siege_v2";
  function fresh() {
    return {
      v: 2, coins: 1240, aura: 30, wave: 1, best: 1, map: "core", squad: 2,
      hero: D.heroes[0].hero_id,
      heroesUnlocked: [D.heroes[0].hero_id, D.heroes[1].hero_id, D.heroes[2].hero_id],
      abUnlocked: [], slots: [null, null, null], wild: null,
      unitLevels: {}, base: { seg: [1200, 1200, 1200, 1200, 1200, 1200], gates: 3600, core: 4000 },
      shop: { plate: 0, armor: 0, reactor: 0, hardpoint: 0 },
      builds: {}, kills: 0, runs: 0
    };
  }
  var G = load();
  function load() {
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return fresh();
      var s = JSON.parse(raw), base = fresh();
      Object.keys(base).forEach(function (k) { if (s[k] === undefined) s[k] = base[k]; });
      return s;
    } catch (e) { return fresh(); }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(G)); } catch (e) {} }

  var CORE_MAX = 4000, GATE_MAX = 3600, SEG_MAX = 1200;

  function map() { return mapById(G.map); }
  function heroById(id) { return D.heroes.filter(function (h) { return h.hero_id === id; })[0] || D.heroes[0]; }
  function hero() { return heroById(G.hero); }
  function unitLevel(name) { return G.unitLevels[name] || 0; }
  function unitStats(u) {
    var r = (u.role || "").toLowerCase();
    var ranged = /range|long|mortar|quickhack|anti-armor|siege|scout|drone/.test(r);
    var lv = unitLevel(u.name), lm = 1 + lv * 0.14;
    return {
      hp: Math.round((260 + u.tier * 140) * lm),
      atk: Math.round((60 + u.tier * 38) * lm),
      def: 12 + u.tier * 9,
      range: ranged ? 190 : 110,
      rate: ranged ? 900 : 700,
      cost: u.deploy_cost_aura * 10
    };
  }
  function unitUpgradeCost(name) {
    var lv = unitLevel(name);
    return lv >= 5 ? null : Math.round(180 * Math.pow(1.75, lv));
  }
  function abCost(a) { return Math.round((a.coin_cost || 100) * 1.6); }
  function abUnlocked(id) { return G.abUnlocked.indexOf(id) >= 0; }
  function heroUnlocked(id) { return G.heroesUnlocked.indexOf(id) >= 0; }
  function buildLevel(id) { return G.builds[id] || 0; }
  function buildCost(b) { return Math.round(220 * Math.pow(1.6, buildLevel(b.building_id))); }
  function unlockedUnitNames() { return D.units.map(function (u) { return u.name; }); }

  var SHOP = [
    { id: "plate", name: "Reinforced Plate", desc: "+10% ring segment integrity", cost: [200, 400, 700, 1100, 1600] },
    { id: "armor", name: "Reactive Armor", desc: "segments reflect melee contact", cost: [900, 1800, 3200] },
    { id: "reactor", name: "Auxiliary Reactor", desc: "+5% core integrity", cost: [600, 1400, 2600] },
    { id: "hardpoint", name: "Hardpoint Expansion", desc: "+2 deploy slots before cap", cost: [500, 1200] }
  ];

  /* ---------------- CSS ---------------- */
  function css() {
    var s = document.createElement("style");
    s.textContent = [
      "#nw{display:none!important}",
      "html,body{margin:0;height:100%;background:#04070a;color:#dbeef2;overflow:hidden;",
      "font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:transparent}",
      "#app{position:fixed;inset:0;display:flex;flex-direction:column;background:#04070a}",
      ".scr{flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;display:none;padding:14px 14px 84px}",
      ".scr.on{display:block}",
      ".scr.battle{padding:0;display:none}",
      ".scr.battle.on{display:flex;flex-direction:column}",
      "h1{margin:0;font-size:31px;line-height:.95;letter-spacing:.02em;color:#eafcff}",
      "h2{margin:0 0 10px;font-size:11px;letter-spacing:.22em;color:#38f5e0;font-weight:600}",
      ".kick{font-size:9px;letter-spacing:.34em;color:#ff7b33;margin-bottom:8px}",
      ".sub{color:#7f99a0;font-size:11px;line-height:1.6}",
      ".card{border:1px solid rgba(56,245,224,.18);background:linear-gradient(180deg,#081114,#060b0e);padding:12px;margin-bottom:10px}",
      ".cta{display:block;width:100%;padding:15px;border:1px solid #38f5e0;background:linear-gradient(180deg,#0d2a2c,#081a1c);",
      "color:#7dfff0;font:12px ui-monospace,monospace;letter-spacing:.22em;border-radius:4px;margin:12px 0}",
      ".grid2{display:grid;grid-template-columns:1fr 1fr;gap:8px}",
      ".grid2 button{padding:14px 10px;border:1px solid rgba(56,245,224,.22);background:#070f12;color:#bfe9e2;",
      "font:10px ui-monospace,monospace;letter-spacing:.14em;text-align:left;border-radius:4px}",
      ".grid2 button small{display:block;color:#54737a;font-size:8px;margin-top:5px;letter-spacing:.08em}",
      ".statrow{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:14px 0}",
      ".stat{border:1px solid rgba(56,245,224,.14);padding:9px;background:#060c0f}",
      ".stat b{display:block;font-size:16px;color:#ffd24a}",
      ".stat span{font-size:8px;letter-spacing:.16em;color:#5c7b82}",
      "#nav{position:fixed;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(5,1fr);",
      "background:rgba(5,11,13,.98);border-top:1px solid rgba(56,245,224,.22);z-index:70}",
      "#nav button{background:none;border:0;color:#5f8b91;font:9px ui-monospace,monospace;letter-spacing:.1em;padding:10px 2px} ",
      "#nav button.on{color:#38f5e0;box-shadow:inset 0 2px 0 #38f5e0}",
      "#nav img{display:block;width:17px;height:17px;margin:0 auto 3px;opacity:.85}",
      "/* battle */",
      "#b-top{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(56,245,224,.16);background:#060f12}",
      "#b-top .hud{display:flex;gap:9px;font-size:10px;margin-left:auto}",
      "#b-top .hud b{color:#ffd24a}",
      "#b-top .hud .au b{color:#8fd6ff}",
      ".ctrl{display:flex;gap:4px}",
      ".ctrl button{background:#0a1418;border:1px solid rgba(56,245,224,.26);color:#9fe9df;font:9px ui-monospace,monospace;",
      "padding:5px 7px;border-radius:3px}",
      ".ctrl button.on{background:#123033;border-color:#38f5e0;color:#38f5e0;box-shadow:0 0 9px rgba(56,245,224,.4)}",
      "#stage{position:relative;flex:1;overflow:hidden;background:radial-gradient(ellipse at 50% 52%,#0b1418,#05090b 65%,#030607)}",
      "#paths{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}",
      "#arena{position:absolute;inset:0}",
      "#core{position:absolute;width:92px;height:92px;margin:-46px 0 0 -46px;border:2px solid #ff7b33;border-radius:50%;",
      "display:grid;place-items:center;box-shadow:0 0 26px rgba(255,123,51,.5),inset 0 0 38px rgba(255,123,51,.13);background:rgba(255,123,51,.06)}",
      "#core img{width:40px;height:40px}",
      "#core .cb{position:absolute;left:50%;bottom:-13px;transform:translateX(-50%);width:78px;height:4px;background:#1a1207;border-radius:2px;overflow:hidden}",
      "#core .cb i{display:block;height:100%;background:#ff7b33}",
      ".sp{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;display:grid;place-items:center;border-radius:50%;will-change:transform}",
      ".sp img{width:19px;height:19px}",
      ".sp.u{border:1px solid #38f5e0;background:rgba(56,245,224,.14);box-shadow:0 0 11px rgba(56,245,224,.4)}",
      ".sp.a{border-color:#c07bff;background:rgba(192,123,255,.14);box-shadow:0 0 11px rgba(192,123,255,.4)}",
      ".sp.e{border:1px solid #ff5d5d;background:rgba(255,93,93,.14);box-shadow:0 0 10px rgba(255,93,93,.32)}",
      ".sp.boss{width:46px;height:46px;margin:-23px 0 0 -23px;border-width:2px;box-shadow:0 0 24px rgba(255,93,93,.6)}",
      ".sp.boss img{width:28px;height:28px}",
      ".hp{position:absolute;top:-6px;left:50%;transform:translateX(-50%);width:25px;height:3px;background:#131a20;border-radius:2px;overflow:hidden}",
      ".hp i{display:block;height:100%;background:#38f5e0}",
      ".sp.e .hp i{background:#ff5d5d}",
      ".sp.a .hp i{background:#c07bff}",
      ".tr{position:absolute;height:2px;transform-origin:0 50%;background:linear-gradient(90deg,rgba(56,245,224,.9),rgba(56,245,224,0));pointer-events:none;animation:tf .18s linear forwards}",
      "@keyframes tf{to{opacity:0}}",
      ".flt{position:absolute;font-size:10px;color:#ffd24a;pointer-events:none;animation:fl .8s ease-out forwards}",
      "@keyframes fl{to{transform:translateY(-26px);opacity:0}}",
      "#banner{position:absolute;left:0;right:0;top:32%;text-align:center;pointer-events:none;opacity:0;transition:opacity .3s}",
      "#banner.on{opacity:1}",
      "#banner b{display:block;font-size:18px;letter-spacing:.24em;color:#38f5e0}",
      "#banner span{font-size:9px;letter-spacing:.18em;color:#7fb9b3}",
      "#b-bar{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;border-top:1px solid rgba(56,245,224,.2);background:rgba(56,245,224,.16);margin-bottom:44px}",
      "#b-bar button{background:#070e11;border:0;color:#8fd6ff;font:10px ui-monospace,monospace;letter-spacing:.1em;padding:13px 2px}",
      "#b-bar button small{display:block;font-size:8px;color:#4d6a70;margin-top:3px}",
      "#b-bar #launch{background:#13261f;color:#7dffb0}",
      "/* sheets */",
      "#sheet{position:fixed;left:0;right:0;bottom:0;max-height:74vh;background:#060d10;border-top:1px solid #38f5e0;",
      "transform:translateY(103%);transition:transform .2s ease;z-index:80;display:flex;flex-direction:column}",
      "#sheet.on{transform:translateY(0)}",
      "#sheet .hd{display:flex;align-items:center;padding:9px 12px;border-bottom:1px solid rgba(56,245,224,.15)}",
      "#sheet .hd b{font-size:10px;letter-spacing:.2em;color:#38f5e0}",
      "#sheet .hd button{margin-left:auto;background:none;border:1px solid rgba(56,245,224,.3);color:#9fe9df;padding:4px 10px;font:9px ui-monospace,monospace;border-radius:3px}",
      "#sheet .bd{overflow-y:auto;padding:10px 12px 20px}",
      "/* rows */",
      ".row{display:flex;align-items:center;gap:10px;border:1px solid rgba(56,245,224,.14);background:#070e11;padding:9px;margin-bottom:7px}",
      ".row img{width:24px;height:24px;flex:none;opacity:.95}",
      ".row .m{flex:1;min-width:0}",
      ".row .m b{display:block;font-size:11px;color:#dff6f4;font-weight:600}",
      ".row .m span{font-size:9px;color:#6e8d94;display:block;line-height:1.4}",
      ".row button{background:#0d1d20;border:1px solid rgba(56,245,224,.35);color:#7dfff0;font:9px ui-monospace,monospace;",
      "padding:6px 9px;border-radius:3px;white-space:nowrap}",
      ".row button.off{border-color:rgba(255,255,255,.08);color:#3f565c}",
      ".row.sel{border-color:#38f5e0;box-shadow:0 0 0 1px #38f5e0 inset}",
      ".chips{display:flex;flex-wrap:wrap;gap:6px}",
      ".chip{display:flex;align-items:center;gap:5px;border:1px solid rgba(56,245,224,.2);padding:5px 7px;font-size:9px;color:#a9cfd2;background:#070e11}",
      ".chip img{width:15px;height:15px}",
      ".chip.on{border-color:#38f5e0;color:#38f5e0}",
      ".tabs{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;background:rgba(56,245,224,.2);margin-bottom:10px}",
      ".tabs button{background:#070e11;border:0;color:#6e8d94;font:9px ui-monospace,monospace;letter-spacing:.12em;padding:10px 2px}",
      ".tabs button.on{color:#38f5e0;background:#0b1f22}",
      "/* base visual */",
      ".basewrap{position:relative;height:210px;border:1px solid rgba(56,245,224,.16);background:radial-gradient(circle at 50% 55%,#0c181c,#050a0c);margin-bottom:10px;overflow:hidden}",
      ".seg{position:absolute;width:10px;height:38px;background:#38f5e0;box-shadow:0 0 10px rgba(56,245,224,.6);border-radius:2px}",
      ".seg.dead{background:#233;box-shadow:none}",
      ".barcore{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:64px;height:64px;border:2px solid #ff7b33;border-radius:50%;",
      "display:grid;place-items:center;box-shadow:0 0 20px rgba(255,123,51,.45);background:rgba(255,123,51,.08)}",
      ".barcore img{width:28px;height:28px}",
      ".barline{display:flex;justify-content:space-between;font-size:9px;color:#7f99a0;margin-bottom:4px}",
      ".track{height:6px;background:#101a1e;border-radius:3px;overflow:hidden;margin-bottom:9px}",
      ".track i{display:block;height:100%}",
      ".plot{border:1px dashed rgba(56,245,224,.22);padding:9px;display:flex;gap:8px;align-items:center;margin-bottom:6px}",
      ".plot .m{flex:1}",
      ".plot b{font-size:10px;color:#cfeeeb}",
      ".plot span{display:block;font-size:8px;color:#63838a}",
      ".empty{color:#5d7a81;font-size:10px;padding:12px;text-align:center;border:1px dashed rgba(56,245,224,.16)}",
      "#toast{position:fixed;left:50%;bottom:70px;transform:translateX(-50%);background:#0b1418;border:1px solid #38f5e0;",
      "color:#38f5e0;padding:8px 13px;font:9px ui-monospace,monospace;letter-spacing:.1em;z-index:95;opacity:0;transition:opacity .15s;pointer-events:none}",
      "#toast.on{opacity:1}",
      "#over{position:fixed;inset:0;background:rgba(3,6,8,.94);display:none;place-items:center;text-align:center;padding:24px;z-index:130}",
      "#over.on{display:grid}",
      "#over h1{font-size:19px;letter-spacing:.22em;color:#ff7b33;margin-bottom:10px}",
      "#over p{color:#93aeb2;font-size:11px;max-width:300px;margin:0 auto 16px;line-height:1.7}",
      "#over button{background:#0d1a1e;border:1px solid #38f5e0;color:#38f5e0;padding:11px 20px;font:10px ui-monospace,monospace;letter-spacing:.16em;border-radius:3px}"
    ].join("");
    document.head.appendChild(s);
  }

  /* ---------------- shell markup ---------------- */
  function shell() {
    css();
    var host = document.createElement("div");
    host.id = "app";
    host.innerHTML =
      '<div class="scr" id="scr-dash"></div>' +
      '<div class="scr" id="scr-camp"></div>' +
      '<div class="scr battle" id="scr-battle"></div>' +
      '<div class="scr" id="scr-upgrade"></div>' +
      '<div class="scr" id="scr-squad"></div>' +
      '<div class="scr" id="scr-maps"></div>' +
      '<nav id="nav">' +
        '<button data-go="camp"><img src="' + icon("ab-base-dome") + '">CAMP</button>' +
        '<button data-go="battle"><img src="' + icon("ab-bolt-shield") + '">BATTLE</button>' +
        '<button data-go="upgrade"><img src="' + icon("ab-upgrade") + '">UPGRADE</button>' +
        '<button data-go="squad"><img src="' + icon("hero-cyborg-face") + '">SQUAD</button>' +
        '<button data-go="maps"><img src="' + icon("ab-all-for-one") + '">MAPS</button>' +
      '</nav>' +
      '<div id="sheet"><div class="hd"><b></b><button>CLOSE</button></div><div class="bd"></div></div>' +
      '<div id="toast"></div>' +
      '<div id="over"><div><h1 id="overt"></h1><p id="overp"></p><button>BACK TO CAMP</button></div></div>';
    document.body.appendChild(host);

    var battle = el("scr-battle");
    battle.innerHTML =
      '<div id="b-top">' +
        '<span style="font-size:9px;letter-spacing:.18em;color:#38f5e0" id="b-map">MEGABLOCK CORE</span>' +
        '<span class="hud"><span>W<b id="h-wave">01</b></span><span>CR<b id="h-coins">0</b></span>' +
        '<span class="au">AU<b id="h-aura">0</b></span></span>' +
        '<div class="ctrl"><button id="c-pause">II</button><button id="c-speed">1x</button>' +
        '<button id="c-auto" class="on">AUTO</button></div>' +
      '</div>' +
      '<div id="stage"><svg id="paths"></svg><div id="arena"></div>' +
        '<div id="core"><img src="' + icon("ab-radioactive") + '" alt=""><div class="cb"><i></i></div></div>' +
        '<div id="banner"><b></b><span></span></div>' +
      '</div>' +
      '<div id="b-bar">' +
        '<button id="b-units">DEPLOY<small>units</small></button>' +
        '<button id="b-skills">SKILLS<small>hero</small></button>' +
        '<button id="launch">LAUNCH<small>next wave</small></button>' +
      '</div>';
  }

  var toastT;
  function toast(m) {
    var t = el("toast");
    t.textContent = m; t.classList.add("on");
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove("on"); }, 1500);
  }

  /* ---------------- navigation ---------------- */
  var current = "dash";
  function go(scr) {
    current = scr;
    ["dash", "camp", "battle", "upgrade", "squad", "maps"].forEach(function (k) {
      var e = el("scr-" + k);
      if (e) e.classList.toggle("on", k === scr);
    });
    document.querySelectorAll("#nav button").forEach(function (b) {
      b.classList.toggle("on", b.dataset.go === scr);
    });
    if (scr === "dash") renderDash();
    if (scr === "camp") renderCamp();
    if (scr === "battle") enterBattle();
    if (scr === "upgrade") renderUpgrade();
    if (scr === "squad") renderSquad();
    if (scr === "maps") renderMaps();
    closeSheet();
  }

  function openSheet(title, html) {
    var s = el("sheet");
    s.querySelector(".hd b").textContent = title;
    s.querySelector(".bd").innerHTML = html;
    s.classList.add("on");
  }
  function closeSheet() { el("sheet").classList.remove("on"); }

  /* ---------------- dashboard ---------------- */
  function renderDash() {
    var m = map();
    el("scr-dash").innerHTML =
      '<div style="padding:12px 0 6px"><div class="kick">SIEGE PROTOCOL · ' + m.name.toUpperCase() + '</div>' +
      '<h1>NEON<br>WASTELAND</h1>' +
      '<p class="sub" style="margin:12px 0 0">Hold the Core Spire. Thirty waves of corporate security, riot mechs ' +
      'and cyberpsychos want it dark. You have coins, a hero, and whatever you can print in time.</p></div>' +
      '<div class="statrow">' +
        '<div class="stat"><b>' + money(G.coins) + '</b><span>CREDITS</span></div>' +
        '<div class="stat"><b>' + pad(G.wave) + '</b><span>WAVE</span></div>' +
        '<div class="stat"><b>' + pad(G.best) + '</b><span>BEST</span></div>' +
      '</div>' +
      '<button class="cta" data-go="battle">' + (G.wave > 1 ? "CONTINUE RUN · WAVE " + pad(G.wave) : "START RUN") + '</button>' +
      '<div class="grid2">' +
        '<button data-go="camp">BASE CAMP<small>core, walls, builds</small></button>' +
        '<button data-go="upgrade">UPGRADE PORTAL<small>units and abilities</small></button>' +
        '<button data-go="squad">CHARACTER INVENTORY<small>heroes, gear, loadout</small></button>' +
        '<button data-go="maps">MULTIPLAYER MAPS<small>' + MAPS.length + ' battlegrounds</small></button>' +
      '</div>' +
      '<div class="card" style="margin-top:12px"><h2>OPERATOR</h2>' +
        '<div class="row" style="margin:0"><img src="' + heroIcon(hero()) + '">' +
        '<div class="m"><b>' + hero().name + '</b><span>' + hero().class + ' · ' + hero().role + ' · affinity ' + (hero().affinity || hero().class) + '</span></div>' +
        '<button data-go="squad">MANAGE</button></div></div>';
    wire(host());
  }
  function host() { return el("scr-dash").parentNode; }
  function wire(scope) {
    (scope || document).querySelectorAll("[data-go]").forEach(function (b) {
      b.onclick = function () { go(b.dataset.go); };
    });
  }

  /* ---------------- base camp ---------------- */
  function renderCamp() {
    var s = el("scr-camp");
    var segTotal = G.base.seg.reduce(function (a, b) { return a + b; }, 0);
    var segMax = SEG_MAX * 6;
    var missing = (segMax - segTotal) + (GATE_MAX - G.base.gates) + (CORE_MAX - G.base.core);
    var repairCost = Math.ceil(missing / 1000 * 40);
    var html = '<div class="kick">FORWARD OPERATING BASE</div><h2 style="margin-bottom:10px">BASE CAMP</h2>' +
      '<div class="basewrap" id="basevis">' +
        '<div class="barcore"><img src="' + icon("ab-radioactive") + '"></div>' +
      '</div>' +
      '<div class="barline"><span>RING SEGMENTS</span><span>' + money(segTotal) + ' / ' + money(segMax) + '</span></div>' +
      '<div class="track"><i style="width:' + clamp(segTotal / segMax * 100, 0, 100) + '%;background:#38f5e0"></i></div>' +
      '<div class="barline"><span>BLAST GATES</span><span>' + money(G.base.gates) + ' / ' + money(GATE_MAX) + '</span></div>' +
      '<div class="track"><i style="width:' + clamp(G.base.gates / GATE_MAX * 100, 0, 100) + '%;background:#8fd6ff"></i></div>' +
      '<div class="barline"><span>CORE SPIRE</span><span>' + money(G.base.core) + ' / ' + money(CORE_MAX) + '</span></div>' +
      '<div class="track"><i style="width:' + clamp(G.base.core / CORE_MAX * 100, 0, 100) + '%;background:#ff7b33"></i></div>' +
      '<div class="grid2" style="margin:12px 0">' +
        '<button id="do-repair">REPAIR ALL<small>' + (missing > 0 ? repairCost + " credits" : "already at full") + '</small></button>' +
        '<button data-go="upgrade">FORTIFY<small>permanent upgrades</small></button>' +
      '</div>' +
      '<h2>BUILD PLOTS</h2>' +
      '<div id="plots"></div>' +
      '<button class="cta" data-go="battle">LAUNCH WAVE ' + pad(G.wave) + '</button>';
    s.innerHTML = html;

    /* ring segments drawn around the core */
    var vis = el("basevis");
    var w = 230, h = 210;
    G.base.seg.forEach(function (v, i) {
      var ang = (i / 6) * Math.PI * 2 - Math.PI / 2;
      var seg = document.createElement("div");
      seg.className = "seg" + (v > 0 ? "" : " dead");
      seg.style.left = (50 + Math.cos(ang) * 34) + "%";
      seg.style.top = (50 + Math.sin(ang) * 34) + "%";
      seg.style.transform = "translate(-50%,-50%) rotate(" + (ang * 180 / Math.PI + 90) + "deg)";
      seg.title = "Segment " + (i + 1) + " · " + Math.round(v);
      vis.appendChild(seg);
    });

    var plots = el("plots");
    D.buildings.forEach(function (b) {
      var lv = buildLevel(b.building_id);
      var cost = buildCost(b);
      var row = document.createElement("div");
      row.className = "plot";
      row.innerHTML = '<img src="' + icon("ab-circuit") + '" style="width:20px;opacity:.8">' +
        '<div class="m"><b>' + b.name + ' · L' + lv + '/' + b.max_level + '</b>' +
        '<span>' + (b.effect || b.description || "") + '</span></div>' +
        '<button>' + (lv >= b.max_level ? "MAX" : money(cost) + " CR") + '</button>';
      var btn = row.querySelector("button");
      if (lv >= b.max_level) btn.classList.add("off");
      btn.onclick = function () {
        if (lv >= b.max_level) return;
        if (G.coins < cost) return toast("Need " + money(cost) + " CR");
        G.coins -= cost; G.builds[b.building_id] = lv + 1; save();
        toast(b.name + " to L" + (lv + 1));
        renderCamp();
      };
      plots.appendChild(row);
    });

    el("do-repair").onclick = function () {
      if (missing <= 0) return toast("Base is at full strength");
      if (G.coins < repairCost) return toast("Need " + repairCost + " CR");
      G.coins -= repairCost;
      G.base.seg = [SEG_MAX, SEG_MAX, SEG_MAX, SEG_MAX, SEG_MAX, SEG_MAX];
      G.base.gates = GATE_MAX; G.base.core = CORE_MAX;
      save(); renderCamp(); toast("Base repaired");
    };
    wire(el("scr-camp"));
  }

  /* ---------------- upgrade portal ---------------- */
  var upTab = "base";
  function renderUpgrade() {
    var s = el("scr-upgrade");
    s.innerHTML = '<div class="kick">UPGRADE PORTAL</div>' +
      '<div class="statrow" style="margin:6px 0 12px"><div class="stat"><b>' + money(G.coins) + '</b><span>CREDITS</span></div>' +
      '<div class="stat"><b>' + D.units.length + '</b><span>FRAMES</span></div>' +
      '<div class="stat"><b>' + G.abUnlocked.length + '/' + D.abilities.length + '</b><span>ABILITIES</span></div></div>' +
      '<div class="tabs"><button data-tab="base">BASE</button><button data-tab="units">UNITS</button>' +
      '<button data-tab="abilities">ABILITIES</button></div><div id="upbody"></div>';
    s.querySelectorAll("[data-tab]").forEach(function (b) {
      b.classList.toggle("on", b.dataset.tab === upTab);
      b.onclick = function () { upTab = b.dataset.tab; renderUpgrade(); };
    });
    var body = el("upbody");
    if (upTab === "base") {
      SHOP.forEach(function (item) {
        var rank = G.shop[item.id] || 0;
        var max = item.cost.length;
        var cost = rank < max ? item.cost[rank] : null;
        body.appendChild(rowEl("ab-base-dome", item.name + " · " + rank + "/" + max, item.desc,
          cost === null ? "MAX" : money(cost) + " CR", cost !== null && G.coins >= cost,
          function () {
            if (cost === null) return;
            if (G.coins < cost) return toast("Not enough credits");
            G.coins -= cost; G.shop[item.id] = rank + 1;
            if (item.id === "reactor") G.base.core = Math.min(CORE_MAX * 2, G.base.core * 1.15);
            save(); renderUpgrade(); toast(item.name + " upgraded");
          }));
      });
    } else if (upTab === "units") {
      D.units.slice().sort(function (a, b) { return a.tier - b.tier; }).forEach(function (u) {
        var lv = unitLevel(u.name), cost = unitUpgradeCost(u.name);
        var st = unitStats(u);
        body.appendChild(rowEl(unitIconName(u),
          u.name + " · L" + lv + "/5", u.class + " · T" + u.tier + " · " + st.atk + " ATK · " + st.hp + " HP · " + st.cost + " CR deploy",
          cost === null ? "MAX" : money(cost) + " CR", cost !== null && G.coins >= cost,
          function () {
            if (cost === null) return;
            if (G.coins < cost) return toast("Not enough credits");
            G.coins -= cost; G.unitLevels[u.name] = lv + 1;
            save(); renderUpgrade(); toast(u.name + " L" + (lv + 1));
          }));
      });
    } else {
      var classes = ["Universal", "Solo", "Netrunner", "Techie", "Medtech", "Nomad", "Corpo", "Cyberpsycho"];
      classes.forEach(function (cls) {
        var list = D.abilities.filter(function (a) { return a.class === cls; });
        if (!list.length) return;
        var head = document.createElement("h2");
        head.textContent = cls.toUpperCase() + " · " + list.filter(function (a) { return abUnlocked(a.ability_id); }).length + "/" + list.length;
        head.style.marginTop = "14px";
        body.appendChild(head);
        list.forEach(function (a) {
          var has = abUnlocked(a.ability_id), cost = abCost(a);
          body.appendChild(rowEl(AB_INDEX[a.ability_id], a.name + " · T" + a.tier,
            a.type + " · " + (a.description || ""),
            has ? "OWNED" : money(cost) + " CR", !has && G.coins >= cost,
            function () {
              if (has) return toast("Already unlocked");
              if (G.coins < cost) return toast("Not enough credits");
              G.coins -= cost; G.abUnlocked.push(a.ability_id);
              save(); renderUpgrade(); toast(a.name + " unlocked");
            }));
        });
      });
    }
  }
  function rowEl(iconName, title, sub, action, afford, onClick) {
    var d = document.createElement("div");
    d.className = "row";
    d.innerHTML = '<img src="' + icon(iconName) + '">' +
      '<div class="m"><b>' + title + '</b><span>' + sub + '</span></div>' +
      '<button>' + action + '</button>';
    var b = d.querySelector("button");
    if (!afford) b.classList.add("off");
    b.onclick = onClick;
    return d;
  }

  /* ---------------- character inventory ---------------- */
  function renderSquad() {
    var s = el("scr-squad");
    var h = hero();
    var slotHtml = "";
    for (var i = 0; i < 3; i++) {
      var aid = G.slots[i];
      var a = aid ? D.abilities.filter(function (x) { return x.ability_id === aid; })[0] : null;
      slotHtml += '<div class="row" data-slot="' + i + '"><img src="' + (a ? abIcon(a) : icon("ab-circuit")) + '">' +
        '<div class="m"><b>' + (a ? a.name : "Empty slot " + (i + 1)) + '</b>' +
        '<span>' + (a ? a.type + " · T" + a.tier + " · " + a.cooldown_seconds + "s" : "tap to equip") + '</span></div>' +
        '<button>' + (a ? "SWAP" : "EQUIP") + '</button></div>';
    }
    var w = G.wild ? D.abilities.filter(function (x) { return x.ability_id === G.wild; })[0] : null;
    slotHtml += '<div class="row" data-slot="3"><img src="' + (w ? abIcon(w) : icon("ab-boss-key")) + '">' +
      '<div class="m"><b>' + (w ? w.name : "Wildcard slot") + '</b>' +
      '<span>' + (w ? "any class · off-affinity surcharge" : "tap to equip any unlocked ability") + '</span></div>' +
      '<button>' + (w ? "SWAP" : "EQUIP") + '</button></div>';

    s.innerHTML = '<div class="kick">CHARACTER INVENTORY</div><h2>OPERATOR</h2>' +
      '<div class="row" style="margin-bottom:10px"><img src="' + heroIcon(h) + '">' +
        '<div class="m"><b>' + h.name + '</b><span>' + h.class + ' · ' + h.role + ' · T' + h.tier + '</span></div></div>' +
      '<div class="card"><div class="statrow" style="margin:0">' +
        '<div class="stat"><b>' + h.base_hp + '</b><span>HP</span></div>' +
        '<div class="stat"><b>' + h.base_attack + '</b><span>ATTACK</span></div>' +
        '<div class="stat"><b>' + h.base_defense + '</b><span>DEFENSE</span></div></div>' +
        '<div class="sub" style="margin-top:10px"><b style="color:#38f5e0">' + h.passive_name + '</b> · ' + h.passive_description + '</div>' +
      '</div>' +
      '<h2>HERO ROSTER</h2><div id="sq-heroes"></div>' +
      '<h2>LOADOUT</h2>' + slotHtml +
      '<h2>FRAME INVENTORY</h2><div id="sq-roster"></div>';

    var heroes = el("sq-heroes");
    D.heroes.forEach(function (x) {
      var owned = heroUnlocked(x.hero_id);
      var row = document.createElement("div");
      row.className = "row" + (x.hero_id === G.hero ? " sel" : "");
      row.innerHTML = '<img src="' + heroIcon(x) + '">' +
        '<div class="m"><b>' + x.name + '</b><span>' + x.class + ' · T' + x.tier + ' · ' + x.passive_name + '</span></div>' +
        '<button>' + (x.hero_id === G.hero ? "ACTIVE" : owned ? "SELECT" : money(x.unlock_coins) + " CR") + '</button>';
      var b = row.querySelector("button");
      if (!owned) b.classList.add("off");
      b.onclick = function () {
        if (owned) { G.hero = x.hero_id; save(); renderSquad(); return toast(x.name + " deployed"); }
        if (G.coins < x.unlock_coins) return toast("Need " + money(x.unlock_coins) + " CR");
        G.coins -= x.unlock_coins; G.heroesUnlocked.push(x.hero_id); G.hero = x.hero_id;
        save(); renderSquad(); toast(x.name + " recruited");
      };
      heroes.appendChild(row);
    });

    s.querySelectorAll("[data-slot]").forEach(function (row) {
      row.querySelector("button").onclick = function () { pickAbility(parseInt(row.dataset.slot, 10)); };
    });

    var roster = el("sq-roster");
    D.units.slice().sort(function (a, b) { return a.tier - b.tier; }).forEach(function (u) {
      var st = unitStats(u);
      roster.appendChild(rowEl(unitIconName(u), u.name + " · L" + unitLevel(u.name),
        u.class + " · " + u.role + " · " + st.atk + " ATK / " + st.hp + " HP",
        st.cost + " CR", true, function () { toast(u.name + " · " + (u.special_name || u.role)); }));
    });
  }

  function pickAbility(slot) {
    var list = D.abilities.filter(function (a) { return abUnlocked(a.ability_id); });
    var html = list.length ? "" : '<div class="empty">No abilities unlocked yet. Buy them in the Upgrade Portal.</div>';
    list.forEach(function (a) {
      html += '<div class="row" data-pick="' + a.ability_id + '"><img src="' + abIcon(a) + '">' +
        '<div class="m"><b>' + a.name + ' · T' + a.tier + '</b><span>' + a.class + ' · ' + a.type + ' · ' +
        (a.description || "") + '</span></div><button>EQUIP</button></div>';
    });
    openSheet("EQUIP ABILITY · " + (slot === 3 ? "WILDCARD" : "SLOT " + (slot + 1)), html);
    el("sheet").querySelectorAll("[data-pick]").forEach(function (row) {
      row.querySelector("button").onclick = function () {
        var id = row.dataset.pick;
        if (slot === 3) G.wild = id; else G.slots[slot] = id;
        save(); closeSheet(); renderSquad(); toast("Equipped");
      };
    });
  }

  /* ---------------- multiplayer maps ---------------- */
  function renderMaps() {
    var s = el("scr-maps");
    var html = '<div class="kick">BATTLEGROUNDS</div><h2>MULTIPLAYER MAPS</h2>' +
      '<p class="sub" style="margin-bottom:12px">Every map changes lane count, hostile scaling and payout. ' +
      'Squad slots are held by AI operators until live co-op ships.</p>';
    MAPS.forEach(function (m) {
      var sel = G.map === m.id;
      html += '<div class="card" style="' + (sel ? "border-color:#38f5e0" : "") + '">' +
        '<div style="display:flex;align-items:center;gap:8px">' +
          '<b style="font-size:12px;color:#e6fbf8">' + m.name.toUpperCase() + '</b>' +
          '<span style="margin-left:auto;font-size:8px;letter-spacing:.14em;color:' + (sel ? "#38f5e0" : "#5d7a81") + '">' +
          (sel ? "SELECTED" : "SELECT") + '</span></div>' +
        '<div class="sub" style="margin:6px 0">' + m.note + '</div>' +
        '<div class="chips" style="margin-bottom:9px">' +
          '<span class="chip">' + m.lanes + ' LANE' + (m.lanes > 1 ? "S" : "") + '</span>' +
          '<span class="chip">THREAT x' + m.diff.toFixed(2) + '</span>' +
          '<span class="chip">PAYOUT x' + m.payout.toFixed(2) + '</span>' +
          '<span class="chip">SQUAD 1-' + m.squad + '</span>' +
        '</div>' +
        '<button class="cta" style="margin:0" data-map="' + m.id + '">' + (sel ? "DEPLOY HERE" : "SELECT MAP") + '</button>' +
      '</div>';
    });
    s.innerHTML = html;
    s.querySelectorAll("[data-map]").forEach(function (b) {
      b.onclick = function () {
        if (G.map === b.dataset.map) { go("battle"); return; }
        G.map = b.dataset.map; G.wave = 1;
        save(); renderMaps(); toast(map().name + " selected");
      };
    });
  }

  /* ---------------- battle engine ---------------- */
  var B = {
    active: false, spawning: false, units: [], enemies: [], queue: [], spawnTimer: 0,
    mult: 1, armedUnit: null, armedAbility: null, last: 0, cooldowns: {}, kills: 0,
    over: false, paused: false, speed: 1, auto: true, deployT: 0, waveT: 2.0,
    pts: [], hudT: 0, pushing: false, waveStart: 0, loopOn: false, allies: []
  };
  var CORE_R = 46;
  var laneIndex = {};

  function buildPaths() {
    var st = el("stage").getBoundingClientRect();
    if (!st.width) return;
    var W = st.width, H = st.height, cx = W / 2, cy = H / 2;
    B.pts = map().paths.map(function (p) {
      var pts = p.map(function (c) { return { x: c[0] * W, y: c[1] * H }; });
      var last = pts[pts.length - 1];
      var dx = last.x - cx, dy = last.y - cy, len = Math.hypot(dx, dy) || 1;
      return pts.slice(0, -1).concat([{ x: cx + dx / len * (CORE_R + 14), y: cy + dy / len * (CORE_R + 14) }]);
    });
    var svg = el("paths");
    if (svg) {
      svg.setAttribute("viewBox", "0 0 " + W + " " + H);
      var out = "";
      B.pts.forEach(function (pts) {
        var d = pts.map(function (p, i) { return (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1); }).join(" ");
        out += '<path d="' + d + '" fill="none" stroke="rgba(56,245,224,.13)" stroke-width="24" stroke-linecap="round"/>';
        out += '<path d="' + d + '" fill="none" stroke="rgba(56,245,224,.42)" stroke-width="1.4" stroke-dasharray="6 9"/>';
      });
      svg.innerHTML = out;
    }
    var core = el("core");
    if (core) { core.style.left = cx + "px"; core.style.top = cy + "px"; }
  }

  function enterBattle() {
    el("b-map").textContent = map().name.toUpperCase() + " · " + map().lanes + " LANE" + (map().lanes > 1 ? "S" : "");
    buildPaths();
    if (!B.loopOn) { B.loopOn = true; requestAnimationFrame(loop); }
    hud();
    if (!B.active && G.wave === 1) toast("Tap DEPLOY to place units, then LAUNCH");
  }

  function sprite(cls, iconName, x, y) {
    var d = document.createElement("div");
    d.className = "sp " + cls;
    var img = document.createElement("img");
    img.src = icon(iconName); img.alt = "";
    d.appendChild(img);
    var bar = document.createElement("div");
    bar.className = "hp"; bar.innerHTML = "<i></i>";
    d.appendChild(bar);
    d._bar = bar.firstChild;
    d.style.transform = "translate(" + x + "px," + y + "px)";
    el("arena").appendChild(d);
    return d;
  }
  function place(o, x, y) {
    o.x = x; o.y = y;
    o.node.style.transform = "translate(" + x + "px," + y + "px)";
    o.node._bar.style.width = clamp(o.hp / o.hpMax * 100, 0, 100) + "%";
  }
  function tracer(a, b) {
    var dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy);
    var t = document.createElement("div");
    t.className = "tr";
    t.style.cssText = "left:" + a.x + "px;top:" + a.y + "px;width:" + len + "px;transform:rotate(" + Math.atan2(dy, dx) + "rad)";
    el("arena").appendChild(t);
    setTimeout(function () { t.remove(); }, 200);
  }
  function floater(x, y, txt) {
    var f = document.createElement("div");
    f.className = "flt"; f.textContent = txt;
    f.style.cssText = "left:" + x + "px;top:" + y + "px";
    el("arena").appendChild(f);
    setTimeout(function () { f.remove(); }, 820);
  }

  function deployAt(x, y, u, ally) {
    u = u || B.armedUnit;
    if (!u) return;
    var st = unitStats(u);
    if (!ally) {
      if (G.coins < st.cost) return toast("Need " + st.cost + " CR");
      G.coins -= st.cost;
    }
    var node = sprite(ally ? "u a" : "u", unitIconName(u), x, y);
    var unit = { name: u.name, class: u.class, hp: st.hp, hpMax: st.hp, atk: st.atk, def: st.def,
      range: st.range, rate: st.rate, cool: 0, x: x, y: y, node: node, ally: !!ally };
    place(unit, x, y);
    B.units.push(unit);
    if (!ally && u === B.armedUnit) B.armedUnit = null;
    return unit;
  }

  function autoDeploy(who) {
    var pool = D.units.slice().sort(function (a, b) { return unitStats(a).cost - unitStats(b).cost; });
    var afford = pool.filter(function (u) {
      return who ? who.coins >= unitStats(u).cost : (G.coins - unitStats(u).cost >= (B.units.length < 5 ? 0 : 140));
    });
    if (!afford.length) return;
    var pick = (Math.random() > 0.65) ? afford[Math.floor(Math.random() * afford.length)] : afford[0];
    var st = el("stage").getBoundingClientRect();
    var ang = Math.random() * Math.PI * 2, rad = 96 + Math.random() * 46;
    var x = clamp(st.width / 2 + Math.cos(ang) * rad, 22, st.width - 22);
    var y = clamp(st.height / 2 + Math.sin(ang) * rad, 22, st.height - 22);
    if (who) { who.coins -= unitStats(pick).cost; deployAt(x, y, pick, true); }
    else deployAt(x, y, pick);
  }

  function queueFor(wave) {
    var mult = (1 + (wave - 1) * 0.14) * map().diff;
    var pool = D.enemies.filter(function (e) { return !e.is_boss; });
    var count = clamp(5 + Math.round(wave * 0.8), 5, 24);
    var q = [];
    if (wave % 10 === 0) {
      var boss = D.enemies.filter(function (e) { return e.is_boss; })[(wave / 10 - 1) % 3];
      if (boss) q.push({ enemy: boss, boss: true, delay: 320 });
    }
    for (var i = 0; i < count; i++) {
      q.push({ enemy: pool[Math.floor(Math.random() * pool.length)], boss: false, delay: 620 });
    }
    return { q: q, mult: mult };
  }

  var ENEMY_ICON = {
    raider: "ab-bat-blade", wolf: "ab-beast-eye", bandit: "ab-bone-knife",
    enemy_archer: "ab-all-seeing-eye", enemy_shield_bearer: "ab-black-hand-shield",
    enemy_cavalry: "ab-bolt", dark_knight: "ab-bone-knife",
    enemy_necromancer: "ab-brain-dump", siege_tower: "ab-base-dome"
  };

  function banner(wave) {
    var w = D.waves.filter(function (x) { return Math.round(x.wave_number) === wave; })[0];
    var b = el("banner");
    b.querySelector("b").textContent = "WAVE " + pad(wave);
    b.querySelector("span").textContent = (w && w.wave_name ? w.wave_name : "").toUpperCase();
    b.classList.add("on");
    setTimeout(function () { b.classList.remove("on"); }, 1700);
  }

  function startWave() {
    if (B.active || B.over) return;
    var built = queueFor(G.wave);
    B.queue = built.q; B.mult = built.mult;
    B.active = true; B.spawning = true; B.spawnTimer = 250;
    B.waveStart = Date.now(); B.pushing = false;
    banner(G.wave);
    hud();
  }

  function spawn(entry) {
    var pts = B.pts[Math.floor(Math.random() * B.pts.length)] || (B.pts[0] || []);
    if (!pts.length) return;
    var e = entry.enemy, mult = B.mult;
    var hp = e.hp * (0.45 + mult * 0.75) * (entry.boss ? 2.6 : 1);
    var node = sprite(entry.boss ? "e boss" : "e",
      entry.boss ? "ab-boss-key" : (ENEMY_ICON[e.enemy_id] || "ab-bone-knife"), pts[0].x, pts[0].y);
    var enemy = {
      name: e.name, boss: !!entry.boss, pts: pts,
      hp: hp, hpMax: hp,
      atk: e.attack * (0.7 + mult * 0.3) * (entry.boss ? 1.9 : 1),
      def: e.defense || 0,
      speed: 30 + (e.speed || 2) * 12 - (entry.boss ? 10 : 0),
      ranged: /archer|siege|necromancer|drone/i.test(e.enemy_id),
      range: /archer|siege|necromancer|drone/i.test(e.enemy_id) ? 165 : 96,
      cool: 500, x: pts[0].x, y: pts[0].y, node: node
    };
    place(enemy, enemy.x, enemy.y);
    B.enemies.push(enemy);
  }

  function loop(ts) {
    if (!B.last) B.last = ts;
    var dt = Math.min(0.05, (ts - B.last) / 1000) * B.speed;
    B.last = ts;
    if (!B.paused && !B.over && current === "battle") step(dt);
    requestAnimationFrame(loop);
  }

  function step(dt) {
    B.pushing = B.active && (Date.now() - B.waveStart) / 1000 > 34;

    if (B.spawning) {
      B.spawnTimer -= dt * 1000;
      if (B.spawnTimer <= 0 && B.queue.length) {
        var entry = B.queue.shift();
        spawn(entry);
        B.spawnTimer = entry.delay;
      }
      if (!B.queue.length) B.spawning = false;
    }

    /* squad allies hold their own lane */
    B.allies.forEach(function (a) {
      a.coins += dt * 9;
      a.timer -= dt;
      if (a.timer <= 0) { a.timer = 3.2; if (B.units.filter(function (u) { return u.ally; }).length < (G.squad - 1) * 4) autoDeploy(a); }
    });

    if (B.auto) {
      B.deployT -= dt;
      if (B.deployT <= 0) { if (B.units.filter(function (u) { return !u.ally; }).length < 10) autoDeploy(); B.deployT = 1.0; }
      if (!B.active) { B.waveT -= dt; if (B.waveT <= 0) { startWave(); B.waveT = 2.0; } }
      else B.waveT = 2.0;
    }

    for (var i = B.enemies.length - 1; i >= 0; i--) {
      var e = B.enemies[i];
      if (e.hp <= 0) {
        e.node.remove(); B.enemies.splice(i, 1); B.kills++;
        var gain = Math.round((9 + e.hpMax / 40 + (e.boss ? 140 : 0)) * map().payout);
        G.coins += gain;
        floater(e.x, e.y, "+" + gain);
        hud();
        continue;
      }
      e.cool -= dt * 1000;
      var target = null, best = 1e9;
      for (var u = 0; u < B.units.length; u++) {
        var d = Math.hypot(B.units[u].x - e.x, B.units[u].y - e.y);
        if (d < best) { best = d; target = B.units[u]; }
      }
      if (target && best <= e.range && e.cool <= 0) {
        e.cool = 850;
        tracer(e, target);
        target.hp -= Math.max(3, e.atk * 0.8 - target.def * 0.35);
        place(target, target.x, target.y);
        if (target.hp <= 0) {
          target.node.remove();
          B.units.splice(B.units.indexOf(target), 1);
        }
      }
      var stopAt = e.ranged ? 0 : 62;
      if (!B.pushing && target && best <= stopAt) continue;
      var goal = e.pts[e.pts.length - 1];
      var dx = goal.x - e.x, dy = goal.y - e.y, dist = Math.hypot(dx, dy);
      if (dist < 8) {
        if (e.cool <= 0) { e.cool = 1000; hitBase(e.atk * 1.05); }
      } else {
        var sp = e.speed * dt * (B.pushing ? 1.7 : 1);
        e.x += dx / dist * Math.min(sp, dist);
        e.y += dy / dist * Math.min(sp, dist);
        place(e, e.x, e.y);
      }
    }

    for (var k = 0; k < B.units.length; k++) {
      var uu = B.units[k];
      uu.cool -= dt * 1000;
      if (uu.cool > 0) continue;
      var tgt = null, bd = 1e9;
      for (var j = 0; j < B.enemies.length; j++) {
        var en = B.enemies[j];
        var dd = Math.hypot(en.x - uu.x, en.y - uu.y);
        if (dd <= uu.range && dd < bd) { bd = dd; tgt = en; }
      }
      if (tgt) {
        uu.cool = uu.rate;
        tracer(uu, tgt);
        tgt.hp -= Math.max(5, uu.atk - (tgt.def || 0) * 0.4);
        place(tgt, tgt.x, tgt.y);
      }
    }

    if (B.active && !B.spawning && !B.enemies.length) {
      B.active = false;
      var w = D.waves.filter(function (x) { return Math.round(x.wave_number) === G.wave; })[0];
      var bonus = Math.round((w ? w.reward_coins : 80) * map().payout);
      G.coins += bonus;
      floater(el("stage").clientWidth / 2, el("stage").clientHeight / 2 - 60, "+" + bonus);
      if (G.wave >= 30) return endRun(true);
      G.wave++; G.best = Math.max(G.best, G.wave);
      save(); hud();
      if (!B.auto) toast("WAVE CLEAR · +" + bonus + " CR");
    }
    B.hudT -= dt;
    if (B.hudT <= 0) { B.hudT = 0.2; hud(); save(); }
  }

  function hitBase(dmg) {
    var alive = G.base.seg.map(function (v, i) { return v > 0 ? i : -1; }).filter(function (i) { return i >= 0; });
    if (alive.length) {
      var idx = alive[Math.floor(Math.random() * alive.length)];
      G.base.seg[idx] = Math.max(0, G.base.seg[idx] - dmg);
    } else if (G.base.gates > 0) {
      G.base.gates = Math.max(0, G.base.gates - dmg);
    } else {
      G.base.core = Math.max(0, G.base.core - dmg);
      if (G.base.core <= 0) endRun(false);
    }
    hud();
  }

  function endRun(won) {
    B.over = true; B.active = false; B.queue = []; B.spawning = false;
    G.runs++;
    if (won) { G.wave = 1; }
    save();
    el("overt").textContent = won ? "PROTOCOL COMPLETE" : "CORE LOST";
    el("overp").textContent = won
      ? "All thirty waves broken on " + map().name + ". " + B.kills + " hostiles down. The megablock is yours."
      : "The Spire went dark on wave " + pad(G.wave) + " at " + map().name + ". " + B.kills +
        " hostiles down. Upgrades and unlocks are kept.";
    el("over").classList.add("on");
  }

  function hud() {
    var hw = el("h-wave"), hc = el("h-coins"), ha = el("h-aura");
    if (hw) hw.textContent = pad(G.wave);
    if (hc) hc.textContent = money(G.coins);
    if (ha) ha.textContent = Math.round(G.aura || 0);
    var bar = el("core") && el("core").querySelector(".cb i");
    if (bar) bar.style.width = clamp(G.base.core / CORE_MAX * 100, 0, 100) + "%";
  }

  function fireAbility(a, x, y) {
    var cost = Math.max(8, Math.round((a.coin_cost || 100) / 12));
    var now = Date.now();
    if ((B.cooldowns[a.ability_id] || 0) > now) return toast("Cooling down");
    G.aura = G.aura || 30;
    if (G.aura < cost) return toast("Need " + cost + " aura");
    G.aura -= cost;
    B.cooldowns[a.ability_id] = now + (a.cooldown_seconds || 20) * 1000;
    var radius = a.tier >= 5 ? 200 : 110 + a.tier * 14;
    var dmg = 95 + (a.tier || 1) * 70;
    var ring = document.createElement("div");
    ring.style.cssText = "position:absolute;left:" + (x - radius / 2) + "px;top:" + (y - radius / 2) +
      "px;width:" + radius + "px;height:" + radius + "px;border:1px solid #38f5e0;border-radius:50%;pointer-events:none;opacity:.9";
    el("arena").appendChild(ring);
    setTimeout(function () { ring.remove(); }, 450);
    var hit = 0;
    B.enemies.forEach(function (e) {
      if (Math.hypot(e.x - x, e.y - y) <= radius) { e.hp -= dmg; place(e, e.x, e.y); hit++; }
    });
    toast(a.name + " · " + hit + " hit");
    hud();
  }

  /* ---------------- battle wiring ---------------- */
  function bindBattle() {
    el("stage").addEventListener("click", function (ev) {
      var st = el("stage").getBoundingClientRect();
      var x = ev.clientX - st.left, y = ev.clientY - st.top;
      if (Math.hypot(x - st.width / 2, y - st.height / 2) < CORE_R) return toast("That is the Core Spire");
      if (B.armedAbility) { var a = B.armedAbility; B.armedAbility = null; return fireAbility(a, x, y); }
      if (B.armedUnit) return deployAt(x, y);
      toast("DEPLOY → pick a frame → tap the ground");
    });

    el("b-units").onclick = function () {
      var html = '<div class="empty" style="margin-bottom:8px">Tap a frame, then tap the ground to place it.</div>';
      openSheet("DEPLOY UNITS", html);
      var bd = el("sheet").querySelector(".bd");
      D.units.slice().sort(function (a, b) { return a.tier - b.tier; }).forEach(function (u) {
        var st = unitStats(u);
        var row = rowEl("ab-bolt", u.name + " · L" + unitLevel(u.name),
          u.class + " · " + st.atk + " ATK · " + st.hp + " HP · " + st.range + " range",
          st.cost + " CR", G.coins >= st.cost, function () {
            B.armedUnit = u; B.armedAbility = null; closeSheet();
            toast(u.name + " armed · " + st.cost + " CR · tap the ground");
          });
        bd.appendChild(row);
      });
    };

    el("b-skills").onclick = function () {
      var html = "";
      G.slots.forEach(function (id, i) {
        if (!id) return;
        var a = D.abilities.filter(function (x) { return x.ability_id === id; })[0];
        if (!a) return;
        html += '<div class="row" data-cast="' + a.ability_id + '"><img src="' + abIcon(a) + '">' +
          '<div class="m"><b>' + a.name + ' · T' + a.tier + '</b><span>' + a.type + ' · ' +
          (a.description || "") + '</span></div><button>ARM</button></div>';
      });
      if (G.wild) {
        var w = D.abilities.filter(function (x) { return x.ability_id === G.wild; })[0];
        if (w) html += '<div class="row" data-cast="' + w.ability_id + '"><img src="' + abIcon(w) + '">' +
          '<div class="m"><b>' + w.name + ' · WILDCARD</b><span>' + (w.description || "") + '</span></div><button>ARM</button></div>';
      }
      if (!html) html = '<div class="empty">No abilities equipped. Unlock them in the Upgrade Portal, then equip in Squad.</div>';
      openSheet("HERO ABILITIES", html);
      el("sheet").querySelectorAll("[data-cast]").forEach(function (row) {
        row.querySelector("button").onclick = function () {
          var a = D.abilities.filter(function (x) { return x.ability_id === row.dataset.cast; })[0];
          B.armedAbility = a; B.armedUnit = null; closeSheet();
          toast(a.name + " armed · tap the ground");
        };
      });
    };

    el("launch").onclick = function () {
      if (B.active) return toast("Wave already running");
      B.auto = false; el("c-auto").classList.remove("on");
      startWave();
    };
    el("c-auto").onclick = function () {
      B.auto = !B.auto;
      el("c-auto").classList.toggle("on", B.auto);
      toast(B.auto ? "AUTO DEFENSE ON · sit back" : "AUTO DEFENSE OFF");
      if (B.auto) { B.deployT = 0; B.waveT = 1.2; }
    };
    el("c-pause").onclick = function () {
      B.paused = !B.paused;
      el("c-pause").classList.toggle("on", B.paused);
      toast(B.paused ? "PAUSED" : "RESUMED");
    };
    el("c-speed").onclick = function () {
      B.speed = B.speed === 1 ? 2 : (B.speed === 2 ? 3 : 1);
      el("c-speed").textContent = B.speed + "x";
    };
    el("sheet").querySelector(".hd button").onclick = closeSheet;
    el("over").querySelector("button").onclick = function () {
      el("over").classList.remove("on");
      B.enemies.forEach(function (e) { e.node.remove(); });
      B.units.forEach(function (u) { u.node.remove(); });
      B.enemies = []; B.units = []; B.queue = []; B.kills = 0;
      B.over = false; B.active = false; B.spawning = false;
      G.base = { seg: [SEG_MAX, SEG_MAX, SEG_MAX, SEG_MAX, SEG_MAX, SEG_MAX], gates: GATE_MAX, core: CORE_MAX };
      if (G.wave > 1) G.wave = 1;
      save(); hud(); go("camp");
    };
    window.addEventListener("resize", function () { setTimeout(buildPaths, 80); });
  }

  function setupAllies() {
    B.allies = [];
    for (var i = 1; i < G.squad; i++) B.allies.push({ coins: 300, timer: 2 + i });
  }

  /* ---------------- boot ---------------- */
  function boot() {
    shell();
    bindBattle();
    setupAllies();
    document.querySelectorAll("#nav button").forEach(function (b) {
      b.onclick = function () { go(b.dataset.go); };
    });
    go("dash");
  }

  window.NW_GAME = {
    state: B, save: G, go: go, startWave: startWave, deploy: deployAt,
    reset: function () { G = fresh(); save(); go("dash"); }
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(boot, 80); });
  else setTimeout(boot, 80);
})();
