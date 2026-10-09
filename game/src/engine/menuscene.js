// مشهد خلفية القائمة: رامي تاو عند الغروب ودبابة تحترق في السهل
import * as THREE from 'three';
import { Environment } from './env.js';
import { FX } from './fx.js';
import { createModel, towLauncherModel, operatorModel } from './models.js';
import { groundDetail, grassTexture } from './textures.js';
import { makeNoise2D, fbm } from '../core/noise.js';
import { rand } from '../core/util.js';

class FlatTerrain {
  constructor() { this.n = makeNoise2D(9); }
  heightAt(x, z) { const r = Math.hypot(x, z); const k = Math.min(1, Math.max(0, (r - 60) / 340)); return (fbm(this.n, x / 400, z / 400, 3) * 6 + Math.max(0, -z - 900) * 0.03) * k * k; }
  groundAt(x, z) { return this.heightAt(x, z); }
  normalAt(x, z, out = new THREE.Vector3()) {
    const e = 2;
    return out.set(this.heightAt(x - e, z) - this.heightAt(x + e, z), 2 * e, this.heightAt(x, z - e) - this.heightAt(x, z + e)).normalize();
  }
}

export class MenuScene {
  constructor(renderer, audio, quality) {
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.3, 18000);
    this.terrain = new FlatTerrain();
    this.env = new Environment(this.scene, renderer, { time: 'golden', weather: 'haze', quality, north: 0 });
    this.env.sun.castShadow = quality !== 'low';
    this.fx = new FX(this.scene, { terrain: this.terrain, audio: null, quality });
    this.fx.setEnv({ fogColor: this.env.fogColor, fogDensity: this.scene.fog.density, light: this.env.particleLight, wind: new THREE.Vector3(2, 0, 0.5) });
    this.audio = audio;
    // الأرض
    const geo = new THREE.PlaneGeometry(9000, 9000, 160, 160);
    geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position;
    const col = new Float32Array(p.count * 3);
    const n2 = makeNoise2D(4);
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i);
      p.setY(i, this.terrain.heightAt(x, z));
      const f = fbm(n2, x / 300, z / 300, 4) * 0.5 + 0.5;
      const c = new THREE.Color().setRGB(0.52 + f * 0.12, 0.36 + f * 0.12, 0.22 + f * 0.05);
      if (fbm(n2, x / 900 + 5, z / 900, 2) > 0.15) c.lerp(new THREE.Color(0.36, 0.42, 0.2), 0.6);
      col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
    }
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const det = groundDetail().clone();
    det.repeat.set(600, 600);
    det.needsUpdate = true;
    const ground = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, map: det, roughness: 1 }));
    ground.receiveShadow = true;
    this.scene.add(ground);
    // عشب أمامي
    const gm = new THREE.MeshStandardMaterial({ map: grassTexture(), alphaTest: 0.45, side: THREE.DoubleSide });
    const gg = new THREE.PlaneGeometry(1.2, 1);
    gg.translate(0, 0.5, 0);
    const grass = new THREE.InstancedMesh(gg, gm, 1400);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), v = new THREE.Vector3();
    for (let i = 0; i < 1400; i++) {
      let x = rand(-30, 30), z = rand(-45, 8);
      if (Math.hypot(x - 3, z - 2) < 5) { x -= 12; z -= 10; }
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rand(0, 6.28));
      const sc = rand(0.6, 1.5);
      m4.compose(v.set(x, this.terrain.heightAt(x, z), z), q, s.set(sc, sc * rand(0.7, 1.4), sc));
      grass.setMatrixAt(i, m4);
    }
    this.scene.add(grass);
    // القاذف والرامي
    this.launcher = towLauncherModel('olive');
    this.launcher.position.set(1.2, this.terrain.heightAt(1.2, -2), -2);
    this.launcher.rotation.y = Math.PI - 0.25;
    this.launcher.getObjectByName('pitch').rotation.x = -0.05;
    this.launcher.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(this.launcher);
    const op = operatorModel();
    op.position.set(1.5, this.terrain.heightAt(1.5, -1.1), -1.05);
    op.rotation.y = -0.25;
    op.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(op);
    // دبابات بعيدة محترقة
    this.wrecks = [];
    const mk = (type, x, z, ry, burning) => {
      const m = createModel(type);
      m.root.position.set(x, this.terrain.heightAt(x, z), z);
      m.root.rotation.y = ry;
      if (burning) {
        const w = new THREE.MeshStandardMaterial({ color: 0x1b1714, roughness: 1 });
        m.root.traverse((o) => { if (o.isMesh && o.userData.matKey !== 'rotor') o.material = w; });
      }
      m.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.scene.add(m.root);
      if (burning) this.wrecks.push(new THREE.Vector3(x, this.terrain.heightAt(x, z) + 1.4, z));
      return m;
    };
    mk('t72', -60, -380, 0.9, true);
    mk('bmp1', 120, -620, -0.6, true);
    this.moving = mk('t72', 300, -900, -1.5, false);
    mk('technical', -260, -700, 2, true);
    this.t = 0;
    this.boomT = 2;
    this.scene.add(this.camera);
  }

  update(dt) {
    this.t += dt;
    const t = this.t;
    const sway = Math.sin(t * 0.07);
    this.camera.position.set(3.6 + sway * 0.9, this.terrain.heightAt(3, 2) + 2.2 + Math.sin(t * 0.13) * 0.15, 3.2 - sway * 0.4);
    this.camera.lookAt(-10 + sway * 6, 1.5, -60);
    for (const [i, w] of this.wrecks.entries()) this.fx.burn(w, { dt, power: 1.2, key: `m${i}`, radius: 1.2 });
    // آلية تتحرك في البعيد وانفجارات متفرقة
    const mv = this.moving.root;
    mv.position.x -= dt * 6;
    if (mv.position.x < -500) mv.position.x = 500;
    mv.position.y = this.terrain.heightAt(mv.position.x, mv.position.z);
    this.boomT -= dt;
    if (this.boomT <= 0) {
      this.boomT = rand(3, 7);
      const p = new THREE.Vector3(rand(-700, 700), 0, rand(-1600, -500));
      p.y = this.terrain.heightAt(p.x, p.z);
      this.fx.explosion(p, { size: rand(0.8, 2.2) });
      if (this.audio && this.audio.ok) this.audio.explosion(p, 1.2, 'far');
    }
    this.fx.update(dt, this.camera);
    this.env.update(dt, this.camera);
    this.env.focusShadow(new THREE.Vector3(0, 0, -6), 30);
  }
}
