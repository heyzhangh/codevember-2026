import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createBird, type Species } from './engine';
import { createBackdrop } from './demo/backdrop';

export interface SceneOptions { species: Species; pixelRatio?: number }

/** Optional small demo host. Embedders can use createBird directly with their own scene. */
export function mountBirdScene(canvas: HTMLCanvasElement, options: SceneOptions) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(options.pixelRatio ?? devicePixelRatio, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.02, 120);
  camera.position.set(1.55, 0.85, 3);
  const controls = new OrbitControls(camera, canvas);
  controls.target.set(0, 0.5, 0);
  controls.enableDamping = true;
  controls.enablePan = false;
  controls.minDistance = 1.8;
  controls.maxDistance = 5;
  controls.maxPolarAngle = Math.PI * 0.65;

  const backdrop = createBackdrop();
  scene.add(backdrop.mesh);
  const envScene = new THREE.Scene();
  const envBackdrop = createBackdrop();
  envBackdrop.material.uniforms.uEnv.value = 1;
  envScene.add(envBackdrop.mesh);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(envScene, 0.02);
  scene.environment = environment.texture;
  scene.environmentIntensity = 1.6;
  pmrem.dispose();
  envBackdrop.mesh.geometry.dispose();
  envBackdrop.material.dispose();

  scene.add(new THREE.HemisphereLight(0xeef2e6, 0x3a3826, 0.6));
  const key = new THREE.DirectionalLight(0xfff4e6, 2.2);
  key.position.set(-1.3, 3.6, 1.5);
  key.target.position.set(0, 0.5, 0);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  Object.assign(key.shadow.camera, { left: -1.2, right: 1.2, top: 1.5, bottom: -1.2, near: 0.5, far: 8 });
  key.shadow.bias = -0.0015;
  key.shadow.normalBias = 0.025;
  scene.add(key, key.target);
  const rim = new THREE.DirectionalLight(0xf2fae8, 1.4);
  rim.position.set(1.5, 1.8, -2.5);
  rim.target.position.set(0, 0.5, 0);
  scene.add(rim, rim.target);

  const bird = createBird({ species: options.species });
  scene.add(bird.root);
  // A primitive perch honors the grip contract; no GLB, textures or Blender assets.
  const radius = options.species.legs.perchRadius;
  const perch = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, 2.5, 12),
    new THREE.MeshStandardMaterial({ color: 0x544336, roughness: 0.95 }),
  );
  perch.rotation.z = Math.PI / 2;
  perch.position.y = -radius;
  perch.castShadow = perch.receiveShadow = true;
  scene.add(perch);
  bird.setPerch((x, out) => {
    out.point.set(x, 0, 0);
    out.up.set(0, 1, 0);
    out.tangent.set(1, 0, 0);
    out.radius = radius;
    return out;
  }, [-0.7, 0.7]);

  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const plane = new THREE.Plane();
  const normal = new THREE.Vector3();
  const at = new THREE.Vector3(0, 0.8, 0);
  const pointer = new THREE.Vector3();
  let pointerAt = -Infinity;
  const onPointer = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    ndc.set((e.clientX - rect.left) / rect.width * 2 - 1, 1 - (e.clientY - rect.top) / rect.height * 2);
    ray.setFromCamera(ndc, camera);
    camera.getWorldDirection(normal);
    plane.setFromNormalAndCoplanarPoint(normal, at);
    if (ray.ray.intersectPlane(plane, pointer)) pointerAt = performance.now();
  };
  const onKey = (e: KeyboardEvent) => {
    if (e.code === 'Space' && !e.repeat) { e.preventDefault(); bird.startle(0.7); }
  };
  canvas.addEventListener('pointermove', onPointer);
  window.addEventListener('keydown', onKey);

  const resize = () => {
    const w = Math.max(canvas.clientWidth, 1), h = Math.max(canvas.clientHeight, 1);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.fov = w / h < 1 ? 30 / Math.max(w / h, 0.55) : 30;
    camera.updateProjectionMatrix();
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();
  const timer = new THREE.Timer();
  timer.connect(document);
  let frames = 0, disposed = false;
  const ready = renderer.compileAsync(scene, camera);
  renderer.setAnimationLoop(() => {
    // Read the current clock inside the callback. A queued RAF timestamp can predate
    // Timer construction after synchronous geometry generation (upstream startup bug).
    timer.update();
    const dt = Math.max(0, Math.min(timer.getDelta(), 1 / 20));
    controls.update();
    bird.setAttention(performance.now() - pointerAt < 300 ? pointer : camera.position);
    bird.update(dt);
    backdrop.material.uniforms.uTime.value = bird.mind.t;
    backdrop.mesh.position.copy(camera.position);
    renderer.render(scene, camera);
    frames++;
  });

  return {
    bird, scene, camera, renderer, controls, ready,
    get frames() { return frames; },
    get disposed() { return disposed; },
    dispose() {
      if (disposed) return;
      disposed = true;
      renderer.setAnimationLoop(null);
      observer.disconnect();
      canvas.removeEventListener('pointermove', onPointer);
      window.removeEventListener('keydown', onKey);
      controls.dispose();
      timer.dispose();
      bird.dispose();
      bird.root.removeFromParent();
      perch.geometry.dispose();
      perch.material.dispose();
      backdrop.mesh.geometry.dispose();
      backdrop.material.dispose();
      environment.dispose();
      key.shadow.map?.dispose();
      key.shadow.mapPass?.dispose();
      renderer.dispose();
      scene.clear();
    },
  };
}
