/* =========================================================
   Віртуальне портфоліо (A-Frame) — єдиний шаблон
   ========================================================= */

const CONFIG_PATH = "./config/config.json";
const $ = (sel) => document.querySelector(sel);

/** Компонент: Блокування руху крізь вертикальні площини (COLLIDER) */
AFRAME.registerComponent('wall-collider', {
  init: function () {
    this.raycaster = new THREE.Raycaster();
    this.colliders = [];
    this.playerRadius = 0.4; // Запас дистанції (відштовхування від стіни)
    this.initialized = false;
    this.lastLocalPos = new THREE.Vector3();
    this.rigObj = document.querySelector('#rig').object3D;
  },
  tick: function () {
    if (this.colliders.length === 0) return;

    const localPos = this.el.object3D.position;

    // Ініціалізація початкової безпечної точки
    if (!this.initialized) {
      this.lastLocalPos.copy(localPos);
      this.initialized = true;
      return;
    }

    // Розрахунок спроби кроку
    const delta = new THREE.Vector3().subVectors(localPos, this.lastLocalPos);
    delta.y = 0; // Ігноруємо зміни висоти (стрибки)

    if (delta.length() < 0.001) {
      this.lastLocalPos.copy(localPos);
      return;
    }

    // Примусово оновлюємо матриці простору для точності
    this.el.object3D.updateMatrixWorld(true);
    this.rigObj.updateMatrixWorld(true);

    // Безпечний перевід локальних координат у світові через математичну матрицю батька (#rig)
    const startWorldPos = this.lastLocalPos.clone();
    startWorldPos.applyMatrix4(this.rigObj.matrixWorld);
    startWorldPos.y -= 0.5; // Опускаємо промінь на рівень грудей

    const endWorldPos = localPos.clone();
    endWorldPos.applyMatrix4(this.rigObj.matrixWorld);
    endWorldPos.y -= 0.5;

    // Світовий вектор руху
    const worldDelta = new THREE.Vector3().subVectors(endWorldPos, startWorldPos);
    worldDelta.y = 0;
    
    const distance = worldDelta.length();
    const direction = worldDelta.normalize();

    // Запуск променя
    this.raycaster.set(startWorldPos, direction);
    const hits = this.raycaster.intersectObjects(this.colliders, true);

    // Якщо відстань до стіни менша за (довжина кроку + радіус тіла) — блокуємо
    if (hits.length > 0 && hits[0].distance < (distance + this.playerRadius)) {
      localPos.copy(this.lastLocalPos); // Відкидаємо камеру назад
    } else {
      this.lastLocalPos.copy(localPos); // Крок легальний, зберігаємо позицію
    }
  }
});

/** Компонент: Автоматичне приховування курсора із мертвою зоною (deadzone) */
AFRAME.registerComponent('auto-hide-cursor', {
  schema: {
    timeout: { type: 'number', default: 1000 }, // Час до зникнення (мс)
    deadzone: { type: 'number', default: 15 }   // Безпечний діапазон руху (пікселі)
  },
  init: function () {
    this.timer = null;
    this.isVisible = true;
    this.baseOpacity = this.el.getAttribute('material').opacity || 0.6;

    // Змінні для запам'ятовування координат миші в стані спокою
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
      // Якщо курсор прихований, фіксуємо стартову точку для розрахунку мертвої зони
      if (this.lastX === null || this.lastY === null) {
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        return;
      }

      // Рахуємо фактичну дистанцію руху курсора екраном
      const dx = e.clientX - this.lastX;
      const dy = e.clientY - this.lastY;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // Пробуджуємо приціл тільки якщо миша вийшла за межі мертвої зони
      if (distance > this.data.deadzone) {
        this.showCursor();
      }
    } else {
      // Якщо курсор видимий, будь-який рух скидає таймер
      this.resetTimer();
    }
  },
  showCursor: function () {
    if (!this.isVisible) {
      this.el.setAttribute('visible', true); // Фізично повертаємо об'єкт у сцену
      this.el.setAttribute('animation', `property: material.opacity; from: 0; to: ${this.baseOpacity}; dur: 150; easing: easeOutQuad`);
      this.isVisible = true;
      
      // Скидаємо координати спокою
      this.lastX = null;
      this.lastY = null;
    }
    this.resetTimer();
  },
  hideCursor: function () {
    if (this.isVisible) {
      this.el.setAttribute('animation', 'property: material.opacity; to: 0; dur: 300; easing: easeOutQuad');
      this.isVisible = false;

      // Чекаємо завершення анімації (300мс) і фізично вимикаємо рендеринг об'єкта
      setTimeout(() => {
        if (!this.isVisible) {
          this.el.setAttribute('visible', false);
        }
      }, 300);
    }
  },
  resetTimer: function () {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(this.hideCursor, this.data.timeout);
  },
  remove: function () {
    window.removeEventListener('mousemove', this.onMouseMove);
    window.removeEventListener('keydown', this.showCursor);
    window.removeEventListener('mousedown', this.showCursor);
    window.removeEventListener('wheel', this.showCursor);
    if (this.timer) clearTimeout(this.timer);
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

    // ЗМІНЕНО: тепер використовуємо flex замість block
    this.panel.style.display = "flex";

    // Блокування керування камерою та звільнення курсора
    if (this.cameraEl) {
      this.cameraEl.setAttribute("look-controls", "enabled", false);
      this.cameraEl.setAttribute("wasd-controls", "enabled", false);
    }
    if (document.pointerLockElement) {
      document.exitPointerLock();
    }
  },
  
  close() {
    this.panel.style.display = "none";
    this.image.src = ""; 
    this.image.style.display = "none";

    // Відновлення керування камерою
    if (this.cameraEl) {
      this.cameraEl.setAttribute("look-controls", "enabled", true);
      this.cameraEl.setAttribute("wasd-controls", "enabled", true);
    }

    // Примусове та автоматичне повернення курсора в сцену
    const sceneCanvas = document.querySelector("a-scene").canvas;
    if (sceneCanvas) {
      sceneCanvas.requestPointerLock();
    }
  }
};


/** UI логіка підказки (Hint) */
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
      this.startTimer(); // Перезапуск таймера після ручного відкриття
    }
  },
  startTimer() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      if (!this.isCollapsed) this.toggle();
    }, 10000); // 10000 мілісекунд = 10 секунд
  },
  init() {
    if (!this.el || !this.full || !this.collapsed) return;
    // Блокуємо спливання події кліку, щоб не активувати інші елементи
    this.el.addEventListener("mousedown", (e) => e.stopPropagation());
    this.el.addEventListener("click", (e) => {
      e.stopPropagation();
      this.toggle();
    });
    this.startTimer();
  }
};
hintBox.init();

// Обробник кліку правою кнопкою миші (працює навіть при заблокованому курсорі)
window.addEventListener("mousedown", (e) => {
  if (e.button === 2) { // 2 — це системний код правої кнопки миші
    ui.close();
  }
});

// Окремо блокуємо появу системного контекстного меню браузера
window.addEventListener("contextmenu", (e) => {
  e.preventDefault();
});

async function loadConfig() {
  const res = await fetch(CONFIG_PATH, { cache: "no-store" });
  if (!res.ok) throw new Error(`Не вдалося завантажити config. Статус: ${res.status}`);
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
    img.onerror = () => reject(new Error(`Зображення не знайдено: ${url}`));
    img.src = url;
  });
}

function computeContainSize(innerW, innerH, imgW, imgH) {
  const innerAspect = innerW / innerH;
  const imgAspect = imgW / imgH;
  if (imgAspect >= innerAspect) return { w: innerW, h: innerW / imgAspect };
  return { w: innerH * imgAspect, h: innerH };
}

function getByName(root3D, name) {
  return root3D.getObjectByName(name);
}

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
  const metalness = override.METALNESS;
  const roughness = override.ROUGHNESS;
  const mapPath = override.TEXTURE || null;
  const targetIndex = typeof override.MATERIAL_INDEX === "number" ? override.MATERIAL_INDEX : null;

  for (let i = 0; i < mats.length; i++) {
    if (targetIndex !== null && i !== targetIndex) continue;
    const m = mats[i];
    if (colorHex && m.color) m.color.set(colorHex);
    if (typeof metalness === "number" && "metalness" in m) m.metalness = metalness;
    if (typeof roughness === "number" && "roughness" in m) m.roughness = roughness;

    if (mapPath) {
      const tex = await new Promise((resolve, reject) => {
        new THREE.TextureLoader().load(mapPath, resolve, undefined, reject);
      });
      tex.colorSpace = THREE.SRGBColorSpace;
      if (override.REPEAT && Array.isArray(override.REPEAT) && override.REPEAT.length === 2) {
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.repeat.set(override.REPEAT[0], override.REPEAT[1]);
      }
      m.map = tex;
      m.needsUpdate = true;
    }
  }
}

function buildLightsFromConfig(cfg) {
  const lightsRoot = $("#lights");
  lightsRoot.innerHTML = "";
  const arr = cfg?.LIGHTS?.LIST;
  if (!Array.isArray(arr) || arr.length === 0) return;

  arr.forEach((L) => {
    const e = document.createElement("a-entity");
    const type = (L.TYPE || "point").toLowerCase();
    const color = L.COLOR || "#ffffff";
    const intensity = typeof L.INTENSITY === "number" ? L.INTENSITY : 1.0;
    const distance = typeof L.DISTANCE === "number" ? L.DISTANCE : 0.0;
    const decay = typeof L.DECAY === "number" ? L.DECAY : 2.0;
    const angle = typeof L.ANGLE === "number" ? L.ANGLE : 45;
    const penumbra = typeof L.PENUMBRA === "number" ? L.PENUMBRA : 0.2;

    let lightStr = `type: ${type}; color: ${color}; intensity: ${intensity};`;
    if (type === "point" || type === "spot") lightStr += ` distance: ${distance}; decay: ${decay};`;
    if (type === "spot") lightStr += ` angle: ${THREE.MathUtils.degToRad(angle)}; penumbra: ${penumbra};`;

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
  const pos = cfg?.ROOM?.POSITION || [0,0,0];
  const rot = cfg?.ROOM?.ROTATION || [0,0,0];
  const scale = cfg?.ROOM?.SCALE ?? 1;

  room.setAttribute("gltf-model", `url(${glbPath})`);
  room.setAttribute("position", `${pos[0]} ${pos[1]} ${pos[2]}`);
  room.setAttribute("rotation", `${rot[0]} ${rot[1]} ${rot[2]}`);
  room.setAttribute("scale", `${scale} ${scale} ${scale}`);
  return room;
}

async function applyMaterialOverrides(root3D, cfg) {
  const list = cfg?.MATERIAL_OVERRIDES;
  if (!Array.isArray(list) || list.length === 0) return;

  root3D.traverse(async (obj) => {
    if (!obj.isMesh || !obj.material) return;
    const mats = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const ov of list) {
      const targetName = ov.MATERIAL_NAME;
      if (!targetName) continue;
      if (typeof ov.MATERIAL_INDEX === "number") {
        const idx = ov.MATERIAL_INDEX;
        if (mats[idx] && mats[idx].name === targetName) await applyMaterialOverride(obj, ov);
        continue;
      }
      if (mats.some(m => m?.name === targetName)) await applyMaterialOverride(obj, ov);
    }
  });
}

async function buildWorks(root3D, cfg) {
  const slots = cfg?.SLOTS;
  const works = cfg?.WORKS;
  if (!Array.isArray(slots) || slots.length === 0) return;
  if (!Array.isArray(works) || works.length === 0) return;

  const slotById = new Map(slots.map(s => [s.SLOT_ID, s]));
  
  // Глобальный параметр свечения (если нужен для всех картин сразу)
  const globalGlow = typeof cfg?.WORKS_GLOW === "number" ? cfg.WORKS_GLOW : 0.0;

  for (let i = 0; i < works.length; i++) {
    const work = works[i];
    const slotId = work.SLOT_ID || slots[i]?.SLOT_ID;
    if (!slotId) continue;

    const slot = slotById.get(slotId);
    if (!slot) continue;

    const hookName = slot.HOOK_NAME;
    const hookObj = getByName(root3D, hookName);
    if (!hookObj) continue;

    const imgUrl = `./works/${work.FILE}`;
    let imgInfo = null;
    try { imgInfo = await loadImageInfo(imgUrl); } catch (e) { continue; }

    const innerW = Number(slot.INNER_W || 1.0);
    const innerH = Number(slot.INNER_H || 1.0);
    const size = computeContainSize(innerW, innerH, imgInfo.width, imgInfo.height);

    const plane = document.createElement("a-plane");
    plane.classList.add("clickable");
    plane.setAttribute("width", size.w);
    plane.setAttribute("height", size.h);
    plane.setAttribute("material", `src: url(${imgUrl}); shader: standard; transparent: true; metalness: 0.0; roughness: 1.0;`);
    plane.setAttribute("geometry", "primitive: plane");

    // --- НОВЫЙ БЛОК: СВЕЧЕНИЕ КАРТИН (GLOW) ---
    // Проверяем, есть ли персональное свечение у картины, если нет - берем глобальное
    const workGlow = typeof work.GLOW === "number" ? work.GLOW : globalGlow;
    
    if (workGlow > 0) {
      plane.addEventListener('materialtextureloaded', () => {
        const mesh = plane.getObject3D('mesh');
        if (mesh && mesh.material && mesh.material.map) {
          // Делаем саму картинку источником свечения
          mesh.material.emissiveMap = mesh.material.map;
          mesh.material.emissive.setHex(0xffffff); // Белый свет свечения (не искажает цвета)
          mesh.material.emissiveIntensity = workGlow; // Яркость
          mesh.material.needsUpdate = true;
        }
      });
    }
    // -----------------------------------------

    const offset = Number(slot.IMAGE_OFFSET || 0.01);
    const wp = new THREE.Vector3();
    const wq = new THREE.Quaternion();
    hookObj.getWorldPosition(wp);
    hookObj.getWorldQuaternion(wq);

    const forward = new THREE.Vector3(0, 0, 1).applyQuaternion(wq);
    const finalPos = wp.clone().add(forward.multiplyScalar(offset));
    plane.setAttribute("position", `${finalPos.x} ${finalPos.y} ${finalPos.z}`);

    const euler = new THREE.Euler().setFromQuaternion(wq, "YXZ");
    plane.setAttribute("rotation", `${THREE.MathUtils.radToDeg(euler.x)} ${THREE.MathUtils.radToDeg(euler.y)} ${THREE.MathUtils.radToDeg(euler.z)}`);

    // Роздільна обробка кнопок миші виключно при наведенні на картину
    plane.addEventListener("mousedown", (e) => {
      // ЗАХИСТ: Перевіряємо, чи браузер вже захопив курсор для керування
      // Якщо pointerLockElement відсутній, це найперший клік по екрану — ігноруємо його
      if (!document.pointerLockElement) {
        return; 
      }

      const nativeEvent = e.detail.mouseEvent;
      
      if (nativeEvent && nativeEvent.button === 2) {
        ui.close();
      } else {
        ui.open(work);
      }
    });

    $("a-scene").appendChild(plane);
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
/** Завантаження та розстановка додаткових 3D-моделей (скульптур) по координатах пустышок */
async function buildSculptures(root3D, cfg) {
  const sculptures = cfg?.SCULPTURES;
  if (!Array.isArray(sculptures) || sculptures.length === 0) return;

  const sceneEl = $("a-scene");

  for (const scl of sculptures) {
    const hookName = scl.HOOK_NAME;
    const hookObj = getByName(root3D, hookName);
    
    // Якщо пустышка не знайдена в room.glb, пропускаємо
    if (!hookObj) {
      console.warn(`[SCULPTURES] Пустишка ${hookName} не знайдена в інтер'єрі.`);
      continue;
    }

    const glbPath = `./assets/${scl.FILE}`;

    // Створюємо новий об'єкт
    const sclEntity = document.createElement("a-entity");
    sclEntity.setAttribute("gltf-model", `url(${glbPath})`);

    // Зчитуємо світові координати та обертання пустышки
    const wp = new THREE.Vector3();
    const wq = new THREE.Quaternion();
    hookObj.getWorldPosition(wp);
    hookObj.getWorldQuaternion(wq);

    // Застосовуємо позицію
    sclEntity.setAttribute("position", `${wp.x} ${wp.y} ${wp.z}`);

    // Застосовуємо обертання
    const euler = new THREE.Euler().setFromQuaternion(wq, "YXZ");
    sclEntity.setAttribute("rotation", `${THREE.MathUtils.radToDeg(euler.x)} ${THREE.MathUtils.radToDeg(euler.y)} ${THREE.MathUtils.radToDeg(euler.z)}`);

    // Застосовуємо масштаб, якщо він вказаний
    const scale = scl.SCALE || 1;
    sclEntity.setAttribute("scale", `${scale} ${scale} ${scale}`);

    sceneEl.appendChild(sclEntity);
  }
}
(async function main() {
  try {
    const cfg = await loadConfig();
    warnIfNotUppercaseKeys(cfg);
    basicComplianceChecks(cfg);

    setupEnvironment(cfg);
    buildLightsFromConfig(cfg);

    const cam = $("#camera");
    const rig = $("#rig");
    const playerH = cfg?.PLAYER?.HEIGHT ?? 1.65;
    const start = cfg?.PLAYER?.START_POSITION || [0, 0, 0];
    
    // Вилучення параметрів FOV та стартового обертання
    const playerFov = cfg?.PLAYER?.FOV ?? 80;
    const startRot = cfg?.PLAYER?.START_ROTATION || [0, 0, 0];
    
    // Впровадження позицій, кута обзора та обертання
    cam.setAttribute("position", `0 ${playerH} 0`);
    cam.setAttribute("camera", "fov", playerFov);
    
    rig.setAttribute("position", `${start[0]} ${start[1]} ${start[2]}`);
    rig.setAttribute("rotation", `${startRot[0]} ${startRot[1]} ${startRot[2]}`);

    const room = loadRoom(cfg);

    room.addEventListener("model-loaded", async () => {
      const root3D = room.getObject3D("mesh");
      if (!root3D) return;

      // 4.0) Збір вертикальних об'єктів-коллайдерів
      const colliderSystem = cam.components['wall-collider'];
      
      root3D.traverse(child => {
        if (child.name && child.name.toUpperCase().includes("COLLIDER")) {
          child.visible = false; // Робимо стіни невидимими для глядача, але відчутними для променя
          if (colliderSystem) colliderSystem.colliders.push(child);
        }
      });

      if (colliderSystem && colliderSystem.colliders.length === 0) {
        console.warn("[COLLIDER] Об'єкти з назвою 'COLLIDER' не знайдені. Рух не обмежено.");
      }

      await applyMaterialOverrides(root3D, cfg);
      await buildWorks(root3D, cfg);
      await buildSculptures(root3D, cfg); // Виклик нової функції

      console.log("✅ Шаблон портфоліо готовий (вертикальні стіни активні)");
    });

  } catch (e) {
    console.error(e);
  }
})();