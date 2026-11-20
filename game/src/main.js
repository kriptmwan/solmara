// Solmara — boot and the one loop: input is read every frame, the world advances in fixed
// 1/60 s steps (several in a slow frame, none in a fast one), and the renderer paints what is
// there. Screens: title, how-to, play, paused and game over.
//
// ?seed=N fixes the city. ?shot=cover|street|mission|title (with &seed=N) stages that scene
// instead of running the loop, paints it twice and sets window.__shotReady for a screenshot.
import { STEP } from './config.js';
import { createRandom } from './random.js';
import { buildWorld } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, createInput } from './input.js';
import { createAudio } from './audio.js';
import { loadSave, saveGame } from './save.js';
import { createRenderer, updateCamera, shakeCamera } from './render.js';
import { drawHud, drawHowTo, drawOver, drawPaused, drawTitle } from './hud.js';
import { makePlayer, updatePlayer } from './player.js';
import { seedVehicles, updateVehicles } from './vehicles.js';
import { seedPeds, updatePeds } from './pedestrians.js';
import { addCrime, updatePolice } from './police.js';
import { updateCombat } from './combat.js';
import { currentWaypoint, initPackages, startMission, updateFares, updateMissions, updatePackages } from './missions.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall (a hidden tab) is dropped. */
const MAX_FRAME = 0.25;
const VIEW_W = 1280;
const VIEW_H = 720;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const renderer = createRenderer(canvas);

// A silent audio stand-in for screenshot mode: no context, no warnings, no sound.
const silentAudio = {
  ensure() { return false; },
  update() {},
  shot() {}, melee() {}, crash() {}, explosion() {}, blip() {}, cash() {}, jingle() {}, busted() {},
  toggleMute() { return true; },
  get muted() { return true; },
};

function createState(gameSeed) {
  const rng = createRandom(gameSeed);
  const world = buildWorld(createRandom((gameSeed ^ 0x9e3779b9) >>> 0));
  const saved = loadSave();
  const state = {
    seed: gameSeed,
    rng,
    time: 0,
    screen: 'title',
    world,
    audio: createAudio(),
    player: makePlayer(),
    vehicles: [],
    peds: [],
    cops: [],
    bullets: [],
    parts: [],
    skids: [],
    booms: [],
    wanted: 0,
    heat: 0,
    lastCrimeT: -100,
    camera: { x: 1750, y: 1030, zoom: 1, shakeT: 0, shakeMag: 0, ox: 0, oy: 0 },
    missions: { done: [false, false, false, false, false], active: -1, step: 0, stepT: 0, nextAt: 0, alarm: false },
    dialogue: null,
    banner: null,
    fare: null,
    fareCd: 6,
    packages: [],
    collected: 0,
    stats: { carsStolen: 0, moneyEarned: 0 },
    events: {},
    over: null,
    best: 0,
    saveExists: false,
    waypoint: null,
    mouseWorld: null,
    mouseScreen: null,
    shotMode: false,
  };
  state.shake = (mag) => shakeCamera(state, mag);
  state.addCrime = (heat, kind) => addCrime(state, heat, kind);
  state.save = () => {
    state.best = Math.max(state.best, state.player.money);
    saveGame(state);
  };
  if (saved) {
    state.player.money = saved.money;
    for (let i = 0; i < 5; i += 1) state.missions.done[i] = Boolean(saved.missionsDone[i]);
    state.collected = saved.packages;
    state.best = saved.best;
    state.saveExists = true;
  }
  initPackages(state);
  seedVehicles(state, rng);
  seedPeds(state, rng);
  return state;
}

// One fixed step of the whole simulation, in the order the game runs it.
function stepGame(state, dt, input, actions) {
  updatePlayer(state, dt, input, actions);
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
  state.events = {};
  const p = state.player;
  if (p.inCar) state.audio.update(Math.abs(p.inCar.speed) / p.inCar.top, true, state.wanted);
  else state.audio.update(0, false, state.wanted);
  if (state.events.crash) state.audio.crash();
  if (state.over) state.screen = 'over';
}

// The title screen's backdrop: the city lives, but nobody plays.
function stepAmbient(state, dt) {
  updateVehicles(state, dt, { axis: () => ({ x: 0, y: 0 }), run: () => false, handbrake: () => false, mouse: () => ({ x: 0, y: 0, down: false }) });
  updatePeds(state, dt);
  updateCombat(state, dt);
  state.time += dt;
  updateCamera(state, dt);
  state.events = {};
}

function runShot(name) {
  const state = createState(seed);
  state.shotMode = true;
  state.audio = silentAudio;
  state.screen = stageShot(name, state);
  state.waypoint = currentWaypoint(state);
  updateCamera(state, 0);
  let painted = 0;
  function paint() {
    renderer.drawWorld(state);
    renderer.beginScreenSpace();
    if (state.screen === 'title') drawTitle(renderer.ctx, state);
    else drawHud(renderer.ctx, state);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let state = createState(seed);
  // A read-only handle for automated play-testing (used by the entry's own checks).
  Object.defineProperty(window, '__solmara', { get() { return state; }, configurable: true });
  let screen = 'title';
  let showHowTo = false;
  let accumulator = 0;
  let last = performance.now();

  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    state = createState(seed);
    state.screen = 'play';
    screen = 'play';
    showHowTo = false;
    accumulator = 0;
    const next = state.missions.done.findIndex((d) => !d);
    if (next !== -1) startMission(state, next);
    announce('Playing. Follow the yellow waypoint.');
  }

  function retryAfterOver() {
    const p = state.player;
    p.health = 100;
    p.x = 1100;
    p.y = 2450;
    p.angle = 0;
    if (p.inCar) {
      p.inCar.kind = 'traffic';
      p.inCar = null;
    }
    state.cops = [];
    state.heat = 0;
    state.wanted = 0;
    state.over = null;
    state.screen = 'play';
    screen = 'play';
    state.save();
    announce('Back on the streets.');
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      state.audio.ensure();
      const muted = state.audio.toggleMute();
      announce(muted ? 'Muted.' : 'Sound on.');
    }
    if (screen === 'title') {
      if (actions & ACTION_CONFIRM) startGame();
      else if (input.down('KeyH')) {
        showHowTo = !showHowTo;
        announce(showHowTo ? 'How to play.' : 'Title screen.');
      }
      return;
    }
    if (screen === 'play' && (actions & ACTION_PAUSE)) {
      screen = 'paused';
      state.screen = 'paused';
      announce('Paused.');
      return;
    }
    if (screen === 'paused' && (actions & (ACTION_PAUSE | ACTION_CONFIRM))) {
      screen = 'play';
      state.screen = 'play';
      announce('Playing.');
      return;
    }
    if (screen === 'over' && (actions & ACTION_CONFIRM)) retryAfterOver();
    state.pendingActions = actions;
  }

  function updateMouseWorld() {
    const rect = canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    const m = input.mouse();
    const view = renderer.view;
    const lx = (m.x * ratio - view.ox) / view.scale;
    const ly = (m.y * ratio - view.oy) / view.scale;
    state.mouseScreen = { x: lx, y: ly };
    const cam = state.camera;
    state.mouseWorld = { x: cam.x + (lx - VIEW_W / 2) / cam.zoom, y: cam.y + (ly - VIEW_H / 2) / cam.zoom };
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    updateMouseWorld();
    const actions = state.pendingActions || 0;
    state.pendingActions = 0;
    if (screen === 'play') {
      // One-shot actions (enter a car, reload, melee) run on the first step of the frame only:
      // passing them to every catch-up step would toggle them several times per press.
      let firstStep = true;
      while (accumulator >= STEP) {
        stepGame(state, STEP, input, firstStep ? actions : 0);
        firstStep = false;
        accumulator -= STEP;
        if (state.screen === 'over') {
          screen = 'over';
          state.save();
          announce(state.over === 'wasted' ? 'Wasted.' : 'Busted.');
          break;
        }
      }
    } else if (screen === 'title') {
      while (accumulator >= STEP) {
        stepAmbient(state, STEP);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.drawWorld(state);
    renderer.beginScreenSpace();
    if (screen === 'title') {
      if (showHowTo) drawHowTo(renderer.ctx);
      else drawTitle(renderer.ctx, state);
    } else if (screen === 'play') {
      drawHud(renderer.ctx, state);
    } else if (screen === 'paused') {
      drawHud(renderer.ctx, state);
      drawPaused(renderer.ctx);
    } else if (screen === 'over') {
      drawHud(renderer.ctx, state);
      drawOver(renderer.ctx, state);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === 'play') {
      screen = 'paused';
      state.screen = 'paused';
      announce('Paused.');
    }
  });

  announce('Solmara. Press Enter or click to start.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
