import { MOUNTAIN_GEM, type Species } from '../engine/species';

// A deliberately obvious data-only experiment, NOT the future mrhao.cc species.
// Keep the original object untouched so both birds can coexist in one scene.
export const PROOF_SPECIES: Species = {
  ...MOUNTAIN_GEM,
  name: 'Extraction proof: amber and teal (temporary)',
  sections: MOUNTAIN_GEM.sections.map((s, i) => i <= 5
    ? { ...s, w: s.w * 1.18, rd: s.rd * 1.08, rv: s.rv * 1.12 }
    : { ...s }),
  bill: { ...MOUNTAIN_GEM.bill, length: 0.23 },
  shading: { ...MOUNTAIN_GEM.shading, gold: 0xb65c14, goldAmount: 0.12 },
  looks: {
    ...MOUNTAIN_GEM.looks,
    ...Object.fromEntries(['body', 'belly', 'flank', 'back', 'scapular', 'covert', 'wingCovert'].map(key => [key, {
      ...MOUNTAIN_GEM.looks[key],
      base: 0x51220c, tip: 0xd7802d, iri: 0xe7a04a, iriGraze: 0x9e4c19,
    }])),
    gorget: { ...MOUNTAIN_GEM.looks.gorget, base: 0x083b37, tip: 0x117d72, iri: 0x20d6cf, iriGraze: 0x66dc98 },
    crown: { ...MOUNTAIN_GEM.looks.crown, base: 0x5a2507, tip: 0xaf6116, iri: 0xffaa20, iriGraze: 0xffdd57 },
  },
  wing: { ...MOUNTAIN_GEM.wing, shoulder: [0.215, 0.64, -0.06], color: 0x6f2d15, sheen: 0xda9250 },
  tail: { ...MOUNTAIN_GEM.tail, length: [0.82, 0.9], color: 0x783f1a },
  behaviour: {
    ...MOUNTAIN_GEM.behaviour,
    breathHz: [1.8, 3.2], holdCalm: [0.8, 2.6], blinkEvery: [3.2, 6],
  },
};
