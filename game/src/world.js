// Solmara's city: the road grid, the blocks between them, and everything that stands in them.
// Built once from a seeded RNG, so the same seed always builds the same city. This module also
// owns the geometry questions the rest of the game asks: is this point on a road, does this
// circle hit a building, and where do sidewalks run.
import { BEACH_X, H_ROADS, PALETTE, ROAD_W, SIDEWALK, SPOTS, V_ROADS, WATER_X, WORLD } from './config.js';

// The park block and the downtown tower blocks are fixed by their block indices.
const PARK_BLOCK = { col: 3, row: 4 }; // between V_ROADS[3..4] and H_ROADS[4..5]
const DOWNTOWN = { colMin: 2, colMax: 4, rowMin: 1, rowMax: 3 };

export function buildWorld(rng) {
  const buildings = [];
  const palms = [];
  const lamps = [];
  const parks = [];
  const docks = [];

  // Block columns run between neighbouring vertical roads, plus the beach strip on the west
  // and the outer strip on the east; rows the same between horizontal roads, plus north/south.
  const colEdges = [BEACH_X, ...V_ROADS, WORLD.w];
  const rowEdges = [0, ...H_ROADS, WORLD.h];

  for (let col = 0; col < colEdges.length - 1; col += 1) {
    for (let row = 0; row < rowEdges.length - 1; row += 1) {
      const x0 = colEdges[col] + (col === 0 ? 0 : ROAD_W / 2 + SIDEWALK);
      const x1 = colEdges[col + 1] - (col === colEdges.length - 2 ? 0 : ROAD_W / 2 + SIDEWALK);
      const y0 = rowEdges[row] + (row === 0 ? 0 : ROAD_W / 2 + SIDEWALK);
      const y1 = rowEdges[row + 1] - (row === rowEdges.length - 2 ? 0 : ROAD_W / 2 + SIDEWALK);
      const bw = x1 - x0;
      const bh = y1 - y0;
      if (bw < 90 || bh < 90) continue;

      // The marina corner (south-west, by the water) stays open for the docks.
      if (col === 0 && row >= rowEdges.length - 3) continue;
      // The park block is grass and trees, no buildings.
      if (col === PARK_BLOCK.col + 1 && row === PARK_BLOCK.row + 1) {
        parks.push({ x: x0, y: y0, w: bw, h: bh });
        for (let i = 0; i < 14; i += 1) {
          palms.push({ x: x0 + rng.range(30, bw - 30), y: y0 + rng.range(30, bh - 30), kind: 'tree' });
        }
        continue;
      }

      const downtown = col >= DOWNTOWN.colMin + 1 && col <= DOWNTOWN.colMax + 1
        && row >= DOWNTOWN.rowMin + 1 && row <= DOWNTOWN.rowMax + 1;
      const count = downtown ? 1 : rng.int(1, 3);
      for (let i = 0; i < count; i += 1) {
        const w = downtown ? rng.range(bw * 0.55, bw * 0.8) : rng.range(90, Math.min(240, bw - 20));
        const h = downtown ? rng.range(bh * 0.55, bh * 0.8) : rng.range(90, Math.min(200, bh - 20));
        const x = x0 + (bw - w) / 2 + rng.range(-20, 20);
        const y = y0 + (bh - h) / 2 + rng.range(-20, 20);
        const tall = downtown ? rng.range(26, 60) : rng.range(8, 22);
        buildings.push({
          x, y, w, h, tall,
          color: downtown ? rng.pick(PALETTE.tower) : rng.pick(PALETTE.building),
          tower: downtown,
        });
      }
      // Palms along the block's south sidewalk.
      const palmCount = rng.int(1, 4);
      for (let i = 0; i < palmCount; i += 1) {
        palms.push({ x: x0 + rng.range(20, bw - 20), y: y1 - 8, kind: 'palm' });
      }
    }
  }

  // Landmark buildings, placed by hand so missions always find them.
  buildings.push({ x: 2320, y: 1580, w: 200, h: 150, tall: 18, color: '#e8e0c8', tower: false, label: 'bank' });
  buildings.push({ x: 1760, y: 1010, w: 130, h: 90, tall: 10, color: '#c96a4d', tower: false, label: 'cafe' });
  buildings.push({ x: 2960, y: 2010, w: 170, h: 120, tall: 12, color: '#5d7d99', tower: false, label: 'garage' });
  buildings.push({ x: 4140, y: 500, w: 120, h: 100, tall: 10, color: '#8a6f4d', tower: false, label: 'safehouse' });

  // Marina docks: wooden piers reaching into the water at the south-west corner.
  docks.push({ x: 60, y: 2980, w: 240, h: 26 });
  docks.push({ x: 60, y: 3120, w: 300, h: 26 });
  docks.push({ x: 60, y: 3260, w: 200, h: 26 });

  // Street lamps at every intersection corner.
  for (const vx of V_ROADS) {
    for (const hy of H_ROADS) {
      lamps.push({ x: vx + ROAD_W / 2 + 8, y: hy - ROAD_W / 2 - 8 });
      lamps.push({ x: vx - ROAD_W / 2 - 8, y: hy + ROAD_W / 2 + 8 });
    }
  }
  // Palms along the beach.
  for (let y = 200; y < WORLD.h; y += 260) {
    palms.push({ x: BEACH_X - 40 + rng.range(-14, 14), y: y + rng.range(-30, 30), kind: 'palm' });
  }

  return { buildings, palms, lamps, parks, docks };
}

// ---- Geometry helpers -------------------------------------------------------

export function onRoad(x, y) {
  for (const vx of V_ROADS) if (Math.abs(x - vx) <= ROAD_W / 2) return true;
  for (const hy of H_ROADS) if (Math.abs(y - hy) <= ROAD_W / 2) return true;
  return false;
}

export function nearestVRoad(x) {
  let best = V_ROADS[0];
  for (const vx of V_ROADS) if (Math.abs(x - vx) < Math.abs(x - best)) best = vx;
  return best;
}

export function nearestHRoad(y) {
  let best = H_ROADS[0];
  for (const hy of H_ROADS) if (Math.abs(y - hy) < Math.abs(y - best)) best = hy;
  return best;
}

// Is this point on a sidewalk (the strip beside a road, but not on the road itself)?
export function onSidewalk(x, y) {
  const m = ROAD_W / 2 + SIDEWALK;
  for (const vx of V_ROADS) {
    if (Math.abs(x - vx) <= m && Math.abs(x - vx) > ROAD_W / 2) return true;
  }
  for (const hy of H_ROADS) {
    if (Math.abs(y - hy) <= m && Math.abs(y - hy) > ROAD_W / 2) return true;
  }
  return false;
}

// A random point on a sidewalk near an intersection: where pedestrians walk.
export function randomSidewalkPoint(rng) {
  const vx = rng.pick(V_ROADS);
  const hy = rng.pick(H_ROADS);
  const side = rng.pick([-1, 1]);
  if (rng.chance(0.5)) {
    return { x: vx + side * (ROAD_W / 2 + SIDEWALK / 2), y: hy + rng.range(-260, 260) };
  }
  return { x: vx + rng.range(-260, 260), y: hy + side * (ROAD_W / 2 + SIDEWALK / 2) };
}

export function pointInBuilding(world, x, y, pad) {
  for (const b of world.buildings) {
    if (x > b.x - pad && x < b.x + b.w + pad && y > b.y - pad && y < b.y + b.h + pad) return b;
  }
  return null;
}

// Push a circle (x, y, radius) out of every building it overlaps, and keep it inside the world.
// Returns true when anything was pushed.
export function resolveBuildings(world, ent, radius) {
  let pushed = false;
  for (const b of world.buildings) {
    const cx = Math.max(b.x, Math.min(ent.x, b.x + b.w));
    const cy = Math.max(b.y, Math.min(ent.y, b.y + b.h));
    const dx = ent.x - cx;
    const dy = ent.y - cy;
    const d2 = dx * dx + dy * dy;
    if (d2 >= radius * radius) continue;
    pushed = true;
    if (d2 < 0.001) {
      // Centre inside the building: shove out along the smallest penetration axis.
      const left = ent.x - b.x;
      const right = b.x + b.w - ent.x;
      const top = ent.y - b.y;
      const bottom = b.y + b.h - ent.y;
      const m = Math.min(left, right, top, bottom);
      if (m === left) ent.x = b.x - radius;
      else if (m === right) ent.x = b.x + b.w + radius;
      else if (m === top) ent.y = b.y - radius;
      else ent.y = b.y + b.h + radius;
    } else {
      const d = Math.sqrt(d2);
      ent.x = cx + (dx / d) * radius;
      ent.y = cy + (dy / d) * radius;
    }
  }
  if (ent.x < WATER_X + radius) { ent.x = WATER_X + radius; pushed = true; }
  if (ent.x > WORLD.w - radius) { ent.x = WORLD.w - radius; pushed = true; }
  if (ent.y < radius) { ent.y = radius; pushed = true; }
  if (ent.y > WORLD.h - radius) { ent.y = WORLD.h - radius; pushed = true; }
  return pushed;
}

// A point on a road near (x, y): used to drop cars and cops onto the asphalt.
export function snapToRoad(x, y) {
  const vx = nearestVRoad(x);
  const hy = nearestHRoad(y);
  if (Math.abs(x - vx) < Math.abs(y - hy)) return { x: vx, y, axis: 'v' };
  return { x, y: hy, axis: 'h' };
}

export { SPOTS };
