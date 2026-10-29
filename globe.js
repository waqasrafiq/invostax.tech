// A globe of project plates around a molten core. Facets crack open around the pointer and let
// the core's light out; plates can be pulled off (opens the project) and snapped back.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const NIGHT = '#0A1150', SUN = new THREE.Color('#FFB000');

// shared by every plate's shader
const U = {
  uHit: { value: new THREE.Vector3(0, 0, 9) }, uHitOn: { value: 0 },
  uBurst: { value: 1 }, uTime: { value: 0 }, uSeam: { value: SUN },
};

// facets lift and tumble near the pointer; their edges and sides glow with core light
function crackable(mat) {
  mat.onBeforeCompile = s => {
    Object.assign(s.uniforms, U);
    s.vertexShader = s.vertexShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uHit; uniform float uHitOn, uBurst, uTime;
        attribute vec3 aCenter, aDir, aBary; attribute float aRand;
        varying vec3 vBary; varying float vLift; float gNear;
        mat3 spin(vec3 ax, float a) { float s = sin(a), c = cos(a), o = 1. - c;
          return mat3(o*ax.x*ax.x+c, o*ax.x*ax.y+ax.z*s, o*ax.z*ax.x-ax.y*s,
                      o*ax.x*ax.y-ax.z*s, o*ax.y*ax.y+c, o*ax.y*ax.z+ax.x*s,
                      o*ax.z*ax.x+ax.y*s, o*ax.y*ax.z-ax.x*s, o*ax.z*ax.z+c); }
        float liftOf() {
          float near = uHitOn * smoothstep(.85, .0, distance(aDir, uHit)); gNear = near;
          return near * (.12 + .3 * aRand) + uBurst * (.4 + 2.2 * aRand) + .006 * sin(uTime * 1.4 + aRand * 40.);
        }
        mat3 facetSpin(float l) { return spin(normalize(cross(aDir, vec3(.3, 1., .1))), l * (aRand - .5) * 5.); }`)
      .replace('#include <beginnormal_vertex>', `#include <beginnormal_vertex>
        float lift = liftOf(); mat3 R = facetSpin(lift); objectNormal = R * objectNormal;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        transformed = aCenter + R * (transformed - aCenter) + aDir * lift;
        vBary = aBary; vLift = gNear;`);
    s.fragmentShader = s.fragmentShader
      .replace('#include <common>', `#include <common>
        uniform vec3 uSeam; varying vec3 vBary; varying float vLift;`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
        float edge = 1. - smoothstep(.0, .045, min(vBary.x, min(vBary.y, vBary.z)));
        totalEmissiveRadiance += uSeam * edge * (.06 + vLift * 1.4);`);
  };
  return mat;
}

const coreMat = new THREE.ShaderMaterial({
  uniforms: U, toneMapped: false,
  vertexShader: `varying vec3 vP; varying vec3 vN; void main() { vP = position; vN = normalMatrix * normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `uniform float uTime; varying vec3 vP; varying vec3 vN;
    float h(vec3 p) { return fract(sin(dot(p, vec3(12.9, 78.2, 37.7))) * 43758.5); }
    float n(vec3 p) { vec3 i = floor(p), f = fract(p); f = f*f*(3.-2.*f);
      return mix(mix(mix(h(i), h(i+vec3(1,0,0)), f.x), mix(h(i+vec3(0,1,0)), h(i+vec3(1,1,0)), f.x), f.y),
                 mix(mix(h(i+vec3(0,0,1)), h(i+vec3(1,0,1)), f.x), mix(h(i+vec3(0,1,1)), h(i+vec3(1,1,1)), f.x), f.y), f.z); }
    void main() {
      vec3 p = vP * 3. + vec3(0., uTime * .25, uTime * .1);
      float v = n(p) * .5 + n(p * 2.1) * .3 + n(p * 4.3) * .2;
      float face = pow(max(dot(normalize(vN), vec3(0, 0, 1)), 0.), .6);
      vec3 col = mix(vec3(1., .35, .02), vec3(1., .86, .45), v) * (1.1 + face * .9);
      gl_FragColor = vec4(col, 1.); }`,
});

const rimMat = new THREE.ShaderMaterial({
  uniforms: U, side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  vertexShader: `varying vec3 vN; varying vec3 vW; void main() { vN = normalize(normalMatrix * normal); vW = normal;
    gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }`,
  fragmentShader: `varying vec3 vN; varying vec3 vW;
    void main() { float f = pow(clamp(.62 - dot(vN, vec3(0, 0, 1.)), 0., 1.), 1.8);
      vec3 a = vec3(.35, .82, 1.), b = vec3(.72, .42, 1.), c = vec3(1., .69, .1);
      float t = vW.y * .5 + .5; vec3 col = t < .5 ? mix(c, b, t * 2.) : mix(b, a, t * 2. - 1.);
      gl_FragColor = vec4(col * f * .55, f * .5); }`,
});

export function initGlobe(el, projects, { reduced, onOpen, cats }) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  el.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(NIGHT);
  scene.environment = new THREE.PMREMGenerator(renderer).fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.55;
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const key = new THREE.DirectionalLight('#cfe0ff', 1.4); key.position.set(-3, 3, 4); scene.add(key);
  const rim = new THREE.PointLight('#FFB000', 4, 6); scene.add(rim); // the core lighting facets from inside

  const world = new THREE.Group(); scene.add(world);   // positions the whole piece
  const globe = new THREE.Group(); world.add(globe);   // spins
  globe.add(new THREE.Mesh(new THREE.SphereGeometry(0.8, 64, 64), coreMat));
  world.add(new THREE.Mesh(new THREE.SphereGeometry(1.16, 64, 64), rimMat));

  // ---- plates: fibonacci seeds, each triangle of a fine sphere joins the nearest -------------
  const N = projects.length;
  const seeds = projects.map((_, i) => {
    const y = 1 - (i + .5) / N * 2, r = Math.sqrt(1 - y * y), a = i * 2.39996;
    return new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  });
  const src = new THREE.IcosahedronGeometry(1, 9).attributes.position;
  const tris = projects.map(() => []);
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), m = new THREE.Vector3();
  for (let i = 0; i < src.count; i += 3) {
    a.fromBufferAttribute(src, i); b.fromBufferAttribute(src, i + 1); c.fromBufferAttribute(src, i + 2);
    m.copy(a).add(b).add(c).normalize();
    let best = 0, bd = -2;
    seeds.forEach((s, k) => { const d = s.dot(m); if (d > bd) { bd = d; best = k; } });
    tris[best].push(a.clone(), b.clone(), c.clone());
  }

  const BARY = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const plates = projects.map((p, k) => {
    const n = seeds[k], home = n.clone().multiplyScalar(0.94);
    const pos = [], cen = [], dir = [], bar = [], rnd = [];
    for (let i = 0; i < tris[k].length; i += 3) {
      m.copy(tris[k][i]).add(tris[k][i + 1]).add(tris[k][i + 2]).divideScalar(3);
      const v = [0, 1, 2].map(j => tris[k][i + j].clone().lerp(m, 0.07));
      const top = v.map(x => x.clone().normalize()), bot = v.map(x => x.clone().normalize().multiplyScalar(0.9));
      const d = m.clone().normalize(), ctr = d.clone().multiplyScalar(0.95).sub(home), r = Math.random();
      const put = (x, br) => { pos.push(x.x - home.x, x.y - home.y, x.z - home.z); cen.push(ctr.x, ctr.y, ctr.z); dir.push(d.x, d.y, d.z); bar.push(...br); rnd.push(r); };
      [0, 1, 2].forEach(j => put(top[j], BARY[j]));
      [2, 1, 0].forEach(j => put(bot[j], BARY[j]));
      for (let j = 0; j < 3; j++) { const q = (j + 1) % 3; [top[j], bot[j], top[q], top[q], bot[j], bot[q]].forEach(x => put(x, [0, 0, 0])); }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aCenter', new THREE.Float32BufferAttribute(cen, 3));
    geo.setAttribute('aDir', new THREE.Float32BufferAttribute(dir, 3));
    geo.setAttribute('aBary', new THREE.Float32BufferAttribute(bar, 3));
    geo.setAttribute('aRand', new THREE.Float32BufferAttribute(rnd, 1));
    geo.computeVertexNormals();
    const mat = crackable(new THREE.MeshPhysicalMaterial({
      color: p.color, roughness: .22, metalness: .25, clearcoat: 1, clearcoatRoughness: .1,
      iridescence: .7, iridescenceIOR: 1.7, iridescenceThicknessRange: [200, 700], emissive: p.color, emissiveIntensity: 0,
    }));
    const mesh = new THREE.Mesh(geo, mat);
    mesh.userData.k = k;
    mesh.frustumCulled = false; // facets move in the shader, past the computed bounds
    globe.add(mesh);
    const spin = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
    return { mesh, n, home, lift: 0, pull: 0, open: false, openT: 0,
      start: reduced ? 0 : 1, delay: reduced ? 0 : 0.2 + Math.random() * 0.8, fly: 3 + Math.random() * 4, spin };
  });

  // tether from an open plate back to its empty slot
  const tether = new THREE.Line(new THREE.BufferGeometry().setFromPoints([a, b]), new THREE.LineBasicMaterial({ color: SUN, toneMapped: false, transparent: true }));
  tether.frustumCulled = false; scene.add(tether);

  // ---- orbits: two tilted rings, one node per category ----------------------------------------
  const rings = [[1.62, 1.15, 0.25], [1.85, -0.5, -0.4]].map(([r, tx, tz]) => {
    const g = new THREE.Group(); g.rotation.set(tx, 0, tz); world.add(g);
    g.add(new THREE.Mesh(new THREE.TorusGeometry(r, 0.0035, 6, 240), new THREE.MeshBasicMaterial({ color: '#9FC4F5', transparent: true, opacity: .45 })));
    return { g, r };
  });
  const nodes = Object.values(cats).map((cat, i) => {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.035, 16, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(cat.color).multiplyScalar(2.2), toneMapped: false }));
    const ring = rings[i % 2]; ring.g.add(s);
    return { s, ring, a: i * 1.3, speed: (i % 2 ? -1 : 1) * (0.12 + i * 0.02) };
  });

  // ---- dust ------------------------------------------------------------------------------------
  const dustPos = new Float32Array(900 * 3);
  for (let i = 0; i < 900; i++) {
    const v = new THREE.Vector3().randomDirection().multiplyScalar(1.5 + Math.random() * 3.5);
    dustPos.set([v.x, v.y, v.z], i * 3);
  }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: '#cfe0ff', size: 0.012, transparent: true, opacity: .7, blending: THREE.AdditiveBlending, depthWrite: false }));
  world.add(dust);

  // ---- post: bloom makes the core and seams actually glow -------------------------------------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.42, 0.4, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---- input -------------------------------------------------------------------------------------
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2(9, 9);
  let drag = null, vel = 0, tiltX = 0, tiltY = 0, explode = 0;
  const hit = () => { ray.setFromCamera(ndc, camera); return ray.intersectObjects(globe.children.filter(o => o.userData.k !== undefined))[0]; };
  const setNdc = e => { const r = el.getBoundingClientRect(); ndc.set((e.clientX - r.left) / r.width * 2 - 1, -(e.clientY - r.top) / r.height * 2 + 1); };

  el.addEventListener('pointermove', e => {
    setNdc(e);
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    drag.moved = Math.max(drag.moved, Math.hypot(dx, dy));
    if (drag.plate) drag.plate.pull = Math.min(Math.hypot(dx, dy) / 160, 1.4);
    else { vel = (e.clientX - drag.lx) * 0.004; globe.rotation.y += vel; tiltX += (e.clientY - drag.ly) * 0.003; }
    drag.lx = e.clientX; drag.ly = e.clientY;
  });
  el.addEventListener('pointerdown', e => {
    setNdc(e);
    const h = hit(), plate = h && plates[h.object.userData.k];
    drag = { x: e.clientX, y: e.clientY, lx: e.clientX, ly: e.clientY, moved: 0, plate: plate && !plate.open ? plate : null };
    el.setPointerCapture(e.pointerId);
  });
  const release = e => {
    if (!drag) return;
    const p = drag.plate;
    if (p && (p.pull > 0.55 || drag.moved < 6)) onOpen(p.mesh.userData.k);
    if (p) p.pull = 0;
    drag = null;
    // touch has no hover: let the crack close once the finger lifts
    if (e.pointerType !== 'mouse') ndc.set(9, 9);
  };
  el.addEventListener('pointerup', release);
  el.addEventListener('pointercancel', release);
  el.addEventListener('pointerleave', () => { if (!drag) ndc.set(9, 9); });

  let narrow = false;
  const resize = () => {
    const { clientWidth: w, clientHeight: h } = el;
    narrow = w < 760;
    renderer.setSize(w, h, false); composer.setSize(w, h); bloom.resolution.set(w / 2, h / 2);
    // desktop: globe in the right half, clear of the headline; phone: top half, above it
    camera.aspect = w / h; camera.position.z = narrow ? 11.5 : 6.2;
    world.position.set(narrow ? 0 : 1.25, narrow ? 1.25 : 0.05, 0);
    camera.updateProjectionMatrix();
  };
  new ResizeObserver(resize).observe(el); resize();

  // ---- frame -------------------------------------------------------------------------------------
  const clock = new THREE.Clock();
  const qId = new THREE.Quaternion(), qFace = new THREE.Quaternion(), qTmp = new THREE.Quaternion(), qInv = new THREE.Quaternion();
  const homePos = new THREE.Vector3(), openPos = new THREE.Vector3(), w = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);
  const hitLocal = new THREE.Vector3();
  let visible = true;
  const openSpot = new THREE.Vector3(-1.5, 0.1, 0.6);
  new IntersectionObserver(([e]) => visible = e.isIntersecting).observe(el);
  const ease = t => 1 - Math.pow(1 - t, 3);

  function frame() {
    requestAnimationFrame(frame);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05), time = clock.elapsedTime;
    U.uTime.value = time;

    if (!drag) { vel *= 0.95; globe.rotation.y += vel + (reduced ? 0 : 0.0014); }
    tiltX *= 0.96;
    const px = ndc.x > 5 ? 0 : ndc.x, py = ndc.y > 5 ? 0 : ndc.y;
    tiltY += (px * 0.25 - tiltY) * 0.05;
    globe.rotation.x = THREE.MathUtils.clamp(tiltX - py * 0.2, -0.8, 0.8);
    globe.rotation.z = tiltY * 0.3;
    dust.rotation.y = time * 0.02; dust.rotation.x = py * 0.1;
    rings[0].g.rotation.y = time * 0.05; rings[1].g.rotation.y = -time * 0.04;
    nodes.forEach(nd => { nd.a += nd.speed * dt; nd.s.position.set(Math.cos(nd.a) * nd.ring.r, Math.sin(nd.a) * nd.ring.r, 0); });
    world.updateMatrixWorld();

    // pointer on the sphere drives the crack wavefront
    const h = drag ? null : hit();
    el.style.cursor = drag ? 'grabbing' : h ? 'pointer' : 'grab';
    if (h) hitLocal.copy(globe.worldToLocal(h.point.clone())).normalize();
    U.uHit.value.lerp(h ? hitLocal : U.uHit.value, 0.25);
    U.uHitOn.value += ((h ? 1 : 0) - U.uHitOn.value) * 0.08;
    const loading = plates.reduce((s, p) => s + p.start, 0) / N;
    U.uBurst.value = loading * 0.6 + explode * 0.9;
    rim.intensity = 4 + U.uHitOn.value * 10;
    qInv.copy(globe.quaternion).invert();

    let opened = null;
    plates.forEach(p => {
      if (p.start > 0) { p.delay -= dt; if (p.delay < 0) p.start = Math.max(0, p.start - dt * 0.8); }
      const s = ease(1 - p.start);
      p.openT += ((p.open ? 1 : 0) - p.openT) * 0.08;
      const o = ease(p.openT);
      const mat = p.mesh.material;
      mat.emissiveIntensity += ((p.open ? 0.25 : 0) - mat.emissiveIntensity) * 0.1;

      homePos.copy(p.home).addScaledVector(p.n, p.pull * 0.9 + explode * 1.4 + (1 - s) * p.fly);
      openPos.copy(globe.worldToLocal(w.copy(openSpot)));
      p.mesh.position.lerpVectors(homePos, openPos, o);
      qFace.setFromUnitVectors(p.n, Z).premultiply(qInv);
      qTmp.slerpQuaternions(qId, qFace, o);
      p.mesh.quaternion.slerpQuaternions(p.spin, qTmp, s);
      p.mesh.scale.setScalar(1 + o * 0.15);
      if (p.openT > 0.02) opened = p;
    });

    // tether: from the empty slot to the floating plate
    tether.visible = !!opened;
    if (opened) {
      const at = tether.geometry.attributes.position;
      w.copy(opened.home).applyMatrix4(globe.matrixWorld); at.setXYZ(0, w.x, w.y, w.z);
      w.copy(opened.mesh.position).applyMatrix4(globe.matrixWorld); at.setXYZ(1, w.x, w.y, w.z);
      at.needsUpdate = true; tether.material.opacity = ease(opened.openT);
    }
    composer.render();
  }
  frame();

  return {
    open(k, spot) { plates.forEach((p, i) => p.open = i === k); if (spot) openSpot.set(...spot); },
    close() { plates.forEach(p => p.open = false); },
    setExplode(e) { explode = e; },
  };
}
