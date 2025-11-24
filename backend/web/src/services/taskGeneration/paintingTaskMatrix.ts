/**
 * Painting Task Matrix - Ultra-Compact 3D Structure
 * Format: Matrix[itemType][componentIndex][timingIndex] → task numbers[]
 * Component order: Face, Return, Trim, Return&Trim, Face&Return, Frame, All Sides (0-6)
 * Timing order: Pre-Cutting, Post-Cutting, Post-Folding, Post-Fabrication (0-3)
 */

export type PaintingComponent = 'Face' | 'Return' | 'Trim' | 'Return & Trim' | 'Face & Return' | 'Frame' | 'All Sides';
export type PaintingTiming = 'Pre-Cutting' | 'Post-Cutting' | 'Post-Folding' | 'Post-Fabrication';
export type MaterialCategory = 'metal' | 'plastic';
export type BackerType = 'flat' | 'folded';

export const PAINTING_TASKS = {
  1: 'Sanding (320) before cutting',
  2: 'Scuffing before cutting',
  3: 'Paint before cutting',
  4: 'Sanding (320) after cutting',
  5: 'Scuffing after cutting',
  6: 'Paint After Cutting',
  7: 'Paint After Bending',
  8: 'Paint after Fabrication',
} as const;

const COMPONENTS: PaintingComponent[] = ['Face', 'Return', 'Trim', 'Return & Trim', 'Face & Return', 'Frame', 'All Sides'];
const TIMINGS: PaintingTiming[] = ['Pre-Cutting', 'Post-Cutting', 'Post-Folding', 'Post-Fabrication'];

type PM = (number[] | null)[][];
const N = null;
const NONE: (number[] | null)[] = [N, N, N, N];

// Reusable patterns
const P1 = [[2,3], [2,6], N, N];           // Face: scuff+paint before, scuff+paint after cutting
const P2 = [[2,3], N, N, [2,8]];           // Return/Trim: scuff+paint before, scuff+paint after fab
const P3 = [[2,3], [2,3,6], N, [2,8]];     // Face&Return: scuff+paint before, all after cutting, scuff+paint after fab
const P4 = [[2,3], [5,6], [5,7], [5,8]];   // Raceway pattern: scuff+paint before, scuff+paint all after stages
const P5 = [[1,3], [4,6], [4,7], [4,8]];   // Metal pattern: sand+paint before, sand+paint all after stages
const P6 = [[1,3], [4,6], N, [4,8]];       // Frame pattern: sand+paint before/after cutting/fab
const P7 = [[2,3], [2,6], N, [2,8]];       // Standard all-around: scuff+paint before/after cutting/fab

const MATRIX: Record<string, PM> = {
  'Front Lit': [P1, P2, P2, P2, P3, NONE, NONE],
  'Halo Lit': [[[2,3], [1,6], N, [1,8]], [[2,3], N, N, N], NONE, NONE, [[2,3], [1,2,3,6], N, [1,8]], NONE, NONE],
  'Front Lit Acrylic Face': [NONE, [[2,3], N, N, [1,8]], NONE, NONE, NONE, NONE, NONE],
  'Dual Lit - Single Layer': [P1, P2, P2, P2, P3, NONE, NONE],
  'Dual Lit - Double Layer': [P1, P2, P2, P2, P3, NONE, NONE],
  'Blade Sign': [P1, [[2,3], N, N, N], [[2,3], N, N, N], [[2,3], N, N, N], [[2,3], N, N, [2,8]], [N, N, N, [8]], [[2,3], [2,6], N, [2,8]]],
  'Marquee Bulb': [P1, P2, NONE, NONE, [[2,3], N, N, [2,8]], NONE, [[2,3], N, N, [2,8]]],
  'Material Cut': [[[2,3], [5,6], N, N], [[2,3], N, N, N], [[2,3], N, N, N], [[2,3], N, N, N], [[2,3], [2,3,5,6], N, N], NONE, [[2,3], N, N, N]],
  'Return': [P7, P2, NONE, NONE, P3, NONE, P7],
  'Trim Cap': [P7, NONE, [[2,3], N, N, [2,8]], NONE, P7, NONE, P7],
  '3D Print': [[[3], [6], N, N], [N, N, N, [8]], NONE, NONE, [[3], [6], N, [8]], NONE, [N, N, N, [8]]],
  'Frame': [P6, P6, NONE, NONE, P6, P6, P6],
  'Aluminum Raceway': [P4, P4, NONE, NONE, P4, NONE, P4],
  'Extrusion Raceway': [P4, P4, NONE, NONE, P4, NONE, P4],
  'Push Thru': [[[2,3], [5,6], [5,7], [5,8]], P5, NONE, NONE, P5, NONE, P5],
  'Knockout Box': [[[2,3], [5,6], [5,7], [5,8]], P5, NONE, NONE, P5, NONE, P5],
  'Neon LED': [[[3], [6], N, N], [N, [6], N, N], NONE, NONE, [N, [6], N, N], NONE, [N, [6], N, N]],
  'Painting': [NONE, NONE, NONE, NONE, NONE, NONE, NONE],
};

// Material-dependent matrices
const SUBSTRATE_CUT_METAL: PM = [[[2,3], [2,6], [1,8], [1,8]], NONE, NONE, NONE, [N, [1,6], [2,6], [2,8]], NONE, [N, [4,6], [4,7], [4,8]]];
const SUBSTRATE_CUT_PLASTIC: PM = [[[3], [6], N, [8]], [N, [6], N, [8]], NONE, NONE, [N, [6], N, [8]], NONE, [N, [6], [7], [8]]];
const BACKER_FLAT: PM = [[[2,3], [2,6], [2,7], [2,8]], [[1,3], [4,6], N, [4,8]], NONE, NONE, [[1,2,3], [2,4,6], N, [4,8]], NONE, [[1,2,3], [2,4,6], N, [4,8]]];
const BACKER_FOLDED: PM = [[[2,3], [2,6], [2,7], [2,8]], [[2,3], N, [2,7], [2,8]], NONE, NONE, [[2,3], N, [5,7], [5,8]], NONE, [[2,3], N, [5,7], [5,8]]];

export function getMaterialCategory(material: string | undefined): MaterialCategory {
  if (!material) return 'metal';
  const m = material.toLowerCase();
  return (m.includes('acrylic') || m.includes('pvc') || m.includes('plastic') || m.includes('polycarbonate') || m.includes('pc')) ? 'plastic' : 'metal';
}

export function getBackerType(itemName: string | undefined): BackerType {
  if (!itemName) return 'flat';
  const n = itemName.toLowerCase();
  return (n.includes('folded') || n.includes('aluminum backer')) ? 'folded' : 'flat';
}

export function lookupPaintingTasks(
  itemType: string,
  component: PaintingComponent,
  timing: PaintingTiming,
  materialCategory?: MaterialCategory,
  backerType?: BackerType
): number[] {
  const ci = COMPONENTS.indexOf(component);
  const ti = TIMINGS.indexOf(timing);
  if (ci === -1 || ti === -1) return [];

  let m: PM | undefined;
  if (itemType === 'Substrate Cut') m = materialCategory === 'plastic' ? SUBSTRATE_CUT_PLASTIC : SUBSTRATE_CUT_METAL;
  else if (itemType === 'Backer') m = backerType === 'folded' ? BACKER_FOLDED : BACKER_FLAT;
  else m = MATRIX[itemType];

  if (!m) return [];
  const tasks = m[ci]?.[ti];
  return tasks === null ? [] : (tasks || []);
}

export function getTaskNames(taskNumbers: number[]): string[] {
  return taskNumbers.map(num => PAINTING_TASKS[num as keyof typeof PAINTING_TASKS]);
}
