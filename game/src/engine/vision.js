// الرؤية الحرارية: استبدال المواد بدرجات حرارة رمادية (أبيض = ساخن)
import * as THREE from 'three';

export class Vision {
  constructor(scene) {
    this.scene = scene;
    this.mode = 'day';
    this.cache = new Map();
    this.orig = new WeakMap();
    this.thermalLight = null;
    this.saved = null;
  }

  _mat(heat, src) {
    const q = Math.round(heat * 24) / 24;
    const hasMap = src && src.userData && src.userData.thermalMap;
    const keepMap = src && (src.alphaTest || src.transparent) && src.map ? src.map : null;
    const key = `${q}|${src && src.side}|${src && src.alphaTest ? 'a' : ''}|${src && src.transparent ? 't' : ''}|${hasMap ? 'm' : ''}|${keepMap ? keepMap.uuid : ''}|${src ? src.opacity : 1}|${src ? src.depthWrite : true}`;
    if (this.cache.has(key)) return this.cache.get(key);
    const m = new THREE.MeshLambertMaterial({
      color: new THREE.Color(0.06, 0.06, 0.06),
      emissive: new THREE.Color(q, q, q),
      side: src ? src.side : THREE.FrontSide,
      transparent: src ? src.transparent : false,
      opacity: src ? src.opacity : 1,
      alphaTest: src ? src.alphaTest : 0,
      map: keepMap,
      depthWrite: src ? src.depthWrite : true,
    });
    if (src && src.alphaTest) m.emissiveMap = null;
    m.userData.thermal = true;
    this.cache.set(key, m);
    return m;
  }

  _thermalFor(obj) {
    const mat = obj.material;
    if (Array.isArray(mat)) return mat.map((m) => this._mat(this._heatOf(obj, m), m));
    if (obj.userData.thermalMap && obj.userData.thermalTex) {
      if (!obj.userData._thMat) {
        obj.userData._thMat = new THREE.MeshLambertMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: obj.userData.thermalTex });
      }
      return obj.userData._thMat;
    }
    return this._mat(this._heatOf(obj, mat), mat);
  }

  _heatOf(obj, mat) {
    if (obj.userData.burning) return 1;
    if (obj.userData.wreckHeat != null) return obj.userData.wreckHeat;
    if (mat && mat.userData && mat.userData.heat != null) return mat.userData.heat;
    if (obj.userData.heat != null) return obj.userData.heat;
    return 0.3;
  }

  apply(root) {
    if (this.mode === 'day') return;
    root.traverse((o) => {
      if (!(o.isMesh || o.isPoints || o.isSprite) || o.userData.noThermalSwap) return;
      if (o.isSprite) { o.visible = false; return; }
      if (o.isPoints) { if (o.userData.nightOnly) return; o.visible = false; return; }
      if (o.material && o.material.userData && o.material.userData.thermal) return;
      if (!this.orig.has(o)) this.orig.set(o, o.material);
      o.material = this._thermalFor(o);
    });
  }

  restore(root) {
    root.traverse((o) => {
      if (o.isSprite || (o.isPoints && !o.userData.nightOnly)) { if (!o.userData.hiddenByGame) o.visible = true; return; }
      if (!o.isMesh) return;
      const m = this.orig.get(o);
      if (m) { o.material = m; this.orig.delete(o); }
    });
  }

  // تحديث مادة كائن واحد بعد تغيير حالته (مثلاً احتراق) أثناء الوضع الحراري
  refresh(obj) {
    if (this.mode === 'day') return;
    obj.traverse((o) => {
      if (!o.isMesh || o.userData.noThermalSwap) return;
      const cur = o.material;
      if (!(cur && cur.userData && cur.userData.thermal)) this.orig.set(o, cur);
      const base = this.orig.get(o);
      if (!base) return;
      o.material = this._thermalFor({ material: base, userData: o.userData });
    });
  }

  setMode(mode, env, fx) {
    if (mode === this.mode) return;
    const scene = this.scene;
    if (mode !== 'day') {
      if (this.mode === 'day') {
        this.saved = { bg: scene.background, fog: scene.fog ? scene.fog.color.clone() : null, envI: scene.environmentIntensity, env: scene.environment };
        if (env) {
          env.group.traverse((o) => { if (o.userData.isSky) o.visible = false; });
          this.saved.sunI = env.sun.intensity; this.saved.hemiI = env.hemi.intensity;
          env.sun.intensity = 0.08; env.hemi.intensity = 0.14;
          env.hemi.color.set(0xffffff); env.hemi.groundColor.set(0x444444);
        }
        scene.background = new THREE.Color(0.05, 0.05, 0.05);
        if (scene.fog) scene.fog.color.set(0x161616);
        scene.environment = null;
      }
      this.mode = mode;
      this.apply(scene);
      if (fx) { fx.setThermal(true); fx.setEnv({ fogColor: new THREE.Color(0x161616) }); }
    } else {
      this.mode = 'day';
      this.restore(scene);
      if (this.saved) {
        scene.background = this.saved.bg;
        if (scene.fog && this.saved.fog) scene.fog.color.copy(this.saved.fog);
        scene.environment = this.saved.env;
        if (env) {
          env.group.traverse((o) => { if (o.userData.isSky) o.visible = true; });
          env.sun.intensity = this.saved.sunI; env.hemi.intensity = this.saved.hemiI;
          env.hemi.color.set(env.t.hemiSky); env.hemi.groundColor.set(env.t.hemiGround);
        }
      }
      if (fx) { fx.setThermal(false); if (env) fx.setEnv({ fogColor: env.fogColor }); }
    }
  }
}
