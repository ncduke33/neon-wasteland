/* NEON WASTELAND 3D LAYER  v3 — town map, humanoid models, procedural only.
   three.js (MIT). No external art assets. */
(function () {
  var T = window.THREE;
  var A = { ok: false, W: 0, H: 0, PPU: 34, zoom: 0.74, can3d: false };
  window.NW3D = A;
  if (!T) return;
  try {
    var probe = document.createElement("canvas");
    if (!(probe.getContext("webgl") || probe.getContext("experimental-webgl"))) return;
    A.can3d = true;
  } catch (e) { return; }

  var CLASS_COLOR = {
    Solo: 0x38f5e0, Netrunner: 0x8fd6ff, Techie: 0xffd24a, Medtech: 0x7dffb0,
    Nomad: 0xffb347, Corpo: 0xc07bff, Cyberpsycho: 0xff5d5d
  };
  var ENEMY_RED = 0xff4455;
  var SKIN = 0xb9a08a, SKIN_DARK = 0x8a6f5c;

  var renderer, scene, camera, raycaster, clock, time = 0;
  var townRoot, coreGroup, ringArcs = [], coreLight;
  var effects = [];
  var G = {}, MATC = {};

  function geoms() {
    G.box = new T.BoxGeometry(1, 1, 1);
    G.cyl = new T.CylinderGeometry(0.5, 0.5, 1, 12);
    G.cone = new T.ConeGeometry(0.5, 1, 10);
    G.sphere = new T.SphereGeometry(0.5, 12, 10);
    G.ico = new T.IcosahedronGeometry(0.5, 1);
    G.octa = new T.OctahedronGeometry(0.5, 0);
    G.torus = new T.TorusGeometry(0.5, 0.08, 8, 20);
    G.plane = new T.PlaneGeometry(1, 1);
    G.cap = new T.CapsuleGeometry(0.5, 0.6, 4, 8);
    G.wheel = new T.CylinderGeometry(0.5, 0.5, 0.24, 10);
  }
  function mat(color, em, inten) {
    var k = color + "|" + (em === undefined ? color : em) + "|" + (inten === undefined ? 0.35 : inten);
    if (MATC[k]) return MATC[k];
    var m = new T.MeshStandardMaterial({
      color: color, emissive: em === undefined ? color : em,
      emissiveIntensity: inten === undefined ? 0.35 : inten,
      metalness: 0.35, roughness: 0.62
    });
    MATC[k] = m;
    return m;
  }
  function basic(color, opacity) {
    return new T.MeshBasicMaterial({ color: color, transparent: opacity !== undefined, opacity: opacity === undefined ? 1 : opacity });
  }
  function put(parent, geo, mtl, sx, sy, sz, px, py, pz, rx, ry, rz) {
    var m = new T.Mesh(geo, mtl);
    m.scale.set(sx, sy, sz);
    m.position.set(px, py, pz);
    if (rx) m.rotation.x = rx;
    if (ry) m.rotation.y = ry;
    if (rz) m.rotation.z = rz;
    parent.add(m);
    return m;
  }

  /* ================= init ================= */
  A.init = function (canvas, w, h) {
    if (!G.box) geoms();
    A.W = w; A.H = h;
    renderer = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.setSize(w, h, false);
    renderer.shadowMap.enabled = false;

    scene = new T.Scene();
    scene.background = new T.Color(0x070d11);
    scene.fog = new T.FogExp2(0x070d11, 0.012);

    camera = new T.PerspectiveCamera(46, w / h, 0.1, 400);

    var hemi = new T.HemisphereLight(0x3d7d8c, 0x0a1014, 1.15);
    scene.add(hemi);
    var moon = new T.DirectionalLight(0xc9ecff, 0.85);
    moon.position.set(-14, 22, 12);
    scene.add(moon);
    var warm = new T.DirectionalLight(0xffa04d, 0.35);
    warm.position.set(12, 10, -14);
    scene.add(warm);
    coreLight = new T.PointLight(0xff9a4d, 2.6, 40, 2);
    coreLight.position.set(0, 3.2, 0);
    scene.add(coreLight);

    raycaster = new T.Raycaster();
    clock = new T.Clock();
    position();
    A.ok = true;
    return true;
  };

  function position() {
    var span = A.W / A.PPU;
    var dist = Math.max(9.5, span * 0.78) / (A.zoom || 1);
    camera.position.set(0, dist * 1.16, dist * 0.42);
    camera.lookAt(0, 0.2, 0);
    camera.aspect = A.W / A.H;
    camera.updateProjectionMatrix();
  }
  A.setZoom = function (z) { A.zoom = Math.min(2.2, Math.max(0.5, z)); if (A.ok) position(); return A.zoom; };
  A.getZoom = function () { return A.zoom; };
  A.resize = function (w, h) { if (!A.ok) return; A.W = w; A.H = h; renderer.setSize(w, h, false); position(); };
  A.toWorld = function (px, py) { return { x: (px - A.W / 2) / A.PPU, z: (py - A.H / 2) / A.PPU }; };
  A.toScreen = function (x, z) { return { x: x * A.PPU + A.W / 2, y: z * A.PPU + A.H / 2 }; };
  A.project = function (x, y) {
    if (!A.ok) return null;
    var w = A.toWorld(x, y);
    var v = new T.Vector3(w.x, 0.8, w.z).project(camera);
    return { x: (v.x * 0.5 + 0.5) * A.W, y: (-v.y * 0.5 + 0.5) * A.H };
  };
  A.pick = function (cx, cy, rect) {
    if (!A.ok) return null;
    raycaster.setFromCamera(new T.Vector2(
      ((cx - rect.left) / rect.width) * 2 - 1,
      -((cy - rect.top) / rect.height) * 2 + 1), camera);
    var hit = new T.Vector3();
    if (!raycaster.ray.intersectPlane(new T.Plane(new T.Vector3(0, 1, 0), 0), hit)) return null;
    return A.toScreen(hit.x, hit.z);
  };

  /* ================= humanoid / mech models ================= */
  function humanoid(opt) {
    var g = new T.Group();
    var skin = opt.skin || SKIN;
    var suit = opt.suit || 0x1d2a30;
    var accent = opt.accent || 0x38f5e0;
    var heavy = !!opt.heavy;

    var hips = put(g, G.cap, mat(suit, 0x0a1216, 0.06), 0.3, 0.16, 0.24, 0, 0.62, 0);
    var torso = put(g, G.cap, mat(suit, 0x0a1216, 0.06), heavy ? 0.36 : 0.31, 0.3, 0.24, 0, 0.86, 0);
    var chest = put(g, G.box, mat(opt.armor || 0x243740, accent, 0.22), heavy ? 0.34 : 0.28, 0.22, 0.11, 0, 0.92, -0.06);
    var lum = put(g, G.box, mat(accent, accent, 1.5), 0.07, 0.05, 0.02, 0, 0.95, -0.13);

    var neck = put(g, G.cyl, mat(skin, 0x000000, 0), 0.09, 0.08, 0.09, 0, 1.08, 0);
    var head = put(g, G.sphere, mat(skin, 0x000000, 0), 0.19, 0.21, 0.19, 0, 1.21, 0);
    var helmet = put(g, G.sphere, mat(opt.helmet || 0x2b3d45, 0x0c1518, 0.08), 0.21, 0.15, 0.21, 0, 1.27, 0);
    var brim = put(g, G.cyl, mat(opt.helmet || 0x2b3d45, 0x0c1518, 0.08), 0.215, 0.035, 0.215, 0, 1.235, -0.01);
    var visor = put(g, G.box, mat(accent, accent, 1.8), 0.16, 0.055, 0.03, 0, 1.19, 0.16);
    if (opt.antenna) {
      put(g, G.cyl, mat(0x1b262b, 0x0a1216, 0.05), 0.015, 0.26, 0.015, 0.13, 1.4, -0.02);
      put(g, G.sphere, mat(accent, accent, 1.8), 0.045, 0.045, 0.045, 0.13, 1.55, -0.02);
    }
    /* arms */
    var arms = [];
    [-1, 1].forEach(function (sgn, i) {
      var grp = new T.Group();
      grp.position.set(sgn * (heavy ? 0.24 : 0.21), 1.02, 0);
      var upper = put(grp, G.cap, mat(suit, 0x0a1216, 0.06), 0.11, 0.17, 0.11, 0, -0.16, 0);
      var elbow = put(grp, G.sphere, mat(0x18242a, accent, 0.5), 0.11, 0.11, 0.11, 0, -0.32, 0);
      var fore = put(grp, G.cap, mat(opt.armor || 0x243740, accent, 0.18), 0.095, 0.15, 0.095, 0, -0.46, 0.02);
      var hand = put(grp, G.sphere, mat(skin, 0x000000, 0), 0.085, 0.09, 0.085, 0, -0.62, 0.03);
      if (heavy) put(grp, G.sphere, mat(opt.armor || 0x243740, accent, 0.25), 0.16, 0.12, 0.16, 0, -0.03, 0);
      g.add(grp);
      arms.push(grp);
    });
    /* rifle in right hand */
    var rifle = new T.Group();
    put(rifle, G.box, mat(0x1b2429, 0x0a1013, 0.05), 0.07, 0.08, 0.42, 0, 0, 0.12);
    put(rifle, G.cyl, mat(0x121a1e, 0x000000, 0), 0.028, 0.34, 0.028, 0, 0.02, 0.4, Math.PI / 2);
    put(rifle, G.box, mat(0x2a3740, accent, 0.7), 0.05, 0.05, 0.12, 0, 0.06, -0.06);
    rifle.position.set(0, -0.62, 0.1);
    rifle.rotation.x = 0.1;
    arms[1].add(rifle);

    /* legs */
    var legs = [];
    [-1, 1].forEach(function (sgn) {
      var grp = new T.Group();
      grp.position.set(sgn * 0.11, 0.62, 0);
      put(grp, G.cap, mat(suit, 0x0a1216, 0.06), 0.115, 0.17, 0.115, 0, -0.17, 0);
      put(grp, G.sphere, mat(0x18242a, accent, 0.4), 0.105, 0.105, 0.105, 0, -0.34, 0);
      put(grp, G.cap, mat(suit, 0x0a1216, 0.06), 0.1, 0.16, 0.1, 0, -0.5, 0);
      put(grp, G.box, mat(0x151e22, 0x000000, 0), 0.14, 0.09, 0.24, 0, -0.66, 0.04);
      g.add(grp);
      legs.push(grp);
    });
    /* backpack */
    if (opt.pack !== false) {
      put(g, G.box, mat(0x1a2429, accent, 0.12), 0.24, 0.3, 0.13, 0, 0.88, 0.19);
      put(g, G.box, mat(accent, accent, 1.2), 0.05, 0.05, 0.02, 0.08, 0.97, 0.26);
    }
    g.userData = { kind: "unit", legs: legs, arms: arms, head: head, visor: visor, rifle: rifle, phase: Math.random() * 6.28, moving: 0 };
    return g;
  }

  function robot(opt) {
    var g = new T.Group();
    var shell = opt.shell || 0x2b3f49, accent = opt.accent || 0x38f5e0;
    put(g, G.box, mat(shell, 0x0d171b, 0.1), 0.36, 0.14, 0.26, 0, 0.66, 0);
    var torso = put(g, G.box, mat(shell, 0x0d171b, 0.1), 0.42, 0.42, 0.3, 0, 0.95, 0);
    put(g, G.box, mat(0x152026, accent, 0.2), 0.3, 0.14, 0.06, 0, 1.0, -0.17);
    var coreL = put(g, G.sphere, mat(accent, accent, 1.9), 0.09, 0.09, 0.06, 0, 1.0, -0.2);
    var head = put(g, G.box, mat(shell, 0x0d171b, 0.1), 0.26, 0.2, 0.24, 0, 1.3, 0);
    put(g, G.box, mat(accent, accent, 2.0), 0.2, 0.055, 0.02, 0, 1.3, -0.13);
    put(g, G.cyl, mat(0x1b262b, 0x000000, 0), 0.03, 0.3, 0.03, 0.1, 1.52, 0);
    put(g, G.sphere, mat(0xff5d5d, 0xff5d5d, 1.9), 0.05, 0.05, 0.05, 0.1, 1.66, 0);
    var arms = [];
    [-1, 1].forEach(function (sgn) {
      var grp = new T.Group();
      grp.position.set(sgn * 0.28, 1.06, 0);
      put(grp, G.box, mat(shell, 0x0d171b, 0.1), 0.13, 0.3, 0.14, 0, -0.16, 0);
      put(grp, G.cyl, mat(0x18242a, accent, 0.6), 0.09, 0.12, 0.09, 0, -0.36, 0);
      put(grp, G.box, mat(shell, 0x0d171b, 0.1), 0.11, 0.3, 0.12, 0, -0.52, 0);
      g.add(grp); arms.push(grp);
    });
    var rifle = new T.Group();
    put(rifle, G.box, mat(0x1b2429, 0x000000, 0), 0.08, 0.1, 0.46, 0, 0, 0.14);
    put(rifle, G.cyl, mat(0x121a1e, 0x000000, 0), 0.03, 0.36, 0.03, 0, 0.02, 0.44, Math.PI / 2);
    rifle.position.set(0, -0.62, 0.12);
    arms[1].add(rifle);
    var legs = [];
    [-1, 1].forEach(function (sgn) {
      var grp = new T.Group();
      grp.position.set(sgn * 0.13, 0.62, 0);
      put(grp, G.box, mat(shell, 0x0d171b, 0.1), 0.16, 0.3, 0.18, 0, -0.16, 0);
      put(grp, G.cyl, mat(0x18242a, accent, 0.5), 0.1, 0.12, 0.1, 0, -0.34, 0);
      put(grp, G.box, mat(shell, 0x0d171b, 0.1), 0.14, 0.3, 0.16, 0, -0.5, 0);
      put(grp, G.box, mat(0x151e22, 0x000000, 0), 0.18, 0.1, 0.28, 0, -0.68, 0.03);
      g.add(grp); legs.push(grp);
    });
    g.userData = { kind: "unit", legs: legs, arms: arms, head: head, rifle: rifle, phase: Math.random() * 6.28, moving: 0 };
    return g;
  }

  function trooper(opt) {
    var g = humanoid({
      suit: opt && opt.suit || 0x3a1a20, armor: 0x50222a, accent: ENEMY_RED,
      helmet: 0x3b1a20, skin: SKIN_DARK, heavy: !!(opt && opt.heavy), pack: false
    });
    g.userData.kind = "enemy";
    return g;
  }

  function walker(scale) {
    var g = new T.Group();
    var shell = 0x3a1620, accent = 0xff4455;
    put(g, G.box, mat(shell, accent, 0.3), 1.0, 0.62, 0.8, 0, 1.9, 0);
    put(g, G.box, mat(0x24101a, accent, 0.2), 1.3, 0.24, 0.9, 0, 1.55, 0);
    put(g, G.box, mat(accent, accent, 1.8), 1.0, 0.1, 0.05, 0, 2.02, -0.42);
    var eye = put(g, G.sphere, mat(0xff8a95, 0xff8a95, 2.2), 0.18, 0.18, 0.18, 0, 2.02, -0.5);
    put(g, G.cyl, mat(0x2a1018, 0x000000, 0), 0.09, 0.9, 0.09, 0.55, 2.32, 0.2);
    put(g, G.cyl, mat(0x2a1018, 0x000000, 0), 0.09, 0.9, 0.09, -0.55, 2.32, 0.2);
    var ring = put(g, G.torus, mat(accent, accent, 1.4), 1.4, 1.4, 1.4, 0, 1.9, 0, Math.PI / 2.3);
    var legs = [];
    [-1, 1].forEach(function (sgn) {
      var grp = new T.Group();
      grp.position.set(sgn * 0.42, 1.55, 0);
      put(grp, G.box, mat(0x2a1018, accent, 0.25), 0.26, 0.6, 0.3, 0, -0.32, 0);
      put(grp, G.cyl, mat(0x1c0c12, accent, 0.5), 0.16, 0.2, 0.16, 0, -0.66, 0);
      put(grp, G.box, mat(0x2a1018, accent, 0.25), 0.24, 0.6, 0.28, 0, -1.0, 0.06);
      put(grp, G.box, mat(0x151e22, 0x000000, 0), 0.36, 0.16, 0.5, 0, -1.34, 0.1);
      g.add(grp); legs.push(grp);
    });
    g.scale.setScalar(scale || 1);
    g.userData = { kind: "enemy", boss: true, legs: legs, ring: ring, phase: Math.random() * 6.28, moving: 0 };
    return g;
  }

  /* ================= town ================= */
  function buildTown(paths) {
    townRoot = new T.Group();
    scene.add(townRoot);

    /* asphalt ground */
    var ground = new T.Mesh(new T.PlaneGeometry(90, 90), new T.MeshStandardMaterial({
      color: 0x14181b, metalness: 0.1, roughness: 0.95
    }));
    ground.rotation.x = -Math.PI / 2;
    townRoot.add(ground);

    /* plaza paving under the core */
    var plaza = new T.Mesh(new T.CylinderGeometry(4.6, 4.8, 0.1, 28), new T.MeshStandardMaterial({
      color: 0x1b2226, metalness: 0.15, roughness: 0.9
    }));
    plaza.position.y = 0.05;
    townRoot.add(plaza);
    for (var r = 0; r < 3; r++) {
      var rv = new T.Mesh(new T.RingGeometry(1.4 + r * 1.15, 1.5 + r * 1.15, 32),
        new T.MeshBasicMaterial({ color: 0x38f5e0, transparent: true, opacity: 0.22 }));
      rv.rotation.x = -Math.PI / 2;
      rv.position.y = 0.11;
      townRoot.add(rv);
    }

    var curvePts = [];
    paths.forEach(function (pts) {
      var v3 = pts.map(function (p) { var w = A.toWorld(p.x, p.y); return new T.Vector3(w.x, 0, w.z); });
      if (v3.length < 2) return;
      curvePts.push(v3);
      var curve = new T.CatmullRomCurve3(v3);

      /* road: flattened tube = street surface */
      var road = new T.Mesh(new T.TubeGeometry(curve, 42, 0.78, 8, false),
        new T.MeshStandardMaterial({ color: 0x22282c, metalness: 0.05, roughness: 0.98 }));
      road.scale.y = 0.1;
      road.position.y = 0.08;
      townRoot.add(road);

      /* center line */
      var laneGeo = new T.BufferGeometry().setFromPoints(v3.map(function (v) { return new T.Vector3(v.x, 0.14, v.z); }));
      townRoot.add(new T.Line(laneGeo, new T.LineBasicMaterial({ color: 0xffd24a, transparent: true, opacity: 0.5 })));

      /* kerbs + sidewalks along the street */
      for (var i = 1; i < v3.length - 1; i++) {
        var a = v3[i], b = v3[i + 1];
        if (!b) continue;
        var dir = new T.Vector3().subVectors(b, a);
        var len = dir.length();
        if (len < 0.01) continue;
        var ang = Math.atan2(dir.x, dir.z);
        [-1, 1].forEach(function (sgn) {
          var nrm = new T.Vector3(dir.z, 0, -dir.x).normalize().multiplyScalar(sgn * 0.92);
          var walk = put(townRoot, G.box, mat(0x2b3438, 0x0b1114, 0.05),
            1.2, 0.09, len + 0.5, a.x + nrm.x + dir.x * 0.5, 0.12, a.z + nrm.z + dir.z * 0.5);
          walk.rotation.y = ang;
          var kerb = put(townRoot, G.box, mat(0x3c474c, 0x0b1114, 0.05),
            0.1, 0.14, len + 0.5, a.x + nrm.x * 0.86 + dir.x * 0.5, 0.13, a.z + nrm.z * 0.86 + dir.z * 0.5);
          kerb.rotation.y = ang;
        });
      }
    });

    /* buildings flanking the streets */
    var winGeo = [], used = [];
    curvePts.forEach(function (v3) {
      for (var i = 1; i < v3.length; i++) {
        var a = v3[i - 1], b = v3[i];
        var dir = new T.Vector3().subVectors(b, a);
        var ang = Math.atan2(dir.x, dir.z);
        [-1, 1].forEach(function (sgn) {
          for (var k = 0; k < 2; k++) {
            var t = 0.28 + k * 0.48;
            var px = a.x + dir.x * t, pz = a.z + dir.z * t;
            var nrm = new T.Vector3(dir.z, 0, -dir.x).normalize().multiplyScalar(sgn * (3.2 + Math.random() * 1.6));
            var bx = px + nrm.x, bz = pz + nrm.z;
            if (Math.hypot(bx, bz) < 5.2) continue;
            var clash = used.some(function (u) { return Math.hypot(u.x - bx, u.z - bz) < 2.3; });
            if (clash) continue;
            used.push({ x: bx, z: bz });
            var w = 1.5 + Math.random() * 1.5, d = 1.5 + Math.random() * 1.5, h = 1.8 + Math.random() * 5.4;
            var tone = [0x222c31, 0x1d262b, 0x26313a, 0x1a2328][Math.floor(Math.random() * 4)];
            var bld = put(townRoot, G.box, mat(tone, 0x0a1013, 0.06), w, h, d, bx, h / 2 + 0.1, bz);
            bld.rotation.y = ang;
            /* roof light + shop sign */
            put(townRoot, G.box, mat(0x0e1518, 0x38f5e0, 0.5), w * 0.9, 0.04, d * 0.9, bx, h + 0.12, bz);
            var signCol = [0x38f5e0, 0xff5d5d, 0xffd24a, 0xc07bff, 0x7dffb0][Math.floor(Math.random() * 5)];
            put(townRoot, G.box, mat(signCol, signCol, 1.5), w * 0.55, 0.18, 0.04,
              bx + Math.cos(ang) * 0, 0.9 + h * 0.06, bz + (sgn > 0 ? -d / 2 - 0.02 : d / 2 + 0.02));
            /* window grid */
            var rows = Math.max(1, Math.floor(h / 0.9)), cols = Math.max(1, Math.floor(w / 0.62));
            for (var rr = 0; rr < rows; rr++) {
              for (var cc = 0; cc < cols; cc++) {
                if (Math.random() < 0.28) continue;
                winGeo.push({
                  x: bx + (cc - (cols - 1) / 2) * 0.62 * Math.cos(ang) + (sgn > 0 ? -d / 2 - 0.03 : d / 2 + 0.03) * Math.sin(ang),
                  y: 0.75 + rr * 0.9,
                  z: bz - (cc - (cols - 1) / 2) * 0.62 * Math.sin(ang) + (sgn > 0 ? -d / 2 - 0.03 : d / 2 + 0.03) * Math.cos(ang),
                  ry: ang,
                  c: Math.random() < 0.22 ? 0xffd9a0 : (Math.random() < 0.5 ? 0x8fd6ff : 0x2e4a55)
                });
              }
            }
          }
        });
      }
    });

    if (winGeo.length) {
      var wm = new T.InstancedMesh(G.plane, new T.MeshBasicMaterial({ vertexColors: false, color: 0xffffff, transparent: true, opacity: 0.85 }), winGeo.length);
      var dummy = new T.Object3D(), color = new T.Color();
      winGeo.forEach(function (wg, i) {
        dummy.position.set(wg.x, wg.y, wg.z);
        dummy.rotation.set(0, wg.ry, 0);
        dummy.scale.set(0.42, 0.34, 1);
        dummy.updateMatrix();
        wm.setMatrixAt(i, dummy.matrix);
        color.setHex(wg.c);
        wm.setColorAt(i, color);
      });
      wm.instanceMatrix.needsUpdate = true;
      if (wm.instanceColor) wm.instanceColor.needsUpdate = true;
      townRoot.add(wm);
    }

    /* street lamps */
    curvePts.forEach(function (v3) {
      for (var i = 1; i < v3.length; i += 2) {
        var p = v3[i];
        [-1, 1].forEach(function (sgn) {
          var off = new T.Vector3(sgn * 1.5, 0, sgn * 0.6);
          var base = new T.Vector3(p.x + off.x, 0, p.z + off.z);
          if (Math.hypot(base.x, base.z) < 4.4) return;
          put(townRoot, G.cyl, mat(0x2b3438, 0x000000, 0), 0.06, 1.7, 0.06, base.x, 0.85, base.z);
          put(townRoot, G.sphere, mat(0xffc98a, 0xffc98a, 1.6), 0.16, 0.1, 0.16, base.x, 1.72, base.z);
        });
      }
    });

    /* parked cars */
    curvePts.forEach(function (v3) {
      for (var i = 1; i < v3.length - 1; i++) {
        if (Math.random() < 0.45) continue;
        var a = v3[i], b = v3[i + 1];
        var dir = new T.Vector3().subVectors(b, a);
        var ang = Math.atan2(dir.x, dir.z);
        var sgn = Math.random() < 0.5 ? -1 : 1;
        var nrm = new T.Vector3(dir.z, 0, -dir.x).normalize().multiplyScalar(sgn * 0.62);
        var cx2 = a.x + nrm.x, cz2 = a.z + nrm.z;
        if (Math.hypot(cx2, cz2) < 3.6) continue;
        var car = new T.Group();
        var tone = [0x2a3038, 0x3a2028, 0x1f2a33, 0x403425][Math.floor(Math.random() * 4)];
        put(car, G.box, mat(tone, 0x0a1013, 0.08), 0.52, 0.12, 0.24, 0, 0.16, 0);
        put(car, G.box, mat(0x101a1e, 0x0a1013, 0.05), 0.26, 0.1, 0.22, 0, 0.26, 0);
        put(car, G.box, mat(0x8fd6ff, 0x8fd6ff, 0.8), 0.1, 0.03, 0.24, 0.24, 0.26, 0);
        put(car, G.box, mat(0xff5d5d, 0xff5d5d, 0.7), 0.04, 0.04, 0.2, -0.26, 0.2, 0);
        [[-0.17, 0.1], [-0.17, -0.1], [0.17, 0.1], [0.17, -0.1]].forEach(function (w) {
          put(car, G.wheel, mat(0x0b1114, 0x000000, 0), 0.09, 0.06, 0.09, w[0], 0.07, w[1], 0, 0, Math.PI / 2);
        });
        car.position.set(cx2, 0.12, cz2);
        car.rotation.y = ang + Math.PI / 2;
        townRoot.add(car);
      }
    });

    /* planters / small trees */
    for (var t2 = 0; t2 < 16; t2++) {
      var ao = Math.random() * Math.PI * 2, rad = 5.6 + Math.random() * 9;
      var tx = Math.cos(ao) * rad, tz = Math.sin(ao) * rad;
      put(townRoot, G.box, mat(0x2a2320, 0x000000, 0), 0.4, 0.24, 0.4, tx, 0.14, tz);
      put(townRoot, G.cyl, mat(0x3b2a1e, 0x000000, 0), 0.06, 0.7, 0.06, tx, 0.55, tz);
      put(townRoot, G.ico, mat(0x1f3b2c, 0x1f3b2c, 0.25), 0.8, 0.7, 0.8, tx, 1.05, tz);
    }

    /* central tower / objective */
    coreGroup = new T.Group();
    put(coreGroup, G.cyl, mat(0x2a3438, 0x0b1114, 0.06), 3.0, 0.24, 3.0, 0, 0.12, 0);
    put(coreGroup, G.cyl, mat(0x1f2a2f, 0x0b1114, 0.05), 1.5, 0.9, 1.5, 0, 0.5, 0);
    put(coreGroup, G.cyl, mat(0x243036, 0x0b1114, 0.05), 1.05, 1.5, 1.05, 0, 1.6, 0);
    for (var f = 0; f < 4; f++) {
      var fa = (f / 4) * Math.PI * 2;
      put(coreGroup, G.box, mat(0x2f3c42, 0x38f5e0, 0.5), 0.1, 2.2, 0.34,
        Math.cos(fa) * 1.06, 1.8, Math.sin(fa) * 1.06, 0, -fa, 0);
    }
    coreGroup.userData.ring = put(coreGroup, G.torus, mat(0x8fd6ff, 0x8fd6ff, 0.9), 1.5, 1.5, 1.5, 0, 3.1, 0, Math.PI / 2.2);
    var orb = new T.Mesh(new T.IcosahedronGeometry(0.52, 1), new T.MeshStandardMaterial({
      color: 0xffb457, emissive: 0xffb457, emissiveIntensity: 1.8, metalness: 0.2, roughness: 0.3
    }));
    orb.position.y = 3.35;
    coreGroup.add(orb);
    coreGroup.userData.orb = orb;
    put(coreGroup, G.cyl, mat(0x243036, 0x0b1114, 0.05), 0.12, 1.4, 0.12, 0, 2.9, 0);
    townRoot.add(coreGroup);
  }

  A.buildArena = function (paths) {
    if (!A.ok) return;
    if (townRoot) { scene.remove(townRoot); townRoot = null; }
    ringArcs.forEach(function (a) { scene.remove(a); });
    ringArcs = [];
    MATC = {};
    buildTown(paths);
  };

  A.setRings = function (seg) {
    if (!A.ok) return;
    if (!ringArcs.length) {
      for (var i = 0; i < 6; i++) {
        var arc = new T.Mesh(new T.TorusGeometry(2.05, 0.1, 6, 34, Math.PI / 3.4),
          mat(0x38f5e0, 0x38f5e0, 1.0));
        arc.rotation.x = -Math.PI / 2;
        arc.rotation.z = (i / 6) * Math.PI * 2;
        arc.position.y = 0.2;
        scene.add(arc);
        ringArcs.push(arc);
      }
    }
    ringArcs.forEach(function (a, i) {
      var hp = (seg && seg[i]) || 0;
      a.visible = hp > 0;
      a.material = mat(hp > 200 ? 0x38f5e0 : 0xff7b33, hp > 200 ? 0x38f5e0 : 0xff7b33, hp > 600 ? 1.2 : 0.5);
    });
  };

  /* ================= spawn api ================= */
  var ROBOT_CLASSES = { Techie: 1, Netrunner: 1, Corpo: 1 };

  A.addUnit = function (o) {
    if (!A.ok) return null;
    var w = A.toWorld(o.x, o.y);
    var cls = o.cls || "Solo";
    var accent = o.ally ? 0xc07bff : (CLASS_COLOR[cls] || 0x38f5e0);
    var m = ROBOT_CLASSES[cls]
      ? robot({ shell: 0x2b3f49, accent: accent })
      : humanoid({ suit: o.ally ? 0x2a2140 : 0x22303a, armor: 0x2b3d45, accent: accent, helmet: 0x2b3d45, heavy: cls === "Cyberpsycho" });
    m.position.set(w.x, 0.02, w.z);
    scene.add(m);
    return m;
  };

  A.addEnemy = function (o) {
    if (!A.ok) return null;
    var w = A.toWorld(o.x, o.y);
    var m = o.boss ? walker(1) : trooper({ heavy: !!o.heavy });
    m.userData.moving = 1;
    m.position.set(w.x, 0.02, w.z);
    scene.add(m);
    return m;
  };

  A.addTurret = function (o) {
    if (!A.ok) return null;
    var w = A.toWorld(o.x, o.y);
    var g = new T.Group();
    var col = o.heavy ? 0xff7b33 : 0xffd24a;
    put(g, G.cyl, mat(0x2a3438, 0x0b1114, 0.06), 0.9, 0.2, 0.9, 0, 0.1, 0);
    put(g, G.box, mat(0x33424a, 0x0b1114, 0.06), 0.5, 0.3, 0.5, 0, 0.34, 0);
    var head = new T.Group();
    put(head, G.box, mat(0x3d4d55, col, 0.35), 0.5, 0.34, 0.5, 0, 0, 0);
    put(head, G.cyl, mat(0x1b2429, col, 0.8), 0.09, o.heavy ? 0.9 : 0.66, 0.09, 0, 0.04, o.heavy ? 0.5 : 0.42, Math.PI / 2);
    put(head, G.sphere, mat(col, col, 1.8), 0.08, 0.08, 0.08, 0, 0.16, -0.14);
    head.position.y = 0.62;
    g.add(head);
    g.position.set(w.x, 0.02, w.z);
    g.userData = { kind: "turret", head: head, barrel: head };
    scene.add(g);
    return g;
  };

  A.aim = function (m, x, y) {
    if (!A.ok || !m) return;
    var w = A.toWorld(x, y);
    var tgt = m.userData.head || m;
    tgt.rotation.y = Math.atan2(w.x - m.position.x, w.z - m.position.z);
  };

  A.move = function (m, x, y) {
    if (!A.ok || !m) return;
    var w = A.toWorld(x, y);
    var dx = w.x - m.position.x, dz = w.z - m.position.z;
    if (Math.abs(dx) + Math.abs(dz) > 0.004) {
      m.userData.moving = 1;
      m.rotation.y = Math.atan2(dx, dz);
    }
    m.position.x = w.x; m.position.z = w.z;
  };
  A.remove = function (m) { if (A.ok && m && m.parent) scene.remove(m); };

  A.setHp = function (m, frac, boss) {
    if (!A.ok || !m) return;
    if (!m.userData.bar) {
      var bar = new T.Mesh(G.plane, new T.MeshBasicMaterial({ color: 0x38f5e0, transparent: true, opacity: 0.9 }));
      bar.scale.set(0.7, 0.07, 1);
      bar.position.y = boss ? 3.0 : 1.92;
      m.add(bar);
      m.userData.bar = bar;
    }
    var b = m.userData.bar;
    b.scale.x = Math.max(0.03, 0.7 * frac);
    b.material.color.setHex(frac > 0.4 ? 0x38f5e0 : 0xff4455);
    b.lookAt(camera.position);
  };

  /* ================= effects ================= */
  A.tracer = function (a, b, color) {
    if (!A.ok) return;
    var wa = A.toWorld(a.x, a.y), wb = A.toWorld(b.x, b.y);
    var geo = new T.BufferGeometry().setFromPoints([
      new T.Vector3(wa.x, 1.0, wa.z), new T.Vector3(wb.x, 0.9, wb.z)
    ]);
    var line = new T.Line(geo, new T.LineBasicMaterial({ color: color === undefined ? 0xffd24a : color, transparent: true, opacity: 0.95 }));
    scene.add(line);
    effects.push({ obj: line, life: 0.14, kind: "line" });
  };
  A.burst = function (x, y, color) {
    if (!A.ok) return;
    var w = A.toWorld(x, y);
    var ring = new T.Mesh(new T.TorusGeometry(0.2, 0.05, 6, 18),
      new T.MeshBasicMaterial({ color: color === undefined ? 0xffd24a : color, transparent: true, opacity: 0.95 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(w.x, 0.25, w.z);
    scene.add(ring);
    effects.push({ obj: ring, life: 0.45, kind: "ring" });
  };
  A.blast = function (x, y, radius) {
    if (!A.ok) return;
    var w = A.toWorld(x, y);
    var ring = new T.Mesh(new T.TorusGeometry(0.3, 0.1, 8, 34),
      new T.MeshBasicMaterial({ color: 0x38f5e0, transparent: true, opacity: 0.85 }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(w.x, 0.22, w.z);
    ring.userData.grow = (radius / A.PPU) / 0.4;
    scene.add(ring);
    effects.push({ obj: ring, life: 0.4, kind: "grow" });
  };

  /* ================= frame ================= */
  A.render = function () {
    if (!A.ok) return;
    var dt = Math.min(0.05, clock.getDelta());
    time += dt;

    if (coreGroup && coreGroup.userData.orb) {
      coreGroup.userData.orb.rotation.y += dt * 0.8;
      coreGroup.userData.orb.position.y = 3.35 + Math.sin(time * 1.5) * 0.05;
      if (coreGroup.userData.ring) coreGroup.userData.ring.rotation.z += dt * 0.7;
    }
    if (coreLight) coreLight.intensity = 2.3 + Math.sin(time * 3) * 0.4;

    scene.traverse(function (o) {
      var d = o.userData;
      if (!d) return;
      if (d.kind === "unit" || d.kind === "enemy") {
        var spd = d.moving ? 7.5 : 2.2;
        var amp = d.moving ? 0.55 : 0.06;
        d.moving = Math.max(0, d.moving - dt * 3);
        if (d.legs && d.legs.length) {
          d.legs[0].rotation.x = Math.sin(time * spd + d.phase) * amp;
          d.legs[1].rotation.x = -Math.sin(time * spd + d.phase) * amp;
        }
        if (d.arms && d.arms.length) {
          d.arms[0].rotation.x = -Math.sin(time * spd + d.phase) * amp * 0.7;
          d.arms[1].rotation.x = Math.sin(time * spd + d.phase) * amp * 0.35;
        }
        if (d.ring) d.ring.rotation.z += dt * 1.2;
      }
    });

    for (var i = effects.length - 1; i >= 0; i--) {
      var f = effects[i];
      f.life -= dt;
      if (f.kind === "grow") f.obj.scale.setScalar(1 + (0.4 - f.life) * f.obj.userData.grow * 3);
      f.obj.material.opacity = Math.max(0, f.life * (f.kind === "line" ? 6 : 2.2));
      if (f.life <= 0) {
        scene.remove(f.obj);
        if (f.kind === "line") f.obj.geometry.dispose();
        effects.splice(i, 1);
      }
    }
    renderer.render(scene, camera);
  };

  /* ================= small views ================= */
  A.campView = function (canvas, seg) {
    if (!A.can3d) return null;
    if (!G.box) geoms();
    var w = canvas.clientWidth || 300, h = canvas.clientHeight || 220, r;
    try { r = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); } catch (e) { return null; }
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.setSize(w, h, false);
    var sc = new T.Scene();
    sc.background = new T.Color(0x0a1116);
    var cam = new T.PerspectiveCamera(42, w / h, 0.1, 80);
    cam.position.set(0, 6.4, 8.2);
    cam.lookAt(0, 1.6, 0);
    sc.add(new T.HemisphereLight(0x3d7d8c, 0x0a1014, 1.2));
    var dl = new T.DirectionalLight(0xc9ecff, 0.8); dl.position.set(-6, 10, 6); sc.add(dl);
    var pl = new T.PointLight(0xff9a4d, 3.0, 26); pl.position.set(0, 3.4, 0); sc.add(pl);

    var grp = new T.Group();
    put(grp, G.cyl, mat(0x1b2226, 0x0b1114, 0.05), 3.4, 0.14, 3.4, 0, 0.07, 0);
    put(grp, G.cyl, mat(0x1f2a2f, 0x0b1114, 0.05), 1.5, 0.9, 1.5, 0, 0.55, 0);
    put(grp, G.cyl, mat(0x243036, 0x0b1114, 0.05), 1.05, 1.5, 1.05, 0, 1.65, 0);
    for (var f = 0; f < 4; f++) {
      var fa = (f / 4) * Math.PI * 2;
      put(grp, G.box, mat(0x2f3c42, 0x38f5e0, 0.5), 0.1, 2.0, 0.3, Math.cos(fa) * 1.06, 1.85, Math.sin(fa) * 1.06, 0, -fa, 0);
    }
    var orb = new T.Mesh(new T.IcosahedronGeometry(0.5, 1), mat(0xffb457, 0xffb457, 1.9));
    orb.position.y = 3.3; grp.add(orb);
    var ring = put(grp, G.torus, mat(0x8fd6ff, 0x8fd6ff, 0.9), 1.5, 1.5, 1.5, 0, 3.05, 0, Math.PI / 2.2);
    var arcs = [];
    for (var i = 0; i < 6; i++) {
      var hp = (seg && seg[i]) || 0;
      var arc = new T.Mesh(new T.TorusGeometry(2.15, 0.1, 6, 30, Math.PI / 3.5),
        mat(hp > 200 ? 0x38f5e0 : 0xff7b33, hp > 200 ? 0x38f5e0 : 0xff7b33, hp > 600 ? 1.1 : 0.5));
      arc.rotation.x = -Math.PI / 2;
      arc.rotation.z = (i / 6) * Math.PI * 2;
      arc.position.y = 0.2;
      arc.visible = hp > 0;
      grp.add(arc); arcs.push(arc);
    }
    /* a couple of citizens and guards for scale */
    var cit = humanoid({ suit: 0x2a333a, armor: 0x33424a, accent: 0x8fd6ff, helmet: 0x2b3d45, pack: false });
    cit.position.set(-2.4, 0.02, 1.6); cit.rotation.y = 0.7; grp.add(cit);
    var guard = humanoid({ suit: 0x22303a, armor: 0x2b3d45, accent: 0x38f5e0, helmet: 0x2b3d45 });
    guard.position.set(2.3, 0.02, 1.2); guard.rotation.y = -0.6; grp.add(guard);
    sc.add(grp);

    var t0 = performance.now();
    function tick() {
      var el = (performance.now() - t0) / 1000;
      grp.rotation.y = Math.sin(el * 0.3) * 0.35;
      orb.rotation.y += 0.012;
      orb.position.y = 3.3 + Math.sin(el * 1.5) * 0.05;
      ring.rotation.z += 0.01;
      cit.userData.legs[0].rotation.x = Math.sin(el * 2.4) * 0.2;
      cit.userData.legs[1].rotation.x = -Math.sin(el * 2.4) * 0.2;
      r.render(sc, cam);
      canvas._raf = requestAnimationFrame(tick);
    }
    tick();
    return { dispose: function () { cancelAnimationFrame(canvas._raf); r.dispose(); } };
  };

  A.mapThumb = function (canvas, paths, accent) {
    if (!A.can3d) return null;
    if (!G.box) geoms();
    var w = canvas.clientWidth || 260, h = canvas.clientHeight || 92, r;
    try { r = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); } catch (e) { return null; }
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.setSize(w, h, false);
    var sc = new T.Scene();
    sc.background = new T.Color(0x080f13);
    var cam = new T.PerspectiveCamera(46, w / h, 0.1, 90);
    cam.position.set(0, 8.4, 7.6);
    cam.lookAt(0, 0.4, 0.4);
    sc.add(new T.HemisphereLight(0x3d7d8c, 0x0a1014, 1.1));
    var dl = new T.DirectionalLight(0xc9ecff, 0.7); dl.position.set(-4, 9, 7); sc.add(dl);
    var ground = new T.Mesh(new T.PlaneGeometry(16, 16), new T.MeshStandardMaterial({ color: 0x141a1d, roughness: 0.95 }));
    ground.rotation.x = -Math.PI / 2; sc.add(ground);
    var col = accent || 0x38f5e0;
    (paths || []).forEach(function (pts) {
      var v3 = pts.map(function (q) { return new T.Vector3((q[0] - 0.5) * 12, 0.1, (q[1] - 0.5) * 12); });
      if (v3.length < 2) return;
      var curve = new T.CatmullRomCurve3(v3);
      var road = new T.Mesh(new T.TubeGeometry(curve, 26, 0.5, 6, false), new T.MeshStandardMaterial({ color: 0x2a3236, roughness: 0.9 }));
      road.scale.y = 0.14; sc.add(road);
      for (var i = 1; i < v3.length; i += 2) {
        if (Math.random() < 0.3) continue;
        var b = v3[i];
        var bh = 0.6 + Math.random() * 1.5;
        var bld = new T.Mesh(G.box, mat(0x233038, col, 0.12));
        bld.scale.set(0.5 + Math.random() * 0.5, bh, 0.5 + Math.random() * 0.5);
        bld.position.set(b.x + (Math.random() - 0.5) * 1.4, bh / 2, b.z + (Math.random() - 0.5) * 1.4);
        sc.add(bld);
      }
    });
    var core = new T.Mesh(new T.IcosahedronGeometry(0.42, 1), mat(0xffb457, 0xffb457, 1.7));
    core.position.set(0, 0.5, 0); sc.add(core);
    var t0 = performance.now();
    function tick() {
      var e2 = (performance.now() - t0) / 1000;
      cam.position.x = Math.sin(e2 * 0.35) * 8.2;
      cam.lookAt(0, 0.4, 0.4);
      core.rotation.y += 0.02;
      r.render(sc, cam);
      canvas._raf = requestAnimationFrame(tick);
    }
    tick();
    return { dispose: function () { cancelAnimationFrame(canvas._raf); r.dispose(); } };
  };

  /* operator portrait — full body character on a plinth */
  A.portrait = function (canvas, cls, tier) {
    if (!A.can3d) return null;
    if (!G.box) geoms();
    var w = canvas.clientWidth || 120, h = canvas.clientHeight || 120, r;
    try { r = new T.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true }); } catch (e) { return null; }
    r.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    r.setSize(w, h, false);
    var sc = new T.Scene();
    var cam = new T.PerspectiveCamera(38, w / h, 0.1, 40);
    cam.position.set(0, 1.5, 3.4);
    cam.lookAt(0, 0.95, 0);
    sc.add(new T.HemisphereLight(0x3d7d8c, 0x0a1014, 1.25));
    var d = new T.DirectionalLight(0xc9ecff, 1.0); d.position.set(-3, 6, 5); sc.add(d);
    var rim = new T.PointLight(0xff9a4d, 2.2, 12); rim.position.set(2.4, 2.2, -2.4); sc.add(rim);
    var accent = CLASS_COLOR[cls] || 0x38f5e0;
    var m = ROBOT_CLASSES[cls]
      ? robot({ shell: 0x2b3f49, accent: accent })
      : humanoid({ suit: 0x22303a, armor: 0x2b3d45, accent: accent, helmet: 0x2b3d45, heavy: cls === "Cyberpsycho" });
    m.position.y = -0.75;
    sc.add(m);
    put(sc, G.cyl, mat(0x1b2226, 0x38f5e0, 0.5), 1.5, 0.12, 1.5, 0, -0.74, 0);
    var t0 = performance.now();
    function tick() {
      var el = (performance.now() - t0) / 1000;
      m.rotation.y = Math.sin(el * 0.6) * 0.55;
      m.position.y = -0.75 + Math.sin(el * 1.2) * 0.012;
      if (m.userData.arms) {
        m.userData.arms[0].rotation.x = Math.sin(el * 0.8) * 0.08;
        m.userData.arms[1].rotation.x = Math.sin(el * 0.8 + 1) * 0.05;
      }
      if (m.userData.legs) {
        m.userData.legs[0].rotation.x = Math.sin(el * 0.6) * 0.05;
        m.userData.legs[1].rotation.x = -Math.sin(el * 0.6) * 0.05;
      }
      r.render(sc, cam);
      canvas._raf = requestAnimationFrame(tick);
    }
    tick();
    return { dispose: function () { cancelAnimationFrame(canvas._raf); r.dispose(); } };
  };
})();
