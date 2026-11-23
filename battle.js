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
      hp: Math.round((260 + u.tier * 140) * lm * agg().hp),
      atk: Math.round((60 + u.tier * 38) * lm * agg().atk),
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

  function buildLv(name) {
    var b = D.buildings.filter(function (x) { return x.name === name; })[0];
    return b ? buildLevel(b.building_id) : 0;
  }
  function agg() {
    var plate = G.shop.plate || 0, reactor = G.shop.reactor || 0,
        armor = G.shop.armor || 0, hard = G.shop.hardpoint || 0;
    return {
      segMax: Math.round(SEG_MAX * (1 + 0.10 * plate + 0.08 * buildLv("Blast Barrier"))),
      coreMax: Math.round(CORE_MAX * (1 + 0.05 * reactor + 0.06 * buildLv("Core Spire"))),
      gateMax: Math.round(GATE_MAX * (1 + 0.06 * buildLv("Checkpoint Gate"))),
      leak: Math.max(0.3, 1 - 0.09 * armor),
      cap: 10 + hard * 2 + buildLv("Cybermod Bench"),
      coin: 1 + 0.06 * buildLv("Scrap Yard"),
      payout: 1 + 0.10 * buildLv("Credit Mint") + 0.08 * buildLv("Faction Hub"),
      atk: 1 + 0.05 * buildLv("Circuit Foundry"),
      hp: 1 + 0.06 * buildLv("Clone Bay"),
      abil: 1 + 0.08 * buildLv("Data Vault"),
      turrets: buildLv("Auto-Turret"),
      rails: buildLv("Rail Cannon")
    };
  }

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
      "html,body{margin:0;min-height:100%;background:#04070a;color:#dbeef2;overflow-x:hidden;overflow-y:auto;"
      ,"html{-webkit-text-size-adjust:100%}"
      ,"body{touch-action:pan-y pinch-zoom;overscroll-behavior-y:auto;-webkit-overflow-scrolling:touch}"
      ,"body.locked{overflow:hidden;height:100dvh;touch-action:pan-y}",
      "font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace;-webkit-text-size-adjust:100%;-webkit-tap-highlight-color:transparent}",
      "#app{position:relative;min-height:100dvh;display:flex;flex-direction:column;background:#04070a}"
      ,"body.locked #app{height:100dvh;min-height:0}",
      ".scr{flex:1 0 auto;display:none;padding:14px 14px calc(92px + env(safe-area-inset-bottom));touch-action:pan-y pinch-zoom}",
      ".scr.on{display:block}",
      ".scr.battle{padding:0;display:none;touch-action:pan-y}",
      ".scr.battle.on{display:flex;flex-direction:column;flex:1 1 auto;min-height:0}",
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
      "#nav{position:fixed;left:0;right:0;bottom:0;display:grid;grid-template-columns:repeat(5,1fr);padding-bottom:env(safe-area-inset-bottom);",
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
      "#b-bar{display:grid;grid-template-columns:repeat(3,1fr);gap:1px;border-top:1px solid rgba(56,245,224,.2);background:rgba(56,245,224,.16);margin-bottom:calc(56px + env(safe-area-inset-bottom))}",
      "#b-bar button{background:#070e11;border:0;color:#8fd6ff;font:10px ui-monospace,monospace;letter-spacing:.1em;padding:13px 2px}",
      "#b-bar button small{display:block;font-size:8px;color:#4d6a70;margin-top:3px}",
      "#b-bar #launch{background:#13261f;color:#7dffb0}",
      "#b-bar .ctrl .zb{min-width:34px;font-size:15px;font-weight:700;color:#8ff7e6}",
      "#b-bar .ctrl .zp{font-size:8px;letter-spacing:.06em;color:#63838a;min-width:26px;text-align:center}",
      "/* sheets */",
      "#sheet{position:fixed;left:0;right:0;bottom:0;max-height:74vh;padding-bottom:env(safe-area-inset-bottom);background:#060d10;border-top:1px solid #38f5e0;",
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
      "/* operator sheet */",
      ".oinv{position:relative}",
      ".otop{display:flex;align-items:center;gap:8px;padding:6px 0 10px}",
      ".otop .back{background:none;border:1px solid rgba(56,245,224,.25);color:#9fe9df;width:30px;height:26px;",
      "border-radius:3px;font:12px ui-monospace,monospace}",
      ".otop .ttl{font-size:10px;letter-spacing:.24em;color:#dfeef2}",
      ".otop .ver{font-size:8px;color:#4d6a70;letter-spacing:.12em}",
      ".otop .cr{margin-left:auto;font-size:10px;color:#ffd24a}",
      ".oid{border:1px solid rgba(56,245,224,.2);background:linear-gradient(135deg,#0b171b,#070e11 60%,#0a1418);padding:12px;display:flex;gap:13px;align-items:center;margin-bottom:10px;position:relative;overflow:hidden}",
      ".oid .holo{width:94px;height:94px;flex:none;border:1px solid rgba(56,245,224,.45);border-radius:4px;display:grid;",
      "place-items:center;background:radial-gradient(circle,rgba(56,245,224,.16),transparent 70%);box-shadow:0 0 18px rgba(56,245,224,.3) inset}",
      ".oid .holo img{width:58px;height:58px}"
      ,".oid .holo canvas{border-radius:3px}",
      ".oid .idn b{display:block;font-size:17px;letter-spacing:.06em;color:#f0fffd}",
      ".oid .lv{font-size:9px;letter-spacing:.18em;color:#7f99a0;margin:3px 0 5px}",
      ".oid .lv b{color:#38f5e0;font-size:9px}",
      ".tag{display:inline-block;font-size:7px;letter-spacing:.18em;padding:2px 6px;border:1px solid;border-radius:2px}",
      ".tag.leg{color:#ffb347;border-color:rgba(255,179,71,.6);background:rgba(255,179,71,.1)}",
      ".tag.epi{color:#c07bff;border-color:rgba(192,123,255,.6);background:rgba(192,123,255,.1)}",
      ".tag.rar{color:#38f5e0;border-color:rgba(56,245,224,.6);background:rgba(56,245,224,.1)}",
      ".tag.com{color:#8fb0b6;border-color:rgba(143,176,182,.45)}",
      ".xp{margin-top:7px}",
      ".xp .bar{height:4px;background:#101a1e;border-radius:2px;overflow:hidden}",
      ".xp .bar i{display:block;height:100%;background:linear-gradient(90deg,#38f5e0,#7dfff0)}",
      ".xp span{display:block;font-size:7px;color:#5d7a81;letter-spacing:.1em;margin-top:3px}",
      ".panel{border:1px solid rgba(56,245,224,.16);background:#070e11}",
      ".panel h3{margin:0;padding:8px 9px;font-size:9px;letter-spacing:.2em;color:#38f5e0;border-bottom:1px solid rgba(56,245,224,.14);display:flex;align-items:center;gap:6px}",
      ".panel h3 span{margin-left:auto;color:#63838a;letter-spacing:.08em}",
      ".statline{display:flex;align-items:center;gap:7px;padding:6px 9px;border-bottom:1px solid rgba(255,255,255,.04)}",
      ".statline:last-child{border-bottom:0}",
      ".statline img{width:13px;height:13px;opacity:.8}",
      ".statline .k{font-size:8px;letter-spacing:.1em;color:#7d9ba2;width:60px;flex:none}",
      ".statline .v{font-size:10px;color:#eafcfb;margin-left:auto;min-width:34px;text-align:right}",
      ".statline .pb{flex:1;height:3px;background:#101a1e;border-radius:2px;overflow:hidden;max-width:70px}",
      ".statline .pb i{display:block;height:100%}",
      ".bp{display:grid;grid-template-columns:repeat(5,1fr);gap:3px;padding:8px}",
      ".bp .cell{aspect-ratio:1;border:1px solid rgba(56,245,224,.13);background:#060c0f;display:grid;place-items:center;position:relative}",
      ".bp .cell.full{border-color:rgba(56,245,224,.35);background:#0a1418}",
      ".bp .cell img{width:19px;height:19px;opacity:.92}",
      ".bp .cell b{position:absolute;right:2px;bottom:1px;font-size:7px;color:#ffd24a}",
      ".bp .cell em{position:absolute;left:2px;top:1px;font-size:6px;color:#4d6a70;font-style:normal}",
      ".wep{padding:9px}",
      ".wep .wname{font-size:12px;color:#f0fffd;letter-spacing:.04em}",
      ".wep .wrow{display:flex;gap:6px;align-items:center;margin:8px 0}",
      ".wep .mod{width:32px;height:32px;border:1px solid rgba(56,245,224,.3);border-radius:3px;display:grid;place-items:center;background:#0a1418}",
      ".wep .mod img{width:19px;height:19px}",
      ".wep .mod.empty{border-style:dashed;border-color:rgba(255,255,255,.1)}",
      ".wep .dmg{margin-left:auto;text-align:right;font-size:9px;color:#ffd24a;letter-spacing:.08em}",
      ".wep .wimg{display:flex;align-items:center;justify-content:center;height:56px;background:radial-gradient(circle,rgba(255,179,71,.18),transparent 70%)}",
      ".wep .wimg img{width:44px;height:44px}",
      ".eq{display:grid;grid-template-columns:repeat(2,1fr);gap:5px;padding:8px}",
      ".eq .slot{border:1px solid rgba(56,245,224,.2);background:#060c0f;padding:7px;text-align:center}",
      ".eq .slot span{display:block;font-size:7px;letter-spacing:.14em;color:#5d7a81;margin-bottom:4px}",
      ".eq .slot img{width:20px;height:20px}",
      ".eq .slot .nm{font-size:8px;color:#bfe0e4;margin-top:4px;line-height:1.3}",
      ".eq .slot.empty{border-style:dashed;border-color:rgba(255,255,255,.1)}",
      ".twocol{display:grid;grid-template-columns:1fr;gap:9px}",
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
    polishCss();
    scoutCss();
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
        '<span class="hud"><span>W<b id="h-wave">01</b></span><span>H<b id="h-foes">0</b></span>' +
        '<span>CR<b id="h-coins">0</b></span><span class="au">AU<b id="h-aura">0</b></span>' +
        '<span class="cm">CB<b id="h-combo">0</b></span></span>' +
        '<div class="ctrl"><button id="c-zoomout" class="zb">−</button><span id="c-zoompct" class="zp">74%</span><button id="c-zoomin" class="zb">+</button>' +
        '<button id="c-recenter" title="Recenter">&#9678;</button><button id="c-pause">II</button><button id="c-speed">1x</button>' +
        '<button id="c-auto" class="on">AUTO</button></div>' +
      '</div>' +
      '<div id="stage"><svg id="paths"></svg><div id="arena"></div>' +
        '<div id="core"><img src="' + icon("ab-radioactive") + '" alt=""><div class="cb"><i></i></div></div>' +
        '<div id="banner"><b></b><span></span></div>' +
        '<div id="build"><div class="bp"><div class="bp-h"><span class="tag">BUILD PHASE</span>' +
          '<b id="bp-wave">WAVE 01 INCOMING</b>' +
          '<button class="hbtn" id="bp-min">▾</button>' +
          '<button class="hbtn" id="bp-auto">AUTO</button>' +
          '<span id="bp-pay"></span></div>' +
          '<div class="prev" id="bp-prev"></div>' +
          '<div class="grid" id="bp-grid"></div>' +
          '<button class="go" id="bp-go">LAUNCH WAVE</button>' +
        '</div></div>' +
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
    if (document.body) document.body.classList.toggle("locked", scr === "battle");
    try { window.scrollTo(0, 0); } catch (e) {}
    ["dash", "camp", "battle", "upgrade", "squad", "maps"].forEach(function (k) {
      var e = el("scr-" + k);
      if (e) e.classList.toggle("on", k === scr);
    });
    if (scr === "battle" && !B.active && !B.over) openBuild(0);
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
    var A0 = agg();
    var segMax = A0.segMax * 6, gateMax = A0.gateMax, coreMax = A0.coreMax;
    var missing = (segMax - segTotal) + (gateMax - G.base.gates) + (coreMax - G.base.core);
    var repairCost = Math.ceil(missing / 1000 * 40);
    var html = '<div class="kick">FORWARD OPERATING BASE</div><h2 style="margin-bottom:10px">BASE CAMP</h2>' +
      '<div class="basewrap" id="basevis"><canvas id="camp3d" width="600" height="420" ' +
        'style="width:100%;height:100%;display:block"></canvas></div>' +
      '<div class="barline"><span>RING SEGMENTS</span><span>' + money(segTotal) + ' / ' + money(segMax) + '</span></div>' +
      '<div class="track"><i style="width:' + clamp(segTotal / segMax * 100, 0, 100) + '%;background:#38f5e0"></i></div>' +
      '<div class="barline"><span>BLAST GATES</span><span>' + money(G.base.gates) + ' / ' + money(gateMax) + '</span></div>' +
      '<div class="track"><i style="width:' + clamp(G.base.gates / gateMax * 100, 0, 100) + '%;background:#8fd6ff"></i></div>' +
      '<div class="barline"><span>CORE SPIRE</span><span>' + money(G.base.core) + ' / ' + money(coreMax) + '</span></div>' +
      '<div class="track"><i style="width:' + clamp(G.base.core / coreMax * 100, 0, 100) + '%;background:#ff7b33"></i></div>' +
      '<div class="grid2" style="margin:12px 0">' +
        '<button id="do-repair">REPAIR ALL<small>' + (missing > 0 ? repairCost + " credits" : "already at full") + '</small></button>' +
        '<button data-go="upgrade">FORTIFY<small>permanent upgrades</small></button>' +
      '</div>' +
      '<h2>BUILD PLOTS</h2>' +
      '<div id="plots"></div>' +
      '<button class="cta" data-go="battle">LAUNCH WAVE ' + pad(G.wave) + '</button>';
    s.innerHTML = html;

    /* 3D base: core spire with live ring arcs */
    var cv = el("camp3d");
    if (cv && window.NW3D && window.NW3D.can3d) {
      try { window.NW3D.campView(cv, G.base.seg); } catch (e) {}
    } else if (cv) {
      cv.style.display = "none";
      var fallback = document.createElement("div");
      fallback.className = "barcore";
      fallback.innerHTML = '<img src="' + icon("ab-radioactive") + '">';
      el("basevis").appendChild(fallback);
    }

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
      var mx = agg();
      G.base.seg = [mx.segMax, mx.segMax, mx.segMax, mx.segMax, mx.segMax, mx.segMax];
      G.base.gates = mx.gateMax; G.base.core = mx.coreMax;
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
  function rarity(tier) {
    if (tier >= 5) return ["LEGENDARY", "leg"];
    if (tier === 4) return ["EPIC", "epi"];
    if (tier === 3) return ["RARE", "rar"];
    return ["STANDARD", "com"];
  }
  function level() { return 1 + Math.floor((G.kills || 0) / 25); }
  function xpIn() { return ((G.kills || 0) % 25) * 80; }

  function statLine(iconName, key, val, max, color) {
    var pct = max > 0 ? clamp(val / max * 100, 0, 100) : 0;
    return '<div class="statline"><img src="' + icon(iconName) + '"><span class="k">' + key + '</span>' +
      '<span class="pb"><i style="width:' + pct + '%;background:' + color + '"></i></span>' +
      '<span class="v">' + val + '</span></div>';
  }

  function renderSquad() {
    var s = el("scr-squad");
    var h = hero();
    var rar = rarity(h.tier);
    var lv = level();
    var core = Math.round(G.base.core / CORE_MAX * 100);
    var load = Math.round((G.abUnlocked.length * 1.2 + G.heroesUnlocked.length * 2) * 10) / 10;
    function abById(id) { return id ? D.abilities.filter(function (a) { return a.ability_id === id; })[0] || null : null; }
    var prim = abById(G.slots[0]);
    var mods = [G.slots[1], G.slots[2], G.wild];
    var slots = [
      { key: "OPTIC", icon: abById(G.wild), alt: "hero-cyber-eye", pick: 3 },
      { key: "DERMAL", icon: abById(G.slots[2]), alt: "hero-skull-mask", pick: 2 },
      { key: "NEURAL", icon: abById(G.slots[1]), alt: "hero-cyber-eye", pick: 1 },
      { key: "RIG", icon: prim, alt: "hero-briefcase", pick: 0 }
    ];

    /* backpack: unlocked abilities and hired frames as kit */
    var items = [];
    G.abUnlocked.forEach(function (id) {
      var a = D.abilities.filter(function (x) { return x.ability_id === id; })[0];
      if (a) items.push({ icon: AB_INDEX[a.ability_id], n: "T" + a.tier });
    });
    D.units.slice(0, 6).forEach(function (u) { items.push({ icon: unitIconName(u), n: "Lv" + unitLevel(u.name) }); });
    var cells = "";
    for (var i = 0; i < 25; i++) {
      var it = items[i];
      cells += '<div class="cell' + (it ? " full" : "") + '">' +
        (it ? '<em>' + it.n + '</em><img src="' + icon(it.icon) + '">' : "") + '</div>';
    }

    s.innerHTML =
      '<div class="oinv">' +
        '<div class="otop"><button class="back" id="inv-back">‹</button>' +
          '<div><div class="ttl">CHARACTER INVENTORY</div><div class="ver">OPERATOR SHEET · v2.0.1</div></div>' +
          '<div class="cr">' + money(G.coins) + ' CR</div></div>' +
        '<div class="oid">' +
          '<div class="holo"><canvas class="holo3d" width="188" height="188" style="width:94px;height:94px;display:block"></canvas></div>' +
          '<div style="flex:1;min-width:0">' +
            '<div class="idn"><b>' + h.name.toUpperCase() + '</b></div>' +
            '<div class="lv">LEVEL <b>' + lv + '</b> · ' + h.class.toUpperCase() + ' · <span class="tag ' + rar[1] + '">' + rar[0] + '</span></div>' +
            '<div class="xp"><div class="bar"><i style="width:' + (xpIn() / 2000 * 100) + '%"></i></div>' +
            '<span>XP ' + xpIn().toLocaleString("en-US") + ' / 2,000</span></div>' +
          '</div>' +
        '</div>' +

        '<div class="twocol">' +
          '<div class="panel"><h3>OPERATOR STATS<span>' + h.role.toUpperCase() + '</span></h3>' +
            statLine("ab-hearts", "HEALTH", h.base_hp, 1600, "#ff5d5d") +
            statLine("ab-lightning-branches", "ENERGY", Math.round(G.aura || 0), 90, "#8fd6ff") +
            statLine("ab-frozen-orb", "COOLANT", core, 100, "#38f5e0") +
            statLine("ab-backpack", "LOAD", load, 48, "#ffd24a") +
            statLine("ab-black-hand-shield", "ARMOR", h.base_defense, 140, "#c07bff") +
            statLine("ab-sprint", "SPEED", h.base_speed, 130, "#7dffb0") +
            statLine("ab-battery-pack", "STAMINA", 60 + h.tier * 6, 100, "#ffb347") +
            statLine("ab-hidden", "STEALTH", h.class === "Netrunner" ? 92 : h.class === "Solo" ? 71 : 44, 100, "#8fd6ff") +
          '</div>' +

          '<div class="panel"><h3>PRIMARY SYSTEM<span>' + (prim ? "EQUIPPED" : "EMPTY") + '</span></h3>' +
            '<div class="wep">' +
              '<div class="wname">' + (prim ? prim.name.toUpperCase() : "NO SYSTEM EQUIPPED") + '</div>' +
              '<div style="margin-top:4px">' + (prim ? '<span class="tag ' + (prim.tier >= 4 ? "leg" : "rar") + '">' +
                (prim.tier >= 4 ? "LIMITED EDITION" : "STANDARD ISSUE") + '</span>' : "") + '</div>' +
              '<div class="wimg"><img src="' + (prim ? abIcon(prim) : icon("ab-circuit")) + '"></div>' +
              '<div class="wrow">' +
                mods.map(function (id) {
                  var a = abById(id);
                  return '<div class="mod' + (a ? "" : " empty") + '">' + (a ? '<img src="' + abIcon(a) + '">' : "") + '</div>';
                }).join("") +
                '<div class="dmg">' + (prim ? 95 + prim.tier * 70 : 0) + ' DMG</div>' +
              '</div>' +
              '<div class="sub" style="font-size:8px">' + (prim ? prim.type + " · " + prim.cooldown_seconds + "s cooldown · " +
                (prim.description || "") : "Open the loadout to equip a signature system.") + '</div>' +
            '</div>' +
          '</div>' +

          '<div class="panel"><h3>BACKPACK<span>' + items.length + ' / 25 SLOTS</span></h3><div class="bp">' + cells + '</div></div>' +

          '<div class="panel"><h3>EQUIPMENT<span>TAP TO SWAP</span></h3><div class="eq">' +
            slots.map(function (sl, i) {
              var a = sl.icon;
              var nm = a ? a.name : "empty";
              return '<div class="slot' + (a ? "" : " empty") + '" data-eq="' + i + '">' +
                '<span>' + sl.key + '</span><img src="' + (a ? abIcon(a) : icon(sl.alt)) + '">' +
                '<div class="nm">' + nm.toUpperCase() + '</div></div>';
            }).join("") +
          '</div></div>' +
        '</div>' +

        '<h2 style="margin-top:14px">HERO ROSTER</h2><div id="sq-heroes"></div>' +
        '<div class="grid2" style="margin-top:10px">' +
          '<button id="inv-frames">FRAME INVENTORY<small>18 combat frames</small></button>' +
          '<button data-go="upgrade">ACQUIRE SYSTEMS<small>upgrade portal</small></button>' +
        '</div>' +
      '</div>';

    var hc = s.querySelector(".holo canvas");
    if (hc && window.NW3D && window.NW3D.can3d) {
      try { window.NW3D.portrait(hc, h.class, h.tier); } catch (e) {}
    }
    el("inv-back").onclick = function () { go("dash"); };
    el("inv-frames").onclick = function () { framesSheet(); };
    s.querySelectorAll("[data-go]").forEach(function (b) { b.onclick = function () { go(b.dataset.go); }; });
    s.querySelectorAll("[data-eq]").forEach(function (tile) {
      tile.onclick = function () {
        var i = parseInt(tile.dataset.eq, 10);
        pickAbility(slots[i].pick);
      };
    });

    /* hero roster */
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
  }

  function framesSheet() {
    var html = "";
    D.units.slice().sort(function (a, b) { return a.tier - b.tier; }).forEach(function (u) {
      var st = unitStats(u);
      html += '<div class="row"><img src="' + icon(unitIconName(u)) + '">' +
        '<div class="m"><b>' + u.name + ' · L' + unitLevel(u.name) + '</b><span>' + u.class + ' · ' + u.role +
        ' · ' + st.atk + ' ATK / ' + st.hp + ' HP</span></div><button class="off">' + st.cost + ' CR</button></div>';
    });
    openSheet("FRAME INVENTORY", html);
  }

  function pickAbility(slot) {
    var list = D.abilities.filter(function (a) { return abUnlocked(a.ability_id); });
    var html = list.length ? "" : '<div class="empty">No systems unlocked yet. Buy them in the Upgrade Portal.</div>';
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
        '<canvas class="mthumb" data-thumb="' + m.id + '" width="520" height="180" ' +
          'style="width:100%;height:92px;display:block;border:1px solid rgba(56,245,224,.12);margin:7px 0"></canvas>' +
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
    if (window.NW3D && window.NW3D.can3d) {
      MAPS.forEach(function (m) {
        var c = s.querySelector('[data-thumb="' + m.id + '"]');
        if (!c) return;
        try { window.NW3D.mapThumb(c, m.paths, m.id === G.map ? 0x38f5e0 : 0x1b6f7a); } catch (e) {}
      });
    }
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
    pts: [], hudT: 0, pushing: false, waveStart: 0, loopOn: false, allies: [], turrets: [],
    phase: "build", payLast: 0, combo: 0, comboT: 0, autoWave: false
  };
  var CORE_R = 46;
  var V3 = false;
  var laneIndex = {};


  /* ---------------- 3D adapter (falls back to DOM sprites) ---------------- */
  function ensure3D() {
    if (V3) return true;
    var N = window.NW3D;
    if (!N || !N.can3d || !N.init) return false;
    var stage = el("stage");
    var canvas = el("c3d");
    if (!canvas) {
      canvas = document.createElement("canvas");
      canvas.id = "c3d";
      canvas.style.cssText = "position:absolute;inset:0;width:100%;height:100%;display:block;touch-action:manipulation";
      stage.insertBefore(canvas, stage.firstChild);
    }
    var r = stage.getBoundingClientRect();
    if (!N.init(canvas, Math.round(r.width), Math.round(r.height))) return false;
    V3 = true;
    var svg = el("paths"), arena = el("arena"), core = el("core");
    if (svg) svg.style.display = "none";
    if (arena) arena.style.display = "none";
    if (core) core.style.display = "none";
    return true;
  }
  function is3D(node) { return !!(V3 && node && node.isObject3D); }
  function drop(node) {
    if (!node) return;
    if (is3D(node)) return window.NW3D.remove(node);
    if (node.remove) node.remove();
  }
  function fxTracer(a, b, color) {
    if (V3) return window.NW3D.tracer(a, b, color);
    tracer(a, b);
  }
  function fxBurst(x, y, color) {
    if (V3) return window.NW3D.burst(x, y, color);
  }

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
    if (ensure3D()) {
      window.NW3D.resize(W, H);
      window.NW3D.buildArena(B.pts);
      window.NW3D.setRings(G.base.seg);
      ensureScout();
    }
  }

  function buildTurrets() {
    B.turrets.forEach(function (t) { drop(t.node); });
    B.turrets = [];
    var A0 = agg();
    var specs = [];
    for (var i = 0; i < A0.turrets; i++) specs.push({ heavy: false, lvl: A0.turrets });
    for (var j = 0; j < A0.rails; j++) specs.push({ heavy: true, lvl: A0.rails });
    var st = el("stage").getBoundingClientRect();
    specs.forEach(function (sp, i) {
      var ang = Math.PI / 4 + (i / Math.max(1, specs.length)) * Math.PI * 1.5;
      var rad = 74;
      var x = st.width / 2 + Math.cos(ang) * rad;
      var y = st.height / 2 + Math.sin(ang) * rad;
      var node = V3 ? window.NW3D.addTurret({ x: x, y: y, heavy: sp.heavy })
                    : sprite("u", sp.heavy ? "ab-cannon" : "ab-turret", x, y);
      B.turrets.push({ x: x, y: y, cool: 0, heavy: sp.heavy, level: sp.lvl, node: node,
        rate: sp.heavy ? 1400 : 900, dmg: (sp.heavy ? 90 : 45) + 30 * sp.lvl, range: sp.heavy ? 230 : 190 });
    });
  }

  function stepTurrets(dt) {
    B.turrets.forEach(function (t) {
      t.cool -= dt * 1000;
      var tgt = null, bd = 1e9;
      for (var i = 0; i < B.enemies.length; i++) {
        var e = B.enemies[i], d = Math.hypot(e.x - t.x, e.y - t.y);
        if (d <= t.range && d < bd) { bd = d; tgt = e; }
      }
      if (tgt && V3 && window.NW3D.aim && t.node) window.NW3D.aim(t.node, tgt.x, tgt.y);
      if (!tgt || t.cool > 0) return;
      t.cool = t.rate;
      fxTracer(t, tgt, t.heavy ? 0xff7b33 : 0xffd24a);
      if (t.heavy) {
        B.enemies.forEach(function (e) {
          if (Math.hypot(e.x - t.x, e.y - t.y) <= 70) { e.hp -= t.dmg * 0.7; place(e, e.x, e.y); }
        });
        fxBurst(tgt.x, tgt.y, 0xff7b33);
      } else {
        tgt.hp -= t.dmg;
        place(tgt, tgt.x, tgt.y);
      }
    });
  }

  function enterBattle() {
    el("b-map").textContent = map().name.toUpperCase() + " · " + map().lanes + " LANE" + (map().lanes > 1 ? "S" : "");
    buildPaths();
    buildTurrets();
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
    if (is3D(o.node)) {
      window.NW3D.move(o.node, x, y);
      window.NW3D.setHp(o.node, clamp(o.hp / o.hpMax, 0, 1), !!o.boss);
      return;
    }
    o.node.style.transform = "translate(" + x + "px," + y + "px)";
    o.node._bar.style.width = clamp(o.hp / o.hpMax * 100, 0, 100) + "%";
  }
  function spawnUnitNode(u, x, y, ally) {
    if (V3) return window.NW3D.addUnit({ x: x, y: y, cls: u.class, ally: !!ally });
    return sprite(ally ? "u a" : "u", unitIconName(u), x, y);
  }
  function tracer(a, b) {
    if (V3) return window.NW3D.tracer(a, b);
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
    var node = spawnUnitNode(u, x, y, ally);
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
    var node = V3
      ? window.NW3D.addEnemy({ x: pts[0].x, y: pts[0].y, boss: !!entry.boss })
      : sprite(entry.boss ? "e boss" : "e",
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


  /* ---------------- scout layer: lane beacons and offscreen enemy arrows ---------------- */
  function scoutCss() {
    var st = document.createElement("style");
    st.textContent = [
      "#scout{position:absolute;inset:0;pointer-events:none;overflow:hidden;z-index:6}",
      "#scout .bc{position:absolute;transform:translate(-50%,-50%);width:26px;height:26px;border-radius:50%;border:2px solid #ff5d6c;background:rgba(255,93,108,.16);box-shadow:0 0 14px rgba(255,93,108,.8);animation:bcp 1.2s ease-in-out infinite}",
      "#scout .bc:after{content:'';position:absolute;inset:6px;border-radius:50%;background:#ff5d6c}",
      "#scout .bl{position:absolute;transform:translate(-50%,-190%);font:8px ui-monospace,monospace;letter-spacing:.12em;color:#ffb3bb;white-space:nowrap;text-shadow:0 0 6px #000}",
      "#scout .ar{position:absolute;transform:translate(-50%,-50%);min-width:30px;height:24px;padding:0 6px;border-radius:12px;background:rgba(255,93,108,.2);border:1px solid #ff5d6c;color:#ffd7db;font:700 10px ui-monospace,monospace;display:flex;align-items:center;justify-content:center;gap:3px;box-shadow:0 0 12px rgba(255,93,108,.55)}",
      "#scout .ar i{display:inline-block;font-style:normal;font-size:11px}",
      "#scout .ar.boss{border-color:#ffd24a;color:#ffe9a8;background:rgba(255,210,74,.2);box-shadow:0 0 14px rgba(255,210,74,.7)}",
      "@keyframes bcp{0%,100%{transform:translate(-50%,-50%) scale(1);opacity:.9}50%{transform:translate(-50%,-50%) scale(1.25);opacity:.55}}",
      "#c-recenter{opacity:.55}#c-recenter.on{opacity:1;border-color:#ffd24a;color:#ffd24a;box-shadow:0 0 10px rgba(255,210,74,.5)}",
      "#pan-hint{position:absolute;left:50%;bottom:8px;transform:translateX(-50%);font:8px ui-monospace,monospace;letter-spacing:.14em;color:#8fd6ff;background:rgba(4,10,14,.7);padding:3px 9px;border-radius:999px;pointer-events:none;opacity:0;transition:opacity .5s;z-index:6}",
      "#pan-hint.on{opacity:.9}"
    ].join("\n");
    document.head.appendChild(st);
  }

  function ensureScout() {
    var stage = el("stage");
    if (!stage || el("scout")) return;
    var d = document.createElement("div"); d.id = "scout"; stage.appendChild(d);
    var h = document.createElement("div"); h.id = "pan-hint"; h.textContent = "DRAG TO SCOUT LANES";
    stage.appendChild(h);
    setTimeout(function () { h.classList.add("on"); }, 800);
    setTimeout(function () { h.classList.remove("on"); }, 5200);
  }

  function updateScout() {
    var layer = el("scout");
    if (!layer || !V3 || !window.NW3D.project) return;
    var W = layer.clientWidth, H = layer.clientHeight, pad = 20, html = "";
    /* lane entrance beacons */
    (B.pts || []).forEach(function (pts, i) {
      if (!pts || !pts.length) return;
      var q = window.NW3D.project(pts[0].x, pts[0].y);
      if (!q) return;
      if (q.x > pad && q.x < W - pad && q.y > pad && q.y < H - pad) {
        html += '<div class="bc" style="left:' + q.x + 'px;top:' + q.y + 'px"></div>' +
                '<div class="bl" style="left:' + q.x + 'px;top:' + q.y + 'px">LANE ' + (i + 1) + '</div>';
      } else {
        var c = clampEdge(q.x, q.y, W, H, pad + 6);
        html += '<div class="ar" style="left:' + c.x + 'px;top:' + c.y + 'px"><i>' + c.arrow + '</i>L' + (i + 1) + '</div>';
      }
    });
    /* offscreen enemies grouped by screen edge */
    var groups = {};
    B.enemies.forEach(function (e) {
      var q = window.NW3D.project(e.x, e.y);
      if (!q) return;
      if (q.x > pad && q.x < W - pad && q.y > pad && q.y < H - pad) return;
      var c = clampEdge(q.x, q.y, W, H, pad + 6);
      var key = Math.round(c.x / 46) + ":" + Math.round(c.y / 46);
      var g = groups[key] || (groups[key] = { x: c.x, y: c.y, n: 0, boss: false, arrow: c.arrow });
      g.n++; if (e.boss) g.boss = true;
    });
    Object.keys(groups).forEach(function (k) {
      var g = groups[k];
      html += '<div class="ar' + (g.boss ? " boss" : "") + '" style="left:' + g.x + 'px;top:' + g.y + 'px"><i>' + g.arrow + "</i>" + g.n + "</div>";
    });
    layer.innerHTML = html;
  }

  function clampEdge(x, y, W, H, m) {
    var cx = W / 2, cy = H / 2, dx = x - cx, dy = y - cy;
    var k = Math.max(Math.abs(dx) / (cx - m), Math.abs(dy) / (cy - m), 0.0001);
    var ex = cx + dx / k, ey = cy + dy / k, ar;
    if (Math.abs(dx) / (cx || 1) > Math.abs(dy) / (cy || 1)) ar = dx > 0 ? "\u25B6" : "\u25C0";
    else ar = dy > 0 ? "\u25BC" : "\u25B2";
    return { x: ex, y: ey, arrow: ar };
  }

  function loop(ts) {
    if (V3) { var __now = Date.now(); if (!B.scoutAt || __now - B.scoutAt > 110) { B.scoutAt = __now; updateScout(); } }
    if (!B.last) B.last = ts;
    var dt = Math.min(0.05, (ts - B.last) / 1000) * B.speed;
    B.last = ts;
    if (!B.paused && !B.over && current === "battle") step(dt);
    if (V3 && current === "battle") window.NW3D.render();
    requestAnimationFrame(loop);
  }

  function step(dt) {
    G.aura = Math.min(90, (G.aura || 0) + dt * 1.4);
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

    if (B.comboT > 0) { B.comboT -= dt; if (B.comboT <= 0) B.combo = 0; }

    stepTurrets(dt);

    /* squad allies hold their own lane */
    B.allies.forEach(function (a) {
      a.coins += dt * 9;
      a.timer -= dt;
      if (a.timer <= 0) { a.timer = 3.2; if (B.units.filter(function (u) { return u.ally; }).length < (G.squad - 1) * 4) autoDeploy(a); }
    });

    if (B.auto) {
      B.deployT -= dt;
      if (B.deployT <= 0) { if (B.units.filter(function (u) { return !u.ally; }).length < agg().cap) autoDeploy(); B.deployT = 1.0; }
      if (!B.active && B.autoWave) { B.waveT -= dt; if (B.waveT <= 0) { startWave(); B.waveT = 2.0; } }
      else B.waveT = 2.0;
    }

    for (var i = B.enemies.length - 1; i >= 0; i--) {
      var e = B.enemies[i];
      if (e.hp <= 0) {
        drop(e.node); B.enemies.splice(i, 1); B.kills++; G.kills = (G.kills || 0) + 1;
        B.combo += 1; B.comboT = 2.6;
        var bounty = 3 + Math.min(18, B.combo * 2);
        G.coins += bounty;
        floater(e.x, e.y - 12, "+" + bounty);
        var gain = Math.round((9 + e.hpMax / 40 + (e.boss ? 140 : 0)) * map().payout * agg().coin);
        G.coins += gain;
        fxBurst(e.x, e.y, e.boss ? 0xff7b33 : 0xffd24a);
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
          drop(target.node);
          B.units.splice(B.units.indexOf(target), 1);
        }
      }
      var stopAt = e.ranged ? 0 : 62;
      if (!B.pushing && target && best <= stopAt) continue;
      var goal = e.pts[e.pts.length - 1];
      var dx = goal.x - e.x, dy = goal.y - e.y, dist = Math.hypot(dx, dy);
      if (dist < 8) {
        if (e.cool <= 0) { e.cool = 1000; hitBase(e.atk * 1.05 * agg().leak); }
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
      var bonus = Math.round((w ? w.reward_coins : 80) * map().payout * agg().payout);
      G.coins += bonus;
      floater(el("stage").clientWidth / 2, el("stage").clientHeight / 2 - 60, "+" + bonus);
      if (G.wave >= 30) return endRun(true);
      G.wave++; G.best = Math.max(G.best, G.wave);
      save(); hud();
      toast("WAVE CLEAR · +" + bonus + " CR");
      if (B.autoWave) { B.waveT = 1.6; }
      else openBuild(bonus);
    }
    B.hudT -= dt;
    if (B.hudT <= 0) { B.hudT = 0.2; hud(); save(); }
  }

  function shakeStage() {
    var st = el("stage");
    if (!st) return;
    st.classList.remove("shake");
    void st.offsetWidth;
    st.classList.add("shake");
    setTimeout(function () { st.classList.remove("shake"); }, 360);
  }

  function hitBase(dmg) {
    shakeStage();
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
    closeBuild();
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
    var hw = el("h-wave"), hc = el("h-coins"), ha = el("h-aura"), hf = el("h-foes");
    if (hf) hf.textContent = B.enemies.length + B.queue.length;
    if (hw) hw.textContent = pad(G.wave);
    if (hc) hc.textContent = money(G.coins);
    if (ha) ha.textContent = Math.round(G.aura || 0);
    if (V3) window.NW3D.setRings(G.base.seg);
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
    var dmg = Math.round((95 + (a.tier || 1) * 70) * agg().abil);
    if (V3) window.NW3D.blast(x, y, radius);
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
    function zoomBy(f) {
      if (!V3 || !window.NW3D.setZoom) return;
      window.NW3D.setZoom(window.NW3D.getZoom() * f);
      var pct = Math.round(window.NW3D.getZoom() * 100);
      var ro = el("c-zoompct");
      if (ro) ro.textContent = pct + "%";
      toast("ZOOM " + pct + "%");
    }
    function setZoomTo(z) {
      if (!V3 || !window.NW3D.setZoom) return;
      window.NW3D.setZoom(z);
      var ro = el("c-zoompct");
      if (ro) ro.textContent = Math.round(window.NW3D.getZoom() * 100) + "%";
    }
    /* double tap the battlefield to punch in and back out */
    var lastTap = 0;
    el("stage").addEventListener("touchend", function (ev) {
      if (!V3 || ev.touches.length) return;
      var now = Date.now();
      if (now - lastTap < 320) {
        setZoomTo(window.NW3D.getZoom() > 1.4 ? 0.74 : 2.1);
        lastTap = 0;
        return;
      }
      lastTap = now;
    });
    el("c-zoomin").onclick = function () { zoomBy(1.22); };
    el("c-zoomout").onclick = function () { zoomBy(1 / 1.22); };
    el("stage").addEventListener("wheel", function (ev) {
      if (!V3) return;
      ev.preventDefault();
      zoomBy(ev.deltaY < 0 ? 1.1 : 1 / 1.1);
    }, { passive: false });

    var pinchStart = 0, pinchZoom0 = 1, pinching = false;
    function touchGap(t) {
      return Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
    }
    el("stage").addEventListener("touchstart", function (ev) {
      if (!V3 || ev.touches.length !== 2) return;
      pinching = true;
      pinchStart = touchGap(ev.touches);
      pinchZoom0 = window.NW3D.getZoom ? window.NW3D.getZoom() : 1;
    }, { passive: true });
    el("stage").addEventListener("touchmove", function (ev) {
      if (!pinching || ev.touches.length !== 2) return;
      ev.preventDefault();
      var gap = touchGap(ev.touches);
      if (pinchStart > 8) window.NW3D.setZoom(pinchZoom0 * (gap / pinchStart));
    }, { passive: false });
    el("stage").addEventListener("touchend", function () {
      if (!pinching) return;
      pinching = false;
      setTimeout(function () { pinching = false; }, 240);
    });

    /* one finger or mouse drag pans the battlefield so you can scout incoming lanes */
    var dragging = false, dragMoved = false, dragX = 0, dragY = 0, suppressClick = 0;
    function dragStart(x, y) { dragging = true; dragMoved = false; dragX = x; dragY = y; }
    function dragMove(x, y) {
      if (!dragging || !V3 || !window.NW3D.panBy) return;
      var dx = x - dragX, dy = y - dragY;
      if (!dragMoved && Math.hypot(dx, dy) < 7) return;
      dragMoved = true;
      window.NW3D.panBy(dx, dy);
      dragX = x; dragY = y;
      var rc = el("c-recenter"); if (rc) rc.classList.add("on");
    }
    function dragEnd() {
      if (dragging && dragMoved) suppressClick = Date.now();
      dragging = false;
    }
    el("stage").addEventListener("touchstart", function (ev) {
      if (ev.touches.length === 1) dragStart(ev.touches[0].clientX, ev.touches[0].clientY);
      else dragging = false;
    }, { passive: true });
    el("stage").addEventListener("touchmove", function (ev) {
      if (pinching || ev.touches.length !== 1) return;
      dragMove(ev.touches[0].clientX, ev.touches[0].clientY);
      if (dragMoved) ev.preventDefault();
    }, { passive: false });
    el("stage").addEventListener("touchend", dragEnd);
    el("stage").addEventListener("mousedown", function (ev) { dragStart(ev.clientX, ev.clientY); });
    window.addEventListener("mousemove", function (ev) { dragMove(ev.clientX, ev.clientY); });
    window.addEventListener("mouseup", dragEnd);
    var rcBtn = el("c-recenter");
    if (rcBtn) rcBtn.onclick = function () {
      if (window.NW3D.recenter) window.NW3D.recenter();
      rcBtn.classList.remove("on");
      toast("CAMERA RECENTERED");
    };

    el("stage").addEventListener("click", function (ev) {
      if (pinching) return;
      if (Date.now() - suppressClick < 320) return;
      var st = el("stage").getBoundingClientRect();
      var x = ev.clientX - st.left, y = ev.clientY - st.top;
      if (V3 && window.NW3D.pick) {
        var hit = window.NW3D.pick(ev.clientX, ev.clientY, st);
        if (hit) { x = hit.x; y = hit.y; }
      }
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
      launchWave();
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
      B.enemies.forEach(function (e) { drop(e.node); });
      B.units.forEach(function (u) { drop(u.node); });
      B.enemies = []; B.units = []; B.queue = []; B.kills = 0;
      B.over = false; B.active = false; B.spawning = false;
      var mx2 = agg();
      G.base = { seg: [mx2.segMax, mx2.segMax, mx2.segMax, mx2.segMax, mx2.segMax, mx2.segMax], gates: mx2.gateMax, core: mx2.coreMax };
      if (G.wave > 1) G.wave = 1;
      save(); hud(); go("camp");
    };
    window.addEventListener("resize", function () { setTimeout(buildPaths, 80); });
    window.addEventListener("orientationchange", function () { setTimeout(buildPaths, 240); });
  }


  /* ---------------- polish layer ---------------- */
  function polishCss() {
    var st = document.createElement("style");
    st.textContent = [
      "#b-top{background:linear-gradient(180deg,rgba(9,20,24,.96),rgba(6,13,16,.92));backdrop-filter:blur(8px);box-shadow:0 1px 0 rgba(56,245,224,.18),0 8px 26px rgba(0,0,0,.5)}",
      "#b-top .hud b{text-shadow:0 0 10px rgba(255,210,74,.55)}",
      "#b-top .hud .cm b{color:#ff7bd0;text-shadow:0 0 10px rgba(255,123,208,.6)}",
      "#b-bar button{background:linear-gradient(180deg,rgba(12,26,30,.96),rgba(6,13,16,.96));transition:transform .08s}",
      "#b-bar button:active{transform:scale(.97)}",
      "#b-bar #launch{background:linear-gradient(180deg,#1c4a37,#123326);color:#8dffbe;box-shadow:inset 0 0 0 1px rgba(120,255,180,.25)}",
      "#stage.shake{animation:nwshake .34s ease-in-out}",
      "@keyframes nwshake{0%,100%{transform:translate(0,0)}15%{transform:translate(-4px,2px)}30%{transform:translate(4px,-2px)}45%{transform:translate(-3px,-2px)}60%{transform:translate(3px,2px)}80%{transform:translate(-1px,1px)}}",
      "#build{position:absolute;left:0;right:0;bottom:0;z-index:8;display:none;padding:6px;pointer-events:none}",
      "#build.on{display:block;animation:nwbp .3s ease-out}",
      "@keyframes nwbp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}",
      "#build .bp{pointer-events:auto;display:flex;flex-direction:column;gap:6px;max-height:44vh;overflow-y:auto;border:1px solid rgba(56,245,224,.3);border-radius:13px;padding:8px 9px 9px;background:linear-gradient(180deg,rgba(9,22,26,.98),rgba(4,10,13,.99));box-shadow:0 -6px 26px rgba(0,0,0,.7),inset 0 1px 0 rgba(255,255,255,.06)}",
      "#build .bp-h{display:flex;align-items:center;gap:6px}",
      "#build .tag{font:7px ui-monospace,monospace;letter-spacing:.16em;color:#04120f;background:#38f5e0;padding:3px 5px;border-radius:4px;font-weight:700;flex:0 0 auto}",
      "#build .bp-h b{font:9.5px ui-monospace,monospace;letter-spacing:.1em;color:#dff8ff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
      "#build #bp-pay{margin-left:auto;font:9.5px ui-monospace,monospace;color:#ffd24a;white-space:nowrap}",
      "#build .hbtn{flex:0 0 auto;border:1px solid rgba(56,245,224,.35);background:rgba(56,245,224,.1);color:#8ff7e6;font:8.5px ui-monospace,monospace;padding:4px 7px;border-radius:8px}",
      "#build .hbtn.on{background:#38f5e0;color:#04120f;border-color:#38f5e0}",
      "#build .prev{display:flex;flex-wrap:nowrap;gap:4px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none}",
      "#build .prev::-webkit-scrollbar{display:none}",
      "#build .chip{flex:0 0 auto;font:7.5px ui-monospace,monospace;letter-spacing:.05em;padding:3px 6px;border-radius:999px;border:1px solid rgba(56,245,224,.3);color:#9fe8e0;background:rgba(56,245,224,.07);white-space:nowrap}",
      "#build .chip.warn{border-color:rgba(255,90,90,.55);color:#ffa8a8;background:rgba(255,90,90,.1)}",
      "#build .grid{display:flex;gap:6px;overflow-x:auto;-webkit-overflow-scrolling:touch;scrollbar-width:none;padding-bottom:1px}",
      "#build .grid::-webkit-scrollbar{display:none}",
      "#build .card{flex:0 0 96px;border:1px solid color-mix(in srgb,var(--ac) 45%,transparent);border-top:2px solid var(--ac);border-radius:10px;background:linear-gradient(160deg,color-mix(in srgb,var(--ac) 16%,transparent),rgba(6,14,17,.8));padding:6px;text-align:left;color:#cfeef2;font:inherit;overflow:hidden;transition:transform .08s}",
      "#build .card:active{transform:scale(.97)}",
      "#build .card .cr{display:flex;align-items:center;gap:4px;margin-bottom:2px}",
      "#build .card .ci{width:16px;height:16px;object-fit:contain;filter:drop-shadow(0 0 4px var(--ac));flex:0 0 auto}",
      "#build .card b{display:block;font:7.5px ui-monospace,monospace;letter-spacing:.04em;color:#eafcff;line-height:1.15}",
      "#build .card span{display:none}",
      "#build .card .cp{display:block;margin-top:4px;font:8.5px ui-monospace,monospace;font-style:normal;color:#03110d;background:var(--ac);padding:2px 5px;border-radius:6px;font-weight:700;text-align:center}",
      "#build .card[disabled]{opacity:.38;filter:grayscale(.6)}",
      "#build .go{flex:0 0 auto;width:100%;border:0;border-radius:10px;padding:11px;font:10.5px ui-monospace,monospace;letter-spacing:.15em;color:#03110d;background:linear-gradient(180deg,#6cffbd,#23d386);box-shadow:0 6px 18px rgba(35,211,134,.28)}",
      "#build .go:active{transform:scale(.99)}",
      "#build .bp.mini .prev,#build .bp.mini .grid{display:none}",
      "#stage.building #scout{display:none}",
      "@media (max-width:440px){#b-top{gap:5px;padding:6px 7px}#b-top #b-map{display:none}#b-top .hud{gap:5px;font-size:9px}#b-top .ctrl{gap:3px}#b-top .ctrl button{min-width:26px;padding:4px 4px;font-size:9px}#b-top .ctrl .zp{min-width:22px;font-size:7.5px}}"
    ].join("");
    document.head.appendChild(st);
  }

  /* ---------------- build phase ---------------- */
  function buildingByName(n) {
    return (D.buildings || []).filter(function (x) { return x.name === n; })[0] || null;
  }

  function nextPreview() {
    var wave = G.wave;
    var mult = (1 + (wave - 1) * 0.14) * map().diff;
    var count = clamp(5 + Math.round(wave * 0.8), 5, 24);
    return { wave: wave, count: count, mult: mult, boss: wave % 10 === 0 };
  }

  function veteranPick() {
    var best = null;
    D.units.forEach(function (u) {
      var lv = unitLevel(u.name);
      if (lv >= 5) return;
      if (!best || lv < unitLevel(best.name)) best = u;
    });
    return best;
  }

  function buildCards() {
    var out = [];
    function add(id, name, desc, cost, ico, col) {
      out.push({ id: id, name: name, desc: desc, cost: cost, ico: ico, col: col, ok: cost !== null && G.coins >= cost });
    }
    var t = buildingByName("Auto-Turret");
    add("turret", "AUTO-TURRET", "Sentry that fires every 0.9s", t ? buildCost(t) : null, "ab-turret", "#38f5e0");
    var r = buildingByName("Rail Cannon");
    add("rail", "RAIL CANNON", "Heavy shot, splash on impact", r ? Math.round(buildCost(r) * 1.9) : null, "ab-cannon", "#ff7b33");
    var b = buildingByName("Blast Barrier");
    add("barrier", "BLAST BARRIER", "+10% ring segment integrity", b ? Math.round(buildCost(b) * 1.4) : null, "ab-shield", "#8fd6ff");
    add("repair", "FIELD REPAIR", "Restore 25% core and 15% ring", 240, "ab-heal", "#7dffb0");
    var v = veteranPick();
    add("veteran", "VETERAN", v ? "Level up " + v.name + " to L" + (unitLevel(v.name) + 1) : "Every unit is maxed",
        v ? unitUpgradeCost(v.name) : null, "ab-upgrade", "#ffd24a");
    return out;
  }

  function cardHtml(c) {
    var art = c.ico ? '<img class="ci" src="' + icon(c.ico) + '" alt="">' : "";
    return '<button class="card" data-buy="' + c.id + '" style="--ac:' + (c.col || "#38f5e0") + '"' +
      (c.ok ? "" : " disabled") + ">" +
      '<div class="cr">' + art + "<b>" + c.name + "</b></div>" +
      "<span>" + c.desc + "</span>" +
      '<i class="cp">' + (c.cost === null ? "MAXED" : money(c.cost) + " CR") + "</i></button>";
  }

  function renderBuild() {
    if (!el("build")) return;
    var p = nextPreview();
    el("bp-wave").textContent = "WAVE " + pad(p.wave) + " INCOMING";
    el("bp-pay").textContent = (B.payLast ? "+" + money(B.payLast) + " · " : "") + money(G.coins) + " CR";
    var mx = agg();
    var chips = '<span class="chip">' + p.count + " HOSTILES</span>" +
      '<span class="chip">THREAT ' + p.mult.toFixed(2) + "x</span>" +
      '<span class="chip">' + Math.round(G.base.core / Math.max(1, mx.coreMax) * 100) + "% CORE</span>" +
      '<span class="chip">' + Math.round(G.base.seg.reduce(function (a, b) { return a + b; }, 0) /
        Math.max(1, mx.segMax * 6) * 100) + "% RING</span>";
    if (p.boss) chips += '<span class="chip warn">BOSS WAVE</span>';
    el("bp-prev").innerHTML = chips;
    el("bp-grid").innerHTML = buildCards().map(cardHtml).join("");
    el("bp-grid").querySelectorAll("[data-buy]").forEach(function (n) {
      n.onclick = function () { buy(n.getAttribute("data-buy")); };
    });
    var ab = el("bp-auto");
    if (ab) {
      ab.textContent = B.autoWave ? "AUTO ON" : "AUTO";
      ab.className = "hbtn" + (B.autoWave ? " on" : "");
      ab.onclick = function () {
        B.autoWave = !B.autoWave;
        if (B.autoWave) { launchWave(); }
        else renderBuild();
      };
    }
    var mb = el("bp-min");
    if (mb) {
      var bpEl = el("build").querySelector(".bp");
      mb.textContent = bpEl && bpEl.classList.contains("mini") ? "▴" : "▾";
      mb.onclick = function () {
        if (!bpEl) return;
        bpEl.classList.toggle("mini");
        mb.textContent = bpEl.classList.contains("mini") ? "▴" : "▾";
      };
    }
    el("bp-go").textContent = "LAUNCH WAVE " + pad(p.wave);
    el("bp-go").onclick = function () { launchWave(); };
  }

  function openBuild(pay) {
    B.phase = "build";
    var stg = el("stage");
    if (stg) stg.classList.add("building");
    B.payLast = pay || 0;
    renderBuild();
    var b = el("build");
    if (b) b.classList.add("on");
  }

  function closeBuild() {
    var b = el("build");
    if (b) b.classList.remove("on");
    var stg = el("stage");
    if (stg) stg.classList.remove("building");
    B.phase = "wave";
  }

  function launchWave() {
    if (B.active || B.over) return;
    closeBuild();
    B.auto = false;
    var ca = el("c-auto");
    if (ca) ca.classList.remove("on");
    startWave();
  }

  function buy(id) {
    var cards = buildCards();
    var c = cards.filter(function (x) { return x.id === id; })[0];
    if (!c || c.cost === null) return toast("Already maxed");
    if (G.coins < c.cost) return toast("Need " + money(c.cost) + " CR");
    G.coins -= c.cost;
    if (id === "repair") {
      var mx = agg();
      G.base.core = Math.min(mx.coreMax, G.base.core + mx.coreMax * 0.25);
      G.base.seg = G.base.seg.map(function (v) { return Math.min(mx.segMax, v + mx.segMax * 0.15); });
    } else if (id === "veteran") {
      var u = veteranPick();
      if (u) G.unitLevels[u.name] = unitLevel(u.name) + 1;
    } else {
      var nm = { turret: "Auto-Turret", rail: "Rail Cannon", barrier: "Blast Barrier" }[id];
      var bd = buildingByName(nm);
      if (bd) {
        G.builds[bd.building_id] = buildLevel(bd.building_id) + 1;
        if (id === "turret" || id === "rail") buildTurrets();
      }
    }
    save(); hud(); renderBuild();
    toast(c.name + " ONLINE");
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
