// السماء والإضاءة والضباب والغيوم والطقس حسب وقت المهمة
import * as THREE from 'three';
import { Sky } from 'three/addons/objects/Sky.js';
import { cloudTexture } from './textures.js';
import { mulberry32, rand } from '../core/util.js';

export const TIMES = {
  dawn: { elev: 4, azim: 100, turb: 6, ray: 2.2, mie: 0.006, sun: 0xffb27a, sunI: 2.2, hemiSky: 0x9fb0d0, hemiGround: 0x6b5340, hemiI: 0.7, fog: 0xd7b49a, fogD: 0.00019, exposure: 0.62, env: 0.55, light: [0.95, 0.82, 0.74] },
  morning: { elev: 22, azim: 120, turb: 4, ray: 1.4, mie: 0.004, sun: 0xfff0dc, sunI: 3.2, hemiSky: 0xb4c8e6, hemiGround: 0x75604a, hemiI: 0.85, fog: 0xc9d3dc, fogD: 0.00014, exposure: 0.5, env: 0.8, light: [1, 0.98, 0.95] },
  noon: { elev: 58, azim: 170, turb: 3, ray: 1.0, mie: 0.004, sun: 0xffffff, sunI: 3.6, hemiSky: 0xc1d4ee, hemiGround: 0x7a644c, hemiI: 0.9, fog: 0xd0d8de, fogD: 0.00013, exposure: 0.45, env: 0.9, light: [1, 1, 1] },
  afternoon: { elev: 30, azim: 235, turb: 4.5, ray: 1.3, mie: 0.005, sun: 0xfff1d6, sunI: 3.2, hemiSky: 0xb4c4de, hemiGround: 0x7a6048, hemiI: 0.85, fog: 0xd3d2cc, fogD: 0.00015, exposure: 0.5, env: 0.8, light: [1, 0.96, 0.9] },
  golden: { elev: 9, azim: 255, turb: 7, ray: 2.4, mie: 0.007, sun: 0xffc48a, sunI: 2.8, hemiSky: 0xa9b3cc, hemiGround: 0x6e5038, hemiI: 0.7, fog: 0xdcb48c, fogD: 0.00018, exposure: 0.58, env: 0.6, light: [1, 0.84, 0.66] },
  dusk: { elev: 2, azim: 260, turb: 9, ray: 3, mie: 0.008, sun: 0xff8f5a, sunI: 1.7, hemiSky: 0x7f86a8, hemiGround: 0x4f3a2e, hemiI: 0.6, fog: 0xb98c78, fogD: 0.0002, exposure: 0.7, env: 0.45, light: [0.85, 0.66, 0.58] },
  night: { elev: -14, azim: 300, turb: 2, ray: 0.4, mie: 0.002, sun: 0x9fb3d8, sunI: 0.35, hemiSky: 0x3b4866, hemiGround: 0x1a1a20, hemiI: 0.32, fog: 0x10141c, fogD: 0.00022, exposure: 0.9, env: 0.15, light: [0.22, 0.24, 0.3], moon: true },
};

export class Environment {
  constructor(scene, renderer, { time = 'morning', weather = 'clear', quality = 'medium', north = 0 } = {}) {
    this.scene = scene;
    this.renderer = renderer;
    this.quality = quality;
    this.timeName = time;
    this.weather = weather;
    this.t = { ...TIMES[time] || TIMES.morning };
    if (weather === 'dust') { this.t.fog = 0xc4a47c; this.t.fogD *= 2.6; this.t.sunI *= 0.6; this.t.turb = 12; }
    if (weather === 'haze') { this.t.fogD *= 1.5; this.t.turb += 3; }
    if (weather === 'rain') { this.t.fog = 0x8d949b; this.t.fogD *= 2.0; this.t.sunI *= 0.35; this.t.hemiI *= 0.9; this.t.exposure *= 1.15; }
    this.night = !!this.t.moon;
    this.group = new THREE.Group();
    scene.add(this.group);

    // الشمس
    const phi = THREE.MathUtils.degToRad(90 - this.t.elev);
    const theta = THREE.MathUtils.degToRad(this.t.azim - north);
    this.sunDir = new THREE.Vector3().setFromSphericalCoords(1, phi, theta);
    const lightDir = this.night ? new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(50), theta + 2.2) : this.sunDir.clone();
    if (lightDir.y < 0.05) lightDir.y = 0.05;
    this.lightDir = lightDir.normalize();

    this.sky = new Sky();
    this.sky.scale.setScalar(20000);
    const u = this.sky.material.uniforms;
    u.turbidity.value = this.t.turb;
    u.rayleigh.value = this.t.ray;
    u.mieCoefficient.value = this.t.mie;
    u.mieDirectionalG.value = 0.86;
    u.sunPosition.value.copy(this.sunDir);
    this.sky.userData.noThermalSwap = true;
    this.sky.userData.isSky = true;
    this.group.add(this.sky);

    this.sun = new THREE.DirectionalLight(this.t.sun, this.t.sunI);
    this.sun.position.copy(this.lightDir).multiplyScalar(1000);
    this.sun.castShadow = quality !== 'low';
    const ss = quality === 'high' ? 4096 : 2048;
    this.sun.shadow.mapSize.set(ss, ss);
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.6;
    const cam = this.sun.shadow.camera;
    cam.near = 10; cam.far = 3000;
    this.shadowRadius = 120;
    cam.left = -120; cam.right = 120; cam.top = 120; cam.bottom = -120;
    cam.updateProjectionMatrix();
    this.group.add(this.sun, this.sun.target);
    this.hemi = new THREE.HemisphereLight(this.t.hemiSky, this.t.hemiGround, this.t.hemiI);
    this.group.add(this.hemi);

    this.fogColor = new THREE.Color(this.t.fog);
    scene.fog = new THREE.FogExp2(this.fogColor.getHex(), this.t.fogD);
    scene.background = this.fogColor.clone();
    this.exposure = this.t.exposure;
    renderer.toneMappingExposure = this.exposure;

    // خريطة البيئة من السماء
    try {
      const pm = new THREE.PMREMGenerator(renderer);
      const envScene = new THREE.Scene();
      const sky2 = new Sky();
      sky2.scale.setScalar(1000);
      sky2.material.uniforms.turbidity.value = this.t.turb;
      sky2.material.uniforms.rayleigh.value = this.t.ray;
      sky2.material.uniforms.mieCoefficient.value = this.t.mie;
      sky2.material.uniforms.sunPosition.value.copy(this.night ? new THREE.Vector3(0, 0.1, -1) : this.sunDir);
      envScene.add(sky2);
      const rt = pm.fromScene(envScene, 0, 0.1, 2000);
      scene.environment = rt.texture;
      this.envRT = rt;
      pm.dispose();
    } catch (e) { /* بعض الأجهزة لا تدعم */ }
    if ('environmentIntensity' in scene) scene.environmentIntensity = this.t.env;
    this.envIntensity = this.t.env;

    this._clouds(weather);
    if (this.night) this._stars();
    this.rain = weather === 'rain';
    this.dust = weather === 'dust';
    this.wind = new THREE.Vector3(rand(-1, 1), 0, rand(-1, 1)).normalize().multiplyScalar(this.dust ? 4 : 1.6);
    this.particleLight = new THREE.Color(...this.t.light);
  }

  _clouds(weather) {
    const n = weather === 'rain' ? 70 : weather === 'clear' ? 26 : 40;
    const rnd = mulberry32(this.timeName.length * 13 + n);
    const tex = [cloudTexture(5), cloudTexture(9), cloudTexture(17)];
    this.clouds = new THREE.Group();
    const tint = new THREE.Color(this.t.sun).lerp(new THREE.Color(0xffffff), 0.5);
    if (this.night) tint.set(0x2a3040);
    if (weather === 'rain') tint.set(0x7d838a);
    for (let i = 0; i < n; i++) {
      const m = new THREE.SpriteMaterial({ map: tex[i % 3], color: tint, transparent: true, opacity: weather === 'rain' ? 0.95 : 0.75 + rnd() * 0.25, depthWrite: false, fog: false });
      const s = new THREE.Sprite(m);
      const a = rnd() * Math.PI * 2, r = 2500 + rnd() * 9000;
      s.position.set(Math.sin(a) * r, 900 + rnd() * 1400, -Math.cos(a) * r - 2000);
      const sc = 1400 + rnd() * 2600;
      s.scale.set(sc, sc * (0.35 + rnd() * 0.25), 1);
      s.userData.noThermalSwap = true;
      s.userData.isSky = true;
      this.clouds.add(s);
    }
    this.group.add(this.clouds);
  }

  _stars() {
    const n = 2500;
    const pos = new Float32Array(n * 3);
    const rnd = mulberry32(77);
    for (let i = 0; i < n; i++) {
      const th = rnd() * Math.PI * 2, ph = Math.acos(rnd() * 0.95);
      const v = new THREE.Vector3().setFromSphericalCoords(15000, ph, th);
      pos[i * 3] = v.x; pos[i * 3 + 1] = v.y; pos[i * 3 + 2] = v.z;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const st = new THREE.Points(g, new THREE.PointsMaterial({ color: 0xffffff, size: 1.6, sizeAttenuation: false, fog: false, transparent: true, opacity: 0.85 }));
    st.userData.noThermalSwap = true;
    st.userData.isSky = true;
    this.group.add(st);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(140, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 2.2, 2.0), fog: false }));
    moon.position.copy(this.lightDir).multiplyScalar(12000);
    moon.userData.noThermalSwap = true;
    moon.userData.isSky = true;
    this.group.add(moon);
  }

  // تحريك منطقة الظل حيث ينظر اللاعب
  focusShadow(point, radius) {
    if (!this.sun.castShadow) return;
    const r = Math.max(40, Math.min(radius, 600));
    const cam = this.sun.shadow.camera;
    if (Math.abs(r - this.shadowRadius) > r * 0.15) {
      this.shadowRadius = r;
      cam.left = -r; cam.right = r; cam.top = r; cam.bottom = -r;
      cam.updateProjectionMatrix();
    }
    // تثبيت على شبكة بكسلات الظل لتجنب الارتعاش
    const texel = (2 * r) / this.sun.shadow.mapSize.x;
    const px = Math.round(point.x / texel) * texel, pz = Math.round(point.z / texel) * texel;
    this.sun.target.position.set(px, point.y, pz);
    this.sun.position.set(px, point.y, pz).addScaledVector(this.lightDir, 1200);
    this.sun.target.updateMatrixWorld();
  }

  update(dt, camera) {
    this.sky.position.copy(camera.position);
    this.clouds.position.x += this.wind.x * dt * 3;
    this.clouds.position.z += this.wind.z * dt * 3;
  }

  // three r160 لا يدعم scene.environmentIntensity: نضبط شدة الانعكاس لكل مادة
  applyEnvIntensity(root) {
    const k = this.envIntensity;
    root.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      for (const m of mats) {
        if (!m || !m.isMeshStandardMaterial) continue;
        if (m.userData.baseEnvI == null) m.userData.baseEnvI = m.envMapIntensity;
        m.envMapIntensity = m.userData.baseEnvI * k;
      }
    });
  }

  dispose() {
    this.sun.dispose?.();
    this.sky.material.dispose();
    this.clouds.children.forEach((s) => s.material.dispose());
    if (this.envRT) this.envRT.dispose();
  }
}
