// نظام جسيمات بلوحات مُوجّهة للكاميرا — محاكاة على المعالج ورسم دفعة واحدة
import * as THREE from 'three';
import { particleAtlas } from './textures.js';

const VERT = /* glsl */`
attribute vec3 iPos;
attribute vec3 iVel;
attribute vec4 iColor;
attribute vec4 iParams; // الحجم، الدوران، الإطار، المط
varying vec2 vUv;
varying vec4 vColor;
varying float vDepth;
void main() {
  vec4 mv = viewMatrix * vec4(iPos, 1.0);
  vec2 c = position.xy;
  float size = iParams.x;
  if (iParams.w > 0.0) {
    vec3 vv = (viewMatrix * vec4(iVel, 0.0)).xyz;
    vec2 d = vv.xy;
    float L = length(d);
    vec2 ax = L > 1e-4 ? d / L : vec2(1.0, 0.0);
    vec2 pp = vec2(-ax.y, ax.x);
    float len = size + L * iParams.w;
    mv.xy += ax * c.x * len + pp * c.y * size;
  } else {
    float s = sin(iParams.y), co = cos(iParams.y);
    mv.xy += vec2(c.x * co - c.y * s, c.x * s + c.y * co) * size;
  }
  gl_Position = projectionMatrix * mv;
  float fr = iParams.z;
  float col = mod(fr, 2.0);
  float row = floor(fr / 2.0);
  vUv = vec2((uv.x + col) * 0.5, (uv.y + 1.0 - row) * 0.5);
  vColor = iColor;
  vDepth = -mv.z;
}`;

const FRAG = /* glsl */`
uniform sampler2D uTex;
uniform vec3 uFogColor;
uniform float uFogDensity;
uniform float uThermal;
uniform float uAdditive;
uniform vec3 uLight;
varying vec2 vUv;
varying vec4 vColor;
varying float vDepth;
void main() {
  vec4 t = texture2D(uTex, vUv);
  vec4 c = vColor * t;
  float f = 1.0 - exp(-uFogDensity * uFogDensity * vDepth * vDepth);
  if (uAdditive > 0.5) {
    if (uThermal > 0.5) c.rgb = vec3(1.4) * (0.6 + 0.4 * t.r);
    c.rgb *= c.a * (1.0 - f);
    gl_FragColor = vec4(c.rgb, 1.0);
  } else {
    c.rgb *= uLight;
    if (uThermal > 0.5) { c.rgb = vec3(0.34 + 0.12 * t.r); c.a *= 0.55; }
    c.rgb = mix(c.rgb, uFogColor, f);
    if (c.a < 0.004) discard;
    gl_FragColor = c;
  }
}`;

export class Particles {
  constructor(capacity, { additive = false } = {}) {
    this.cap = capacity;
    this.additive = additive;
    this.count = 0;
    const N = capacity;
    this.p = new Float32Array(N * 3);
    this.v = new Float32Array(N * 3);
    this.age = new Float32Array(N);
    this.life = new Float32Array(N);
    this.s0 = new Float32Array(N);
    this.s1 = new Float32Array(N);
    this.c0 = new Float32Array(N * 4);
    this.c1 = new Float32Array(N * 4);
    this.rot = new Float32Array(N);
    this.rotV = new Float32Array(N);
    this.frame = new Float32Array(N);
    this.drag = new Float32Array(N);
    this.grav = new Float32Array(N);
    this.stretch = new Float32Array(N);
    this.fadeIn = new Float32Array(N);
    this.windK = new Float32Array(N);
    this._depth = new Float32Array(N);
    this._order = new Uint32Array(N);

    const base = new THREE.PlaneGeometry(1, 1);
    const geo = new THREE.InstancedBufferGeometry();
    geo.index = base.index;
    geo.setAttribute('position', base.attributes.position);
    geo.setAttribute('uv', base.attributes.uv);
    this.aPos = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aVel = new THREE.InstancedBufferAttribute(new Float32Array(N * 3), 3).setUsage(THREE.DynamicDrawUsage);
    this.aCol = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage);
    this.aPar = new THREE.InstancedBufferAttribute(new Float32Array(N * 4), 4).setUsage(THREE.DynamicDrawUsage);
    geo.setAttribute('iPos', this.aPos);
    geo.setAttribute('iVel', this.aVel);
    geo.setAttribute('iColor', this.aCol);
    geo.setAttribute('iParams', this.aPar);
    geo.instanceCount = 0;
    this.geo = geo;
    this.uniforms = {
      uTex: { value: particleAtlas() },
      uFogColor: { value: new THREE.Color(0.7, 0.7, 0.7) },
      uFogDensity: { value: 0.0002 },
      uThermal: { value: 0 },
      uAdditive: { value: additive ? 1 : 0 },
      uLight: { value: new THREE.Color(1, 1, 1) },
    };
    const mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms,
      transparent: true, depthWrite: false, depthTest: true,
      blending: additive ? THREE.CustomBlending : THREE.NormalBlending,
    });
    if (additive) {
      mat.blendSrc = THREE.OneFactor;
      mat.blendDst = THREE.OneFactor;
      mat.blendEquation = THREE.AddEquation;
    }
    this.mesh = new THREE.Mesh(geo, mat);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = additive ? 11 : 10;
    this.mesh.userData.noThermalSwap = true;
    this.wind = new THREE.Vector3();
  }

  spawn(o) {
    let i;
    if (this.count < this.cap) i = this.count++;
    else i = Math.floor(Math.random() * this.cap);
    const i3 = i * 3, i4 = i * 4;
    this.p[i3] = o.x; this.p[i3 + 1] = o.y; this.p[i3 + 2] = o.z;
    this.v[i3] = o.vx || 0; this.v[i3 + 1] = o.vy || 0; this.v[i3 + 2] = o.vz || 0;
    this.age[i] = 0;
    this.life[i] = o.life || 1;
    this.s0[i] = o.size || 1;
    this.s1[i] = o.size1 ?? this.s0[i];
    const c = o.color || [1, 1, 1, 1], c1 = o.color1 || [c[0], c[1], c[2], 0];
    this.c0[i4] = c[0]; this.c0[i4 + 1] = c[1]; this.c0[i4 + 2] = c[2]; this.c0[i4 + 3] = c[3];
    this.c1[i4] = c1[0]; this.c1[i4 + 1] = c1[1]; this.c1[i4 + 2] = c1[2]; this.c1[i4 + 3] = c1[3];
    this.rot[i] = o.rot ?? Math.random() * 6.283;
    this.rotV[i] = o.rotV ?? (Math.random() - 0.5) * 0.8;
    this.frame[i] = o.frame ?? 0;
    this.drag[i] = o.drag ?? 0;
    this.grav[i] = o.grav ?? 0;
    this.stretch[i] = o.stretch ?? 0;
    this.fadeIn[i] = o.fadeIn ?? 0;
    this.windK[i] = o.wind ?? (this.additive ? 0 : 1);
    return i;
  }

  _kill(i) {
    const j = --this.count;
    if (i === j) return;
    const i3 = i * 3, j3 = j * 3, i4 = i * 4, j4 = j * 4;
    for (let k = 0; k < 3; k++) { this.p[i3 + k] = this.p[j3 + k]; this.v[i3 + k] = this.v[j3 + k]; }
    for (let k = 0; k < 4; k++) { this.c0[i4 + k] = this.c0[j4 + k]; this.c1[i4 + k] = this.c1[j4 + k]; }
    this.age[i] = this.age[j]; this.life[i] = this.life[j]; this.s0[i] = this.s0[j]; this.s1[i] = this.s1[j];
    this.rot[i] = this.rot[j]; this.rotV[i] = this.rotV[j]; this.frame[i] = this.frame[j]; this.drag[i] = this.drag[j];
    this.grav[i] = this.grav[j]; this.stretch[i] = this.stretch[j]; this.fadeIn[i] = this.fadeIn[j]; this.windK[i] = this.windK[j];
  }

  clear() { this.count = 0; this.geo.instanceCount = 0; }

  update(dt, camera) {
    const { p, v } = this;
    const wx = this.wind.x, wz = this.wind.z;
    for (let i = 0; i < this.count; i++) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) { this._kill(i); i--; continue; }
      const i3 = i * 3;
      const dr = Math.exp(-this.drag[i] * dt);
      const wk = this.windK[i];
      v[i3] = (v[i3] - wx * wk) * dr + wx * wk;
      v[i3 + 1] = v[i3 + 1] * dr - this.grav[i] * dt;
      v[i3 + 2] = (v[i3 + 2] - wz * wk) * dr + wz * wk;
      p[i3] += v[i3] * dt; p[i3 + 1] += v[i3 + 1] * dt; p[i3 + 2] += v[i3 + 2] * dt;
      this.rot[i] += this.rotV[i] * dt;
    }
    const n = this.count;
    const order = this._order;
    for (let i = 0; i < n; i++) order[i] = i;
    if (!this.additive && n > 1) {
      const e = camera.matrixWorldInverse.elements;
      const d = this._depth;
      for (let i = 0; i < n; i++) {
        const i3 = i * 3;
        d[i] = e[2] * p[i3] + e[6] * p[i3 + 1] + e[10] * p[i3 + 2] + e[14];
      }
      const sub = order.subarray(0, n);
      sub.sort((a, b) => d[a] - d[b]);
    }
    const P = this.aPos.array, V = this.aVel.array, C = this.aCol.array, R = this.aPar.array;
    for (let k = 0; k < n; k++) {
      const i = order[k];
      const i3 = i * 3, i4 = i * 4, k3 = k * 3, k4 = k * 4;
      const t = this.age[i] / this.life[i];
      P[k3] = p[i3]; P[k3 + 1] = p[i3 + 1]; P[k3 + 2] = p[i3 + 2];
      V[k3] = v[i3]; V[k3 + 1] = v[i3 + 1]; V[k3 + 2] = v[i3 + 2];
      const ct = t;
      let a = this.c0[i4 + 3] + (this.c1[i4 + 3] - this.c0[i4 + 3]) * ct;
      const fi = this.fadeIn[i];
      if (fi > 0 && t < fi) a *= t / fi;
      C[k4] = this.c0[i4] + (this.c1[i4] - this.c0[i4]) * ct;
      C[k4 + 1] = this.c0[i4 + 1] + (this.c1[i4 + 1] - this.c0[i4 + 1]) * ct;
      C[k4 + 2] = this.c0[i4 + 2] + (this.c1[i4 + 2] - this.c0[i4 + 2]) * ct;
      C[k4 + 3] = a;
      const st = 1 - (1 - t) * (1 - t);
      R[k4] = this.s0[i] + (this.s1[i] - this.s0[i]) * st;
      R[k4 + 1] = this.rot[i];
      R[k4 + 2] = this.frame[i];
      R[k4 + 3] = this.stretch[i];
    }
    this.geo.instanceCount = n;
    if (n > 0) {
      for (const [a, sz] of [[this.aPos, 3], [this.aVel, 3], [this.aCol, 4], [this.aPar, 4]]) {
        if (a.addUpdateRange && a.clearUpdateRanges) { a.clearUpdateRanges(); a.addUpdateRange(0, n * sz); }
        a.needsUpdate = true;
      }
    }
  }
}
