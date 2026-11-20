// Combat: the pistol, the fist, bullets and their hits, explosions and the particle pool that
// everything else feeds (muzzle flash, sparks, smoke, blood, debris).
import { PLAYER } from './config.js';
import { pointInBuilding } from './world.js';
import { hitPed } from './pedestrians.js';
import { damageCar } from './vehicles.js';

const BULLET_SPEED = 900;
const BULLET_RANGE = 620;
const BULLET_DAMAGE = 34;

export function shoot(state, fromX, fromY, angle) {
  const p = state.player;
  if (p.ammo <= 0 || p.reloadT > 0 || p.fireCd > 0) return false;
  p.ammo -= 1;
  p.fireCd = 0.14; // about seven shots a second while the trigger is held
  p.muzzleT = 0.06;
  state.bullets.push({
    x: fromX + Math.cos(angle) * 22,
    y: fromY + Math.sin(angle) * 22,
    vx: Math.cos(angle) * BULLET_SPEED,
    vy: Math.sin(angle) * BULLET_SPEED,
    life: BULLET_RANGE / BULLET_SPEED,
  });
  state.events.shotAt = { x: fromX, y: fromY };
  state.audio.shot();
  state.shake(1.5);
  // A muzzle flash and a little smoke.
  for (let i = 0; i < 4; i += 1) {
    state.parts.push({ x: fromX + Math.cos(angle) * 24, y: fromY + Math.sin(angle) * 24, vx: Math.cos(angle) * 120 + state.rng.range(-30, 30), vy: Math.sin(angle) * 120 + state.rng.range(-30, 30), life: 0.12, max: 0.12, size: 3, color: '#ffd21f' });
  }
  return true;
}

export function melee(state) {
  const p = state.player;
  if (p.meleeCd > 0 || p.inCar) return;
  p.meleeCd = 0.45;
  p.swingT = 0.18;
  state.audio.melee();
  // Hit the closest ped or cop in front of the swing.
  let best = null;
  let bestD = PLAYER.meleeRange;
  for (const ped of state.peds) {
    if (ped.health <= 0) continue;
    const d = Math.hypot(ped.x - p.x, ped.y - p.y);
    if (d < bestD) {
      const dot = ((ped.x - p.x) * Math.cos(p.angle) + (ped.y - p.y) * Math.sin(p.angle)) / (d || 1);
      if (dot > 0.3) { bestD = d; best = { kind: 'ped', ent: ped }; }
    }
  }
  for (const cop of state.cops) {
    const d = Math.hypot(cop.x - p.x, cop.y - p.y);
    if (d < bestD) {
      const dot = ((cop.x - p.x) * Math.cos(p.angle) + (cop.y - p.y) * Math.sin(p.angle)) / (d || 1);
      if (dot > 0.3) { bestD = d; best = { kind: 'cop', ent: cop }; }
    }
  }
  if (best) {
    if (best.kind === 'ped') hitPed(state, best.ent, PLAYER.meleeDamage, true);
    else {
      state.cops.splice(state.cops.indexOf(best.ent), 1);
      state.addCrime(45, 'cop');
      state.shake(4);
    }
  }
}

export function explodeAt(state, x, y, radius) {
  state.booms.push({ x, y, r: radius, t: 0, life: 0.7 });
  state.audio.explosion();
  state.shake(12);
  for (let i = 0; i < 24; i += 1) {
    const a = state.rng() * Math.PI * 2;
    const s = 60 + state.rng() * 300;
    state.parts.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: 0.5 + state.rng() * 0.6, max: 1.1, size: 3 + state.rng() * 5, color: state.rng.chance(0.5) ? '#ff7b2f' : '#ffd21f' });
  }
  for (const ped of state.peds) {
    if (Math.hypot(ped.x - x, ped.y - y) < radius) ped.health = 0;
  }
  for (const car of state.vehicles) {
    if (Math.hypot(car.x - x, car.y - y) < radius + 20) damageCar(state, car, 60);
  }
  const p = state.player;
  const d = Math.hypot(p.x - x, p.y - y);
  if (d < radius && !p.inCar) {
    p.health -= 40;
    if (p.health <= 0) state.over = 'wasted';
  }
}

export function updateCombat(state, dt) {
  const p = state.player;
  if (p.reloadT > 0) {
    p.reloadT -= dt;
    if (p.reloadT <= 0) p.ammo = PLAYER.pistolMag;
  }
  if (p.meleeCd > 0) p.meleeCd -= dt;
  if (p.swingT > 0) p.swingT -= dt;
  if (p.muzzleT > 0) p.muzzleT -= dt;
  if (p.fireCd > 0) p.fireCd -= dt;

  // Bullets fly, and stop at the first thing they hit.
  for (let i = state.bullets.length - 1; i >= 0; i -= 1) {
    const b = state.bullets[i];
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.life -= dt;
    let dead = b.life <= 0;
    if (!dead && pointInBuilding(state.world, b.x, b.y, 0)) {
      dead = true;
      spark(state, b.x, b.y);
    }
    if (!dead) {
      for (const ped of state.peds) {
        if (ped.health <= 0) continue;
        if (Math.hypot(ped.x - b.x, ped.y - b.y) < 14) {
          hitPed(state, ped, BULLET_DAMAGE, true);
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (let c = 0; c < state.cops.length; c += 1) {
        const cop = state.cops[c];
        if (Math.hypot(cop.x - b.x, cop.y - b.y) < 14) {
          state.cops.splice(c, 1);
          state.addCrime(45, 'cop');
          dead = true;
          break;
        }
      }
    }
    if (!dead) {
      for (const car of state.vehicles) {
        if (car.dead) continue;
        const dx = car.x - b.x;
        const dy = car.y - b.y;
        const along = dx * Math.cos(car.angle) + dy * Math.sin(car.angle);
        const side = -dx * Math.sin(car.angle) + dy * Math.cos(car.angle);
        if (Math.abs(along) < car.len / 2 + 4 && Math.abs(side) < car.wid / 2 + 4) {
          damageCar(state, car, BULLET_DAMAGE);
          spark(state, b.x, b.y);
          dead = true;
          break;
        }
      }
    }
    if (dead) state.bullets.splice(i, 1);
  }

  // Explosions expand and fade; particles drift and die; skid marks age out.
  for (let i = state.booms.length - 1; i >= 0; i -= 1) {
    const boom = state.booms[i];
    boom.t += dt;
    if (boom.t > boom.life) state.booms.splice(i, 1);
  }
  for (let i = state.parts.length - 1; i >= 0; i -= 1) {
    const part = state.parts[i];
    part.x += part.vx * dt;
    part.y += part.vy * dt;
    part.vx *= 0.98;
    part.vy *= 0.98;
    part.life -= dt;
    if (part.life <= 0) state.parts.splice(i, 1);
  }
  for (let i = state.skids.length - 1; i >= 0; i -= 1) {
    state.skids[i].life -= dt;
    if (state.skids[i].life <= 0) state.skids.splice(i, 1);
  }
}

function spark(state, x, y) {
  for (let i = 0; i < 5; i += 1) {
    state.parts.push({ x, y, vx: state.rng.range(-120, 120), vy: state.rng.range(-120, 120), life: 0.2, max: 0.2, size: 2, color: '#ffd21f' });
  }
}
