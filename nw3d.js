/* NEON WASTELAND 3D LAYER
   Procedural low-poly geometry only (no external art), three.js MIT.
   Falls back to 2D if WebGL is unavailable. */
(function () {
  var T = window.THREE;
  var A = { ok: false, W: 0, H: 0, PPU: 34 };
  window.NW3D = A;
  A.can3d = false;

  if (!T) return;
  try {
    var test = document.createElement("canvas");
    if (!(test.getContext("webgl") || test.getContext("experimental-webgl"))) return;
    A.can3d = true;
  } catch (e) { return; }

  var CLASS_COLOR = {
    Solo: 0x38f5e0, Netrunner: 0x8fd6ff, Techie: 0xffd24a, Medtech: 0x7dffb0,
    Nomad: 0xffb347, Corpo: 0xc07bff, Cyberpsycho: 0xff5d5d
  };
  var ENEMY_RED = 0xff4455;

  var renderer, scene, camera, raycaster, ground;
  var routes = [], coreGroup, coreShell, ringArcs = [], coreLight;
  var clock, time = 0;
  var canvasEl, hostEl;
  var effects = [];
  var store = { units: [], enemies: [], turrets: [] };

  /* ---------- shared geometry (cheap) ---------- */
  var G = {};
  function geoms() {
    G.box = new T.BoxGeometry(1, 1, 1);
    G.cyl = new T.CylinderGeometry(0.5, 0.5, 1, 10);
    G.cone = new T.ConeGeometry(0.5, 1, 8);
    G.sphere = new T.IcosahedronGeometry(0.5, 1);
    G.octa = new T.OctahedronGeometry(0.5, 0);
    G.torus = new T.TorusGeometry(0.5, 0.09, 8, 24);
    G.plane = new T.PlaneGeometry(1, 1);
  }

  function mat(color, emissive, intensity) {
    return new T.MeshStandardMaterial({
      color: color, emissive: emissive === undefined ? color : emissive,
      emissiveIntensity: intensity === undefined ? 0.45 : intensity,
      metalness: 0.65, roughness: 0.42, flatShading: true
    });
  }

  A.init = function (canvas, w, h) {
    if (!G.box) geoms();
    canvasEl = canvas;
    A.W = w; A.H = h;
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);

    scene = new T.Scene();
    scene.fog = new T.FogExp2(0x04070a, 0.021);

    camera = new T.PerspectiveCamera(48, w / h, 0.1, 400);
    positionCamera();

    scene.add(new T.HemisphereLight(0x1d5f6b, 0x05090b, 0.9));
    var key = new T.DirectionalLight(0x9fe9df, 0.75);
    key.position.set(-8, 16, 10);
    scene.add(key);
    var rim = new T.DirectionalLight(0xff7b33, 0.5);
    rim.position.set(9, 8, -12);
    scene.add(rim);
    coreLight = new T.PointLight(0xff7b33, 2.2, 34, 2);
    coreLight.position.set(0, 2.2, 0);
    scene.add(coreLight);

    /* ground grid */
    ground = new T.Mesh(new T.PlaneGeometry(140, 140, 1, 1),
      new T.MeshStandardMaterial({ color: 0x060b0e, metalness: 0.2, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.02;
    scene.add(ground);

    var grid = new T.GridHelper(120, 60, 0x0d3038, 0x081a20);
    grid.position.y = 0;
    scene.add(grid);

    /* distant megablock silhouettes */
    for (var i = 0; i < 26; i++) {
      var bw = 1.6 + Math.random() * 3.4, bh = 2 + Math.random() * 12, bd = 1.6 + Math.random() * 3.4;
      var b = new T.Mesh(G.box, mat(0x0a1519, 0x0d2b33, 0.25));
      b.scale.set(bw, bh, bd);
      var ang = Math.random() * Math.PI * 2, rad = 24 + Math.random() * 26;
      b.position.set(Math.cos(ang) * rad, bh / 2 - 0.5, Math.sin(ang) * rad);
      scene.add(b);
      var win = new T.Mesh(G.box, mat(0x38f5e0, 0x38f5e0, 0.8));
      win.scale.set(bw * 0.7, 0.06, 0.02);
      win.position.set(b.position.x, bh * 0.55, b.position.z + bd / 2);
      scene.add(win);
    }

    raycaster = new T.Raycaster();
    clock = new T.Clock();
    A.ok = true;
    return A.ok;
  };

  function positionCamera() {
    var aspect = A.W / A.H;
    var span = A.W / A.PPU;             /* visible width in world units */
    var dist = Math.max(11, span * 0.86);
    camera.position.set(0, dist * 0.82, dist * 0.62);
    camera.lookAt(0, 0.35, 0);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
  }

  A.resize = function (w, h) {
    if (!A.ok) return;
    A.W = w; A.H = h;
    renderer.setSize(w, h, false);
    positionCamera();
  };

  A.toWorld = function (px, py) {
    return { x: (px - A.W / 2) / A.PPU, z: (py - A.H / 2) / A.PPU };
  };
  A.toScreen = function (x, z) {
    return { x: x * A.PPU + A.W / 2, y: z * A.PPU + A.H / 2 };
  };

  /* ---------- arena ---------- */
  A.buildArena = function (paths) {
    if (!A.ok) return;
    routes.forEach(function (o) { scene.remove(o); });
    routes = [];
    if (coreGroup) { scene.remove(coreGroup); coreGroup = null; }
    ringArcs.forEach(function (a) { scene.remove(a); });
    ringArcs = [];

    paths.forEach(function (pts) {
      var v3 = pts.map(function (p) { var w = A.toWorld(p.x, p.y); return new T.Vector3(w.x, 0.06, w.z); });
      if (v3.length < 2) return;
      var curve = new T.CatmullRomCurve3(v3);
      var road = new T.Mesh(new T.TubeGeometry(curve, 40, 0.52, 6, false),
        new T.MeshStandardMaterial({ color: 0x13272c, emissive: 0x0d3a44, emissiveIntensity: 0.5, metalness: 0.5, roughness: 0.6 }));
      scene.add(road); routes.push(road);

      var railGeo = new T.BufferGeometry().setFromPoints(v3.map(function (v) { return new T.Vector3(v.x, 0.14, v.z); }));
      var rail = new T.Line(railGeo, new T.LineBasicMaterial({ color: 0x38f5e0, transparent: true, opacity: 0.55 }));
      scene.add(rail); routes.push(rail);

      /* marker posts along the route */
      for (var i = 1; i < v3.length; i++) {
        var post = new T.Mesh(G.cyl, mat(0x0e2a30, 0x38f5e0, 0.7));
        post.scale.set(0.07, 0.5, 0.07);
        post.position.set(v3[i].x, 0.25, v3[i].z);
        scene.add(post); routes.push(post);
      }
    });

    /* core spire */
    coreGroup = new T.Group();
    var base = new T.Mesh(new T.CylinderGeometry(1.35, 1.65, 0.34, 8), mat(0x14252b, 0x0d2b33, 0.3));
    base.position.y = 0.17; coreGroup.add(base);
    coreShell = new T.Mesh(new T.IcosahedronGeometry(0.72, 1), mat(0xff7b33, 0xff7b33, 1.5));
    coreShell.position.y = 1.15; coreGroup.add(coreShell);
    var cage = new T.Mesh(new T.TorusGeometry(0.95, 0.05, 6, 24), mat(0xffb347, 0xffb347, 1.1));
    cage.position.y = 1.15; cage.rotation.x = Math.PI / 2.4; coreGroup.add(cage);
    coreShell.userData.cage = cage;
    for (var k = 0; k < 3; k++) {
      var fin = new T.Mesh(G.box, mat(0x1b3038, 0xff7b33, 0.5));
      fin.scale.set(0.12, 1.5, 0.34);
      var a2 = (k / 3) * Math.PI * 2;
      fin.position.set(Math.cos(a2) * 0.86, 0.8, Math.sin(a2) * 0.86);
      fin.rotation.y = -a2;
      coreGroup.add(fin);
    }
    scene.add(coreGroup);
  };

  A.setRings = function (seg) {
    if (!A.ok) return;
    if (!ringArcs.length) {
      for (var i = 0; i < 6; i++) {
        var arc = new T.Mesh(new T.TorusGeometry(2.2, 0.13, 6, 40, Math.PI / 3.6), mat(0x38f5e0, 0x38f5e0, 1.0));
        arc.rotation.x = -Math.PI / 2;
        arc.rotation.z = (i / 6) * Math.PI * 2;
        scene.add(arc);
        ringArcs.push(arc);
      }
    }
    ringArcs.forEach(function (a, i) {
      var hp = (seg && seg[i]) || 0;
      a.visible = hp > 0;
      var m = a.material;
      m.emissiveIntensity = hp > 600 ? 1.1 : hp > 200 ? 0.6 : 0.25;
      m.color.setHex(hp > 200 ? 0x38f5e0 : 0xff7b33);
      m.emissive.setHex(hp > 200 ? 0x38f5e0 : 0xff7b33);
    });
  };

  /* ---------- models ---------- */
  function unitMesh(cls, ally) {
    var col = CLASS_COLOR[cls] || 0x38f5e0;
    var g = new T.Group();
    var torso = new T.Mesh(G.box, mat(0x152126, col, 0.5));
    torso.scale.set(0.42, 0.52, 0.28); torso.position.y = 0.52; g.add(torso);
    var head = new T.Mesh(G.box, mat(0x1d2c33, col, 0.9));
    head.scale.set(0.22, 0.2, 0.22); head.position.y = 0.88; g.add(head);
    var visor = new T.Mesh(G.box, mat(col, col, 1.6));
    visor.scale.set(0.2, 0.05, 0.02); visor.position.set(0, 0.88, 0.12); g.add(visor);
    var legL = new T.Mesh(G.box, mat(0x101a1e, col, 0.25));
    legL.scale.set(0.13, 0.42, 0.15); legL.position.set(-0.12, 0.2, 0); g.add(legL);
    var legR = legL.clone(); legR.position.x = 0.12; g.add(legR);
    var arm = new T.Mesh(G.box, mat(0x152126, col, 0.4));
    arm.scale.set(0.1, 0.34, 0.1); arm.position.set(0.26, 0.56, 0.04); g.add(arm);
    var gun = new T.Mesh(G.box, mat(0x222c30, col, 0.7));
    gun.scale.set(0.06, 0.07, 0.34); gun.position.set(0.28, 0.5, 0.2); g.add(gun);
    var pad = new T.Mesh(G.sphere, mat(ally ? 0xc07bff : col, ally ? 0xc07bff : col, 1.2));
    pad.scale.set(0.1, 0.1, 0.1); pad.position.y = 1.02; g.add(pad);
    g.userData = { kind: "unit", legs: [legL, legR], gun: gun, color: ally ? 0xc07bff : col };
    return g;
  }

  function enemyMesh(boss) {
    var g = new T.Group();
    var body = new T.Mesh(boss ? G.octa : G.box, mat(0x2a1116, ENEMY_RED, 0.75));
    body.scale.set(boss ? 1.5 : 0.5, boss ? 1.5 : 0.62, boss ? 1.5 : 0.44);
    body.position.y = boss ? 1.0 : 0.5; g.add(body);
    var eye = new T.Mesh(G.sphere, mat(ENEMY_RED, 0xff9aa4, 2.0));
    eye.scale.setScalar(boss ? 0.34 : 0.14);
    eye.position.set(0, boss ? 1.2 : 0.62, boss ? 0.7 : 0.24); g.add(eye);
    var spike = new T.Mesh(G.cone, mat(0x3a1218, ENEMY_RED, 0.6));
    spike.scale.set(0.14, 0.34, 0.14); spike.position.y = boss ? 1.9 : 0.95; g.add(spike);
    if (boss) {
      var ring = new T.Mesh(new T.TorusGeometry(1.15, 0.06, 6, 26), mat(ENEMY_RED, ENEMY_RED, 1.2));
      ring.rotation.x = Math.PI / 2.4; ring.position.y = 1.0; g.add(ring);
      g.userData.ring = ring;
    }
    var legL = new T.Mesh(G.box, mat(0x1a0c10, ENEMY_RED, 0.4));
    legL.scale.set(0.12, 0.36, 0.12); legL.position.set(-0.14, 0.18, 0); if (!boss) g.add(legL);
    var legR = legL.clone(); legR.position.x = 0.14; if (!boss) g.add(legR);
    g.userData = Object.assign(g.userData || {}, { kind: "enemy", legs: boss ? [] : [legL, legR] });
    return g;
  }

  A.addTurret = function (o) {
    if (!A.ok) return null;
    var w = A.toWorld(o.x, o.y);
    var g = new T.Group();
    var base = new T.Mesh(new T.CylinderGeometry(0.34, 0.44, 0.3, 8), mat(0x14252b, 0x0d2b33, 0.4));
    base.position.y = 0.15; g.add(base);
    var turret = new T.Mesh(G.box, mat(0x1b3038, o.heavy ? 0xff7b33 : 0xffd24a, 0.75));
    turret.scale.set(0.4, 0.28, 0.46); turret.position.y = 0.44; g.add(turret);
    var barrel = new T.Mesh(G.cyl, mat(0x222c30, o.heavy ? 0xff7b33 : 0xffd24a, 0.9));
    barrel.scale.set(0.08, o.heavy ? 0.9 : 0.7, 0.08);
    barrel.rotation.x = Math.PI / 2;
    barrel.position.set(0, 0.46, o.heavy ? 0.5 : 0.4); g.add(barrel);
    var lamp = new T.Mesh(G.sphere, mat(0xffd24a, 0xffd24a, 1.8));
    lamp.scale.setScalar(0.09); lamp.position.set(0, 0.62, 0); g.add(lamp);
    g.position.set(w.x, 0, w.z);
    g.userData = { kind: "turret", barrel: barrel };
    scene.add(g);
    return g;
  };
  A.aim = function (m, x, y) {
    if (!A.ok || !m) return;
    var w = A.toWorld(x, y);
    m.rotation.y = Math.atan2(w.x - m.position.x, w.z - m.position.z);
  };

  A.addUnit = function (o) {
    if (!A.ok) return null;
    var w = A.toWorld(o.x, o.y);
    var m = unitMesh(o.cls, o.ally);
    m.position.set(w.x, 0, w.z);
    m.userData.phase = Math.random() * 6.28;
    scene.add(m);
    return m;
  };
  A.addEnemy = function (o) {
    if (!A.ok) return null;
    var w = A.toWorld(o.x, o.y);
    var m = enemyMesh(o.boss);
    m.position.set(w.x, 0, w.z);
    m.userData.phase = Math.random() * 6.28;
    scene.add(m);
    return m;
  };
  A.move = function (m, x, y) {
    if (!A.ok || !m) return;
    var w = A.toWorld(x, y);
    m.position.x = w.x; m.position.z = w.z;
  };
  A.remove = function (m) {
    if (!A.ok || !m) return;
    scene.remove(m);
  };
  A.setHp = function (m, frac, boss) {
    if (!A.ok || !m) return;
    if (m.userData.hpBar === undefined) {
      var bar = new T.Mesh(G.plane, new T.MeshBasicMaterial({ color: frac > 0.4 ? 0x38f5e0 : 0xff4455, transparent: true, opacity: 0.9 }));
      bar.scale.set(0.6, 0.06, 1);
      bar.position.y = boss ? 2.25 : 1.2;
      m.add(bar);
      m.userData.hpBar = bar;
    }
    var b = m.userData.hpBar;
    b.scale.x = Math.max(0.02, 0.6 * frac);
    b.position.x = -(0.6 - b.scale.x) / 2;
    b.material.color.setHex(frac > 0.4 ? 0x38f5e0 : 0xff4455);
    b.lookAt(camera.position);
  };

  /* ---------- effects ---------- */
  A.tracer = function (a, b, color) {
    if (!A.ok) return;
    var wa = A.toWorld(a.x, a.y), wb = A.toWorld(b.x, b.y);
    var geo = new T.BufferGeometry().setFromPoints([
      new T.Vector3(wa.x, 0.55, wa.z), new T.Vector3(wb.x, 0.5, wb.z)
    ]);
    var line = new T.Line(geo, new T.LineBasicMaterial({
      color: color === undefined ? 0x38f5e0 : color, transparent: true, opacity: 0.95
    }));
    scene.add(line);
    effects.push({ obj: line, life: 0.16, kind: "line" });
  };

  A.burst = function (x, y, color) {
    if (!A.ok) return;
    var w = A.toWorld(x, y);
    var ring = new T.Mesh(new T.TorusGeometry(0.2, 0.05, 6, 18), new T.MeshBasicMaterial({
      color: color === undefined ? 0xffd24a : color, transparent: true, opacity: 0.95
    }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(w.x, 0.2, w.z);
    scene.add(ring);
    effects.push({ obj: ring, life: 0.5, kind: "ring" });
  };

  A.blast = function (x, y, radius) {
    if (!A.ok) return;
    var w = A.toWorld(x, y);
    var ring = new T.Mesh(new T.TorusGeometry(0.3, 0.1, 8, 40), new T.MeshBasicMaterial({
      color: 0x38f5e0, transparent: true, opacity: 0.9
    }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(w.x, 0.18, w.z);
    ring.userData.grow = (radius / A.PPU) / 0.45;
    scene.add(ring);
    effects.push({ obj: ring, life: 0.45, kind: "grow" });
  };

  /* ---------- frame ---------- */
  A.render = function () {
    if (!A.ok) return;
    var dt = Math.min(0.05, clock.getDelta());
    time += dt;
    if (coreShell) {
      coreShell.rotation.y += dt * 0.6;
      coreShell.position.y = 1.15 + Math.sin(time * 1.6) * 0.05;
      if (coreShell.userData.cage) coreShell.userData.cage.rotation.z += dt * 0.9;
    }
    if (coreLight) coreLight.intensity = 1.9 + Math.sin(time * 3) * 0.35;

    scene.traverse(function (o) {
      if (o.userData && o.userData.kind === "unit") {
        if (o.userData.legs) {
          o.userData.legs[0].rotation.x = Math.sin(time * 5 + o.userData.phase) * 0.25;
          o.userData.legs[1].rotation.x = -Math.sin(time * 5 + o.userData.phase) * 0.25;
        }
      }
      if (o.userData && o.userData.ring) o.userData.ring.rotation.z += dt * 1.4;
    });

    for (var i = effects.length - 1; i >= 0; i--) {
      var f = effects[i];
      f.life -= dt;
      if (f.kind === "grow") {
        f.obj.scale.x = f.obj.scale.y = f.obj.scale.z = 1 + (0.45 - f.life) * f.obj.userData.grow * 3;
      }
      f.obj.material.opacity = Math.max(0, f.life * (f.kind === "line" ? 6 : 2));
      if (f.life <= 0) {
        scene.remove(f.obj);
        if (f.obj.geometry && f.kind === "line") f.obj.geometry.dispose();
        effects.splice(i, 1);
      }
    }
    renderer.render(scene, camera);
  };

  A.project = function (x, y) {
    if (!A.ok) return null;
    var w = A.toWorld(x, y);
    var v = new T.Vector3(w.x, 0.6, w.z).project(camera);
    return { x: (v.x * 0.5 + 0.5) * A.W, y: (-v.y * 0.5 + 0.5) * A.H, z: v.z };
  };

  A.pick = function (clientX, clientY, rect) {
    if (!A.ok) return null;
    var ndc = new T.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(ndc, camera);
    var plane = new T.Plane(new T.Vector3(0, 1, 0), 0);
    var hit = new T.Vector3();
    if (!raycaster.ray.intersectPlane(plane, hit)) return null;
    return A.toScreen(hit.x, hit.z);
  };

  /* ---------- camp view (3D base) ---------- */
  A.campView = function (canvas, seg) {
    if (!A.can3d) return null;
    if (!G.box) geoms();
    var w = canvas.clientWidth || 300, h = canvas.clientHeight || 200;
    var r;
    try { r = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); } catch (e) { return null; }
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.setSize(w, h, false);
    var sc = new T.Scene();
    sc.fog = new T.FogExp2(0x04070a, 0.03);
    var cam = new T.PerspectiveCamera(45, w / h, 0.1, 60);
    cam.position.set(0, 4.6, 6.4);
    cam.lookAt(0, 0.9, 0);
    sc.add(new T.HemisphereLight(0x1d5f6b, 0x05090b, 1.0));
    var d = new T.DirectionalLight(0xbff8ff, 0.8); d.position.set(-5, 8, 5); sc.add(d);
    var pl = new T.PointLight(0xff7b33, 2.4, 18); pl.position.set(0, 2, 0); sc.add(pl);

    var grp = new T.Group();
    var plate = new T.Mesh(new T.CylinderGeometry(2.4, 2.8, 0.16, 10), mat(0x0b1519, 0x0d2b33, 0.4));
    plate.position.y = 0.08; grp.add(plate);
    var base = new T.Mesh(new T.CylinderGeometry(1.35, 1.65, 0.34, 8), mat(0x14252b, 0x0d2b33, 0.3));
    base.position.y = 0.3; grp.add(base);
    var shell = new T.Mesh(new T.IcosahedronGeometry(0.72, 1), mat(0xff7b33, 0xff7b33, 1.6));
    shell.position.y = 1.25; grp.add(shell);
    var cage = new T.Mesh(new T.TorusGeometry(0.95, 0.05, 6, 24), mat(0xffb347, 0xffb347, 1.2));
    cage.position.y = 1.25; cage.rotation.x = Math.PI / 2.4; grp.add(cage);
    for (var k = 0; k < 3; k++) {
      var fin = new T.Mesh(G.box, mat(0x1b3038, 0xff7b33, 0.6));
      fin.scale.set(0.12, 1.5, 0.34);
      var a2 = (k / 3) * Math.PI * 2;
      fin.position.set(Math.cos(a2) * 0.86, 0.9, Math.sin(a2) * 0.86);
      fin.rotation.y = -a2; grp.add(fin);
    }
    var arcs = [];
    for (var i = 0; i < 6; i++) {
      var hp = (seg && seg[i]) || 0;
      var arc = new T.Mesh(new T.TorusGeometry(2.05, 0.11, 6, 30, Math.PI / 3.6),
        mat(hp > 200 ? 0x38f5e0 : 0xff7b33, hp > 200 ? 0x38f5e0 : 0xff7b33, hp > 600 ? 1.1 : 0.5));
      arc.rotation.x = -Math.PI / 2;
      arc.rotation.z = (i / 6) * Math.PI * 2;
      arc.visible = hp > 0;
      grp.add(arc); arcs.push(arc);
    }
    sc.add(grp);

    var t0 = performance.now();
    function tick() {
      var el2 = (performance.now() - t0) / 1000;
      grp.rotation.y = Math.sin(el2 * 0.35) * 0.4;
      shell.rotation.y += 0.01;
      shell.position.y = 1.25 + Math.sin(el2 * 1.5) * 0.04;
      cage.rotation.z += 0.012;
      pl.intensity = 2.1 + Math.sin(el2 * 3) * 0.3;
      r.render(sc, cam);
      canvas._raf = requestAnimationFrame(tick);
    }
    tick();
    return { dispose: function () { cancelAnimationFrame(canvas._raf); r.dispose(); } };
  };

  /* ---------- map thumbnail ---------- */
  A.mapThumb = function (canvas, paths, accent) {
    if (!A.can3d) return null;
    if (!G.box) geoms();
    var w = canvas.clientWidth || 260, h = canvas.clientHeight || 90;
    var r;
    try { r = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); } catch (e) { return null; }
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.setSize(w, h, false);
    var sc = new T.Scene();
    var cam = new T.PerspectiveCamera(50, w / h, 0.1, 80);
    cam.position.set(0, 7.5, 7.2);
    cam.lookAt(0, 0, 0.4);
    sc.add(new T.HemisphereLight(0x2a7f8c, 0x05090b, 1.2));
    var d = new T.DirectionalLight(0xbff8ff, 0.6); d.position.set(-4, 8, 6); sc.add(d);
    var grid = new T.Mesh(new T.PlaneGeometry(14, 14), new T.MeshStandardMaterial({
      color: 0x071114, metalness: 0.2, roughness: 0.9
    }));
    grid.rotation.x = -Math.PI / 2; sc.add(grid);
    var col = accent || 0x38f5e0;
    (paths || []).forEach(function (pts) {
      var v3 = pts.map(function (q) {
        return new T.Vector3((q[0] - 0.5) * 12, 0.12, (q[1] - 0.5) * 12);
      });
      if (v3.length < 2) return;
      var curve = new T.CatmullRomCurve3(v3);
      sc.add(new T.Mesh(new T.TubeGeometry(curve, 30, 0.22, 5, false),
        new T.MeshStandardMaterial({ color: 0x13272c, emissive: col, emissiveIntensity: 0.55, metalness: 0.4, roughness: 0.6 })));
    });
    var core = new T.Mesh(new T.IcosahedronGeometry(0.42, 1), mat(0xff7b33, 0xff7b33, 1.5));
    core.position.set(0, 0.5, 0); sc.add(core);
    var t0 = performance.now();
    function tick() {
      var e2 = (performance.now() - t0) / 1000;
      cam.position.x = Math.sin(e2 * 0.3) * 7.2;
      cam.lookAt(0, 0, 0.4);
      core.rotation.y += 0.02;
      r.render(sc, cam);
      canvas._raf = requestAnimationFrame(tick);
    }
    tick();
    return { dispose: function () { cancelAnimationFrame(canvas._raf); r.dispose(); } };
  };

  /* ---------- hero portrait ---------- */
  A.portrait = function (canvas, cls, tier) {
    if (!A.can3d || !G.box) { if (!G.box) geoms(); }
    if (!A.can3d) return null;
    var w = canvas.clientWidth || 120, h = canvas.clientHeight || 120;
    var r;
    try { r = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); } catch (e) { return null; }
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.setSize(w, h, false);
    var sc = new T.Scene();
    var cam = new T.PerspectiveCamera(42, w / h, 0.1, 50);
    cam.position.set(0, 1.1, 3.2);
    cam.lookAt(0, 0.62, 0);
    sc.add(new T.HemisphereLight(0x2a7f8c, 0x05090b, 1.1));
    var d = new T.DirectionalLight(0xbff8ff, 1.0); d.position.set(-3, 5, 4); sc.add(d);
    var rim = new T.PointLight(0xff7b33, 2.0, 12); rim.position.set(2.5, 2, -2.5); sc.add(rim);

    var m = unitMesh(cls, false);
    m.scale.setScalar(1.45);
    m.position.y = -0.35;
    sc.add(m);
    var plinth = new T.Mesh(new T.CylinderGeometry(0.9, 1.0, 0.12, 16), mat(0x0d1a1e, 0x38f5e0, 0.6));
    plinth.position.y = -0.42; sc.add(plinth);

    var t0 = performance.now();
    function tick() {
      var el = (performance.now() - t0) / 1000;
      m.rotation.y = Math.sin(el * 0.6) * 0.5;
      m.position.y = -0.35 + Math.sin(el * 1.2) * 0.02;
      if (m.userData.gun) m.userData.gun.rotation.x = Math.sin(el * 0.9) * 0.06;
      r.render(sc, cam);
      canvas._raf = requestAnimationFrame(tick);
    }
    tick();
    return { dispose: function () { cancelAnimationFrame(canvas._raf); r.dispose(); } };
  };
})();
