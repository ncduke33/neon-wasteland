/* NEON WASTELAND 3D LAYER  v3 — town map, humanoid models, procedural only.
   three.js (MIT). No external art assets. */
(function () {
  var T = window.THREE;
  var A = { ok: false, W: 0, H: 0, PPU: 34, zoom: 0.95, can3d: false };
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
  var townRoot, coreGroup, ringArcs = [], coreLight, fadeMeshes = [];
  var effects = [];
  var G = {}, MATC = {};

  function geoms() {
    G.box = new T.BoxGeometry(1, 1, 1);
    G.cyl = new T.CylinderGeometry(0.5, 0.5, 1, 20);
    G.cone = new T.ConeGeometry(0.5, 1, 10);
    G.sphere = new T.SphereGeometry(0.5, 20, 16);
    G.ico = new T.IcosahedronGeometry(0.5, 1);
    G.octa = new T.OctahedronGeometry(0.5, 0);
    G.torus = new T.TorusGeometry(0.5, 0.08, 8, 20);
    G.plane = new T.PlaneGeometry(1, 1);
    G.cap = new T.CapsuleGeometry(0.5, 0.6, 8, 16);
    G.cap2 = new T.CapsuleGeometry(0.5, 0.9, 8, 16);
    G.torus2 = new T.TorusGeometry(0.5, 0.05, 10, 40);
    G.octa2 = new T.OctahedronGeometry(0.5, 1);
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
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.toneMapping = T.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    if (renderer.outputEncoding !== undefined) renderer.outputEncoding = T.sRGBEncoding;

    scene = new T.Scene();
    scene.background = new T.Color(0x070d11);
    scene.fog = new T.FogExp2(0x070d11, 0.012);

    camera = new T.PerspectiveCamera(46, w / h, 0.1, 400);

    var hemi = new T.HemisphereLight(0x5fa8c8, 0x14181f, 1.35);
    scene.add(hemi);
    var moon = new T.DirectionalLight(0xd6f0ff, 1.5);
    moon.position.set(-16, 26, 14);
    moon.castShadow = true;
    moon.shadow.mapSize.width = 1024;
    moon.shadow.mapSize.height = 1024;
    moon.shadow.camera.near = 1;
    moon.shadow.camera.far = 90;
    moon.shadow.camera.left = -22;
    moon.shadow.camera.right = 22;
    moon.shadow.camera.top = 22;
    moon.shadow.camera.bottom = -22;
    moon.shadow.bias = -0.0008;
    scene.add(moon);
    var warm = new T.DirectionalLight(0xff8a3d, 0.75);
    warm.position.set(16, 9, -16);
    scene.add(warm);
    var rimCyan = new T.DirectionalLight(0x38f5e0, 0.55);
    rimCyan.position.set(0, 6, 20);
    scene.add(rimCyan);
    var rimPink = new T.DirectionalLight(0xff3d8b, 0.4);
    rimPink.position.set(-18, 5, -12);
    scene.add(rimPink);
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
    var dist = Math.max(7.4, span * 0.62) / (A.zoom || 1);
    camera.position.set(0, dist * 0.94, dist * 0.62);
    camera.lookAt(0, 0.6, 0);
    camera.aspect = A.W / A.H;
    camera.updateProjectionMatrix();
  }
  A.setZoom = function (z) { A.zoom = Math.min(3.0, Math.max(0.55, z)); if (A.ok) position(); return A.zoom; };
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
  function shadows(root) {
    root.traverse(function (n) { if (n.isMesh) { n.castShadow = true; n.receiveShadow = false; } });
    return root;
  }

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
    put(g, G.box, mat(0x151f24, accent, 0.5), 0.26, 0.05, 0.06, 0, 0.86, -0.12);
    put(g, G.box, mat(0x151f24, accent, 0.5), 0.06, 0.2, 0.05, 0.09, 0.88, -0.12);
    put(g, G.box, mat(0x151f24, accent, 0.5), 0.06, 0.2, 0.05, -0.09, 0.88, -0.12);

    var neck = put(g, G.cyl, mat(skin, 0x000000, 0), 0.09, 0.08, 0.09, 0, 1.08, 0);
    var head = put(g, G.sphere, mat(skin, 0x000000, 0), 0.19, 0.21, 0.19, 0, 1.21, 0);
    var helmet = put(g, G.sphere, mat(opt.helmet || 0x2b3d45, 0x0c1518, 0.08), 0.21, 0.15, 0.21, 0, 1.27, 0);
    var brim = put(g, G.cyl, mat(opt.helmet || 0x2b3d45, 0x0c1518, 0.08), 0.215, 0.035, 0.215, 0, 1.235, -0.01);
    var visor = put(g, G.box, mat(accent, accent, 1.8), 0.16, 0.055, 0.03, 0, 1.19, 0.16);
    /* face plate and jaw so the head is not a bare ball */
    put(g, G.box, mat(opt.armor || 0x243740, accent, 0.16), 0.15, 0.1, 0.06, 0, 1.14, 0.15);
    put(g, G.sphere, mat(skin, 0x000000, 0), 0.06, 0.05, 0.05, 0, 1.115, 0.19);
    put(g, G.cyl, mat(0x1b262b, accent, 0.8), 0.02, 0.12, 0.02, 0.115, 1.22, 0.1);
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
      /* shoulder pad + forearm guard so the arm reads as armour, not a tube */
      put(grp, G.sphere, mat(opt.armor || 0x243740, accent, 0.3), 0.15, 0.1, 0.15, 0, -0.02, 0);
      put(grp, G.box, mat(0x1a242a, accent, 0.45), 0.12, 0.14, 0.1, 0, -0.46, 0.02);
      put(grp, G.box, mat(accent, accent, 1.3), 0.03, 0.1, 0.02, sgn * 0.055, -0.46, 0.075);
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
      /* thigh plate + knee guard + boot cuff */
      put(grp, G.box, mat(opt.armor || 0x243740, accent, 0.2), 0.13, 0.16, 0.12, 0, -0.2, 0.03);
      put(grp, G.sphere, mat(0x1a242a, accent, 0.5), 0.085, 0.07, 0.085, 0, -0.34, 0.05);
      put(grp, G.cyl, mat(0x151e22, accent, 0.3), 0.115, 0.05, 0.115, 0, -0.59, 0.02);
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
  function instancer(geo, items, mtlOpt, opacity) {
    if (!items.length) return null;
    var material = new T.MeshStandardMaterial({
      color: 0xffffff, metalness: mtlOpt && mtlOpt.metal !== undefined ? mtlOpt.metal : 0.2,
      roughness: mtlOpt && mtlOpt.rough !== undefined ? mtlOpt.rough : 0.8,
      transparent: opacity !== undefined, opacity: opacity === undefined ? 1 : opacity,
      emissive: mtlOpt && mtlOpt.emissive !== undefined ? mtlOpt.emissive : 0x000000,
      emissiveIntensity: mtlOpt && mtlOpt.ei !== undefined ? mtlOpt.ei : 0.4
    });
    if (mtlOpt && mtlOpt.basic) material = new T.MeshBasicMaterial({ color: 0xffffff, transparent: opacity !== undefined, opacity: opacity === undefined ? 1 : opacity });
    var mesh = new T.InstancedMesh(geo, material, items.length);
    var dummy = new T.Object3D(), col = new T.Color();
    items.forEach(function (it, i) {
      dummy.position.set(it.x, it.y, it.z);
      dummy.rotation.set(it.rx || 0, it.ry || 0, it.rz || 0);
      dummy.scale.set(it.sx, it.sy, it.sz);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
      col.setHex(it.c === undefined ? 0xffffff : it.c);
      mesh.setColorAt(i, col);
    });
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    mesh.frustumCulled = false;
    return mesh;
  }

  function buildTown(paths) {
    townRoot = new T.Group();
    scene.add(townRoot);
    fadeMeshes = [];
    var Q = { bld: [], roof: [], kerb: [], walk: [], pole: [], lamp: [], planter: [], trunk: [], leaf: [], win: [], carBody: [], carTop: [], carGlass: [], carLamp: [], carWheel: [], walkLine: [] };

    var ground = new T.Mesh(new T.PlaneGeometry(90, 90), new T.MeshStandardMaterial({ color: 0x1a2028, metalness: 0.18, roughness: 0.9 }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    townRoot.add(ground);
    /* district colour washes so the board is not one flat tone */
    var washes = [[0x38f5e0, -6.5, 4.2], [0xff3d8b, 7.2, 3.4], [0xffb457, 3.4, -6.6], [0x7dffb0, -4.8, -5.8]];
    washes.forEach(function (wsh) {
      var patch = new T.Mesh(new T.CircleGeometry(3.6, 26),
        new T.MeshBasicMaterial({ color: wsh[0], transparent: true, opacity: 0.07 }));
      patch.rotation.x = -Math.PI / 2;
      patch.position.set(wsh[1], 0.02, wsh[2]);
      townRoot.add(patch);
    });

    var plaza = new T.Mesh(new T.CylinderGeometry(4.6, 4.8, 0.1, 40), new T.MeshStandardMaterial({ color: 0x2a3238, metalness: 0.4, roughness: 0.55 }));
    plaza.position.y = 0.05;
    plaza.receiveShadow = true;
    townRoot.add(plaza);
    var ringCols = [0x38f5e0, 0xffb457, 0xff3d8b];
    for (var r = 0; r < 3; r++) {
      var rv = new T.Mesh(new T.RingGeometry(1.4 + r * 1.15, 1.5 + r * 1.15, 48),
        new T.MeshBasicMaterial({ color: ringCols[r], transparent: true, opacity: 0.26 }));
      rv.rotation.x = -Math.PI / 2; rv.position.y = 0.11; townRoot.add(rv);
    }

    var curvePts = [];
    var LANE_ROAD = [0x2b3238, 0x322b3a, 0x263239, 0x38322b];
    var LANE_LINE = [0x38f5e0, 0xff3d8b, 0xffb457, 0x7dffb0];
    paths.forEach(function (pts, laneNo) {
      var v3 = pts.map(function (p) { var w = A.toWorld(p.x, p.y); return new T.Vector3(w.x, 0, w.z); });
      if (v3.length < 2) return;
      curvePts.push(v3);
      var curve = new T.CatmullRomCurve3(v3);
      var road = new T.Mesh(new T.TubeGeometry(curve, 60, 0.78, 12, false),
        new T.MeshStandardMaterial({ color: LANE_ROAD[laneNo % 4], metalness: 0.25, roughness: 0.8 }));
      road.scale.y = 0.1; road.position.y = 0.08; townRoot.add(road);
      var laneGeo = new T.BufferGeometry().setFromPoints(v3.map(function (v) { return new T.Vector3(v.x, 0.14, v.z); }));
      townRoot.add(new T.Line(laneGeo, new T.LineBasicMaterial({ color: LANE_LINE[laneNo % 4], transparent: true, opacity: 0.6 })));

      for (var i = 1; i < v3.length - 1; i++) {
        var a = v3[i], b = v3[i + 1];
        if (!b) continue;
        var dir = new T.Vector3().subVectors(b, a);
        var len = dir.length();
        if (len < 0.01) continue;
        var ang = Math.atan2(dir.x, dir.z);
        [-1, 1].forEach(function (sgn) {
          var nrm = new T.Vector3(dir.z, 0, -dir.x).normalize().multiplyScalar(sgn * 0.92);
          Q.walk.push({ sx: 1.2, sy: 0.09, sz: len + 0.5, x: a.x + nrm.x + dir.x * 0.5, y: 0.12, z: a.z + nrm.z + dir.z * 0.5, ry: ang, c: 0x2b3438 });
          var nrm2 = new T.Vector3(dir.z, 0, -dir.x).normalize().multiplyScalar(sgn * 0.86);
          Q.kerb.push({ sx: 0.1, sy: 0.14, sz: len + 0.5, x: a.x + nrm2.x + dir.x * 0.5, y: 0.13, z: a.z + nrm2.z + dir.z * 0.5, ry: ang, c: 0x3c474c });
        });
      }
    });

    var used = [];
    var tones = [0x1e3a44, 0x2a2440, 0x3a2430, 0x1f3327, 0x2c2f4a, 0x402a1e];
    var signCols = [0x38f5e0, 0xff5d5d, 0xffd24a, 0xc07bff, 0x7dffb0];
    curvePts.forEach(function (v3) {
      for (var i = 1; i < v3.length; i++) {
        var a = v3[i - 1], b = v3[i];
        var dir = new T.Vector3().subVectors(b, a);
        var ang = Math.atan2(dir.x, dir.z);
        [-1, 1].forEach(function (sgn) {
          for (var k = 0; k < 2; k++) {
            var t = 0.28 + k * 0.5;
            var px = a.x + dir.x * t, pz = a.z + dir.z * t;
            var nrm = new T.Vector3(dir.z, 0, -dir.x).normalize().multiplyScalar(sgn * (3.7 + Math.random() * 2.1));
            var bx = px + nrm.x, bz = pz + nrm.z;
            if (Math.hypot(bx, bz) < 5.2) continue;
            if (used.some(function (u) { return Math.hypot(u.x - bx, u.z - bz) < 2.4; })) continue;
            used.push({ x: bx, z: bz });
            var w = 1.5 + Math.random() * 1.5, d = 1.5 + Math.random() * 1.5, h = 1.4 + Math.random() * 3.4;
            Q.bld.push({ sx: w, sy: h, sz: d, x: bx, y: h / 2 + 0.1, z: bz, ry: ang, c: tones[(Math.random() * tones.length) | 0] });
            Q.roof.push({ sx: w * 0.9, sy: 0.05, sz: d * 0.9, x: bx, y: h + 0.12, z: bz, ry: ang, c: 0x0e1518 });
            var neon = signCols[(Math.random() * signCols.length) | 0];
            var ex = Math.cos(ang) * (w / 2 - 0.04), ez = -Math.sin(ang) * (w / 2 - 0.04);
            Q.roof.push({ sx: 0.05, sy: h * 0.86, sz: 0.05, x: bx + ex, y: h * 0.46, z: bz + ez, ry: ang, c: neon });
            Q.roof.push({ sx: 0.05, sy: h * 0.86, sz: 0.05, x: bx - ex, y: h * 0.46, z: bz - ez, ry: ang, c: neon });
            Q.roof.push({ sx: w * 0.5, sy: 0.16, sz: 0.05, x: bx, y: 1.0 + h * 0.05, z: bz + (sgn > 0 ? -d / 2 - 0.03 : d / 2 + 0.03), ry: ang, c: signCols[(Math.random() * signCols.length) | 0] });
            var rows = Math.max(1, Math.floor(h / 0.95)), cols = Math.max(1, Math.floor(w / 0.66));
            for (var rr = 0; rr < rows; rr++) {
              for (var cc = 0; cc < cols; cc++) {
                if (Math.random() < 0.3) continue;
                var side = sgn > 0 ? -d / 2 - 0.04 : d / 2 + 0.04;
                Q.win.push({
                  sx: 0.42, sy: 0.34, sz: 1,
                  x: bx + (cc - (cols - 1) / 2) * 0.66 * Math.cos(ang) + side * Math.sin(ang),
                  y: 0.78 + rr * 0.95,
                  z: bz - (cc - (cols - 1) / 2) * 0.66 * Math.sin(ang) + side * Math.cos(ang),
                  ry: ang,
                  c: Math.random() < 0.2 ? 0xffd9a0 : (Math.random() < 0.5 ? 0x8fd6ff : 0x2e4a55)
                });
              }
            }
          }
        });
      }
    });

    curvePts.forEach(function (v3) {
      for (var i = 1; i < v3.length; i += 2) {
        var p = v3[i];
        [-1, 1].forEach(function (sgn) {
          var base = new T.Vector3(p.x + sgn * 1.5, 0, p.z + sgn * 0.6);
          if (Math.hypot(base.x, base.z) < 4.4) return;
          Q.pole.push({ sx: 0.06, sy: 1.7, sz: 0.06, x: base.x, y: 0.85, z: base.z, c: 0x2b3438 });
          Q.lamp.push({ sx: 0.16, sy: 0.1, sz: 0.16, x: base.x, y: 1.72, z: base.z, c: 0xffc98a });
        });
      }
    });

    curvePts.forEach(function (v3) {
      for (var i = 1; i < v3.length - 1; i++) {
        if (Math.random() < 0.5) continue;
        var a = v3[i], b = v3[i + 1];
        var dir = new T.Vector3().subVectors(b, a);
        var ang = Math.atan2(dir.x, dir.z);
        var sgn = Math.random() < 0.5 ? -1 : 1;
        var nrm = new T.Vector3(dir.z, 0, -dir.x).normalize().multiplyScalar(sgn * 0.62);
        var cx2 = a.x + nrm.x, cz2 = a.z + nrm.z;
        if (Math.hypot(cx2, cz2) < 3.6) continue;
        var tone = [0x2a3038, 0x3a2028, 0x1f2a33, 0x403425][(Math.random() * 4) | 0];
        var ry2 = ang + Math.PI / 2;
        Q.carBody.push({ sx: 0.52, sy: 0.12, sz: 0.24, x: cx2, y: 0.28, z: cz2, ry: ry2, c: tone });
        Q.carTop.push({ sx: 0.26, sy: 0.1, sz: 0.22, x: cx2, y: 0.38, z: cz2, ry: ry2, c: 0x101a1e });
        Q.carGlass.push({ sx: 0.1, sy: 0.03, sz: 0.24, x: cx2 + Math.cos(ry2) * 0.24, y: 0.38, z: cz2 - Math.sin(ry2) * 0.24, ry: ry2, c: 0x8fd6ff });
        Q.carLamp.push({ sx: 0.04, sy: 0.04, sz: 0.2, x: cx2 - Math.cos(ry2) * 0.26, y: 0.32, z: cz2 + Math.sin(ry2) * 0.26, ry: ry2, c: 0xff5d5d });
        [[-0.17, 0.1], [-0.17, -0.1], [0.17, 0.1], [0.17, -0.1]].forEach(function (wk) {
          Q.carWheel.push({ sx: 0.09, sy: 0.06, sz: 0.09, x: cx2 + wk[0] * Math.cos(ry2) + wk[1] * Math.sin(ry2), y: 0.19,
            z: cz2 - wk[0] * Math.sin(ry2) + wk[1] * Math.cos(ry2), ry: ry2, rx: 0, rz: Math.PI / 2, c: 0x0b1114 });
        });
      }
    });

    for (var t2 = 0; t2 < 18; t2++) {
      var ao = Math.random() * Math.PI * 2, rad = 5.6 + Math.random() * 9;
      var tx = Math.cos(ao) * rad, tz = Math.sin(ao) * rad;
      Q.planter.push({ sx: 0.4, sy: 0.24, sz: 0.4, x: tx, y: 0.14, z: tz, c: 0x2a2320 });
      Q.trunk.push({ sx: 0.06, sy: 0.7, sz: 0.06, x: tx, y: 0.55, z: tz, c: 0x3b2a1e });
      Q.leaf.push({ sx: 0.8, sy: 0.7, sz: 0.8, x: tx, y: 1.05, z: tz, c: 0x1f3b2c });
    }

    [["bld", G.box, { rough: 0.85, metal: 0.1 }], ["roof", G.box, { rough: 0.6, metal: 0.3, emissive: 0x0a1013, ei: 0.3 }],
     ["walk", G.box, { rough: 0.9 }], ["kerb", G.box, { rough: 0.85 }], ["pole", G.cyl, { rough: 0.7 }],
     ["planter", G.box, { rough: 0.9 }], ["trunk", G.cyl, { rough: 0.9 }],
     ["carBody", G.box, { rough: 0.5, metal: 0.5 }], ["carTop", G.box, { rough: 0.5 }],
     ["carWheel", G.wheel, { rough: 0.9 }]
    ].forEach(function (d) {
      var m = instancer(d[1], Q[d[0]], d[2]);
      if (m) {
        townRoot.add(m);
        if (d[0] === "bld" || d[0] === "roof") {
          m.material.transparent = true;
          m.material.opacity = 1;
          m.material.depthWrite = false;
          fadeMeshes.push(m);
        }
      }
    });
    var lampM = instancer(G.sphere, Q.lamp, { emissive: 0xffc98a, ei: 1.6, rough: 0.4 }, 1);
    if (lampM) { lampM.material = new T.MeshBasicMaterial({ color: 0xffc98a, transparent: true, opacity: 0.95 }); townRoot.add(lampM); }
    var leafM = instancer(G.ico, Q.leaf, { emissive: 0x16281d, ei: 0.3, rough: 0.9 });
    if (leafM) townRoot.add(leafM);
    var glassM = instancer(G.box, Q.carGlass, { emissive: 0x8fd6ff, ei: 0.7, rough: 0.2 }, 1);
    if (glassM) townRoot.add(glassM);
    var carLampM = instancer(G.box, Q.carLamp, { emissive: 0xff5d5d, ei: 0.9, rough: 0.4 }, 1);
    if (carLampM) townRoot.add(carLampM);
    var winM = instancer(G.plane, Q.win, { basic: true }, 0.9);
    if (winM) townRoot.add(winM);

    /* central tower */
    coreGroup = new T.Group();

    /* ---- objective base: layered octagonal platform, not a stack of drums ---- */
    var baseGeo = new T.CylinderGeometry(3.15, 3.35, 0.26, 8);
    var base = new T.Mesh(baseGeo, mat(0x2b343b, 0x0b1114, 0.05));
    base.position.y = 0.13; base.receiveShadow = true; base.castShadow = true;
    coreGroup.add(base);
    var trim = new T.Mesh(new T.TorusGeometry(3.12, 0.045, 8, 8), mat(0x38f5e0, 0x38f5e0, 1.4));
    trim.rotation.x = Math.PI / 2; trim.rotation.z = Math.PI / 8; trim.position.y = 0.27;
    coreGroup.add(trim);

    /* eight buttresses with lit edges */
    for (var bf = 0; bf < 8; bf++) {
      var ba = (bf / 8) * Math.PI * 2 + Math.PI / 8;
      var bx = Math.cos(ba) * 2.55, bz = Math.sin(ba) * 2.55;
      put(coreGroup, G.box, mat(0x333d45, 0x0d171b, 0.08), 0.62, 0.5, 0.9, bx, 0.5, bz, 0, -ba, 0);
      put(coreGroup, G.box, mat(0x38f5e0, 0x38f5e0, 1.5), 0.66, 0.045, 0.06, bx, 0.74, bz, 0, -ba, 0);
      put(coreGroup, G.cyl, mat(0x1d262c, 0x0b1114, 0.05), 0.16, 0.62, 0.16, bx * 1.06, 0.6, bz * 1.06);
    }

    /* stepped tiers with coloured trim */
    var tier = [[2.05, 0.34, 0.42, 0x39444d], [1.55, 0.3, 0.86, 0x333d45], [1.05, 0.26, 1.2, 0x2c353c]];
    tier.forEach(function (t, ti) {
      var m = new T.Mesh(new T.CylinderGeometry(t[0], t[0] * 1.06, t[1], 24), mat(t[3], 0x0b1114, 0.05));
      m.position.y = t[2]; m.castShadow = true; m.receiveShadow = true;
      coreGroup.add(m);
      var tg = new T.Mesh(new T.TorusGeometry(t[0] * 0.99, 0.028, 6, 36), mat([0xffb457, 0x38f5e0, 0x8fd6ff][ti], [0xffb457, 0x38f5e0, 0x8fd6ff][ti], 1.5));
      tg.rotation.x = Math.PI / 2; tg.position.y = t[2] + t[1] * 0.5;
      coreGroup.add(tg);
    });

    /* energy pylons ringing the top tier */
    for (var pf = 0; pf < 6; pf++) {
      var pa = (pf / 6) * Math.PI * 2;
      var px2 = Math.cos(pa) * 1.28, pz2 = Math.sin(pa) * 1.28;
      put(coreGroup, G.cyl, mat(0x2f3941, 0x0b1114, 0.06), 0.1, 0.95, 0.1, px2, 1.75, pz2);
      put(coreGroup, G.sphere, mat(0xffb457, 0xffb457, 2.0), 0.11, 0.11, 0.11, px2, 2.26, pz2);
    }

    /* central column with glowing veins */
    put(coreGroup, G.cyl, mat(0x333d45, 0x0b1114, 0.06), 0.62, 1.9, 0.62, 0, 2.35, 0);
    for (var vf = 0; vf < 4; vf++) {
      var va = (vf / 4) * Math.PI * 2;
      put(coreGroup, G.box, mat(0x38f5e0, 0x38f5e0, 1.6), 0.05, 1.55, 0.03, Math.cos(va) * 0.32, 2.35, Math.sin(va) * 0.32, 0, -va, 0);
    }

    /* the objective: layered energy orb with a spinning cage */
    var orbGlow = new T.Mesh(new T.SphereGeometry(0.78, 24, 18),
      new T.MeshBasicMaterial({ color: 0xffb457, transparent: true, opacity: 0.16 }));
    orbGlow.position.y = 3.55;
    coreGroup.add(orbGlow);
    var orb = new T.Mesh(new T.IcosahedronGeometry(0.5, 1), new T.MeshStandardMaterial({
      color: 0xffc46b, emissive: 0xffb457, emissiveIntensity: 2.4, metalness: 0.35, roughness: 0.22
    }));
    orb.position.y = 3.55;
    coreGroup.add(orb);
    coreGroup.userData.orb = orb;
    coreGroup.userData.orbGlow = orbGlow;
    var cage = new T.Mesh(new T.IcosahedronGeometry(0.68, 0), new T.MeshBasicMaterial({ color: 0xffd9a0, wireframe: true, transparent: true, opacity: 0.5 }));
    cage.position.y = 3.55;
    coreGroup.add(cage);
    coreGroup.userData.cage = cage;

    coreGroup.userData.ring = put(coreGroup, G.torus, mat(0x8fd6ff, 0x8fd6ff, 1.2), 1.7, 1.7, 1.7, 0, 3.55, 0, Math.PI / 2.15);
    var halo = new T.Mesh(new T.TorusGeometry(1.15, 0.03, 8, 48), mat(0xff3d8b, 0xff3d8b, 1.6));
    halo.rotation.x = Math.PI / 2.6;
    halo.position.y = 3.55;
    coreGroup.add(halo);
    coreGroup.userData.halo = halo;

    /* shield dome */
    var dome = new T.Mesh(new T.SphereGeometry(4.1, 26, 18, 0, Math.PI * 2, 0, Math.PI / 2),
      new T.MeshBasicMaterial({ color: 0x38f5e0, transparent: true, opacity: 0.05, side: T.DoubleSide }));
    dome.position.y = 0.1;
    coreGroup.add(dome);
    coreGroup.userData.dome = dome;

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
    shadows(m);
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
  A.stats = function () {
    if (!A.ok) return null;
    return { calls: renderer.info.render.calls, tris: renderer.info.render.triangles, meshes: scene.children.length };
  };

  var perf = { frames: 0, acc: 0, step: 0 };
  function adapt(dt) {
    perf.frames++; perf.acc += dt;
    if (perf.acc < 1.6) return;
    var fps = perf.frames / perf.acc;
    perf.frames = 0; perf.acc = 0;
    if (fps < 26 && perf.step === 0) {
      perf.step = 1;
      renderer.setPixelRatio(1);
      renderer.setSize(A.W, A.H, false);
      A.quality = "reduced";
    } else if (fps < 26 && perf.step === 1) {
      perf.step = 2;
      renderer.setPixelRatio(0.8);
      renderer.setSize(A.W, A.H, false);
      A.quality = "low";
    }
  }

  A.render = function () {
    if (!A.ok) return;
    var dt = Math.min(0.05, clock.getDelta());
    time += dt;
    adapt(dt);

    if (fadeMeshes.length) {
      var ft = A.zoom < 0.8 ? 0.16 : (A.zoom < 1.15 ? 0.42 : (A.zoom < 1.7 ? 0.75 : 1));
      for (var fi = 0; fi < fadeMeshes.length; fi++) {
        var mm = fadeMeshes[fi].material;
        mm.opacity += (ft - mm.opacity) * Math.min(1, dt * 5);
        mm.depthWrite = mm.opacity > 0.92;
      }
    }
    if (coreGroup && coreGroup.userData.orb) {
      coreGroup.userData.orb.rotation.y += dt * 0.8;
      coreGroup.userData.orb.position.y = 3.55 + Math.sin(time * 1.5) * 0.06;
      if (coreGroup.userData.orbGlow) {
        coreGroup.userData.orbGlow.position.y = coreGroup.userData.orb.position.y;
        coreGroup.userData.orbGlow.scale.setScalar(1 + Math.sin(time * 2.1) * 0.06);
      }
      if (coreGroup.userData.cage) {
        coreGroup.userData.cage.position.y = coreGroup.userData.orb.position.y;
        coreGroup.userData.cage.rotation.y -= dt * 0.45;
        coreGroup.userData.cage.rotation.x += dt * 0.2;
      }
      if (coreGroup.userData.halo) {
        coreGroup.userData.halo.position.y = coreGroup.userData.orb.position.y;
        coreGroup.userData.halo.rotation.z += dt * 0.9;
      }
      if (coreGroup.userData.dome) {
        coreGroup.userData.dome.material.opacity = 0.04 + Math.sin(time * 1.3) * 0.015;
      }
      if (coreGroup.userData.ring) {
        coreGroup.userData.ring.rotation.z += dt * 0.7;
        coreGroup.userData.ring.position.y = coreGroup.userData.orb.position.y;
      }
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
