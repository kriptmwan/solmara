// The Solmara PD: the wanted system, foot cops who chase and arrest, and cruisers that chase
// and ram. Wanted heat rises with crimes and decays when nobody is watching; stars follow heat.
import { WANTED } from './config.js';
import { driveToward, makeCar } from './vehicles.js';
import { resolveBuildings, snapToRoad } from './world.js';

export function starsFor(heat) {
  let stars = 0;
  for (let i = 0; i < WANTED.stars.length; i += 1) {
    if (heat >= WANTED.stars[i]) stars = i;
  }
  return Math.min(5, stars);
}

export function addCrime(state, heat, kind) {
  state.heat = Math.min(100, state.heat + heat);
  state.lastCrimeT = state.time;
  state.wanted = starsFor(state.heat);
  if (kind === 'steal' || kind === 'ped' || kind === 'cop') {
    state.events.crime = true;
  }
}

function makeFootCop(state, x, y) {
  return {
    x, y, angle: 0, speed: 265, arrestT: 0, state: 'chase',
  };
}

function spawnFootCop(state, rng) {
  const p = state.player;
  const a = rng.range(0, Math.PI * 2);
  const pos = snapToRoad(p.x + Math.cos(a) * 700, p.y + Math.sin(a) * 700);
  state.cops.push(makeFootCop(state, pos.x, pos.y));
}

function spawnCruiser(state, rng) {
  const p = state.player;
  const a = rng.range(0, Math.PI * 2);
  const pos = snapToRoad(p.x + Math.cos(a) * 850, p.y + Math.sin(a) * 850);
  const car = makeCar('police', pos.x, pos.y, Math.atan2(p.y - pos.y, p.x - pos.x), 'police');
  car.chasing = true;
  state.vehicles.push(car);
}

export function updatePolice(state, dt) {
  const rng = state.rng;
  const p = state.player;
  // Wanted decays when the player has been quiet and no cop is close.
  const copNear = state.cops.some((c) => Math.hypot(c.x - p.x, c.y - p.y) < 520)
    || state.vehicles.some((c) => c.kind === 'police' && !c.dead && Math.hypot(c.x - p.x, c.y - p.y) < 560);
  if (state.time - state.lastCrimeT > 8 && !copNear && state.heat > 0) {
    state.heat = Math.max(0, state.heat - WANTED.decayPerSec * dt);
    state.wanted = starsFor(state.heat);
  }

  const wanted = state.wanted;
  // Foot cops: one per star up to the cap, only while the player is on foot.
  const wantCops = wanted > 0 && !p.inCar ? Math.min(wanted, WANTED.maxFootCops) : 0;
  while (state.cops.length < wantCops) spawnFootCop(state, rng);
  while (state.cops.length > wantCops) state.cops.pop();

  // Cruisers: one per star up to the cap, whenever wanted.
  let cruisers = 0;
  for (const car of state.vehicles) if (car.kind === 'police' && !car.dead) cruisers += 1;
  const wantCruisers = wanted > 0 ? Math.min(wanted, WANTED.maxCruisers) : 0;
  for (let i = cruisers; i < wantCruisers; i += 1) spawnCruiser(state, rng);

  // Foot cops chase; touching the player on foot for ~1.5 s is an arrest.
  for (const cop of state.cops) {
    const d = Math.hypot(p.x - cop.x, p.y - cop.y);
    const want = Math.atan2(p.y - cop.y, p.x - cop.x);
    let diff = want - cop.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    cop.angle += Math.max(-4 * dt, Math.min(4 * dt, diff));
    const speed = d < 60 ? cop.speed * 0.4 : cop.speed;
    cop.x += Math.cos(cop.angle) * speed * dt;
    cop.y += Math.sin(cop.angle) * speed * dt;
    resolveBuildings(state.world, cop, 13);
    if (d < 34) {
      cop.arrestT += dt;
      if (cop.arrestT > 1.5) {
        state.over = 'busted';
        state.audio.busted();
      }
    } else {
      cop.arrestT = Math.max(0, cop.arrestT - dt * 2);
    }
  }

  // Cruisers chase the player and ram.
  for (const car of state.vehicles) {
    if (car.kind !== 'police' || car.dead) continue;
    car.chasing = wanted > 0;
    if (!car.chasing) continue;
    const target = p.inCar ? p.inCar : p;
    driveToward(car, target.x, target.y, dt, car.top * (0.85 + wanted * 0.03), state);
    // Ramming the player's car damages it; ramming the player on foot hurts.
    const d = Math.hypot(car.x - p.x, car.y - p.y);
    if (p.inCar) {
      const dc = Math.hypot(car.x - p.inCar.x, car.y - p.inCar.y);
      if (dc < 48 && Math.abs(car.speed) > 120) {
        car.speed *= 0.5;
        p.inCar.speed *= 0.85;
        p.inCar.health -= 4;
        state.events.crash = true;
        state.shake(5);
      }
    } else if (d < 30 && Math.abs(car.speed) > 90) {
      p.health -= 18;
      car.speed *= 0.4;
      state.shake(8);
      state.events.crash = true;
      if (p.health <= 0) state.over = 'wasted';
    }
  }
}
