import './style.css';
import { MOUNTAIN_GEM } from './engine';
import { PROOF_SPECIES } from './species/proof';
import { mountBirdScene } from './scene';
import { installDebug } from './demo/debug';

const query = new URLSearchParams(location.search);
const demo = mountBirdScene(document.querySelector<HTMLCanvasElement>('#bird')!, {
  species: query.get('species') === 'proof' ? PROOF_SPECIES : MOUNTAIN_GEM,
});
const cleanDebug = installDebug(demo.bird);
// Demo diagnostics only. The engine itself has no window, URL or DOM dependency.
Object.assign(window, { __birdDemo: demo });
window.addEventListener('pagehide', e => {
  if (!e.persisted) { cleanDebug?.(); demo.dispose(); }
});
