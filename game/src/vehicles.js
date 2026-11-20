// Vehicles: car physics for the player, the traffic AI that follows the road grid, parked cars,
// and the shared chase-driving used by police cruisers. A car is a circle for collisions and a
// heading for drawing; traffic cars steer toward a point ahead on their lane.
import { CAR_COLORS, CAR_MODELS, H_ROADS, ROAD_W, V_ROADS, WORLD } from './config.js';
import { nearestHRoad, nearestVRoad, resolveBuildings, snapToRoad } from './world.js';

const LANE = 32; // lane centre offset from the road centreline (right-hand traffic)
const TRAFFIC_TARGET = 13;
const PARKED_TARGET = 9;

let nextId = 1;

export function makeCar(model, x, y, angle, kind, color) {
  const spec = CAR_MODELS[model];
  return {
    id: nextId += 1,
    model, kind, x, y, angle, speed: 0,
    len: spec.len, wid: spec.wid, top: spec.top, accel: spec.accel, steer: spec.steer,
    color: color || CAR_COLORS[model][0],
    health: 100, dead: false, smokeT: 0, skidT: 0,
    // Traffic AI state: which road it is on, which way it drives, what it aims at.
    ai: { axis: 'v', road: x, dir: 1, targetSpeed: 150, turnCd: 0 },
    hitCd: 0,
  };
}

// Lane centre for a car driving `dir` along a road on `axis`: right-hand traffic.
function lanePoint(axis, road, dir, along) {
  if (axis === 'v') return { x: road + (dir > 0 ? LANE : -LANE), y: along };
  return { x: along, y: road + (dir > 0 ? LANE : -LANE) };
}

function angleTo(x, y, tx, ty) {
  return Math.atan2(ty - y, tx - x);
}

function angleDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

// Steer a car toward a target point at up to topSpeed. Used by traffic and by police chases.
export function driveToward(car, tx, ty, dt, topSpeed, state) {
  const want = angleTo(car.x, car.y, tx, ty);
  const diff = angleDiff(car.angle, want);
  const turnRate = car.steer * (0.4 + 0.6 * Math.min(1, Math.abs(car.speed) / 150));
  car.angle += Math.max(-turnRate * dt, Math.min(turnRate * dt, diff));
  const aligned = Math.abs(diff) < 0.9;
  if (aligned) car.speed = Math.min(topSpeed, car.speed + car.accel * dt);
  else car.speed = Math.max(0, car.speed - car.accel * 0.8 * dt);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  if (state) resolveBuildings(state.world, car, car.len * 0.42);
}

function carAhead(state, car, dist) {
  const fx = Math.cos(car.angle);
  const fy = Math.sin(car.angle);
  let nearest = Infinity;
  for (const other of state.vehicles) {
    if (other === car || other.dead) continue;
    const dx = other.x - car.x;
    const dy = other.y - car.y;
    const along = dx * fx + dy * fy;
    if (along < 0 || along > dist) continue;
    const side = Math.abs(-dx * fy + dy * fx);
    if (side < 34 && along < nearest) nearest = along;
  }
  return nearest;
}

function updateTrafficCar(state, car, dt, rng) {
  const ai = car.ai;
  ai.turnCd -= dt;
  // At an intersection, sometimes turn onto the crossing road.
  const cross = ai.axis === 'v' ? nearestHRoad(car.y) : nearestVRoad(car.x);
  const along = ai.axis === 'v' ? car.y : car.x;
  if (ai.turnCd <= 0 && Math.abs(along - cross) < 46) {
    ai.turnCd = 2.5;
    if (rng.chance(0.45)) {
      if (ai.axis === 'v') {
        ai.axis = 'h';
        ai.road = cross;
        ai.dir = rng.chance(0.5) ? 1 : -1;
      } else {
        ai.axis = 'v';
        ai.road = cross;
        ai.dir = rng.chance(0.5) ? 1 : -1;
      }
    }
  }
  // Target: a point ahead on the lane. If it is far off-lane (just turned), aim at the lane.
  const ahead = (ai.axis === 'v' ? car.y : car.x) + ai.dir * 140;
  const target = lanePoint(ai.axis, ai.road, ai.dir, ahead);
  let top = ai.targetSpeed;
  const gap = carAhead(state, car, 120);
  if (gap < 90) top = Math.min(top, Math.max(0, (gap - 40) * 1.2));
  driveToward(car, target.x, target.y, dt, top, state);
  // A traffic car that ends up far off the grid (pushed by a crash) snaps back to a road.
  if (!onAnyRoad(car.x, car.y)) {
    const snapped = snapToRoad(car.x, car.y);
    car.x = snapped.x;
    car.y = snapped.y;
  }
}

function onAnyRoad(x, y) {
  for (const vx of V_ROADS) if (Math.abs(x - vx) <= ROAD_W / 2 + 10) return true;
  for (const hy of H_ROADS) if (Math.abs(y - hy) <= ROAD_W / 2 + 10) return true;
  return false;
}

function updatePlayerCar(state, car, dt, input) {
  const axis = input.axis();
  const spec = CAR_MODELS[car.model];
  const forward = axis.y < 0; // W / ArrowUp
  const back = axis.y > 0;
  if (forward) car.speed = Math.min(spec.top, car.speed + spec.accel * dt);
  else if (back) {
    car.speed = car.speed > 20 ? car.speed - spec.accel * 1.4 * dt : Math.max(-140, car.speed - spec.accel * 0.7 * dt);
  } else {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 180 * dt);
  }
  if (input.handbrake()) {
    car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 620 * dt);
  }
  const steerInput = axis.x;
  const speedFactor = Math.min(1, Math.abs(car.speed) / 160);
  car.angle += steerInput * spec.steer * speedFactor * dt * Math.sign(car.speed || 1)
    * (input.handbrake() ? 1.7 : 1);
  car.x += Math.cos(car.angle) * car.speed * dt;
  car.y += Math.sin(car.angle) * car.speed * dt;
  const hit = resolveBuildings(state.world, car, car.len * 0.42);
  if (hit && Math.abs(car.speed) > 120) {
    damageCar(state, car, Math.abs(car.speed) * 0.06);
    state.events.crash = true;
    car.speed *= 0.45;
  }
  // Skid marks while handbraking at speed.
  car.skidT -= dt;
  if (input.handbrake() && Math.abs(car.speed) > 160 && car.skidT <= 0) {
    car.skidT = 0.05;
    state.skids.push({ x: car.x, y: car.y, angle: car.angle, life: 5 });
  }
  if (car.skidT <= 0 && Math.abs(car.speed) > 300) {
    car.skidT = 0.09;
    state.skids.push({ x: car.x - Math.cos(car.angle) * 20, y: car.y - Math.sin(car.angle) * 20, angle: car.angle, life: 4 });
  }
}

export function damageCar(state, car, amount) {
  if (car.dead) return;
  car.health -= amount;
  if (car.health <= 0) {
    car.health = 0;
    car.dead = true;
    explodeCar(state, car);
  }
}

export function explodeCar(state, car) {
  state.booms.push({ x: car.x, y: car.y, r: 90, t: 0, life: 0.7 });
  state.audio.explosion();
  state.shake(14);
  for (let i = 0; i < 26; i += 1) {
    const a = state.rng() * Math.PI * 2;
    const s = 60 + state.rng() * 320;
    state.parts.push({ x: car.x, y: car.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + state.rng() * 0.6, max: 1.1, size: 3 + state.rng() * 5, color: state.rng.chance(0.5) ? '#ff7b2f' : '#ffd21f' });
  }
  // Anything close takes blast damage.
  for (const ped of state.peds) {
    const d = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (d < 110) ped.health = 0;
  }
  if (state.player.inCar === car) {
    state.player.health -= 45;
    state.player.inCar = null;
  }
}

function spawnTrafficNear(state, rng) {
  const p = state.player;
  const vx = rng.pick(V_ROADS);
  const hy = rng.pick(H_ROADS);
  const axis = rng.chance(0.5) ? 'v' : 'h';
  const dir = rng.chance(0.5) ? 1 : -1;
  const road = axis === 'v' ? vx : hy;
  const along = axis === 'v' ? p.y + rng.range(-900, 900) : p.x + rng.range(-900, 900);
  const pos = lanePoint(axis, road, dir, along);
  if (Math.hypot(pos.x - p.x, pos.y - p.y) < 420) return;
  if (Math.hypot(pos.x - p.x, pos.y - p.y) > 1400) return;
  const model = rng.pick(['sedan', 'sedan', 'taxi', 'van', 'pickup']);
  const car = makeCar(model, pos.x, pos.y, axis === 'v' ? (dir > 0 ? Math.PI / 2 : -Math.PI / 2) : (dir > 0 ? 0 : Math.PI), 'traffic');
  car.ai.axis = axis;
  car.ai.road = road;
  car.ai.dir = dir;
  car.ai.targetSpeed = rng.range(120, 190);
  state.vehicles.push(car);
}

function spawnParked(state, rng) {
  const p = state.player;
  const vx = rng.pick(V_ROADS);
  const hy = rng.pick(H_ROADS);
  const side = rng.chance(0.5) ? 1 : -1;
  let x;
  let y;
  let angle;
  if (rng.chance(0.5)) {
    x = vx + side * (ROAD_W / 2 + 16);
    y = hy + rng.range(-320, 320);
    angle = side > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    x = vx + rng.range(-320, 320);
    y = hy + side * (ROAD_W / 2 + 16);
    angle = side > 0 ? 0 : Math.PI;
  }
  if (Math.hypot(x - p.x, y - p.y) < 300) return;
  const model = rng.pick(['sedan', 'sedan', 'van', 'pickup', 'taxi']);
  const car = makeCar(model, x, y, angle, 'parked');
  state.vehicles.push(car);
}

export function seedVehicles(state, rng) {
  // The Comet GT the second mission steals, parked at the marina.
  const comet = makeCar('sports', 430, 3050, Math.PI / 2, 'mission', '#e8232a');
  comet.missionCar = true;
  state.vehicles.push(comet);
  for (let i = 0; i < 16; i += 1) spawnTrafficNear(state, rng);
  for (let i = 0; i < 10; i += 1) spawnParked(state, rng);
}

export function nearestCar(state, x, y, maxDist) {
  let best = null;
  let bestD = maxDist;
  for (const car of state.vehicles) {
    if (car.dead || car.kind === 'police') continue;
    const d = Math.hypot(car.x - x, car.y - y);
    if (d < bestD) {
      bestD = d;
      best = car;
    }
  }
  return best;
}

export function updateVehicles(state, dt, input) {
  const rng = state.rng;
  // Keep traffic topped up near the player; drop cars far away.
  let traffic = 0;
  for (let i = state.vehicles.length - 1; i >= 0; i -= 1) {
    const car = state.vehicles[i];
    if (car.dead) {
      car.deadT = (car.deadT || 0) + dt;
      if (car.deadT > 12) state.vehicles.splice(i, 1);
      continue;
    }
    if (car.kind === 'traffic') {
      traffic += 1;
      if (Math.hypot(car.x - state.player.x, car.y - state.player.y) > 1900) {
        state.vehicles.splice(i, 1);
        traffic -= 1;
      }
    }
  }
  for (let i = traffic; i < TRAFFIC_TARGET; i += 1) spawnTrafficNear(state, rng);
  let parked = state.vehicles.filter((c) => c.kind === 'parked').length;
  for (let i = parked; i < PARKED_TARGET; i += 1) spawnParked(state, rng);

  for (const car of state.vehicles) {
    if (car.dead) continue;
    car.hitCd -= dt;
    if (car.kind === 'player' || car === state.player.inCar) {
      updatePlayerCar(state, car, dt, input);
    } else if (car.kind === 'traffic') {
      updateTrafficCar(state, car, dt, rng);
    } else if (car.kind === 'police') {
      // Police cruisers are driven by police.js; here they only coast to a stop when idle.
      if (!car.chasing) {
        car.speed -= Math.sign(car.speed) * Math.min(Math.abs(car.speed), 200 * dt);
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;
        resolveBuildings(state.world, car, car.len * 0.42);
      }
    }
    // Smoke while wrecked.
    if (car.health < 40 && !car.dead) {
      car.smokeT -= dt;
      if (car.smokeT <= 0) {
        car.smokeT = 0.12;
        state.parts.push({ x: car.x + rng.range(-8, 8), y: car.y + rng.range(-8, 8), vx: rng.range(-12, 12), vy: -40 - rng.range(0, 30), life: 0.9, max: 0.9, size: 5 + rng.range(0, 5), color: '#5a5a5a' });
      }
    }
  }

  // Car-car collisions: push apart, damage on hard hits.
  const cars = state.vehicles;
  for (let i = 0; i < cars.length; i += 1) {
    const a = cars[i];
    if (a.dead) continue;
    for (let j = i + 1; j < cars.length; j += 1) {
      const b = cars[j];
      if (b.dead) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const min = (a.len + b.len) * 0.42;
      const d2 = dx * dx + dy * dy;
      if (d2 >= min * min || d2 < 0.01) continue;
      const d = Math.sqrt(d2);
      const push = (min - d) / 2;
      const nx = dx / d;
      const ny = dy / d;
      a.x -= nx * push;
      a.y -= ny * push;
      b.x += nx * push;
      b.y += ny * push;
      const closing = Math.abs(a.speed - b.speed);
      if (closing > 130 && a.hitCd <= 0) {
        a.hitCd = 0.4;
        b.hitCd = 0.4;
        damageCar(state, a, closing * 0.05);
        damageCar(state, b, closing * 0.05);
        state.events.crash = true;
        for (let k = 0; k < 6; k += 1) {
          state.parts.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, vx: rng.range(-140, 140), vy: rng.range(-140, 140), life: 0.3, max: 0.3, size: 2, color: '#ffd21f' });
        }
      }
    }
  }
}
