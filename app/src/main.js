import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);
let THREE;

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const revealNodes = gsap.utils.toArray('.eyebrow, h1, h2, .cover-subtitle, .discover-link, .flower-description, .memory-card, .memory-quote, .closing-note');
if (!reducedMotion) {
  revealNodes.forEach((node) => gsap.from(node, {
    y: 22, opacity: 0, duration: 0.9, ease: 'power2.out',
    scrollTrigger: { trigger: node, start: 'top 88%', once: true },
  }));
  gsap.from('.cover-image-wrap', { x: 34, opacity: 0, duration: 1.2, delay: 0.25, ease: 'power2.out' });
  gsap.to('.cover-stamp', { rotation: 8, y: -5, duration: 3, yoyo: true, repeat: -1, ease: 'sine.inOut' });
  gsap.to('.closing-sun', { scale: 1.08, duration: 4, yoyo: true, repeat: -1, ease: 'sine.inOut' });
}

// Personal photos stay in memory in this browser tab. Nothing is uploaded.
const photoInput = document.querySelector('#photo-input');
const photoTargets = [...document.querySelectorAll('[data-photo]')];
const objectUrls = [];
let photoStartIndex = 0;
photoTargets.forEach((target) => {
  const image = target.querySelector('img');
  const markLoaded = () => target.classList.add('has-photo');
  image.addEventListener('load', markLoaded, { once: true });
  if (image.complete && image.naturalWidth > 0) markLoaded();
});
photoInput.addEventListener('change', (event) => {
  const files = [...event.target.files].filter((file) => file.type.startsWith('image/')).slice(0, 4 - photoStartIndex);
  files.forEach((file, index) => {
    const photoIndex = photoStartIndex + index;
    const url = URL.createObjectURL(file);
    objectUrls.push(url);
    photoTargets.filter((target) => Number(target.dataset.photo) === photoIndex).forEach((target) => {
      const img = target.querySelector('img');
      img.src = url;
      target.classList.add('has-photo');
    });
  });
  photoInput.value = '';
});
window.addEventListener('pagehide', () => objectUrls.forEach(URL.revokeObjectURL), { once: true });

const modal = document.querySelector('#photo-modal');
const modalImage = modal.querySelector('img');
document.querySelectorAll('.memory-card').forEach((card) => card.addEventListener('click', () => {
  const img = card.querySelector('img');
  if (!card.classList.contains('has-photo')) {
    if (!img.complete || img.naturalWidth > 0) return;
    photoStartIndex = Number(card.dataset.photo);
    photoInput.click();
    return;
  }
  modalImage.src = img.src;
  modal.classList.add('is-open');
  modal.setAttribute('aria-hidden', 'false');
}));
const closeModal = () => { modal.classList.remove('is-open'); modal.setAttribute('aria-hidden', 'true'); };
modal.querySelector('.modal-close').addEventListener('click', closeModal);
modal.addEventListener('click', (event) => { if (event.target === modal) closeModal(); });
window.addEventListener('keydown', (event) => { if (event.key === 'Escape') closeModal(); });

// Three.js sunflower bouquet: custom petal meshes, curved stems, leaves and layered flower centres.
const canvas = document.querySelector('#flower-canvas');
const stage = document.querySelector('#flower-stage');
let renderer;
let flowerHeads = [];
let raf = 0;
let isVisible = true;
let pointerX = 0;
let pointerY = 0;

function petalGeometry(length, width) {
  const positions = [];
  const indices = [];
  const rows = 8;
  const cols = 5;
  for (let row = 0; row <= rows; row += 1) {
    const t = row / rows;
    const taper = Math.pow(Math.sin(Math.PI * t * 0.76), 0.55) * (0.82 + 0.18 * t);
    const half = width * taper / 2;
    for (let col = 0; col <= cols; col += 1) {
      const u = col / cols * 2 - 1;
      positions.push(u * half, t * length, 0.12 * (1 - u * u) * Math.sin(Math.PI * t) + 0.045 * Math.sin(t * Math.PI));
    }
  }
  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      const a = row * (cols + 1) + col;
      const b = a + cols + 1;
      indices.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function makeLeaf(scene, start, direction, scale) {
  const points = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(direction * 0.34 * scale, 0.13 * scale, 0.02),
    new THREE.Vector3(direction * 0.67 * scale, 0.18 * scale, 0.04),
    new THREE.Vector3(direction * scale, 0.08 * scale, 0.01),
  ];
  const curve = new THREE.CatmullRomCurve3(points);
  const leaf = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshStandardMaterial({ color: 0x63744a }));
  // A custom tapered leaf surface, curved around the central vein.
  const verts = []; const indices = []; const rows = 12;
  for (let i = 0; i <= rows; i += 1) {
    const t = i / rows;
    const p = curve.getPoint(t);
    const w = Math.sin(Math.PI * t) * 0.15 * scale;
    verts.push(p.x, p.y, p.z, p.x, p.y + w, p.z + 0.018, p.x, p.y - w, p.z + 0.018);
    if (i < rows) { const a = i * 3; indices.push(a, a + 3, a + 1, a + 1, a + 3, a + 4, a, a + 2, a + 3, a + 2, a + 5, a + 3); }
  }
  leaf.geometry = new THREE.BufferGeometry();
  leaf.geometry.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  leaf.geometry.setIndex(indices);
  leaf.geometry.computeVertexNormals();
  leaf.material = new THREE.MeshStandardMaterial({ color: 0x65794b, roughness: 0.84, side: THREE.DoubleSide });
  leaf.position.copy(start);
  leaf.rotation.z = direction * -0.19;
  scene.add(leaf);
  return leaf;
}

function createSunflower(scene, x, y, z, size, tilt, petalMaterial, centerMaterial) {
  const group = new THREE.Group();
  group.position.set(x, y, z);
  group.rotation.z = tilt;
  const petalGeo = petalGeometry(0.56 * size, 0.19 * size);
  const petals = new THREE.Group();
  const count = 22;
  for (let ring = 0; ring < 2; ring += 1) {
    for (let i = 0; i < count; i += 1) {
      const petal = new THREE.Mesh(petalGeo, petalMaterial.clone());
      petal.rotation.z = (i + ring * 0.5) * Math.PI * 2 / count;
      petal.rotation.x = -0.08 - ring * 0.08;
      petal.scale.set(0.02, 0.48 + Math.random() * 0.08, 0.9);
      petal.position.z = 0.01 + ring * 0.012;
      petals.add(petal);
      flowerHeads.push({ petal, delay: 0.38 + i * 0.018 + ring * 0.05 });
    }
  }
  const center = new THREE.Mesh(new THREE.SphereGeometry(0.24 * size, 32, 24), centerMaterial);
  center.scale.set(1, 1, 0.36);
  center.position.z = 0.08;
  petals.add(center);
  const edge = new THREE.Mesh(new THREE.TorusGeometry(0.224 * size, 0.025 * size, 8, 56), new THREE.MeshStandardMaterial({ color: 0x75451f, roughness: 0.9 }));
  edge.position.z = 0.075;
  petals.add(edge);
  group.add(petals);
  scene.add(group);
  return { group, petals, center };
}

async function initFlowers() {
  try {
    THREE = await import('three');
    renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: window.devicePixelRatio < 2, powerPreference: 'low-power' });
  } catch (error) {
    stage.classList.add('no-webgl');
    console.warn('WebGL no está disponible; se conserva la versión editorial.', error);
    return;
  }
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  camera.position.set(0, 0.1, 9.6);
  scene.add(new THREE.HemisphereLight(0xffeed1, 0x403322, 2.05));
  const key = new THREE.DirectionalLight(0xffd58c, 3.1);
  key.position.set(-3, 5, 7); scene.add(key);
  const fill = new THREE.PointLight(0xf4a84f, 65, 14); fill.position.set(3, -1, 3); scene.add(fill);

  const backdrop = new THREE.Mesh(new THREE.CircleGeometry(4.3, 96), new THREE.MeshBasicMaterial({ color: 0xebe0c7, transparent: true, opacity: 0.6 }));
  backdrop.position.set(0, 0.15, -2.6); scene.add(backdrop);
  const ground = new THREE.Mesh(new THREE.CircleGeometry(4.6, 96), new THREE.MeshBasicMaterial({ color: 0xd9c6a3, transparent: true, opacity: 0.24 }));
  ground.scale.set(1.35, 0.23, 1); ground.position.set(0, -2.35, -0.8); scene.add(ground);

  const green = new THREE.MeshStandardMaterial({ color: 0x63764a, roughness: 0.9 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xd4a84f, roughness: 0.64, metalness: 0.04, side: THREE.DoubleSide });
  const honey = new THREE.MeshStandardMaterial({ color: 0xe3b55b, roughness: 0.7, side: THREE.DoubleSide });
  const center = new THREE.MeshStandardMaterial({ color: 0x54351f, roughness: 0.96 });
  const centerLight = new THREE.MeshStandardMaterial({ color: 0x684526, roughness: 0.9 });
  const stems = new THREE.Group();
  const flowerDefs = [
    { x: -0.85, y: 0.75, z: 0.2, size: 1.04, tilt: 0.22 },
    { x: 0.62, y: 0.45, z: 0.5, size: 1.15, tilt: -0.18 },
    { x: 0.03, y: 1.26, z: -0.45, size: 0.86, tilt: 0.04 },
    { x: -1.48, y: -0.12, z: -0.2, size: 0.74, tilt: 0.42 },
    { x: 1.38, y: -0.19, z: -0.35, size: 0.78, tilt: -0.4 },
  ];
  const flowers = flowerDefs.map((def, i) => {
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3((i - 2) * 0.09, -2.1, def.z),
      new THREE.Vector3(def.x * 0.52, -0.95, def.z),
      new THREE.Vector3(def.x * 0.88, def.y - 0.16, def.z),
    ]);
    stems.add(new THREE.Mesh(new THREE.TubeGeometry(stemCurve, 28, 0.026 + def.size * 0.008, 8, false), green));
    makeLeaf(scene, new THREE.Vector3(def.x * 0.44, -0.82 + i * 0.12, def.z + 0.12), i % 2 === 0 ? -1 : 1, 0.9 + (i % 2) * 0.2);
    const flower = createSunflower(scene, def.x, def.y, def.z, def.size, def.tilt, i % 2 ? gold : honey, i % 2 ? center : centerLight);
    flower.group.rotation.x = -0.07;
    return flower;
  });
document.querySelector('.upload-cta').addEventListener('click', () => { photoStartIndex = 0; });
  scene.add(stems);

  const wrap = new THREE.Mesh(new THREE.ConeGeometry(1.47, 2.56, 5, 1, true), new THREE.MeshStandardMaterial({ color: 0xc7ad81, roughness: 0.95, side: THREE.DoubleSide }));
  wrap.position.set(0, -2.05, 0.34); wrap.rotation.y = Math.PI / 5; scene.add(wrap);
  const ribbon = new THREE.Mesh(new THREE.TorusGeometry(0.63, 0.035, 8, 64), new THREE.MeshStandardMaterial({ color: 0x9b7650, roughness: 0.75 }));
  ribbon.position.set(0, -1.52, 0.52); ribbon.scale.set(1, 0.38, 1); scene.add(ribbon);
  const bow = new THREE.Group();
  for (const side of [-1, 1]) {
    const loop = new THREE.Mesh(new THREE.TorusGeometry(0.27, 0.045, 8, 32), ribbon.material);
    loop.scale.set(1.45, 0.56, 0.45); loop.position.set(side * 0.23, -1.5, 0.6); loop.rotation.z = side * -0.42; bow.add(loop);
  }
  scene.add(bow);

  const motes = new THREE.Group();
  for (let i = 0; i < 38; i += 1) {
    const mote = new THREE.Mesh(new THREE.SphereGeometry(0.018 + Math.random() * 0.022, 8, 8), new THREE.MeshBasicMaterial({ color: i % 3 ? 0xf5d58e : 0xfff1cc, transparent: true, opacity: 0.7 }));
    mote.position.set((Math.random() - 0.5) * 6.5, (Math.random() - 0.45) * 5, Math.random() * 2 - 0.8); mote.userData.phase = Math.random() * Math.PI * 2; motes.add(mote);
  }
  scene.add(motes);

  const bouquet = new THREE.Group();
  bouquet.add(...scene.children.filter((child) => child !== motes && child !== key && child !== fill && child.type !== 'HemisphereLight'));
  scene.add(bouquet);
  function resize() {
    const bounds = stage.getBoundingClientRect();
    const width = Math.max(1, bounds.width); const height = Math.max(1, bounds.height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, window.innerWidth < 700 ? 1.35 : 1.7));
    renderer.setSize(width, height, false);
    camera.aspect = width / height; camera.position.z = width < 700 ? 11.4 : 9.6; camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage); resize();
  stage.addEventListener('pointermove', (event) => {
    const rect = stage.getBoundingClientRect();
    pointerX = (event.clientX - rect.left) / rect.width - 0.5;
    pointerY = (event.clientY - rect.top) / rect.height - 0.5;
  });
  const observer = new IntersectionObserver(([entry]) => { isVisible = entry.isIntersecting; if (isVisible) render(); else cancelAnimationFrame(raf); }, { threshold: 0.01 });
  observer.observe(stage);
  let started = false;
  function bloom() {
    gsap.killTweensOf(bouquet.rotation);
    if (started) {
      flowerHeads.forEach(({ petal }) => { gsap.killTweensOf(petal.scale); gsap.set(petal.scale, { x: 0.02, y: 0.48 + Math.random() * 0.08 }); });
      gsap.set(bouquet.position, { y: -0.17 });
    }
    started = true;
    flowerHeads.forEach(({ petal, delay }) => gsap.to(petal.scale, { x: 1, y: 1, duration: 0.78, delay: reducedMotion ? 0 : delay, ease: 'back.out(1.18)' }));
    gsap.to(bouquet.position, { y: 0, duration: 1.45, delay: 0.22, ease: 'power3.out' });
    gsap.fromTo(bouquet.rotation, { z: -0.035 }, { z: 0, duration: 2.4, ease: 'sine.out' });
  }
  document.querySelector('#bloom').addEventListener('click', bloom);
  document.querySelector('#replay').addEventListener('click', () => { bloom(); document.querySelector('#flores').scrollIntoView({ behavior: reducedMotion ? 'auto' : 'smooth' }); });
  function render(time = 0) {
    if (!isVisible) return;
    bouquet.rotation.y += ((pointerX * 0.18) - bouquet.rotation.y) * 0.018;
    bouquet.rotation.x += ((-pointerY * 0.1) - bouquet.rotation.x) * 0.018;
    motes.children.forEach((mote) => { mote.position.y += Math.sin(time * 0.00045 + mote.userData.phase) * 0.0007; });
    renderer.render(scene, camera);
    raf = requestAnimationFrame(render);
  }
  if (reducedMotion) { flowerHeads.forEach(({ petal }) => petal.scale.set(1, 1, 0.9)); } else { bloom(); }
  render();
}
const flowerLoader = new IntersectionObserver(([entry]) => {
  if (entry.isIntersecting) {
    flowerLoader.disconnect();
    initFlowers();
  }
}, { rootMargin: '300px 0px' });
flowerLoader.observe(stage);
