// Pedestrians: the people of Solmara. They stroll the sidewalks, cross at crosswalks, and run
// from gunshots, explosions and speeding cars. Hitting one is a crime; killing one is worse.
import { PLAYER } from './config.js';
import { pointInBuilding, randomSidewalkPoint, resolveBuildings } from './world.js';

const SHIRTS = ['#d95f4b', '#4b8fd9', '#e8c84b', '#6ab86a', '#9b6bb8', '#e88ab8', '#5fb8b0', '#d98a4b'];
const PANTS = ['#2e3a4d', '#4d4d4d', '#5d3a2e', '#2e4d3a'];
const PED_TARGET = 26;

let nextId = 1;

export function makePed(state, x, y) {
  const rng = state.rng;
  return {
    id: nextId += 1,
    x, y,
    angle: rng.range(0, Math.PI * 2),
    speed: rng.range(45, 75),
    state: 'walk', // walk | flee | down | fare
    target: randomSidewalkPoint(rng),
    health: 100,
    shirt: rng.pick(SHIRTS),
    pants: rng.pick(PANTS),
    bob: rng.range(0, Math.PI * 2),
    fleeT: 0,
    fare: false,
    scaredT: 0,
  };
}

export function seedPeds(state, rng) {
  for (let i = 0; i < PED_TARGET; i += 1) {
    const p = randomSidewalkPoint(rng);
    state.peds.push(makePed(state, p.x, p.y));
  }
}

function nearestThreat(state, ped) {
  // Gunshots and explosions scare peds; so does a car barrelling at them.
  let tx = 0;
  let ty = 0;
  let found = false;
  for (const boom of state.booms) {
    if (Math.hypot(ped.x - boom.x, ped.y - boom.y) < 420) { tx = boom.x; ty = boom.y; found = true; }
  }
  if (state.events.shotAt) {
    const s = state.events.shotAt;
    if (Math.hypot(ped.x - s.x, ped.y - s.y) < 380) { tx = s.x; ty = s.y; found = true; }
  }
  for (const car of state.vehicles) {
    if (car.dead || Math.abs(car.speed) < 200) continue;
    const d = Math.hypot(ped.x - car.x, ped.y - car.y);
    if (d < 130) {
      const ahead = (ped.x - car.x) * Math.cos(car.angle) + (ped.y - car.y) * Math.sin(car.angle);
      if (ahead > 0) { tx = car.x; ty = car.y; found = true; }
    }
  }
  return found ? { x: tx, y: ty } : null;
}

export function updatePeds(state, dt) {
  const rng = state.rng;
  // Keep the streets populated near the player.
  let count = 0;
  for (let i = state.peds.length - 1; i >= 0; i -= 1) {
    const ped = state.peds[i];
    if (ped.health <= 0) {
      ped.downT = (ped.downT || 0) + dt;
      if (ped.downT > 14) state.peds.splice(i, 1);
      continue;
    }
    count += 1;
    if (Math.hypot(ped.x - state.player.x, ped.y - state.player.y) > 1700) {
      state.peds.splice(i, 1);
      count -= 1;
    }
  }
  for (let i = count; i < PED_TARGET; i += 1) {
    const p = randomSidewalkPoint(rng);
    if (Math.hypot(p.x - state.player.x, p.y - state.player.y) > 1500) continue;
    state.peds.push(makePed(state, p.x, p.y));
  }

  for (const ped of state.peds) {
    if (ped.health <= 0) continue;
    ped.bob += dt * 8;
    const threat = nearestThreat(state, ped);
    if (threat) {
      ped.state = 'flee';
      ped.fleeT = 1.6;
      ped.fleeAngle = Math.atan2(ped.y - threat.y, ped.x - threat.x);
    } else if (ped.fleeT > 0) {
      ped.fleeT -= dt;
      if (ped.fleeT <= 0) ped.state = 'walk';
    }

    let tx;
    let ty;
    let speed = ped.speed;
    if (ped.state === 'flee') {
      const away = ped.fleeAngle || 0;
      tx = ped.x + Math.cos(away) * 120;
      ty = ped.y + Math.sin(away) * 120;
      speed = 230;
    } else if (ped.state === 'fare') {
      // A fare waits where they stand until the player's car arrives.
      continue;
    } else {
      tx = ped.target.x;
      ty = ped.target.y;
      if (Math.hypot(tx - ped.x, ty - ped.y) < 24) {
        ped.target = randomSidewalkPoint(rng);
        tx = ped.target.x;
        ty = ped.target.y;
      }
    }
    const want = Math.atan2(ty - ped.y, tx - ped.x);
    let diff = want - ped.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    ped.angle += Math.max(-3.2 * dt, Math.min(3.2 * dt, diff));
    ped.x += Math.cos(ped.angle) * speed * dt;
    ped.y += Math.sin(ped.angle) * speed * dt;
    resolveBuildings(state.world, ped, 12);
    if (ped.x < 160) ped.x = 160;
    if (ped.x > 4780) ped.x = 4780;
    if (ped.y < 20) ped.y = 20;
    if (ped.y > 3580) ped.y = 3580;
  }

  // Cars running peds over: a crime, and the ped goes down.
  for (const car of state.vehicles) {
    if (car.dead || Math.abs(car.speed) < 60) continue;
    for (const ped of state.peds) {
      if (ped.health <= 0) continue;
      const d = Math.hypot(ped.x - car.x, ped.y - car.y);
      if (d < 26) {
        ped.health = 0;
        ped.state = 'down';
        const isPlayerCar = car === state.player.inCar;
        if (isPlayerCar) {
          state.addCrime(30, 'ped');
          state.shake(6);
        }
        for (let i = 0; i < 8; i += 1) {
          state.parts.push({ x: ped.x, y: ped.y, vx: rng.range(-90, 90), vy: rng.range(-90, 90), life: 0.4, max: 0.4, size: 3, color: '#c0392b' });
        }
      }
    }
  }
}

// A ped the player can hit on foot (melee) or shoot; returns the closest living ped in range.
export function pedInRange(state, x, y, range) {
  let best = null;
  let bestD = range;
  for (const ped of state.peds) {
    if (ped.health <= 0) continue;
    const d = Math.hypot(ped.x - x, ped.y - y);
    if (d < bestD) {
      bestD = d;
      best = ped;
    }
  }
  return best;
}

export function hitPed(state, ped, damage, byPlayer) {
  if (ped.health <= 0) return;
  ped.health -= damage;
  ped.state = 'flee';
  ped.fleeT = 2;
  if (ped.health <= 0) {
    ped.health = 0;
    ped.state = 'down';
    if (byPlayer) state.addCrime(30, 'ped');
  }
}
