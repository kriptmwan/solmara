// Screenshot staging: each named shot plays the real game forward from a fresh world for a
// fixed number of steps, steered by a scripted input, so the frame is what a short game really
// looks like and the same seed always gives the same frame. The loop paints twice afterwards
// and sets window.__shotReady.
import { STEP } from './config.js';
import { updateCamera } from './render.js';
import { updatePlayer } from './player.js';
import { makeCar, updateVehicles } from './vehicles.js';
import { updatePeds } from './pedestrians.js';
import { updatePolice } from './police.js';
import { updateCombat } from './combat.js';
import { currentWaypoint, startMission, updateFares, updateMissions, updatePackages } from './missions.js';

// A scripted stand-in for the real input: holds the given keys and never clicks.
function scriptedInput(hold) {
  return {
    axis() { return { x: hold.x || 0, y: hold.y || 0 }; },
    run() { return false; },
    handbrake() { return false; },
    mouse() { return { x: 640, y: 360, down: false }; },
    takeClick() { return false; },
    takeActions() { return 0; },
  };
}

// One fixed step of the whole simulation, in the same order as the live loop.
function stepGame(state, dt, input) {
  updatePlayer(state, dt, input, 0);
  updateVehicles(state, dt, input);
  updatePeds(state, dt);
  updatePolice(state, dt);
  updateCombat(state, dt);
  updateMissions(state, dt);
  updateFares(state, dt);
  updatePackages(state);
  state.time += dt;
  if (state.banner && state.banner.t > 0) state.banner.t -= dt;
  if (state.dialogue && state.dialogue.t > 0) state.dialogue.t -= dt;
  updateCamera(state, dt);
  state.waypoint = currentWaypoint(state);
  state.mouseWorld = { x: state.player.x + 200, y: state.player.y };
  state.mouseScreen = { x: 640, y: 360 };
}

function runSteps(state, seconds, hold) {
  const input = scriptedInput(hold);
  for (let i = 0; i < seconds / STEP; i += 1) stepGame(state, STEP, input);
}

function putPlayerInCar(state, car, x, y, angle, speed) {
  car.x = x;
  car.y = y;
  car.angle = angle;
  car.speed = speed;
  car.kind = 'player';
  state.player.inCar = car;
  state.player.x = x;
  state.player.y = y;
  state.player.angle = angle;
}

// Set `state` to the named scene and return the screen to draw over it.
export function stageShot(name, state) {
  const rng = state.rng;
  if (name === 'cover') {
    // A police chase downtown: Rico in the Comet GT, 3 stars, cruisers closing in, and the
    // mission objective on the HUD.
    startMission(state, 1);
    state.missions.step = 2; // delivering the Comet GT to Ray's garage
    const comet = state.vehicles.find((c) => c.missionCar);
    putPlayerInCar(state, comet, 2050, 1450, 0, 320);
    state.heat = 55;
    state.wanted = 3;
    state.lastCrimeT = state.time;
    // Two cruisers already on his tail, one ahead cutting across.
    const c1 = makeCar('police', 1850, 1450, 0, 'police');
    c1.chasing = true;
    c1.speed = 380;
    const c2 = makeCar('police', 1900, 1386, 0, 'police');
    c2.chasing = true;
    c2.speed = 360;
    state.vehicles.push(c1, c2);
    state.dialogue = null;
    state.banner = null;
    runSteps(state, 2.2, { x: 0, y: -1 });
    return 'play';
  }
  if (name === 'street') {
    // On foot on the boulevard by Celia's cafe: traffic rolling past, pedestrians on the
    // sidewalks, the city alive around the player.
    startMission(state, 0);
    state.player.x = 1680;
    state.player.y = 1040;
    state.player.angle = 0;
    runSteps(state, 4, { x: 1, y: 0 });
    return 'play';
  }
  if (name === 'mission') {
    // The Pickup at the docks: Rico in a sedan on the coast road, the waypoint beam on the
    // package, the ambush already landing — two stars and cruisers closing in.
    startMission(state, 2);
    state.missions.step = 1;
    state.banner = null;
    const sedan = state.vehicles.find((c) => c.model === 'sedan' && c.kind === 'traffic')
      || state.vehicles.find((c) => c.kind === 'traffic');
    putPlayerInCar(state, sedan, 950, 2450, Math.PI, 320);
    runSteps(state, 2.0, { x: 0, y: -1 });
    return 'play';
  }
  // Title: the city alive behind the logo.
  runSteps(state, 5, { x: 0, y: 0 });
  return 'title';
}
