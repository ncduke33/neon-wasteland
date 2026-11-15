/* NEON WASTELAND - battle engine
   Waves march down three lanes toward the Core Spire. Spend coins to deploy
   units, fire hero abilities with aura, hold the line for 30 waves.
   All art is the existing free game-icons SVG set; nothing generated. */
(function () {
  var D = window.NW_DATA;
  if (!D) return;

  var LANE_Y = [65, 145, 225];
  var CORE_R = 52;

  var B = {
    wave: 0, active: false, spawning: false,
    units: [], enemies: [], queue: [], spawnTimer: 0,
    armedUnit: null, armedAbility: null, last: 0,
    cooldowns: {}, kills: 0, segHP: [1200, 1200, 1200, 1200, 1200, 1200],
    over: false, paused: false
  };

  var ICON_BY_CLASS = {
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
  var BOSS_ICON = "ab-boss-key";

  function el(id) { return document.getElementById(id); }
  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function rng(a, b) { return a + Math.random() * (b - a); }

  function unitStats(u) {
    var role = (u.role || "").toLowerCase();
    var ranged = /range|long|mortar|quickhack|anti-armor|siege|scout|drone/.test(role);
    return {
      hp: 220 + u.tier * 120,
      atk: 42 + u.tier * 26,
      def: 10 + u.tier * 8,
      range: ranged ? 260 : 140,
      rate: ranged ? 900 : 700,
      cost: u.deploy_cost_aura * 10
    };
  }

  function waveMult(w) { return 1 + (w - 1) * 0.14; }

  /* ---------- arena ---------- */
  var arena, layer;
  function mount() {
    var field = el("field");
    if (!field || el("arena")) return;
    field.style.position = "relative";
    layer = document.createElement("div");
    layer.id = "arena";
    layer.style.cssText = "position:absolute;inset:0;z-index:6";
    field.appendChild(layer);

    var st = document.createElement("style");
    st.textContent =
      ".sp{position:absolute;width:34px;height:34px;margin:-17px 0 0 -17px;display:grid;place-items:center;" +
      "border-radius:50%;transition:transform .08s linear;will-change:transform}" +
      ".sp img{width:22px;height:22px;filter:none}" +
      ".sp.u{border:1px solid #38f5e0;background:rgba(56,245,224,.12);box-shadow:0 0 10px rgba(56,245,224,.35)}" +
      ".sp.e{border:1px solid #ff5d5d;background:rgba(255,93,93,.12);box-shadow:0 0 10px rgba(255,93,93,.3)}" +
      ".sp.boss{width:52px;height:52px;margin:-26px 0 0 -26px;border-width:2px;box-shadow:0 0 22px rgba(255,93,93,.6)}" +
      ".sp.boss img{width:34px;height:34px}" +
      ".hp{position:absolute;top:-7px;left:50%;transform:translateX(-50%);width:30px;height:3px;background:#1a2128}" +
      ".hp i{display:block;height:100%;background:#38f5e0}" +
      ".sp.e .hp i{background:#ff5d5d}" +
      ".unit.sel{border-color:#38f5e0;box-shadow:0 0 0 1px #38f5e0 inset}"+
      ".ucost{color:#38f5e0}"+
      ".pulse{position:absolute;border:1px solid #38f5e0;border-radius:50%;pointer-events:none;animation:pl .45s ease-out forwards}" +
      "@keyframes pl{from{opacity:.9;transform:scale(.4)}to{opacity:0;transform:scale(1.6)}}" +
      ".eng{position:absolute;inset:0;z-index:7;cursor:crosshair}";
    document.head.appendChild(st);
  }

  function size() {
    var r = layer.getBoundingClientRect();
    return { w: r.width, h: r.height };
  }

  /* ---------- sprites ---------- */
  function sprite(cls, iconName, x, y) {
    var d = document.createElement("div");
    d.className = "sp " + cls;
    var img = document.createElement("img");
    img.src = window.NW_ICON_SRC && window.NW_ICON_SRC[iconName] ? window.NW_ICON_SRC[iconName] : "";
    img.alt = "";
    d.appendChild(img);
    var hp = document.createElement("div");
    hp.className = "hp";
    hp.innerHTML = "<i></i>";
    d.appendChild(hp);
    d._bar = hp.firstChild;
    d.style.transform = "translate(" + x + "px," + y + "px)";
    layer.appendChild(d);
    return d;
  }
  function place(o, x, y) {
    o.x = x; o.y = y;
    o.node.style.transform = "translate(" + x + "px," + y + "px)";
    o.node._bar.style.width = clamp(o.hp / o.hpMax * 100, 0, 100) + "%";
  }

  /* ---------- deploy ---------- */
  function armUnit(u) {
    B.armedUnit = u;
    B.armedAbility = null;
    var cards = document.querySelectorAll("#units .unit");
    for (var i = 0; i < cards.length; i++) cards[i].classList.remove("sel");
    var s = unitStats(u);
    toast(u.name + " armed - " + s.cost + "c - tap the field");
  }

  function deployAt(x, y) {
    var u = B.armedUnit;
    if (!u) return;
    var s = unitStats(u);
    if (run.coins < s.cost) return toast("Need " + s.cost + "c for " + u.name);
    run.coins -= s.cost;
    var node = sprite("u", ICON_BY_CLASS[u.class] || "hero-cyborg-face", x, y);
    var unit = {
      name: u.name, cls: u.class, hp: s.hp, hpMax: s.hp, atk: s.atk, def: s.def,
      range: s.range, rate: s.rate, cool: 0, x: x, y: y, node: node
    };
    place(unit, x, y);
    B.units.push(unit);
    B.armedUnit = null;
    renderBase();
  }

  /* ---------- waves ---------- */
  function pool(wave) {
    return D.enemies.filter(function (e) { return !e.is_boss; });
  }
  function buildQueue(wave) {
    var mult = waveMult(wave);
    var list = pool(wave);
    var count = clamp(6 + Math.round(wave * 0.8), 6, 26);
    var q = [];
    if (wave % 10 === 0) {
      var boss = D.enemies.filter(function (e) { return e.is_boss; })[(wave / 10 - 1) % 3];
      if (boss) q.push({ enemy: boss, boss: true, delay: 0 });
    }
    for (var i = 0; i < count; i++) {
      var e = list[Math.floor(Math.random() * list.length)];
      q.push({ enemy: e, boss: false, delay: 620 });
    }
    return { list: q, mult: mult };
  }

  function startWave() {
    if (B.active || B.over) return;
    B.wave = Math.max(1, run.wave);
    var built = buildQueue(B.wave);
    B.queue = built.list;
    B.mult = built.mult;
    B.active = true;
    B.spawning = true;
    B.spawnTimer = 0;
    run.wave = B.wave;
    el("actWave").classList.add("cool");
    renderBase();
    toast("WAVE " + B.wave + " inbound");
  }

  function spawn(entry) {
    var dim = size();
    var lane = Math.floor(Math.random() * 3);
    var fromLeft = Math.random() > 0.5;
    var e = entry.enemy;
    var mult = B.mult || 1;
    var hp = e.hp * (0.55 + mult * 0.45) * (entry.boss ? 3.2 : 1);
    var node = sprite(entry.boss ? "e boss" : "e", entry.boss ? BOSS_ICON : (ENEMY_ICON[e.enemy_id] || "ab-bone-knife"),
      fromLeft ? -20 : dim.w + 20, LANE_Y[lane]);
    var enemy = {
      name: e.name, boss: !!entry.boss, lane: lane, fromLeft: fromLeft,
      hp: hp, hpMax: hp,
      atk: e.attack * (0.7 + mult * 0.3) * (entry.boss ? 2 : 1),
      def: e.defense || 0,
      speed: 45 + (e.speed || 2) * 22 - (entry.boss ? 22 : 0),
      range: /archer|siege|necromancer|drone/i.test(e.enemy_id) ? 210 : 120,
      cool: 600, x: fromLeft ? -20 : dim.w + 20, y: LANE_Y[lane], node: node,
      atCore: false
    };
    place(enemy, enemy.x, enemy.y);
    B.enemies.push(enemy);
  }

  /* ---------- tick ---------- */
  function tick(ts) {
    if (!B.last) B.last = ts;
    var dt = Math.min(0.05, (ts - B.last) / 1000);
    B.last = ts;
    if (!B.paused) step(dt, ts);
    requestAnimationFrame(tick);
  }

  function step(dt, ts) {
    var dim = size();
    var cx = dim.w / 2, cy = dim.h / 2;

    /* aura regen */
    run.aura = Math.min(90, run.aura + dt * 1.1);
    el("v-aura").textContent = Math.round(run.aura);

    /* spawning */
    if (B.spawning) {
      B.spawnTimer -= dt * 1000;
      if (B.spawnTimer <= 0 && B.queue.length) {
        var entry = B.queue.shift();
        spawn(entry);
        B.spawnTimer = entry.delay || 620;
      }
      if (!B.queue.length) B.spawning = false;
    }

    /* enemies */
    for (var i = B.enemies.length - 1; i >= 0; i--) {
      var e = B.enemies[i];
      if (e.hp <= 0) {
        e.node.remove();
        B.enemies.splice(i, 1);
        B.kills++;
        run.coins += 5 + Math.round(e.hpMax / 55) + (e.boss ? 120 : 0);
        run.aura = Math.min(90, run.aura + (e.boss ? 20 : 1));
        renderBase();
        continue;
      }

      /* nearest unit in sight */
      var target = null, best = 1e9;
      for (var u = 0; u < B.units.length; u++) {
        var un = B.units[u];
        var d = Math.hypot(un.x - e.x, un.y - e.y);
        if (d < best) { best = d; target = un; }
      }
      e.cool -= dt * 1000;

      if (target && best <= e.range) {
        if (e.cool <= 0) {
          e.cool = 900;
          var dmg = Math.max(3, e.atk * 0.8 - target.def * 0.35);
          target.hp -= dmg;
          place(target, target.x, target.y);
          if (target.hp <= 0) {
            target.node.remove();
            B.units.splice(B.units.indexOf(target), 1);
          }
        }
        continue; /* blocked, stands and fights */
      }

      /* march toward the core */
      var stopX = cx + (e.fromLeft ? -CORE_R : CORE_R);
      var dir = e.fromLeft ? 1 : -1;
      var reached = e.fromLeft ? e.x >= stopX : e.x <= stopX;
      if (reached) {
        if (e.cool <= 0) {
          e.cool = 900;
          hitBase(e.atk * 1.6, e.lane);
        }
      } else {
        e.x += dir * e.speed * dt;
        place(e, e.x, e.y);
      }
    }

    /* units fire */
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
        tgt.hp -= Math.max(5, uu.atk - (tgt.def || 0) * 0.4);
        place(tgt, tgt.x, tgt.y);
      }
    }

    /* wave cleared */
    if (B.active && !B.spawning && !B.enemies.length) {
      B.active = false;
      var w = D.waves.filter(function (x) { return Math.round(x.wave_number) === B.wave; })[0];
      var bonus = w ? w.reward_coins : 80;
      run.coins += bonus;
      run.aura = Math.min(90, run.aura + 10);
      el("actWave").classList.remove("cool");
      renderBase();
      run.summonUsed = false; run.wildUsed = false;
      if (B.wave >= 30) return win();
      toast("WAVE " + B.wave + " CLEARED  +" + bonus + "c");
      B.wave = B.wave + 1;
      run.wave = B.wave;
      renderBase();
    }
  }

  function hitBase(dmg, lane) {
    var segs = B.segHP;
    var alive = [];
    for (var i = 0; i < 6; i++) if (segs[i] > 0) alive.push(i);
    if (alive.length) {
      var pick = alive.indexOf((lane * 2) % 6);
      var idx = pick >= 0 ? (lane * 2) % 6 : alive[0];
      segs[idx] = Math.max(0, segs[idx] - dmg);
      run.ring = segs.reduce(function (a, b) { return a + b; }, 0);
    } else if (run.gates > 0) {
      run.gates = Math.max(0, run.gates - dmg);
    } else {
      run.core = Math.max(0, run.core - dmg);
      if (run.core <= 0) return lose();
    }
    run.ringSegs = segs.map(function (v) { return v > 0 ? 1 : 0; });
    renderBase();
  }

  function win() {
    B.over = true;
    el("modalTitle").textContent = "Protocol Complete";
    el("modalBody").textContent = "All 30 waves broken. You cleared the megablock with " +
      B.kills + " hostiles down and " + Math.round(run.coins) + " credits banked.";
    el("modal").classList.add("on");
  }
  function lose() {
    B.over = true;
    B.active = false;
    B.queue = [];
    B.spawning = false;
    el("modalTitle").textContent = "Core Lost";
    el("modalBody").textContent = "The Spire went dark on wave " + B.wave + ". " + B.kills +
      " hostiles down. Every base upgrade and unlock is kept - nothing is lost but the run.";
    el("modal").classList.add("on");
  }

  function reset() {
    for (var i = 0; i < B.enemies.length; i++) B.enemies[i].node.remove();
    for (var j = 0; j < B.units.length; j++) B.units[j].node.remove();
    B.enemies = []; B.units = []; B.queue = []; B.active = false; B.spawning = false;
    B.over = false; B.kills = 0; B.wave = 1;
    B.segHP = [1200, 1200, 1200, 1200, 1200, 1200];
    run.wave = 1;
    el("actWave").classList.remove("cool");
    renderBase();
  }

  /* ---------- abilities ---------- */
  function fireAbility(a, x, y) {
    var cost = Math.max(8, Math.round((a.coin_cost || 100) / 12));
    var now = Date.now();
    if ((B.cooldowns[a.ability_id] || 0) > now) return toast("Ability cooling down");
    if (run.aura < cost) return toast("Need " + cost + " aura");
    run.aura -= cost;
    B.cooldowns[a.ability_id] = now + (a.cooldown_seconds || 20) * 1000;
    var radius = a.tier >= 5 ? 200 : 120 + a.tier * 12;
    var dmg = 90 + (a.tier || 1) * 70;
    var p = document.createElement("div");
    p.className = "pulse";
    p.style.cssText += ";left:" + (x - radius / 2) + "px;top:" + (y - radius / 2) + "px;width:" + radius + "px;height:" + radius + "px";
    layer.appendChild(p);
    setTimeout(function () { p.remove(); }, 480);
    var hit = 0;
    for (var i = 0; i < B.enemies.length; i++) {
      var e = B.enemies[i];
      if (Math.hypot(e.x - x, e.y - y) <= radius) {
        e.hp -= dmg;
        place(e, e.x, e.y);
        hit++;
      }
    }
    renderBase();
    toast(a.name + " hit " + hit + " hostile" + (hit === 1 ? "" : "s"));
  }

  /* ---------- wiring ---------- */
  function bind() {
    mount();

    var eng = document.createElement("div");
    eng.className = "eng";
    layer.appendChild(eng);
    eng.addEventListener("click", function (ev) {
      var r = layer.getBoundingClientRect();
      var x = ev.clientX - r.left, y = ev.clientY - r.top;
      var dim = size();
      if (Math.hypot(x - dim.w / 2, y - dim.h / 2) < CORE_R) return toast("That is the Core Spire");
      if (B.armedAbility) { fireAbility(B.armedAbility, x, y); B.armedAbility = null; return; }
      if (B.armedUnit) return deployAt(x, y);
      toast("Pick a unit card below, then tap where it should hold");
    });

    /* unit cards arm a deployment */
    var cards = document.querySelectorAll("#units .unit");
    for (var i = 0; i < cards.length; i++) {
      (function (card) {
        var name = card.querySelector("b") ? card.querySelector("b").textContent.trim() : "";
        var unit = D.units.filter(function (u) { return u.name === name; })[0];
        card.style.cursor = "pointer";
        if (unit) {
          var cb = document.createElement("div");
          cb.className = "ucost";
          cb.textContent = unitStats(unit).cost + " credits to deploy";
          card.appendChild(cb);
        }
        card.addEventListener("click", function () {
          if (!unit) return;
          cards.forEach(function (c) { c.classList.remove("sel"); });
          card.classList.add("sel");
          armUnit(unit);
        });
      })(cards[i]);
    }

    /* ability chips arm a cast */
    var container = el("abilities");
    if (container) {
      container.addEventListener("click", function (ev) {
        var chip = ev.target.closest ? ev.target.closest(".ab") : null;
        if (!chip) return;
        var aid = chip.getAttribute("data-id");
        var a = D.abilities.filter(function (x) {
          return (aid && x.ability_id === aid) || chip.textContent.indexOf(x.name) >= 0;
        })[0];
        if (!a) return;
        B.armedAbility = a;
        B.armedUnit = null;
        toast(a.name + " armed - tap the field to fire");
      });
    }

    /* rebind the action bar to the real engine */
    var aw = el("actWave");
    if (aw) aw.onclick = function () { if (B.active) return toast("Wave already running"); startWave(); };
    var ar = el("actRepair");
    if (ar) ar.onclick = function () {
      var missing = (run.ringMax - run.ring) + (run.gatesMax - run.gates) + (run.coreMax - run.core);
      if (missing <= 0) return toast("Everything is already at full");
      var cost = Math.ceil(missing / 1000 * 40);
      if (run.coins < cost) return toast("Not enough coins: " + cost + "c needed");
      run.coins -= cost;
      run.ring = run.ringMax; run.gates = run.gatesMax; run.core = run.coreMax;
      B.segHP = [1200, 1200, 1200, 1200, 1200, 1200];
      run.ringSegs = [1, 1, 1, 1, 1, 1];
      renderBase(); toast("Repaired for " + cost + "c");
    };
    var as = el("actSummon");
    if (as) as.onclick = function () {
      if (run.summonUsed) return toast("Emergency Summon already spent this wave");
      run.summonUsed = true;
      var pick = D.units[Math.floor(Math.random() * D.units.length)];
      B.armedUnit = pick;
      var dim = size();
      deployAt(dim.w / 2 - CORE_R - 40, dim.h / 2);
      toast("Emergency summon: " + pick.name);
    };
    var awi = el("actWild");
    if (awi) awi.onclick = function () {
      if (run.wildUsed) return toast("Wildcard already used this wave");
      if (!B.enemies.length) return toast("Nothing to hit yet");
      run.wildUsed = true;
      var e = B.enemies[0];
      var a = D.abilities.filter(function (x) { return x.tier === 3; })[0];
      fireAbility(a, e.x, e.y);
    };
    var am = el("actMerge");
    if (am) am.onclick = function () {
      if (B.units.length < 2) return toast("Deploy two units before merging");
      if (run.coins < 25) return toast("Merging costs 25 coins");
      run.coins -= 25;
      var a1 = B.units.pop(); a1.node.remove();
      var a2 = B.units.pop(); a2.node.remove();
      var best = a1.hpMax >= a2.hpMax ? a1 : a2;
      best.hpMax = Math.round(best.hpMax * 1.7);
      best.hp = best.hpMax;
      best.atk = Math.round(best.atk * 1.5);
      best.range = Math.round(best.range * 1.1);
      best.node.classList.add("boss");
      B.units.push(best);
      place(best, best.x, best.y);
      renderBase();
      toast("Merged into a veteran frame");
    };
    var mb = el("modalBtn");
    if (mb) mb.onclick = function () {
      el("modal").classList.remove("on");
      run.core = run.coreMax; run.gates = run.gatesMax; run.ring = run.ringMax;
      B.segHP = [1200, 1200, 1200, 1200, 1200, 1200];
      reset();
    };

    reset();
    requestAnimationFrame(tick);
  }

  window.NW_BATTLE = { bind: bind, startWave: startWave, state: B };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () { setTimeout(bind, 60); });
  } else {
    setTimeout(bind, 60);
  }
})();
