import * as THREE from 'three';
import type { BirdHandle } from '../engine';

/**
 * URL switches, all optional:
 *   ?gaze=yaw,pitch,roll   pin the head (degrees);  ?pose=front|profile|up|back as shortcuts
 *   ?quiet                 no spontaneous behaviour (breathing and tremor stay)
 *   ?arousal=0..1          pin the mood
 *   ?fluff=rad  ?spread=0..1  ?fan=0..1  ?blink=0..1
 *   ?bones  ?skin (hide feathers)  ?noflash
 * and window.__bird for poking.
 */
export function installDebug(bird: BirdHandle) {
  if (typeof window === 'undefined') return null;
  const q = new URLSearchParams(window.location.search);
  (window as unknown as { __bird: BirdHandle }).__bird = bird;
  const num = (k: string) => (q.has(k) ? Number(q.get(k)) : null);
  const poses: Record<string, [number, number, number]> = { front: [0, 22, 0], profile: [88, 16, 0], up: [10, 40, 8], back: [-110, 10, 0], three: [38, 20, -4] };
  const pose = q.get('pose');
  if (pose && poses[pose]) bird.mind.pinGaze = poses[pose];
  const gaze = q.get('gaze');
  if (gaze) {
    const [y = 0, p = 0, r = 0] = gaze.split(',').map(Number);
    bird.mind.pinGaze = [y, p, r];
  }
  if (q.has('quiet')) bird.mind.quiet = true;
  if (q.has('sing')) {
    // debug: sing every few seconds
    const prev = bird.onPose;
    let next = 1;
    bird.onPose = (p, mind) => {
      prev?.(p, mind);
      if (mind.t > next && !bird.singing && bird.sing(1.8)) next = mind.t + 4;
    };
  }
  const jawOpen = num('jaw');
  const tongue = num('tongue');
  const arousal = num('arousal');
  const fluff = num('fluff');
  const spread = num('spread');
  const fan = num('fan');
  const blink = num('blink');
  if (arousal !== null || fluff !== null || spread !== null || fan !== null || blink !== null || jawOpen !== null || tongue !== null) {
    const before = bird.onPose;
    bird.onPose = (p, m) => {
      before?.(p, m);
      if (jawOpen !== null) p.jaw = jawOpen;
      if (tongue !== null) p.tongueOut = tongue;
      if (arousal !== null) m.arousal = m.baseline = arousal;
      if (fluff !== null) p.fluff = fluff;
      if (spread !== null) p.wing.L.spread = p.wing.R.spread = spread;
      if (fan !== null) p.tailFan = fan;
      if (blink !== null) p.nict = p.lidLower = p.lidUpper = blink;
    };
  }
  if (q.has('nofuzz')) bird.root.traverse((o) => o.name === 'bird.fuzz' && (o.visible = false));
  if (q.has('noflash')) bird.plumage.uFlash.value = bird.plumage.uGlint.value = 0;
  if (q.has('skin')) bird.root.traverse((o) => o.name.match(/contour|flight|fuzz/) && (o.visible = false));
  if (q.has('wire')) {
    bird.root.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined;
      if (o.name === 'bird.skin' && m) {
        m.wireframe = true;
        m.color.set(0xffffff);
        m.emissive.set(0x888888);
      }
    });
  }
  let helper: THREE.SkeletonHelper | null = null;
  if (q.has('bones')) {
    helper = new THREE.SkeletonHelper(bird.rig.rootBone);
    (helper.material as THREE.LineBasicMaterial).depthTest = false;
    helper.renderOrder = 10;
    bird.root.add(helper);
  }
  return () => {
    helper?.dispose();
  };
}
