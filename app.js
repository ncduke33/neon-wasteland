// NEON WASTELAND — UI prototype. Renders live game data with open-source icons.
// Icons: game-icons.net (CC BY 3.0) — Lorc, Delapouite, DarkZaitzev and contributors.

var DATA = null, AB_ICONS = {}, HERO_ICONS = {};
var state = { hero: null, slots: [null, null, null], wild: null, filter: "All", q: "" };

var UI_ICONS = {
  sig: "ab-skull-sabertooth.svg",
  coin: "ab-buy.svg",
  aura: "ab-bolt.svg",
  scrap: "ab-chips-bag.svg",
  circuit: "ab-circuit.svg",
  eddie: "ab-cash.svg",
  core: "ab-radioactive.svg"
};

function el(id) { return document.getElementById(id); }
function icon(name) {
  if (!name) return "";
  var map = window.NW_ICON_SRC;
  if (map) {
    if (map[name]) return map[name];
    var bare = name.replace(/\.svg$/, "");
    if (map[bare]) return map[bare];
    if (map["ab-" + bare]) return map["ab-" + bare];
    if (map["hero-" + bare]) return map["hero-" + bare];
  }
  return "assets/icons/" + name;
}
function pad(n) { return n < 10 ? "0" + n : String(n); }

function load() {
  // Data is embedded in data.js so the UI works from a local file or any host.
  DATA = window.NW_DATA;
  AB_ICONS = window.NW_AB || {};
  HERO_ICONS = window.NW_HERO || {};
  if (!DATA || !DATA.heroes) {
    document.body.insertAdjacentHTML("afterbegin",
      '<div style="padding:20px;color:#ff2d7a;font-family:monospace">data.js did not load. Keep data.js next to index.html.</div>');
    throw new Error("no data");
  }
}

function heroIcon(id) {
  var f = HERO_ICONS[id];
  if (!f) return "";
  if (f.indexOf("hero-") !== 0) f = "hero-" + f;
  if (f.indexOf(".svg") === -1) f += ".svg";
  return icon(f);
}
function abilityIcon(aid) {
  var f = AB_ICONS[aid];
  return f ? icon(f) : "";
}

function renderHud() {
  el("sig").src = icon(UI_ICONS.sig);
  el("coreIcon").src = icon(UI_ICONS.core);
  el("i-coin").src = icon(UI_ICONS.coin);
  el("i-aura").src = icon(UI_ICONS.aura);
  el("i-scrap").src = icon(UI_ICONS.scrap);
  el("i-circuit").src = icon(UI_ICONS.circuit);
  el("i-eddie").src = icon(UI_ICONS.eddie);
}

function renderHeroes() {
  var box = el("heroes");
  box.innerHTML = "";
  DATA.heroes
    .sort(function (a, b) { return a.tier - b.tier; })
    .forEach(function (h) {
      var d = document.createElement("div");
      d.className = "hero" + (state.hero === h.hero_id ? " sel" : "");
      d.innerHTML =
        '<div class="hero-top">' +
          '<div class="portrait"><img src="' + heroIcon(h.hero_id) + '" alt=""/></div>' +
          '<div><h3>' + h.name + '</h3><div class="cls">' + h.class + ' · ' + h.body_type + '</div></div>' +
        '</div>' +
        '<p>' + (h.passive_name || "") + ': ' + (h.passive_description || "") + '</p>' +
        '<div class="stat"><span>HP ' + h.base_hp + '</span><span>ATK ' + h.base_attack + '</span><span>DEF ' + h.base_defense + '</span></div>';
      d.onclick = function () { selectHero(h); };
      box.appendChild(d);
    });
}

function selectHero(h) {
  state.hero = h.hero_id;
  el("activeHeroIcon").src = heroIcon(h.hero_id);
  el("activeHeroName").textContent = h.name;
  el("activeHeroClass").textContent = h.class + " · " + h.body_type;
  renderHeroes();
  renderLoadout();
}

function renderLoadout() {
  var box = el("loadout");
  box.innerHTML = "";
  for (var i = 0; i < 3; i++) {
    box.appendChild(slotNode(state.slots[i], "SLOT " + (i + 1), false, i));
  }
  box.appendChild(slotNode(state.wild, "WILDCARD", true, 3));
}

function slotNode(aid, label, wild, idx) {
  var d = document.createElement("div");
  d.className = "slot" + (aid ? " full" : "") + (wild ? " wild" : "");
  if (!aid) { d.textContent = label; return d; }
  var a = findAbility(aid);
  d.innerHTML = '<div><img src="' + abilityIcon(aid) + '" alt=""/><div class="sn">' +
    (a ? a.name : aid) + '</div></div>';
  d.title = "Click to clear";
  d.onclick = function () {
    if (wild) state.wild = null; else state.slots[idx] = null;
    renderLoadout();
  };
  return d;
}

function findAbility(aid) {
  for (var i = 0; i < DATA.abilities.length; i++)
    if (DATA.abilities[i].ability_id === aid) return DATA.abilities[i];
  return null;
}

function equip(a) {
  var hero = null;
  for (var i = 0; i < DATA.heroes.length; i++) if (DATA.heroes[i].hero_id === state.hero) hero = DATA.heroes[i];
  var placed = false;
  for (var s = 0; s < 3; s++) {
    if (!state.slots[s]) { state.slots[s] = a.ability_id; placed = true; break; }
  }
  if (!placed && a.tier >= 5) state.slots[2] = a.ability_id;
  else if (!placed) state.wild = a.ability_id;
  renderLoadout();
  flash(a.ability_id);
}

function flash(aid) {
  var nodes = document.querySelectorAll(".ab");
  for (var i = 0; i < nodes.length; i++) {
    if (nodes[i].dataset.id === aid) {
      nodes[i].style.borderColor = "var(--cyan)";
      nodes[i].style.boxShadow = "0 0 18px rgba(56,245,224,.45)";
    }
  }
}

function renderFilters() {
  var classes = ["All", "Solo", "Netrunner", "Techie", "Medtech", "Nomad", "Corpo", "Cyberpsycho", "Universal"];
  var box = el("filters");
  box.innerHTML = "";
  classes.forEach(function (c) {
    var b = document.createElement("button");
    b.className = "chip" + (state.filter === c ? " on" : "");
    b.textContent = c;
    b.onclick = function () { state.filter = c; renderFilters(); renderAbilities(); };
    box.appendChild(b);
  });
}

function renderAbilities() {
  var box = el("abilities");
  box.innerHTML = "";
  var list = DATA.abilities.filter(function (a) {
    if (state.filter !== "All" && a.class !== state.filter) return false;
    if (state.q) {
      var q = state.q.toLowerCase();
      return (a.name || "").toLowerCase().indexOf(q) > -1 || (a.description || "").toLowerCase().indexOf(q) > -1;
    }
    return true;
  });
  el("abCount").textContent = list.length + " of 150 abilities · click to equip";
  list.sort(function (a, b) { return a.tier - b.tier || a.name.localeCompare(b.name); });
  list.forEach(function (a) {
    var d = document.createElement("div");
    d.className = "ab";
    d.dataset.id = a.ability_id;
    d.title = a.name + " — " + a.description + " (" + a.coin_cost + " coins, " + a.cooldown_seconds + "s)";
    d.innerHTML =
      '<div class="t">T' + a.tier + '</div><div class="c">' + a.coin_cost + '</div>' +
      '<img src="' + abilityIcon(a.ability_id) + '" alt=""/>' +
      '<div class="nm">' + a.name + '</div>' +
      '<div class="ty">' + a.type + '</div>';
    d.onclick = function () { equip(a); };
    box.appendChild(d);
  });
}

function renderUnits() {
  var box = el("units");
  box.innerHTML = "";
  DATA.units.sort(function (a, b) { return a.tier - b.tier; }).forEach(function (u) {
    var d = document.createElement("div");
    d.className = "unit";
    d.innerHTML = '<b><span class="dot ' + u.body_type + '"></span>' + u.name + '</b>' +
      '<span>' + u.class + ' · T' + u.tier + ' · ' + u.deploy_cost_aura + ' aura</span><br/>' +
      '<span style="color:#9aa6b1">' + (u.special_name || "") + '</span>';
    box.appendChild(d);
  });
}

function renderEnemies() {
  var box = el("enemies");
  box.innerHTML = "";
  DATA.enemies.forEach(function (e) {
    var d = document.createElement("div");
    d.className = "unit";
    d.style.borderColor = e.is_boss ? "var(--magenta)" : "var(--line)";
    d.innerHTML = '<b style="color:' + (e.is_boss ? "var(--magenta)" : "#e8ecef") + '">' +
      '<span class="dot ' + e.body_type + '"></span>' + e.name + '</b>' +
      '<span>HP ' + e.hp + ' · ATK ' + e.attack + (e.is_boss ? ' · BOSS' : '') + '</span><br/>' +
      '<span style="color:#9aa6b1;font-size:9px">' + (e.special || "") + '</span>';
    box.appendChild(d);
  });
}

function renderBuildings() {
  var box = el("buildings");
  box.innerHTML = "";
  DATA.buildings.forEach(function (b) {
    var d = document.createElement("div");
    d.className = "unit";
    d.innerHTML = '<b>' + b.name + '</b><span>' + b.category + ' · ' + (b.effect || "") + '</span>';
    box.appendChild(d);
  });
}

function boot() {
  load();
  renderHud();
  var waves = DATA.waves.slice().sort(function (a, b) { return a.wave_number - b.wave_number; });
  if (waves.length) {
    el("waveNum").textContent = pad(Math.round(waves[0].wave_number));
    el("waveName").textContent = waves[0].wave_name || "";
    el("waveTag").textContent = waves[0].is_boss ? "BOSS" : "NORMAL";
    if (waves[0].is_boss) el("waveTag").className = "tag boss";
  }
  renderHeroes();
  renderFilters();
  renderAbilities();
  renderUnits();
  renderEnemies();
  renderBuildings();
  if (DATA.heroes.length) selectHero(DATA.heroes[0]);

  // seed a demo loadout so the prototype shows filled slots
  var pick = function (cls, type) {
    for (var i = 0; i < DATA.abilities.length; i++)
      if (DATA.abilities[i].class === cls && DATA.abilities[i].type === type) return DATA.abilities[i];
    return null;
  };
  var a1 = pick("Solo", "Offense"), a2 = pick("Solo", "Defense"), a3 = pick("Solo", "Ultimate");
  if (a1) state.slots[0] = a1.ability_id;
  if (a2) state.slots[1] = a2.ability_id;
  if (a3) state.slots[2] = a3.ability_id;
  var w = pick("Universal", "Summon");
  if (w) state.wild = w.ability_id;
  renderLoadout();
}
boot();

/* ---------------- run state + base defense ---------------- */
var run = {
  coins: 1240, aura: 30, wave: 1, maxWave: 1,
  ring: 7200, ringMax: 7200,
  gates: 3600, gatesMax: 3600,
  core: 4000, coreMax: 4000,
  ringSegs: [1, 1, 1, 1, 1, 1],
  summonUsed: false, wildUsed: false,
  upgrades: { plate: 0, armor: 0, reactor: 0, hardpoint: 0 }
};

var SHOP = [
  { id: "plate", name: "Reinforced Plate", desc: "+10% segment HP", cost: [200, 400, 700, 1100, 1600] },
  { id: "armor", name: "Reactive Armor", desc: "segments reflect melee", cost: [900, 1800, 3200] },
  { id: "reactor", name: "Auxiliary Reactor", desc: "core +2% per round", cost: [600, 1400, 2600] },
  { id: "hardpoint", name: "Hardpoint Expansion", desc: "+2 build plots", cost: [500, 1200] }
];

function fmt(n) { return Math.round(n).toLocaleString("en-US"); }

function renderBase() {
  var segs = el("ringSegs");
  if (!segs) return;
  segs.innerHTML = "";
  for (var i = 0; i < 6; i++) {
    var d = document.createElement("div");
    d.className = "segdiv" + (run.ringSegs[i] ? "" : " dead");
    var f = document.createElement("div");
    f.className = "f";
    f.style.width = (run.ringSegs[i] ? Math.min(100, Math.round((run.ring / 6) / 1200 * 100)) : 0) + "%";
    d.appendChild(f);
    segs.appendChild(d);
  }
  el("gateBar").style.width = Math.max(0, Math.round(run.gates / run.gatesMax * 100)) + "%";
  el("coreBar").style.width = Math.max(0, Math.round(run.core / run.coreMax * 100)) + "%";
  el("baseNumbers").textContent = "Ring " + fmt(run.ring) + " / Gates " + fmt(run.gates) + " / Core " + fmt(run.core);
  el("v-coin").textContent = fmt(run.coins);
  el("v-aura").textContent = Math.round(run.aura);
  var t = el("waves");
  if (t) {
    var nodes = t.querySelectorAll(".wnode");
    for (var w = 0; w < nodes.length; w++) {
      var n = Number(nodes[w].dataset.wave);
      nodes[w].className = "wnode" + (nodes[w].dataset.boss === "1" ? " boss" : "") +
        (n < run.wave ? " done" : (n === run.wave ? " cur" : ""));
    }
  }
  el("waveNum").textContent = pad(run.wave);
  el("waveTag").textContent = (run.wave % 10 === 0 && run.wave <= 30) ? "BOSS" : "NORMAL";
  el("waveTag").className = "tag" + (((run.wave % 10 === 0) && run.wave <= 30) ? " boss" : "");
}

function renderWaveTrack() {
  var box = el("waves");
  if (!box) return;
  box.innerHTML = "";
  DATA.waves.slice().sort(function (a, b) { return a.wave_number - b.wave_number; }).forEach(function (w) {
    var d = document.createElement("div");
    d.className = "wnode" + (w.is_boss ? " boss" : "");
    d.dataset.wave = Math.round(w.wave_number);
    d.dataset.boss = w.is_boss ? "1" : "0";
    d.innerHTML = "<b>" + pad(Math.round(w.wave_number)) + "</b>" + (w.wave_name || "").split("—")[0].slice(0, 14);
    d.title = w.wave_name || "";
    box.appendChild(d);
  });
}

function renderShop() {
  var box = el("shop");
  if (!box) return;
  box.innerHTML = "";
  SHOP.forEach(function (item) {
    var rank = run.upgrades[item.id];
    var max = item.cost.length;
    var can = rank < max && run.coins >= item.cost[rank];
    var d = document.createElement("div");
    d.className = "buy" + (can ? "" : " off");
    d.innerHTML = '<div><span>' + item.name + ' ' + rank + "/" + max + '</span><small>' + item.desc + '</small></div>' +
      '<em>' + (rank < max ? fmt(item.cost[rank]) + "c" : "MAX") + '</em>';
    d.onclick = function () {
      if (rank >= max || run.coins < item.cost[rank]) return;
      run.coins -= item.cost[rank];
      run.upgrades[item.id]++;
      if (item.id === "plate") { run.ringMax = Math.round(run.ringMax * 1.1); run.ring = run.ringMax; }
      if (item.id === "reactor") { run.coreMax = Math.round(run.coreMax * 1.05); }
      renderBase(); renderShop();
    };
    box.appendChild(d);
  });
}

function toast(msg) {
  var t = document.createElement("div");
  t.textContent = msg;
  t.style.cssText = "position:fixed;left:50%;bottom:28px;transform:translateX(-50%);background:#0e1216;border:1px solid #38f5e0;color:#38f5e0;padding:10px 16px;font:11px ui-monospace,monospace;letter-spacing:.12em;z-index:200";
  document.body.appendChild(t);
  setTimeout(function () { t.remove(); }, 1600);
}

function startWave() {
  run.wave++;
  var dmg = 300 + run.wave * 90;
  if (run.wave % 10 === 0) dmg *= 2;
  var seg = Math.floor(Math.random() * 6);
  if (Math.random() > 0.45) {
    run.ring = Math.max(0, run.ring - dmg);
    if (run.ring % 1200 < dmg) run.ringSegs[seg] = 0;
  } else {
    run.gates = Math.max(0, run.gates - dmg * 0.6);
  }
  if (run.ring <= 0 && run.gates <= 0) run.core = Math.max(0, run.core - dmg * 0.4);
  run.aura = Math.min(90, run.aura + 12);
  run.coins += 75 + run.wave * 25;
  run.summonUsed = false; run.wildUsed = false;
  renderBase();
  if (run.core <= 0) loseRun();
}

function loseRun() {
  el("modalTitle").textContent = "Core Lost";
  el("modalBody").textContent = "The Spire went dark on wave " + run.wave + ". You banked " +
    fmt(Math.round(run.coins * 0.5)) + " coins and kept every base upgrade and unit unlock. Nothing is lost but the run.";
  el("modal").classList.add("on");
}

function bindActions() {
  if (el("actWave")) el("actWave").onclick = startWave;
  if (el("actRepair")) el("actRepair").onclick = function () {
    var missing = (run.ringMax - run.ring) + (run.gatesMax - run.gates) + (run.coreMax - run.core);
    if (missing <= 0) return toast("Everything is already at full");
    var cost = Math.ceil(missing / 1000 * 40);
    if (run.coins < cost) return toast("Not enough coins: " + cost + "c needed");
    run.coins -= cost;
    run.ring = run.ringMax; run.gates = run.gatesMax; run.core = run.coreMax;
    run.ringSegs = [1, 1, 1, 1, 1, 1];
    renderBase(); toast("Repaired for " + cost + "c");
  };
  if (el("actSummon")) el("actSummon").onclick = function () {
    if (run.summonUsed) return toast("Emergency Summon already spent this wave");
    run.summonUsed = true;
    el("actSummon").classList.add("cool");
    toast("Emergency unit deployed · 20s lifetime");
  };
  if (el("actWild")) el("actWild").onclick = function () {
    if (run.wildUsed) return toast("Wildcard already used this wave");
    run.wildUsed = true;
    el("actWild").classList.add("cool");
    toast("Wildcard ability fired · double cooldown");
  };
  if (el("actMerge")) el("actMerge").onclick = function () {
    if (run.coins < 25) return toast("Merging costs 25 coins");
    run.coins -= 25; renderBase(); toast("Units merged");
  };
  if (el("modalBtn")) el("modalBtn").onclick = function () {
    el("modal").classList.remove("on");
    run.core = run.coreMax; run.gates = run.gatesMax; run.ring = run.ringMax;
    run.ringSegs = [1, 1, 1, 1, 1, 1];
    run.wave = 1;
    renderBase();
  };
}

var _boot = boot;
boot = function () {
  _boot();
  renderWaveTrack();
  renderBase();
  renderShop();
  bindActions();
  if (el("factionSig")) el("factionSig").src = icon(UI_ICONS.sig);
};
boot();
