/* NEON WASTELAND: SIEGE PROTOCOL - full screen battle view
   Watch mode: hostiles march a road into the Core Spire, your units hold the
   line, waves auto-advance. Menus live behind the bottom dock.
   Art: free game-icons.net SVG set only, nothing generated. */
(function () {
  var D = window.NW_DATA;
  if (!D) return;

  var CORE_R = 46;
  var PATHS = [
    [[-0.06, 0.14], [0.26, 0.14], [0.26, 0.40], [0.485, 0.485]],
    [[-0.06, 0.86], [0.26, 0.86], [0.26, 0.60], [0.485, 0.515]],
    [[1.06, 0.50], [0.74, 0.50], [0.515, 0.50]]
  ];

  var B = {
    wave: 0, active: false, spawning: false, units: [], enemies: [],
    queue: [], spawnTimer: 0, mult: 1, armedUnit: null, armedAbility: null,
    last: 0, cooldowns: {}, kills: 0, leaks: 0,
    segHP: [1200, 1200, 1200, 1200, 1200, 1200],
    over: false, paused: false, speed: 1, auto: true, autoTimer: 0, deployT: 0, waveT: 2.4,
    pts: [], hudT: 0
  };

  var ICON_CLASS = {
    Solo: "hero-skull-mask", Netrunner: "hero-cyber-eye", Techie: "hero-mechanic-garage",
    Medtech: "hero-doctor-face", Nomad: "hero-full-motorcycle-helmet",
    Corpo: "hero-briefcase", Cyberpsycho: "hero-brute"
  };
  var ENEMY_ICON = {
    raider: "ab-bat-blade", wolf: "ab-beast-eye", bandit: "ab-bone-knife",
    enemy_archer: "ab-all-seeing-eye", enemy_shield_bearer: "ab-black-hand-shield",
    enemy_cavalry: "ab-bolt", dark_knight: "ab-bone-knife",
    enemy_necromancer: "ab-brain-dump", siege_tower: "ab-base-dome"
  };

  function el(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function iconUrl(n) { return (window.NW_ICON_SRC && window.NW_ICON_SRC[n]) || ""; }

  function stats(u) {
    var r = (u.role || "").toLowerCase();
    var ranged = /range|long|mortar|quickhack|anti-armor|siege|scout|drone/.test(r);
    return {
      hp: 260 + u.tier * 140, atk: 60 + u.tier * 38, def: 12 + u.tier * 9,
      range: ranged ? 190 : 110, rate: ranged ? 900 : 700, cost: u.deploy_cost_aura * 10
    };
  }
  function waveMult(w) { return 1 + (w - 1) * 0.14; }

  /* ---------------- shell ---------------- */
  function css() {
    var s = document.createElement("style");
    s.textContent = [
      "#nw{display:none!important}",
      "html,body{margin:0;background:#05080a;height:100%;overflow:hidden;-webkit-text-size-adjust:100%}",
      "#gx{position:fixed;inset:0;display:flex;flex-direction:column;background:#05080a;color:#dfeef2;",
      "font:12px/1.35 ui-monospace,SFMono-Regular,Menlo,monospace;z-index:1000}",
      "#gx-top{display:flex;align-items:center;gap:8px;padding:8px 10px;border-bottom:1px solid rgba(56,245,224,.18);",
      "background:linear-gradient(180deg,#081316,#060b0d)}",
      ".gx-brand{font-size:10px;letter-spacing:.18em;color:#38f5e0;white-space:nowrap}",
      ".gx-hud{display:flex;gap:10px;margin-left:auto;font-size:11px}",
      ".gx-hud b{color:#ffd24a;font-weight:600}",
      ".gx-hud .au b{color:#8fd6ff}",
      ".gx-hud .wv b{color:#ff7b33}",
      ".gx-ctrl{display:flex;gap:5px;margin-left:8px}",
      ".gx-ctrl button{background:#0c1418;border:1px solid rgba(56,245,224,.28);color:#9fe9df;",
      "font:10px ui-monospace,monospace;padding:5px 7px;border-radius:3px;letter-spacing:.08em}",
      ".gx-ctrl button.on{background:#123033;border-color:#38f5e0;color:#38f5e0;box-shadow:0 0 10px rgba(56,245,224,.35)}",
      "#gx-stage{position:relative;flex:1;overflow:hidden;background:radial-gradient(ellipse at 50% 52%,#0b1418 0%,#060a0c 62%,#040708 100%)}",
      "#gx-paths{position:absolute;inset:0;width:100%;height:100%;pointer-events:none}",
      "#arena{position:absolute;inset:0}",
      ".sp{position:absolute;width:30px;height:30px;margin:-15px 0 0 -15px;display:grid;place-items:center;border-radius:50%;will-change:transform}",
      ".sp img{width:19px;height:19px}",
      ".sp.u{border:1px solid #38f5e0;background:rgba(56,245,224,.14);box-shadow:0 0 12px rgba(56,245,224,.4)}",
      ".sp.e{border:1px solid #ff5d5d;background:rgba(255,93,93,.14);box-shadow:0 0 10px rgba(255,93,93,.35)}",
      ".sp.boss{width:48px;height:48px;margin:-24px 0 0 -24px;border-width:2px;box-shadow:0 0 26px rgba(255,93,93,.6)}",
      ".sp.boss img{width:30px;height:30px}",
      ".hp{position:absolute;top:-6px;left:50%;transform:translateX(-50%);width:26px;height:3px;background:#131a20;border-radius:2px;overflow:hidden}",
      ".hp i{display:block;height:100%;background:#38f5e0}",
      ".sp.e .hp i{background:#ff5d5d}",
      "#gx-core{position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);width:96px;height:96px;",
      "border:2px solid #ff7b33;border-radius:50%;display:grid;place-items:center;",
      "box-shadow:0 0 28px rgba(255,123,51,.55),inset 0 0 40px rgba(255,123,51,.15);background:rgba(255,123,51,.07)}",
      "#gx-core img{width:44px;height:44px}",
      "#gx-core .cring{position:absolute;width:132px;height:132px;border:1px dashed rgba(255,123,51,.35);border-radius:50%}",
      ".corebar{position:absolute;left:50%;bottom:-16px;transform:translateX(-50%);width:86px;height:4px;background:#1a1207;border-radius:2px;overflow:hidden}",
      ".corebar i{display:block;height:100%;background:#ff7b33}",
      ".tr{position:absolute;height:2px;transform-origin:0 50%;background:linear-gradient(90deg,rgba(56,245,224,.9),rgba(56,245,224,0));pointer-events:none;animation:tf .18s linear forwards}",
      "@keyframes tf{to{opacity:0}}",
      ".flt{position:absolute;font-size:10px;color:#ffd24a;pointer-events:none;animation:fl .8s ease-out forwards;text-shadow:0 0 8px rgba(255,210,74,.6)}",
      "@keyframes fl{to{transform:translateY(-26px);opacity:0}}",
      "#gx-banner{position:absolute;left:0;right:0;top:34%;text-align:center;pointer-events:none;opacity:0;transition:opacity .3s}",
      "#gx-banner.on{opacity:1}",
      "#gx-banner b{display:block;font-size:19px;letter-spacing:.26em;color:#38f5e0;text-shadow:0 0 18px rgba(56,245,224,.6)}",
      "#gx-banner span{font-size:10px;letter-spacing:.2em;color:#7fb9b3}",
      "#gx-dock{display:grid;grid-template-columns:repeat(5,1fr);gap:1px;background:rgba(56,245,224,.14);border-top:1px solid rgba(56,245,224,.2)}",
      "#gx-dock button{background:#070d10;border:0;color:#8fd6ff;font:10px ui-monospace,monospace;letter-spacing:.1em;padding:12px 2px}",
      "#gx-dock button small{display:block;color:#4d6a70;font-size:8px;letter-spacing:.06em}",
      "#gx-dock #gx-launch{background:#132a20;color:#7dffb0}",
      "#gx-dock button:active{background:#0d1a1e}",
      "#gx-sheet{position:fixed;left:0;right:0;bottom:0;max-height:76vh;background:#060d10;border-top:1px solid #38f5e0;",
      "transform:translateY(102%);transition:transform .22s ease;z-index:60;display:flex;flex-direction:column}",
      "#gx-sheet.on{transform:translateY(0)}",
      "#gx-sheet .hd{display:flex;align-items:center;padding:9px 12px;border-bottom:1px solid rgba(56,245,224,.16)}",
      "#gx-sheet .hd b{font-size:10px;letter-spacing:.2em;color:#38f5e0}",
      "#gx-sheet .hd button{margin-left:auto;background:none;border:1px solid rgba(56,245,224,.3);color:#9fe9df;padding:4px 10px;font:10px ui-monospace,monospace;border-radius:3px}",
      "#gx-sheet .bd{overflow-y:auto;padding:10px 12px 18px;-webkit-overflow-scrolling:touch}",
      "#gx-sheet .unit{border:1px solid rgba(56,245,224,.2);padding:9px;background:#0a1114;margin-bottom:7px;font-size:10px}",
      "#gx-sheet .unit.sel{border-color:#38f5e0;box-shadow:0 0 0 1px #38f5e0 inset}",
      ".ucost{color:#ffd24a;font-size:9px;margin-top:3px}",
      "#gx-toast{position:fixed;left:50%;bottom:78px;transform:translateX(-50%);background:#0b1418;border:1px solid #38f5e0;",
      "color:#38f5e0;padding:8px 14px;font:10px ui-monospace,monospace;letter-spacing:.1em;z-index:90;pointer-events:none;opacity:0;transition:opacity .15s}",
      "#gx-toast.on{opacity:1}",
      "#gx-over{position:fixed;inset:0;background:rgba(3,6,8,.92);display:none;place-items:center;z-index:120;text-align:center;padding:24px}",
      "#gx-over.on{display:grid}",
      "#gx-over h1{font-size:20px;letter-spacing:.24em;color:#ff7b33;margin:0 0 10px}",
      "#gx-over p{color:#9fb4b8;font-size:11px;max-width:320px;margin:0 auto 18px;line-height:1.6}",
      "#gx-over button{background:#0d1a1e;border:1px solid #38f5e0;color:#38f5e0;padding:11px 22px;font:11px ui-monospace,monospace;letter-spacing:.16em;border-radius:3px}"
    ].join("");
    document.head.appendChild(s);
  }

  function shell() {
    css();
    var gx = document.createElement("div");
    gx.id = "gx";
    gx.innerHTML =
      '<div id="gx-top">' +
        '<div class="gx-brand">NEON WASTELAND</div>' +
        '<div class="gx-hud">' +
          '<span class="wv">W<b id="gx-wave">01</b>/30</span>' +
          '<span>CR<b id="gx-coins">0</b></span>' +
          '<span class="au">AU<b id="gx-aura">0</b></span>' +
        '</div>' +
        '<div class="gx-ctrl">' +
          '<button id="gx-pause" title="pause">II</button>' +
          '<button id="gx-speed">1x</button>' +
          '<button id="gx-auto" class="on">AUTO</button>' +
        '</div>' +
      '</div>' +
      '<div id="gx-stage">' +
        '<svg id="gx-paths"></svg>' +
        '<div id="arena"></div>' +
        '<div id="gx-core"><div class="cring"></div><img id="gx-coreicon" alt=""/><div class="corebar"><i></i></div></div>' +
        '<div id="gx-banner"><b></b><span></span></div>' +
      '</div>' +
      '<div id="gx-dock">' +
        '<button data-sheet="units">UNITS<small id="gx-d-units">18</small></button>' +
        '<button data-sheet="skills">SKILLS<small>150</small></button>' +
        '<button data-sheet="base">BASE<small>shop</small></button>' +
        '<button data-sheet="waves">WAVES<small>30</small></button>' +
        '<button id="gx-launch">LAUNCH<small>wave</small></button>' +
      '</div>' +
      '<div id="gx-sheet"><div class="hd"><b></b><button>CLOSE</button></div><div class="bd"></div></div>' +
      '<div id="gx-toast"></div>' +
      '<div id="gx-over"><div><h1 id="gx-overt"></h1><p id="gx-overp"></p><button>RUN IT AGAIN</button></div></div>';
    document.body.appendChild(gx);
    var ci = el("gx-coreicon");
    if (ci) ci.src = iconUrl("ab-radioactive");
  }

  /* move the app's existing panels into sheets */
  function collect() {
    var SK = {
      units: [["units"]],
      skills: [["heroes"], ["loadout"], ["filters"], ["q"], ["abilities"]],
      base: [["ringSegs"], ["gateBar"], ["coreBar"], ["baseNumbers"], ["shop"]],
      waves: [["waves"], ["enemies"], ["buildings"]]
    };
    Object.keys(SK).forEach(function (key) {
      var body = el("gx-sheet").querySelector(".bd");
      var wrap = document.createElement("div");
      wrap.className = "gx-pane";
      wrap.dataset.pane = key;
      SK[key].forEach(function (pair) {
        var n = el(pair[0]);
        if (!n) return;
        var holder = n.parentElement;
        wrap.appendChild(holder && holder.id === "" ? n : n);
      });
      body.appendChild(wrap);
    });
    /* search box needs its own wrapper so it stays usable */
    var q = el("q");
    if (q) {
      var box = document.createElement("div");
      box.style.cssText = "display:flex;gap:6px;margin-bottom:8px";
      q.parentNode && q.parentNode.removeChild(q);
      box.appendChild(q);
      var pane = el("gx-sheet").querySelector('[data-pane="skills"]');
      if (pane) pane.insertBefore(box, pane.firstChild);
    }
  }

  /* ---------------- geometry ---------------- */
  function buildPaths() {
    var st = el("gx-stage").getBoundingClientRect();
    var W = st.width, H = st.height;
    B.pts = PATHS.map(function (p) {
      var pts = p.map(function (c) { return { x: c[0] * W, y: c[1] * H }; });
      return trimToCore(pts, W / 2, H / 2, CORE_R + 14);
    });
    var svg = el("gx-paths");
    svg.setAttribute("viewBox", "0 0 " + W + " " + H);
    var out = "";
    B.pts.forEach(function (pts) {
      var d = pts.map(function (p, i) { return (i ? "L" : "M") + p.x.toFixed(1) + " " + p.y.toFixed(1); }).join(" ");
      out += '<path d="' + d + '" fill="none" stroke="rgba(56,245,224,.16)" stroke-width="26" stroke-linecap="round"/>';
      out += '<path d="' + d + '" fill="none" stroke="rgba(56,245,224,.5)" stroke-width="1.5" stroke-dasharray="7 9"/>';
    });
    svg.innerHTML = out;
    var core = el("gx-core");
    core.style.left = W / 2 + "px";
    core.style.top = H / 2 + "px";
    core.style.position = "absolute";
  }

  function trimToCore(pts, cx, cy, r) {
    var last = pts[pts.length - 1];
    var prev = pts[pts.length - 2] || pts[0];
    var dx = last.x - cx, dy = last.y - cy;
    var len = Math.hypot(dx, dy) || 1;
    var out = pts.slice(0, -1);
    out.push({ x: cx + dx / len * r, y: cy + dy / len * r });
    return out;
  }

  function blank() { return 0; }

  /* ---------------- sprites ---------------- */
  function sprite(cls, name, x, y) {
    var d = document.createElement("div");
    d.className = "sp " + cls;
    var img = document.createElement("img");
    img.src = iconUrl(name); img.alt = "";
    d.appendChild(img);
    var bar = document.createElement("div");
    bar.className = "hp";
    bar.innerHTML = "<i></i>";
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

  function tracer(from, to) {
    var dx = to.x - from.x, dy = to.y - from.y;
    var len = Math.hypot(dx, dy);
    var t = document.createElement("div");
    t.className = "tr";
    t.style.cssText = "left:" + from.x + "px;top:" + from.y + "px;width:" + len + "px;transform:rotate(" + Math.atan2(dy, dx) + "rad)";
    el("arena").appendChild(t);
    setTimeout(function () { t.remove(); }, 200);
  }
  function floater(x, y, text) {
    var f = document.createElement("div");
    f.className = "flt";
    f.textContent = text;
    f.style.cssText = "left:" + x + "px;top:" + y + "px";
    el("arena").appendChild(f);
    setTimeout(function () { f.remove(); }, 820);
  }
  var toastT = null;
  function toast(msg) {
    var t = el("gx-toast");
    t.textContent = msg;
    t.classList.add("on");
    clearTimeout(toastT);
    toastT = setTimeout(function () { t.classList.remove("on"); }, 1600);
  }

  /* ---------------- deploy ---------------- */
  function armUnit(u) {
    B.armedUnit = u; B.armedAbility = null;
    document.querySelectorAll("#units .unit").forEach(function (c) { c.classList.remove("sel"); });
    toast(u.name + " · " + stats(u).cost + " CR · tap the ground");
  }
  function deployAt(x, y, u) {
    u = u || B.armedUnit;
    if (!u) return;
    var s = stats(u);
    if (run.coins < s.cost) return toast("Need " + s.cost + " CR");
    run.coins -= s.cost;
    var node = sprite("u", ICON_CLASS[u.class] || "hero-cyborg-face", x, y);
    var unit = { name: u.name, class: u.class, hp: s.hp, hpMax: s.hp, atk: s.atk, def: s.def,
      range: s.range, rate: s.rate, cool: 0, x: x, y: y, node: node };
    place(unit, x, y);
    B.units.push(unit);
    if (u === B.armedUnit) B.armedUnit = null;
    return unit;
  }

  function autoDeploy() {
    var pool = D.units.slice().sort(function (a, b) { return stats(a).cost - stats(b).cost; });
    var afford = pool.filter(function (u) { return run.coins >= stats(u).cost; });
    if (!afford.length) return;
    /* build a line cheaply, upgrade when the bank is fat */
    var reserve = B.units.length < 5 ? 0 : 140;
    var spendable = afford.filter(function (u) { return run.coins - stats(u).cost >= reserve; });
    if (!spendable.length) return;
    var pick = (run.coins > 1000 && Math.random() > 0.5) ? spendable[spendable.length - 1] : spendable[0];
    if (Math.random() > 0.7) pick = spendable[Math.floor(Math.random() * spendable.length)];
    var st = el("gx-stage").getBoundingClientRect();
    /* ring the core so every converging lane stays covered */
    var ang = Math.random() * Math.PI * 2;
    var rad = 96 + Math.random() * 46;
    var x = clamp(st.width / 2 + Math.cos(ang) * rad, 22, st.width - 22);
    var y = clamp(st.height / 2 + Math.sin(ang) * rad, 22, st.height - 22);
    deployAt(x, y, pick);
  }

  /* ---------------- waves ---------------- */
  function queueFor(wave) {
    var mult = waveMult(wave);
    var pool = D.enemies.filter(function (e) { return !e.is_boss; });
    var count = clamp(5 + Math.round(wave * 0.8), 5, 24);
    var q = [];
    if (wave % 10 === 0) {
      var boss = D.enemies.filter(function (e) { return e.is_boss; })[(wave / 10 - 1) % 3];
      if (boss) q.push({ enemy: boss, boss: true, delay: 300 });
    }
    for (var i = 0; i < count; i++) {
      q.push({ enemy: pool[Math.floor(Math.random() * pool.length)], boss: false, delay: 620 });
    }
    return { q: q, mult: mult };
  }

  function banner(wave) {
    var w = D.waves.filter(function (x) { return Math.round(x.wave_number) === wave; })[0];
    var b = el("gx-banner");
    b.querySelector("b").textContent = "WAVE " + (wave < 10 ? "0" + wave : wave);
    b.querySelector("span").textContent = (w && w.wave_name ? w.wave_name : "").toUpperCase();
    b.classList.add("on");
    setTimeout(function () { b.classList.remove("on"); }, 1700);
  }

  function startWave() {
    if (B.active || B.over) return;
    var built = queueFor(B.wave);
    B.queue = built.q; B.mult = built.mult;
    B.active = true; B.spawning = true; B.spawnTimer = 250; B.waveStart = Date.now(); B.pushing = false;
    run.summonUsed = false; run.wildUsed = false;
    banner(B.wave);
    el("gx-launch").classList.add("cool");
    hud();
  }

  function spawn(entry) {
    var st = el("gx-stage").getBoundingClientRect();
    var lane = Math.floor(Math.random() * 3);
    var pts = B.pts[lane] || B.pts[0];
    var e = entry.enemy, mult = B.mult;
    var hp = e.hp * (0.45 + mult * 0.75) * (entry.boss ? 2.6 : 1);
    var node = sprite(entry.boss ? "e boss" : "e",
      entry.boss ? "ab-boss-key" : (ENEMY_ICON[e.enemy_id] || "ab-bone-knife"), pts[0].x, pts[0].y);
    var enemy = {
      name: e.name, boss: !!entry.boss, lane: lane, pts: pts, seg: 0,
      hp: hp, hpMax: hp,
      atk: e.attack * (0.7 + mult * 0.3) * (entry.boss ? 1.9 : 1),
      def: e.defense || 0,
      speed: 30 + (e.speed || 2) * 12 + (entry.boss ? -10 : 0),
      ranged: /archer|siege|necromancer|drone/i.test(e.enemy_id),
      range: /archer|siege|necromancer|drone/i.test(e.enemy_id) ? 165 : 96,
      cool: 500, x: pts[0].x, y: pts[0].y, node: node
    };
    place(enemy, enemy.x, enemy.y);
    B.enemies.push(enemy);
  }

  /* ---------------- loop ---------------- */
  function loop(ts) {
    if (!B.last) B.last = ts;
    var dt = Math.min(0.05, (ts - B.last) / 1000) * B.speed;
    B.last = ts;
    if (!B.paused && !B.over) step(dt, ts);
    requestAnimationFrame(loop);
  }

  function step(dt, ts) {
    run.aura = Math.min(90, run.aura + dt * 1.1);
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

    if (B.auto) {
      B.deployT -= dt;
      if (B.deployT <= 0) { if (B.units.length < 10) autoDeploy(); B.deployT = 1.0; }
      if (!B.active) {
        B.waveT -= dt;
        if (B.waveT <= 0) { startWave(); B.waveT = 2.0; }
      } else {
        B.waveT = 2.0;
      }
    }

    for (var i = B.enemies.length - 1; i >= 0; i--) {
      var e = B.enemies[i];
      if (e.hp <= 0) {
        e.node.remove(); B.enemies.splice(i, 1); B.kills++;
        var gain = 9 + Math.round(e.hpMax / 40) + (e.boss ? 140 : 0);
        run.coins += gain;
        run.aura = Math.min(90, run.aura + (e.boss ? 18 : 1));
        floater(e.x, e.y, "+" + gain);
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

      /* melee frames hold ground in contact; ranged hostiles keep pressing forward */
      var stopAt = e.ranged ? 0 : 62;
      if (!B.pushing && target && best <= stopAt) continue;

      var goal = e.pts[e.pts.length - 1];
      var dx = goal.x - e.x, dy = goal.y - e.y;
      var dist = Math.hypot(dx, dy);
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
      var w = D.waves.filter(function (x) { return Math.round(x.wave_number) === B.wave; })[0];
      var bonus = w ? w.reward_coins : 80;
      run.coins += bonus;
      run.aura = Math.min(90, run.aura + 10);
      floater(el("gx-stage").clientWidth / 2, el("gx-stage").clientHeight / 2 - 60, "+" + bonus);
      el("gx-launch").classList.remove("cool");
      if (B.wave >= 30) return endRun(true);
      B.wave++; run.wave = B.wave;
      if (!B.auto) toast("WAVE CLEAR · +" + bonus + " CR");
      hud();
    }

    B.hudT -= dt;
    if (B.hudT <= 0) { B.hudT = 0.2; hud(); }
  }

  function hitBase(dmg) {
    var alive = B.segHP.map(function (v, i) { return v > 0 ? i : -1; }).filter(function (i) { return i >= 0; });
    if (alive.length) {
      var idx = alive[Math.floor(Math.random() * alive.length)];
      B.segHP[idx] = Math.max(0, B.segHP[idx] - dmg);
      run.ring = B.segHP.reduce(function (a, b) { return a + b; }, 0);
      run.ringSegs = B.segHP.map(function (v) { return v > 0 ? 1 : 0; });
    } else if (run.gates > 0) {
      run.gates = Math.max(0, run.gates - dmg);
    } else {
      run.core = Math.max(0, run.core - dmg);
      if (run.core <= 0) endRun(false);
    }
    hud();
  }

  function endRun(won) {
    B.over = true; B.active = false;
    B.queue = []; B.spawning = false;
    el("gx-overt").textContent = won ? "PROTOCOL COMPLETE" : "CORE LOST";
    el("gx-overp").textContent = won
      ? "All 30 waves broken. " + B.kills + " hostiles down. The megablock is yours."
      : "The Spire went dark on wave " + B.wave + " with " + B.kills + " hostiles down. Unlocks and upgrades are kept.";
    el("gx-over").classList.add("on");
  }

  function hud() {
    el("gx-wave").textContent = (B.wave < 10 ? "0" : "") + B.wave;
    el("gx-coins").textContent = Math.round(run.coins).toLocaleString("en-US");
    el("gx-aura").textContent = Math.round(run.aura);
    var bar = el("gx-core").querySelector(".corebar i");
    if (bar) bar.style.width = clamp(run.core / run.coreMax * 100, 0, 100) + "%";
    if (el("v-coin")) el("v-coin").textContent = Math.round(run.coins).toLocaleString("en-US");
  }

  /* ---------------- abilities ---------------- */
  function fireAbility(a, x, y) {
    var cost = Math.max(8, Math.round((a.coin_cost || 100) / 12));
    var now = Date.now();
    if ((B.cooldowns[a.ability_id] || 0) > now) return toast("Cooling down");
    if (run.aura < cost) return toast("Need " + cost + " aura");
    run.aura -= cost;
    B.cooldowns[a.ability_id] = now + (a.cooldown_seconds || 20) * 1000;
    var radius = a.tier >= 5 ? 200 : 110 + a.tier * 14;
    var dmg = 95 + (a.tier || 1) * 70;
    var ring = document.createElement("div");
    ring.style.cssText = "position:absolute;left:" + (x - radius / 2) + "px;top:" + (y - radius / 2) +
      "px;width:" + radius + "px;height:" + radius + "px;border:1px solid #38f5e0;border-radius:50%;" +
      "pointer-events:none;animation:pl .45s ease-out forwards";
    el("arena").appendChild(ring);
    setTimeout(function () { ring.remove(); }, 470);
    var hit = 0;
    B.enemies.forEach(function (e) {
      if (Math.hypot(e.x - x, e.y - y) <= radius) { e.hp -= dmg; place(e, e.x, e.y); hit++; }
    });
    toast(a.name + " · " + hit + " hit");
    hud();
  }

  /* ---------------- wiring ---------------- */
  function openSheet(key) {
    var body = el("gx-sheet").querySelector(".bd");
    var panes = body.querySelectorAll(".gx-pane");
    for (var i = 0; i < panes.length; i++) panes[i].style.display = panes[i].dataset.pane === key ? "block" : "none";
    var titles = { units: "DEPLOY UNITS", skills: "HERO LOADOUT", base: "CORE AND UPGRADES", waves: "WAVE MAP" };
    el("gx-sheet").querySelector(".hd b").textContent = titles[key] || "";
    el("gx-sheet").classList.add("on");
  }

  function bind() {
    shell();
    collect();
    buildPaths();
    window.addEventListener("resize", function () { setTimeout(buildPaths, 60); });

    run.coins = 1240; run.aura = 30;
    B.wave = 1; run.wave = 1;

    /* tap to deploy / cast */
    el("gx-stage").addEventListener("click", function (ev) {
      var st = el("gx-stage").getBoundingClientRect();
      var x = ev.clientX - st.left, y = ev.clientY - st.top;
      if (Math.hypot(x - st.width / 2, y - st.height / 2) < CORE_R) return toast("That is the Core Spire");
      if (B.armedAbility) { var a = B.armedAbility; B.armedAbility = null; return fireAbility(a, x, y); }
      if (B.armedUnit) return deployAt(x, y);
      toast("UNITS → pick a frame → tap the ground");
    });

    document.querySelectorAll("#units .unit").forEach(function (card) {
      var label = card.querySelector("b") ? card.querySelector("b").textContent.trim() : "";
      var unit = D.units.filter(function (u) { return u.name === label; })[0];
      if (!unit) return;
      var cost = document.createElement("div");
      cost.className = "ucost";
      cost.textContent = stats(unit).cost + " CR";
      card.appendChild(cost);
      card.addEventListener("click", function () {
        document.querySelectorAll("#units .unit").forEach(function (c) { c.classList.remove("sel"); });
        if (B.armedUnit === unit) { B.armedUnit = null; return toast("Deployment cancelled"); }
        card.classList.add("sel");
        el("gx-sheet").classList.remove("on");
        armUnit(unit);
      });
    });

    var abBox = el("abilities");
    if (abBox) abBox.addEventListener("click", function (ev) {
      var chip = ev.target.closest ? ev.target.closest(".ab") : null;
      if (!chip) return;
      var aid = chip.getAttribute("data-id");
      var a = D.abilities.filter(function (x) {
        return (aid && x.ability_id === aid) || chip.textContent.indexOf(x.name) >= 0;
      })[0];
      if (!a) return;
      B.armedAbility = a; B.armedUnit = null;
      el("gx-sheet").classList.remove("on");
      toast(a.name + " armed · tap the ground");
    });

    /* dock */
    document.querySelectorAll("#gx-dock button[data-sheet]").forEach(function (b) {
      b.addEventListener("click", function () { openSheet(b.dataset.sheet); });
    });
    el("gx-sheet").querySelector(".hd button").addEventListener("click", function () {
      el("gx-sheet").classList.remove("on");
    });
    el("gx-launch").addEventListener("click", function () {
      if (B.active) return toast("Wave already running");
      B.auto = false; el("gx-auto").classList.remove("on");
      startWave();
    });
    el("gx-auto").addEventListener("click", function () {
      B.auto = !B.auto;
      el("gx-auto").classList.toggle("on", B.auto);
      toast(B.auto ? "AUTO DEFENSE ON · sit back" : "AUTO DEFENSE OFF");
      if (B.auto) { B.deployT = 0; B.waveT = 1.2; }
      if (B.auto) { B.autoTimer = 0; B.paused = false; el("gx-pause").classList.remove("on"); }
    });
    el("gx-pause").addEventListener("click", function () {
      B.paused = !B.paused;
      el("gx-pause").classList.toggle("on", B.paused);
      toast(B.paused ? "PAUSED" : "RESUMED");
    });
    el("gx-speed").addEventListener("click", function () {
      B.speed = B.speed === 1 ? 2 : (B.speed === 2 ? 3 : 1);
      el("gx-speed").textContent = B.speed + "x";
    });
    el("gx-over").querySelector("button").addEventListener("click", function () {
      el("gx-over").classList.remove("on");
      B.enemies.forEach(function (e) { e.node.remove(); });
      B.units.forEach(function (u) { u.node.remove(); });
      B.enemies = []; B.units = []; B.queue = [];
      B.over = false; B.active = false; B.spawning = false; B.kills = 0;
      B.segHP = [1200, 1200, 1200, 1200, 1200, 1200];
      run.core = run.coreMax; run.gates = run.gatesMax; run.ring = run.ringMax;
      run.ringSegs = [1, 1, 1, 1, 1, 1];
      B.wave = 1; run.wave = 1; run.coins = 1240; run.aura = 30;
      hud();
    });

    hud();
    requestAnimationFrame(loop);
  }

  window.NW_BATTLE = { state: B, startWave: startWave, deploy: deployAt };

  function go() {
    if (!el("field")) return setTimeout(go, 120);
    bind();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(go, 120); });
  else setTimeout(go, 120);
})();
