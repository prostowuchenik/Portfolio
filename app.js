/* =========================================================
   Віртуальне портфоліо (A-Frame) — Професійна редакція
   ========================================================= */

const CONFIG_PATH = "./config/config.json";
const $ = (sel) => document.querySelector(sel);

/** Компонент: Блокування руху крізь вертикальні площини (Анти-лаг) */
AFRAME.registerComponent('wall-collider', {
  init: function () {
    this.raycaster = new THREE.Raycaster();
    this.colliders = [];
    this.playerRadius = 0.4;
    
    this.dirs = [
      new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
      new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
      new THREE.Vector3(0.707, 0, 0.707), new THREE.Vector3(-0.707, 0, 0.707),
      new THREE.Vector3(0.707, 0, -0.707), new THREE.Vector3(-0.707, 0, -0.707)
    ];
  },
  tick: function () {
    if (this.colliders.length === 0) return;

    this.el.object3D.updateMatrixWorld(true);
    const worldPos = new THREE.Vector3();
    this.el.object3D.getWorldPosition(worldPos);
    worldPos.y -= 0.5; 

    const rigObj = document.querySelector('#rig').object3D;

    for (let i = 0; i < this.dirs.length; i++) {
      this.raycaster.set(worldPos, this.dirs[i]);
      const hits = this.raycaster.intersectObjects(this.colliders, true);
      
      if (hits.length > 0 && hits[0].distance < this.playerRadius) {
        const overlap = this.playerRadius - hits[0].distance;
        const pushVec = this.dirs[i].clone().multiplyScalar(-overlap);
        
        const invQuat = rigObj.quaternion.clone().invert();
        const localPush = pushVec.clone().applyQuaternion(invQuat);

        this.el.object3D.position.add(localPush);
        worldPos.add(pushVec); 
      }
    }
  }
});

/** Компонент: Автоматичне приховування курсора */
AFRAME.registerComponent('auto-hide-cursor', {
  schema: {
    timeout: { type: 'number', default: 1000 },
    deadzone: { type: 'number', default: 15 }   
  },
  init: function () {
    this.timer = null;
    this.isVisible = true;
    this.baseOpacity = this.el.getAttribute('material').opacity || 0.6;
    this.lastX = null;
    this.lastY = null;

    this.onMouseMove = this.onMouseMove.bind(this);
    this.showCursor = this.showCursor.bind(this);
    this.hideCursor = this.hideCursor.bind(this);

    window.addEventListener('mousemove', this.onMouseMove);
    window.addEventListener('keydown', this.showCursor);
    window.addEventListener('mousedown', this.showCursor);
    window.addEventListener('wheel', this.showCursor);

    this.resetTimer();
  },
  onMouseMove: function (e) {
    if (!this.isVisible) {
      if (this.lastX === null || this.lastY === null) {
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        return;
      }
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      const distance = Math.sqrt(dx * dx + dy * dy);
      if (distance > this.data.deadzone) this.showCursor();
    } else {
      this.resetTimer();
    }
  },
  showCursor: function () {
    if (!this.isVisible) {
      this.el.setAttribute('visible', true); 
      this.el.setAttribute('animation', `property: material.opacity; from: 0; to: ${this.baseOpacity}; dur: 150; easing: easeOutQuad`);
      this.isVisible = true;
      this.lastX = null;
      this.lastY = null;
    }
    this.resetTimer();
  },
  hideCursor: function () {
    if (this.isVisible) {
      this.el.setAttribute('animation', 'property: material.opacity; to: 0; dur: 300; easing: easeOutQuad');
      this.isVisible = false;
      setTimeout(() => { if (!this.isVisible) this.el.setAttribute('visible', false); }, 300);
    }
  },
  resetTimer: function () {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(this.hideCursor, this.data.timeout);
  }
});

const ui = {
  panel: $("#infoPanel"),
  image: $("#infoImage"),
  title: $("#infoTitle"),
  meta: $("#infoMeta"),
  desc: $("#infoDesc"),
  cameraEl: $("#camera"), 

  open(work) {
    this.title.textContent = work.TITLE || work.WORK_ID || "Без назви";
    const metaParts = [];
    if (work.AUTHOR) metaParts.push(work.AUTHOR);
    if (work.YEAR) metaParts.push(String(work.YEAR));
    if (work.TECHNIQUE) metaParts.push(work.TECHNIQUE);
    this.meta.textContent = metaParts.join(" · ") || "—";
    this.desc.textContent = work.DESCRIPTION || "—";
    
    if (work.FILE) {
      this.image.src = `./works/${work.FILE}`;
      this.image.style.display = "block";
    } else {
      this.image.src = "";
      this.image.style.display = "none";
    }
    this.panel.style.display = "flex";
    if (this.cameraEl) {
      this.cameraEl.setAttribute("look-controls", "enabled", false);
      this.cameraEl.setAttribute("wasd-controls", "enabled", false);
    }
    if (document.pointerLockElement) document.exitPointerLock();
  },
  
  close() {
    this.panel.style.display = "none";
    this.image.src = ""; 
    this.image.style.display = "none";
    if (this.cameraEl) {
      this.cameraEl.setAttribute("look-controls", "enabled", true);
      this.cameraEl.setAttribute("wasd-controls", "enabled", true);
    }
    const sceneCanvas = document.querySelector("a-scene").canvas;
    if (sceneCanvas) sceneCanvas.requestPointerLock();
  }
};

const hintBox = {
  el: $("#hint"),
  full: $("#hint-full"),
  collapsed: $("#hint-collapsed"),
  isCollapsed: false,
  timer: null,
  toggle() {
    this.isCollapsed = !this.isCollapsed;
    if (this.isCollapsed) {
      this.full.style.display = "none";
      this.collapsed.style.display = "block";
    } else {
      this.full.style.display = "block";
      this.collapsed.style.display = "none";
      this.startTimer(); 
    }
  },
  startTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => { if (!this.isCollapsed) this.toggle(); }, 10000); 
  },
  init() {
    if (!this.el) return;
    this.el.addEventListener("click", (e) => { e.stopPropagation(); this.toggle(); });
    this.startTimer();
  }
};
hintBox.init();

window.addEventListener("contextmenu", (e) => e.preventDefault());
window.addEventListener("mousedown", (e) => {
  if (e.button === 2 && ui.panel.style.display === "flex") ui.close();
});

/** =========================================================
    ЛОГІКА ПЛАНУВАЛЬНИКА МАРШРУТУ (2D ПЛАН)
    ========================================================= */
const pathPlanner = {
  overlay: $("#pathModalOverlay"),
  pointsContainer: $("#planPoints"),
  linesContainer: $("#planLines"),
  startBtn: $("#startTourBtn"),
  resetBtn: $("#resetTourBtn"),
  
  cols: 6,
  rows: 5,
  currentPathEnd: null, 
  spawnPointHook: null,
  activeSegments: new Set(),
  drawnLines: new Map(), 
  blacklistedSegments: new Set(),
  blacklistedPoints: new Set(),
  sceneRoot: null, 

  mapping: {
    "c1_r1-2": "PATH_VER_01", "c1_r2-3": "PATH_VER_02", "c2_r1-2": "PATH_VER_03", "c2_r2-3": "PATH_VER_04",
    "c3_r1-2": "PATH_VER_05", "c3_r2-3": "PATH_VER_06", "c4_r1-2": "PATH_VER_07", "c4_r2-3": "PATH_VER_08",
    "r1_c1-2": "PATH_HOR_01", "r1_c2-3": "PATH_HOR_02", "r1_c3-4": "PATH_HOR_03",
    "r2_c1-2": "PATH_HOR_04", "r2_c2-3": "PATH_HOR_05", "r2_c3-4": "PATH_HOR_06",
    "r3_c1-2": "PATH_HOR_07", "r3_c2-3": "PATH_HOR_08", "r3_c3-4": "PATH_HOR_09"
  },

  pointToHook: {
    "c1_r1": "POINT_01", "c2_r1": "POINT_02", "c3_r1": "POINT_03", "c4_r1": "POINT_04",
    "c1_r2": "POINT_05", "c2_r2": "POINT_06", "c3_r2": "POINT_07", "c4_r2": "POINT_08",
    "c1_r3": "POINT_09", "c2_r3": "POINT_10", "c3_r3": "POINT_11", "c4_r3": "POINT_12"
  },

  init(cfg) {
    const cam = $("#camera");
    if (cam) {
      cam.setAttribute("look-controls", "enabled", false);
      cam.setAttribute("wasd-controls", "enabled", false);
    }

    if (cfg?.PLAN_GRID?.COLS) this.cols = cfg.PLAN_GRID.COLS;
    if (cfg?.PLAN_GRID?.ROWS) this.rows = cfg.PLAN_GRID.ROWS;

    if (cfg && Array.isArray(cfg.BLACKLISTED_PATHS)) {
      cfg.BLACKLISTED_PATHS.forEach(segment => this.blacklistedSegments.add(segment));
    }
    if (cfg?.PLAN_GRID && Array.isArray(cfg.PLAN_GRID.BLACKLISTED_POINTS)) {
      cfg.PLAN_GRID.BLACKLISTED_POINTS.forEach(pt => this.blacklistedPoints.add(pt));
    }

    this.buildGrid(cfg);
    this.resetBtn.addEventListener("click", () => this.resetRoute());

    this.startBtn.addEventListener("click", () => {
      this.overlay.style.display = "none";
      this.load3DPaths();
      
      if (this.spawnPointHook && this.sceneRoot) {
        const hookObj = getByName(this.sceneRoot, this.spawnPointHook);
        if (hookObj) {
          const wp = new THREE.Vector3();
          hookObj.getWorldPosition(wp);
          const rig = $("#rig");
          rig.setAttribute("position", `${wp.x} ${wp.y} ${wp.z}`);
          
          const pointRot = cfg?.POINT_ROTATIONS?.[this.spawnPointHook] || cfg?.PLAYER?.START_ROTATION || [0, 0, 0];
          rig.setAttribute("rotation", `${pointRot[0]} ${pointRot[1]} ${pointRot[2]}`);
        }
      }

      if (cam) {
        cam.setAttribute("look-controls", "enabled", true);
        cam.setAttribute("wasd-controls", "enabled", true);
      }
    });
  },

  resetRoute() {
    this.activeSegments.clear();
    this.drawnLines.forEach(line => line.remove());
    this.drawnLines.clear();
    const selectedPoints = document.querySelectorAll('.point-selected');
    selectedPoints.forEach(pt => pt.classList.remove('point-selected'));
    this.currentPathEnd = null;
    this.spawnPointHook = null;
  },

  buildGrid(cfg) {
    const colsX = cfg?.PLAN_GRID?.COLUMNS_X;
    const rowsY = cfg?.PLAN_GRID?.ROWS_Y;
    if (!Array.isArray(colsX) || colsX.length !== this.cols || !Array.isArray(rowsY) || rowsY.length !== this.rows) {
      console.error("[CONFIG ERROR] Невідповідність параметрів PLAN_GRID.");
      return;
    }

    for (let r = 0; r < this.rows; r++) {
      for (let c = 0; c < this.cols; c++) {
        const ptID = `c${c}_r${r}`;
        if (this.blacklistedPoints.has(ptID)) continue;

        const pt = document.createElement("div");
        pt.className = "plan-point";
        pt.style.left = `${colsX[c]}%`;
        pt.style.top = `${rowsY[r]}%`;

        const isEdge = (c === 0 || c === this.cols - 1 || r === 0 || r === this.rows - 1);
        if (isEdge) {
          pt.classList.add("point-edge");
        } else {
          pt.classList.add("point-inner");
          pt.dataset.c = c; pt.dataset.r = r;
          pt.addEventListener("click", (e) => this.handlePointClick(e.target, c, r));
        }
        this.pointsContainer.appendChild(pt);
      }
    }
  },

  handlePointClick(el, c, r) {
    if (!this.currentPathEnd) {
      this.currentPathEnd = { el, c, r };
      this.spawnPointHook = this.pointToHook[`c${c}_r${r}`];
      el.classList.add("point-selected");
      return;
    }
    const p1 = this.currentPathEnd;
    const p2 = { el, c, r };
    let segmentKey = null;
    if (p1.c === p2.c && Math.abs(p1.r - p2.r) === 1) {
      const minR = Math.min(p1.r, p2.r);
      const maxR = Math.max(p1.r, p2.r);
      segmentKey = `c${p1.c}_r${minR}-${maxR}`;
    } else if (p1.r === p2.r && Math.abs(p1.c - p2.c) === 1) {
      const minC = Math.min(p1.c, p2.c);
      const maxC = Math.max(p1.c, p2.c);
      segmentKey = `r${p1.r}_c${minC}-${maxC}`;
    }
    if (segmentKey && this.mapping[segmentKey]) {
      if (this.blacklistedSegments.has(segmentKey)) return; 
      if (this.activeSegments.has(segmentKey)) {
        this.activeSegments.delete(segmentKey);
        const lineObj = this.drawnLines.get(segmentKey);
        if (lineObj) { lineObj.remove(); this.drawnLines.delete(segmentKey); }
      } else {
        this.activeSegments.add(segmentKey);
        this.drawSVGFast(p1, p2, segmentKey);
      }
      p1.el.classList.remove("point-selected");
      this.currentPathEnd = p2;
      p2.el.classList.add("point-selected");
    }
  },

  drawSVGFast(p1, p2, segmentKey) {
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', p1.el.style.left); line.setAttribute('y1', p1.el.style.top);
    line.setAttribute('x2', p2.el.style.left); line.setAttribute('y2', p2.el.style.top);
    line.setAttribute('stroke', '#ff3b3b'); line.setAttribute('stroke-width', '4');
    this.linesContainer.appendChild(line);
    this.drawnLines.set(segmentKey, line);
  },

  load3DPaths() {
    if (!this.sceneRoot) return;
    this.activeSegments.forEach(segmentKey => {
      const objName = this.mapping[segmentKey];
      if (objName) {
        const pathObj = getByName(this.sceneRoot, objName);
        if (pathObj) pathObj.visible = true;
      }
    });
  }
};

/** ========================================================= */

async function loadConfig() {
  const res = await fetch(CONFIG_PATH, { cache: "no-store" });
  if (!res.ok) throw new Error(`Status: ${res.status}`);
  return await res.json();
}

function warnIfNotUppercaseKeys(obj, prefix = "ROOT") {
  if (!obj || typeof obj !== "object") return;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => warnIfNotUppercaseKeys(v, `${prefix}[${i}]`));
    return;
  }
  for (const k of Object.keys(obj)) {
    if (k !== k.toUpperCase()) console.warn(`[CONFIG] Ключ не UPPERCASE: ${prefix}.${k}`);
    warnIfNotUppercaseKeys(obj[k], `${prefix}.${k}`);
  }
}

function loadImageInfo(url) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error(url));
    img.src = url;
  });
}

function computeContainSize(innerW, innerH, imgW, imgH) {
  const innerAspect = innerW / innerH;
  const imgAspect = imgW / imgH;
  if (imgAspect >= innerAspect) return { w: innerW, h: innerW / imgAspect };
  return { w: innerH * imgAspect, h: innerH };
}

function getByName(root3D, name) { return root3D.getObjectByName(name); }

function ensureUniqueMaterial(mesh) {
  if (!mesh || !mesh.material) return;
  if (Array.isArray(mesh.material)) mesh.material = mesh.material.map(m => m.clone());
  else mesh.material = mesh.material.clone();
}

async function applyMaterialOverride(mesh, override) {
  if (!mesh || !mesh.material) return;
  ensureUniqueMaterial(mesh);
  const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
  const colorHex = override.COLOR || null;
  const mapPath = override.TEXTURE || null;
  const targetIndex = typeof override.MATERIAL_INDEX === "number" ? override.MATERIAL_INDEX : null;
  for (let i = 0; i < mats.length; i++) {
    if (targetIndex !== null && i !== targetIndex) continue;
    const m = mats[i];
    if (colorHex && m.color) m.color.set(colorHex);
    if (typeof override.METALNESS === "number" && "metalness" in m) m.metalness = override.METALNESS;
    if (typeof override.ROUGHNESS === "number" && "roughness" in m) m.roughness = override.ROUGHNESS;
    if (mapPath) {
      const tex = await new Promise((res, rej) => new THREE.TextureLoader().load(mapPath, res, undefined, rej));
      tex.colorSpace = THREE.SRGBColorSpace;
      if (override.REPEAT) {
        tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(override.REPEAT[0], override.REPEAT[1]);
      }
      m.map = tex; m.needsUpdate = true;
    }
  }
}

function buildLightsFromConfig(cfg) {
  const lightsRoot = $("#lights");
  lightsRoot.innerHTML = "";
  const arr = cfg?.LIGHTS?.LIST;
  if (!Array.isArray(arr)) return;
  arr.forEach((L) => {
    const e = document.createElement("a-entity");
    const type = (L.TYPE || "point").toLowerCase();
    let lightStr = `type: ${type}; color: ${L.COLOR || "#ffffff"}; intensity: ${L.INTENSITY || 1};`;
    if (type === "point" || type === "spot") lightStr += ` distance: ${L.DISTANCE || 0}; decay: ${L.DECAY || 2};`;
    e.setAttribute("light", lightStr);
    const p = L.POSITION || [0, 3, 0];
    const r = L.ROTATION || [0, 0, 0];
    e.setAttribute("position", `${p[0]} ${p[1]} ${p[2]}`);
    e.setAttribute("rotation", `${r[0]} ${r[1]} ${r[2]}`);
    lightsRoot.appendChild(e);
  });
}

function loadRoom(cfg) {
  const room = $("#room");
  const glbPath = cfg?.ROOM?.GLB_PATH || "./assets/room.glb";
  const p = cfg?.ROOM?.POSITION || [0,0,0];
  const r = cfg?.ROOM?.ROTATION || [0,0,0];
  room.setAttribute("gltf-model", `url(${glbPath})`);
  room.setAttribute("position", `${p[0]} ${p[1]} ${p[2]}`);
  room.setAttribute("rotation", `${r[0]} ${r[1]} ${r[2]}`);
  room.setAttribute("scale", `${cfg?.ROOM?.SCALE ?? 1} ${cfg?.ROOM?.SCALE ?? 1} ${cfg?.ROOM?.SCALE ?? 1}`);
  return room;
}

async function applyMaterialOverrides(root3D, cfg) {
  const list = cfg?.MATERIAL_OVERRIDES;
  if (!Array.isArray(list)) return;
  root3D.traverse(async (obj) => {
    if (!obj.isMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const ov of list) {
      const targetName = ov.MATERIAL_NAME;
      if (!targetName) continue;
      if (mats.some(m => m?.name === targetName)) await applyMaterialOverride(obj, ov);
    }
  });
}

async function buildWorks(root3D, cfg) {
  const slots = cfg?.SLOTS;
  const works = cfg?.WORKS;
  if (!Array.isArray(slots) || !Array.isArray(works)) return;
  const slotById = new Map(slots.map(s => [s.SLOT_ID, s]));
  const globalGlow = cfg?.WORKS_GLOW ?? 0;

  for (let i = 0; i < works.length; i++) {
    const work = works[i];
    const slot = slotById.get(work.SLOT_ID || slots[i]?.SLOT_ID);
    if (!slot) continue;
    const hookObj = getByName(root3D, slot.HOOK_NAME);
    if (!hookObj) continue;
    const imgUrl = `./works/${work.FILE}`;
    let imgInfo = null;
    try { imgInfo = await loadImageInfo(imgUrl); } catch (e) { continue; }
    const size = computeContainSize(slot.INNER_W || 1, slot.INNER_H || 1, imgInfo.width, imgInfo.height);
    const plane = document.createElement("a-plane");
    plane.classList.add("clickable");
    plane.setAttribute("width", size.w); plane.setAttribute("height", size.h);
    plane.setAttribute("material", `src: url(${imgUrl}); shader: standard; transparent: true; metalness: 0; roughness: 1;`);
    
    if ((work.GLOW ?? globalGlow) > 0) {
      plane.addEventListener('materialtextureloaded', () => {
        const mesh = plane.getObject3D('mesh');
        mesh.material.emissiveMap = mesh.material.map;
        mesh.material.emissive.setHex(0xffffff); 
        mesh.material.emissiveIntensity = work.GLOW ?? globalGlow; 
        mesh.material.needsUpdate = true;
      });
    }

    const wp = new THREE.Vector3(); const wq = new THREE.Quaternion();
    hookObj.getWorldPosition(wp); hookObj.getWorldQuaternion(wq);
    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(wq);
    const finalPos = wp.clone().add(forward.multiplyScalar(slot.IMAGE_OFFSET || 0.01));
    plane.setAttribute("position", `${finalPos.x} ${finalPos.y} ${finalPos.z}`);
    const euler = new THREE.Euler().setFromQuaternion(wq, "YXZ");
    plane.setAttribute("rotation", `${THREE.MathUtils.radToDeg(euler.x)} ${THREE.MathUtils.radToDeg(euler.y)} ${THREE.MathUtils.radToDeg(euler.z)}`);
    plane.addEventListener("mousedown", (e) => {
      if (document.pointerLockElement) ui.open(work);
    });
    $("a-scene").appendChild(plane);
  }
}

async function buildSculptures(root3D, cfg) {
  const arr = cfg?.SCULPTURES;
  if (!Array.isArray(arr)) return;
  for (const scl of arr) {
    const hookObj = getByName(root3D, scl.HOOK_NAME);
    if (!hookObj) continue;
    const e = document.createElement("a-entity");
    e.setAttribute("gltf-model", `url(./assets/${scl.FILE})`);
    const wp = new THREE.Vector3(); const wq = new THREE.Quaternion();
    hookObj.getWorldPosition(wp); hookObj.getWorldQuaternion(wq);
    e.setAttribute("position", `${wp.x} ${wp.y} ${wp.z}`);
    const euler = new THREE.Euler().setFromQuaternion(wq, "YXZ");
    e.setAttribute("rotation", `${THREE.MathUtils.radToDeg(euler.x)} ${THREE.MathUtils.radToDeg(euler.y)} ${THREE.MathUtils.radToDeg(euler.z)}`);
    e.setAttribute("scale", `${scl.SCALE || 1} ${scl.SCALE || 1} ${scl.SCALE || 1}`);
    $("a-scene").appendChild(e);
  }
}

function basicComplianceChecks(cfg) {
  (cfg?.WORKS || []).forEach(w => {
    if (w.FILE && w.FILE !== w.FILE.toUpperCase()) console.warn(`[WORK FILE] Файл не UPPERCASE: ${w.FILE}`);
  });
}

function setupEnvironment(cfg) {
  const envPath = cfg?.ENVIRONMENT?.MAP_PATH;
  if (!envPath) return;
  const sceneEl = $("a-scene");
  if (!sceneEl) return;
  const intensity = typeof cfg?.ENVIRONMENT?.INTENSITY === "number" ? cfg?.ENVIRONMENT?.INTENSITY : 1.0;

  new THREE.TextureLoader().load(envPath, (texture) => {
    texture.mapping = THREE.EquirectangularReflectionMapping;
    texture.colorSpace = THREE.SRGBColorSpace;
    sceneEl.object3D.environment = texture;
    if ("environmentIntensity" in sceneEl.object3D) sceneEl.object3D.environmentIntensity = intensity;
  });
}

(async function main() {
  try {
    const cfg = await loadConfig();
    warnIfNotUppercaseKeys(cfg);
    basicComplianceChecks(cfg);
    
    pathPlanner.init(cfg);
    setupEnvironment(cfg);
    buildLightsFromConfig(cfg);
    
    const cam = $("#camera"); const rig = $("#rig");
    cam.setAttribute("position", `0 ${cfg?.PLAYER?.HEIGHT ?? 1.65} 0`);
    cam.setAttribute("camera", "fov", cfg?.PLAYER?.FOV ?? 80);
    const start = cfg?.PLAYER?.START_POSITION || [0, 0, 0];
    const rot = cfg?.PLAYER?.START_ROTATION || [0, 0, 0];
    rig.setAttribute("position", `${start[0]} ${start[1]} ${start[2]}`);
    rig.setAttribute("rotation", `${rot[0]} ${rot[1]} ${rot[2]}`);
    
    const room = loadRoom(cfg);
    room.addEventListener("model-loaded", async () => {
      const root3D = room.getObject3D("mesh"); if (!root3D) return;
      pathPlanner.sceneRoot = root3D;
      const collSystem = cam.components['wall-collider'];
      root3D.traverse(child => {
        if (!child.name) return;
        const nameU = child.name.toUpperCase();
        if (nameU.includes("COLLIDER")) { child.visible = false; if (collSystem) collSystem.colliders.push(child); }
        if (nameU.includes("PATH_HOR_") || nameU.includes("PATH_VER_")) child.visible = false;
      });
      await applyMaterialOverrides(root3D, cfg);
      await buildWorks(root3D, cfg);
      await buildSculptures(root3D, cfg);
    });
  } catch (e) { console.error(e); }
})();
