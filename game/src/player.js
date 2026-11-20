// The player: on foot (walk, run, aim with the mouse, shoot, punch) and in a car (enter and
// exit with E, stealing a car is a crime unless it is empty and parked). The camera target and
// the aim angle live here too.
import { PLAYER, SPOTS } from './config.js';
import { resolveBuildings } from './world.js';
import { nearestCar } from './vehicles.js';
import { melee, shoot } from './combat.js';
import { ACTION_ENTER, ACTION_MELEE, ACTION_RELOAD } from './input.js';

export function makePlayer() {
  return {
    x: SPOTS.spawn.x, y: SPOTS.spawn.y, angle: -Math.PI / 2,
    vx: 0, vy: 0, speed: 0,
    health: PLAYER.health, money: 0,
    inCar: null, ammo: PLAYER.pistolMag, reloadT: 0, fireCd: 0,
    meleeCd: 0, swingT: 0, muzzleT: 0, aimAngle: 0,
    hurtT: 0, invulnT: 0,
  };
}

export function updatePlayer(state, dt, input, actions) {
  const p = state.player;
  if (p.hurtT > 0) p.hurtT -= dt;
  if (p.invulnT > 0) p.invulnT -= dt;

  if (p.inCar) {
    const car = p.inCar;
    p.x = car.x;
    p.y = car.y;
    p.angle = car.angle;
    p.speed = Math.abs(car.speed);
    p.aimAngle = car.angle;
    if (actions & ACTION_ENTER) {
      // Step out beside the car, on the driver's side.
      const side = car.angle + Math.PI / 2;
      p.x = car.x + Math.cos(side) * 34;
      p.y = car.y + Math.sin(side) * 34;
      resolveBuildings(state.world, p, PLAYER.radius);
      car.kind = car.missionCar ? 'mission' : (car.wasParked ? 'parked' : 'traffic');
      if (car.kind === 'traffic') car.ai.targetSpeed = 150;
      p.inCar = null;
      p.speed = 0;
    }
    return;
  }

  // On foot: WASD/arrows move, Shift runs, the mouse aims.
  const axis = input.axis();
  const len = Math.hypot(axis.x, axis.y) || 1;
  const speed = input.run() ? PLAYER.run : PLAYER.walk;
  const moving = axis.x !== 0 || axis.y !== 0;
  p.vx = (axis.x / len) * speed * (moving ? 1 : 0);
  p.vy = (axis.y / len) * speed * (moving ? 1 : 0);
  p.x += p.vx * dt;
  p.y += p.vy * dt;
  p.speed = moving ? speed : 0;
  resolveBuildings(state.world, p, PLAYER.radius);
  if (moving) p.angle = Math.atan2(p.vy, p.vx);

  // Aim at the mouse (screen space converted to world space by the caller).
  const mouse = state.mouseWorld;
  if (mouse) p.aimAngle = Math.atan2(mouse.y - p.y, mouse.x - p.x);

  if (input.mouse().down) {
    shoot(state, p.x, p.y, p.aimAngle);
  }
  if (actions & ACTION_MELEE) melee(state);
  if ((actions & ACTION_RELOAD) && p.ammo < PLAYER.pistolMag && p.reloadT <= 0) {
    p.reloadT = PLAYER.reloadTime;
  }

  if (actions & ACTION_ENTER) {
    const car = nearestCar(state, p.x, p.y, 70);
    if (car) {
      const wasParked = car.kind === 'parked';
      car.wasParked = wasParked;
      car.kind = 'player';
      p.inCar = car;
      p.x = car.x;
      p.y = car.y;
      state.stats.carsStolen += 1;
      // Stealing a car someone was driving is a crime; an empty parked car is quieter.
      if (!wasParked) state.addCrime(14, 'steal');
      else state.addCrime(4, 'steal');
      state.audio.blip();
    }
  }
}

// Hurt the player (car crash, cop ram, explosion handled elsewhere). Returns true on death.
export function hurtPlayer(state, amount) {
  const p = state.player;
  if (p.invulnT > 0) return false;
  p.health -= amount;
  p.hurtT = 0.5;
  if (p.health <= 0) {
    p.health = 0;
    state.over = 'wasted';
    return true;
  }
  return false;
}
