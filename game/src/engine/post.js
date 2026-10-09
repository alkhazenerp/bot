// المُصيِّر والمعالجة اللاحقة: توهج، تدرج لوني، حراري، حبيبات، ضرر، بث المسيّرة
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const FinalShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uAspect: { value: 1.7 },
    uThermal: { value: 0 },
    uBlackHot: { value: 0 },
    uDamage: { value: 0 },
    uChroma: { value: 0 },
    uGrain: { value: 0.035 },
    uVignette: { value: 1 },
    uDrone: { value: 0 },
    uStatic: { value: 0 },
    uSat: { value: 1.08 },
    uContrast: { value: 1.06 },
    uFlash: { value: 0 },
    uWarm: { value: 0 },
  },
  vertexShader: /* glsl */`
    varying vec2 vUv;
    void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: /* glsl */`
    uniform sampler2D tDiffuse;
    uniform float uTime, uAspect, uThermal, uBlackHot, uDamage, uChroma, uGrain, uVignette, uDrone, uStatic, uSat, uContrast, uFlash, uWarm;
    varying vec2 vUv;
    float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    void main() {
      vec2 uv = vUv;
      if (uDrone > 0.0) {
        vec2 c = uv - 0.5;
        float r2 = dot(c, c);
        uv = 0.5 + c * (1.0 - 0.22 * r2 * uDrone);
        float line = floor(uv.y * 260.0);
        uv.x += (hash(vec2(line, floor(uTime * 30.0))) - 0.5) * 0.006 * (uDrone + uStatic * 6.0);
      }
      vec3 col;
      float ch = uChroma + uDrone * 0.4;
      if (ch > 0.001) {
        vec2 d = (uv - 0.5) * ch * 0.012;
        col = vec3(texture2D(tDiffuse, uv + d).r, texture2D(tDiffuse, uv).g, texture2D(tDiffuse, uv - d).b);
      } else col = texture2D(tDiffuse, uv).rgb;
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSat);
      col = (col - 0.5) * uContrast + 0.5;
      col += vec3(0.02, 0.008, -0.015) * uWarm;
      if (uThermal > 0.5) {
        float t = smoothstep(0.03, 0.92, l);
        t += (hash(uv * vec2(1731.0, 977.0) + fract(uTime * 7.0)) - 0.5) * 0.07;
        t *= 0.965 + 0.035 * sin(uv.y * 900.0);
        if (uBlackHot > 0.5) t = 1.0 - t;
        col = vec3(t);
      }
      if (uDrone > 0.0) {
        col = mix(col, vec3(dot(col, vec3(0.33))) * vec3(0.9, 1.0, 0.9), 0.25);
        float n = hash(uv * vec2(640.0, 360.0) + uTime);
        col = mix(col, vec3(n), uStatic * 0.85);
      }
      vec2 vc = (vUv - 0.5) * vec2(uAspect, 1.0);
      float vig = smoothstep(1.05, 0.25, length(vc) * uVignette);
      col *= mix(0.55, 1.0, vig);
      col = mix(col, vec3(0.55, 0.02, 0.0), uDamage * smoothstep(0.15, 0.85, length(vc)));
      col += (hash(vUv * vec2(1213.0, 917.0) + fract(uTime)) - 0.5) * uGrain;
      col += uFlash;
      gl_FragColor = vec4(col, 1.0);
    }`,
};

export class Post {
  constructor(canvas, quality) {
    this.canvas = canvas;
    this.quality = quality;
    let r;
    try {
      r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', preserveDrawingBuffer: false, stencil: false });
    } catch (e) {
      r = new THREE.WebGLRenderer({ canvas, antialias: false });
    }
    this.renderer = r;
    r.outputColorSpace = THREE.SRGBColorSpace;
    r.toneMapping = THREE.ACESFilmicToneMapping;
    r.toneMappingExposure = 0.5;
    r.shadowMap.enabled = quality !== 'low';
    r.shadowMap.type = THREE.PCFSoftShadowMap;
    this.baseRatio = quality === 'low' ? Math.min(window.devicePixelRatio, 1) * 0.8 : quality === 'high' ? Math.min(window.devicePixelRatio, 2) : Math.min(window.devicePixelRatio, 1.35);
    this.ratio = this.baseRatio;
    r.setPixelRatio(this.ratio);
    const w = canvas.clientWidth || window.innerWidth, h = canvas.clientHeight || window.innerHeight;
    r.setSize(w, h, false);
    const samples = r.capabilities.isWebGL2 ? (quality === 'low' ? 0 : quality === 'high' ? 4 : 2) : 0;
    const rt = new THREE.WebGLRenderTarget(w * this.ratio, h * this.ratio, { type: THREE.HalfFloatType, samples });
    this.composer = new EffectComposer(r, rt);
    this.renderPass = new RenderPass(new THREE.Scene(), new THREE.PerspectiveCamera());
    this.composer.addPass(this.renderPass);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(w / 2, h / 2), quality === 'high' ? 0.62 : 0.5, 0.55, 0.95);
    this.bloom.enabled = quality !== 'low';
    this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.final = new ShaderPass(FinalShader);
    this.composer.addPass(this.final);
    this.u = this.final.uniforms;
    this._frameTimes = [];
  }

  setSize(w, h) {
    this.renderer.setPixelRatio(this.ratio);
    this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.ratio);
    this.composer.setSize(w, h);
    this.u.uAspect.value = w / Math.max(1, h);
  }

  // دقة تكيفية حسب الأداء
  adapt(dt) {
    const f = this._frameTimes;
    f.push(dt);
    if (f.length < 90) return;
    const avg = f.reduce((a, b) => a + b, 0) / f.length;
    f.length = 0;
    let r = this.ratio;
    if (avg > 1 / 38 && r > 0.55) r = Math.max(0.55, r - 0.1);
    else if (avg < 1 / 57 && r < this.baseRatio) r = Math.min(this.baseRatio, r + 0.05);
    if (Math.abs(r - this.ratio) > 0.01) {
      this.ratio = r;
      const c = this.canvas;
      this.setSize(c.clientWidth || window.innerWidth, c.clientHeight || window.innerHeight);
    }
  }

  render(scene, camera, time, exposure) {
    if (exposure != null) this.renderer.toneMappingExposure = exposure;
    this.renderPass.scene = scene;
    this.renderPass.camera = camera;
    this.u.uTime.value = time;
    this.composer.render();
  }

  compile(scene, camera) { this.renderer.compile(scene, camera); }
}
