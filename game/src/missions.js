// Missions, taxi fares and hidden packages: the story and the side work of Solmara.
// Five missions run as a chain — each one starts when the last ends — and every step is a
// small goal (go somewhere, steal a car, deliver it, lose the cops, hold a robbery) with a
// waypoint on the map and the HUD. Fares and packages pay cash between missions.
import { ECONOMY, PACKAGE_SPOTS, SPOTS } from './config.js';
import { randomSidewalkPoint } from './world.js';

const MISSION_DEFS = [
  {
    name: 'Welcome Back', giver: 'Celia',
    intro: 'Rico! You\u2019re back in Solmara. Come see me at the cafe \u2014 I\u2019ve got work for you.',
    steps: [
      { type: 'goto', wp: SPOTS.cafe, radius: 80, text: 'Drive to Celia\u2019s Cafe' },
    ],
  },
  {
    name: 'Wheels Up', giver: 'Ray',
    intro: 'There\u2019s a Comet GT sitting at the marina. Bring it to my garage. Quietly, yeah?',
    steps: [
      { type: 'goto', wp: SPOTS.marinaCar, radius: 90, text: 'Go to the marina' },
      { type: 'enterCar', wp: SPOTS.marinaCar, radius: 90, text: 'Steal the Comet GT (E to enter)' },
      { type: 'deliver', wp: SPOTS.garage, radius: 80, text: 'Deliver the Comet GT to Ray\u2019s Garage' },
      { type: 'loseCops', wp: null, radius: 0, text: 'Lose the cops \u2014 stay out of sight' },
    ],
  },
  {
    name: 'The Pickup', giver: 'Marco',
    intro: 'Package is waiting at the docks. Grab it and don\u2019t stop for anyone.',
    steps: [
      { type: 'goto', wp: SPOTS.docks, radius: 80, text: 'Collect the package at the docks' },
      { type: 'escape', wp: SPOTS.garage, radius: 80, text: 'Ambush! Escape to Ray\u2019s Garage' },
    ],
  },
  {
    name: 'Heat Wave', giver: 'Celia',
    intro: 'The whole city is hot, Rico. Get to the safehouse and lay low till it cools off.',
    steps: [
      { type: 'goto', wp: SPOTS.safehouse, radius: 80, text: 'Reach the safehouse \u2014 3 stars on you' },
    ],
  },
  {
    name: 'The Big One', giver: 'Ray',
    intro: 'The bank. Five seconds at the vault door, then run for the boat. Don\u2019t get cute.',
    steps: [
      { type: 'goto', wp: SPOTS.bank, radius: 90, text: 'Go to Solmara National Bank' },
      { type: 'rob', wp: SPOTS.bank, radius: 110, text: 'Hold at the bank doors \u2014 cracking the vault' },
      { type: 'escape', wp: SPOTS.boat, radius: 80, text: 'Escape to the boat at the marina!' },
    ],
  },
];

export function missionCount() {
  return MISSION_DEFS.length;
}

export function missionName(index) {
  return MISSION_DEFS[index].name;
}

export function startMission(state, index) {
  const def = MISSION_DEFS[index];
  state.missions.active = index;
  state.missions.step = 0;
  state.missions.stepT = 0;
  state.missions.nextAt = 0;
  state.dialogue = { name: def.giver, text: def.intro, t: 6 };
  state.banner = { title: def.name, sub: `Mission ${index + 1} of ${MISSION_DEFS.length}`, t: 3 };
  if (index === 3) {
    // Heat Wave opens with the whole city after the player.
    state.heat = Math.max(state.heat, 55);
    state.wanted = 3;
    state.lastCrimeT = state.time;
  }
}

function stepDone(state, step) {
  const p = state.player;
  switch (step.type) {
    case 'goto':
    case 'collect':
    case 'escape': {
      const d = Math.hypot(p.x - step.wp.x, p.y - step.wp.y);
      return d < step.radius;
    }
    case 'enterCar': {
      const comet = state.vehicles.find((c) => c.missionCar);
      return p.inCar === comet;
    }
    case 'deliver': {
      const comet = state.vehicles.find((c) => c.missionCar);
      if (p.inCar !== comet) return false;
      return Math.hypot(p.x - step.wp.x, p.y - step.wp.y) < step.radius;
    }
    case 'loseCops':
      return state.wanted === 0;
    case 'rob': {
      const d = Math.hypot(p.x - step.wp.x, p.y - step.wp.y);
      if (d < step.radius) {
        state.missions.stepT += 1 / 60;
        if (state.missions.stepT > 5) return true;
      } else {
        state.missions.stepT = Math.max(0, state.missions.stepT - 1 / 30);
      }
      return false;
    }
    default:
      return false;
  }
}

function completeMission(state, index) {
  const pay = ECONOMY.missionPay[index];
  state.player.money += pay;
  state.stats.moneyEarned += pay;
  state.missions.done[index] = true;
  state.missions.active = -1;
  state.banner = { title: 'Mission Complete', sub: `${MISSION_DEFS[index].name}  \u2014  $${pay}`, t: 4 };
  state.audio.jingle();
  state.audio.cash();
  // The next mission in the chain starts after a short breather.
  if (index + 1 < MISSION_DEFS.length) state.missions.nextAt = state.time + 4;
  state.save();
}

export function updateMissions(state, dt) {
  const m = state.missions;
  if (m.active === -1) {
    if (m.nextAt > 0 && state.time >= m.nextAt) {
      m.nextAt = 0;
      startMission(state, m.done.findIndex((d) => !d));
    }
    return;
  }
  const def = MISSION_DEFS[m.active];
  const step = def.steps[m.step];
  if (!step) {
    completeMission(state, m.active);
    return;
  }
  // Stealing the Comet GT trips the alarm: the cops come.
  if (m.active === 1 && m.step === 1 && state.player.inCar && state.player.inCar.missionCar && !m.alarm) {
    m.alarm = true;
    state.heat = Math.max(state.heat, 32);
    state.wanted = 2;
    state.lastCrimeT = state.time;
  }
  // The docks ambush: grabbing the package brings the heat.
  if (m.active === 2 && m.step === 1 && !m.alarm) {
    m.alarm = true;
    state.heat = Math.max(state.heat, 32);
    state.wanted = 2;
    state.lastCrimeT = state.time;
    state.dialogue = { name: 'Marco', text: 'It\u2019s a setup! Run!', t: 4 };
  }
  // The bank job: finishing the robbery maxes the heat.
  if (m.active === 4 && m.step === 2 && !m.alarm) {
    m.alarm = true;
    state.heat = Math.max(state.heat, 80);
    state.wanted = 4;
    state.lastCrimeT = state.time;
  }
  if (stepDone(state, step)) {
    m.step += 1;
    m.stepT = 0;
    m.alarm = false;
    if (m.step >= def.steps.length) completeMission(state, m.active);
    else state.audio.blip();
  }
}

export function currentObjective(state) {
  const m = state.missions;
  if (m.active === -1) {
    const next = m.done.findIndex((d) => !d);
    if (next === -1) return 'All missions complete \u2014 Solmara is yours, Rico.';
    return `Next mission: ${MISSION_DEFS[next].name} \u2014 starting soon`;
  }
  const step = MISSION_DEFS[m.active].steps[m.step];
  if (!step) return MISSION_DEFS[m.active].name;
  return `${MISSION_DEFS[m.active].name}: ${step.text}`;
}

export function currentWaypoint(state) {
  const m = state.missions;
  if (m.active === -1) {
    if (state.fare && state.fare.state === 'ride') return state.fare.dest;
    if (state.fare && state.fare.state === 'wait') return { x: state.fare.ped.x, y: state.fare.ped.y, label: 'Fare' };
    return null;
  }
  const step = MISSION_DEFS[m.active].steps[m.step];
  if (!step || !step.wp) {
    if (state.fare && state.fare.state === 'ride') return state.fare.dest;
    return null;
  }
  return { x: step.wp.x, y: step.wp.y, label: step.wp.label || MISSION_DEFS[m.active].name };
}

// ---- Taxi fares -------------------------------------------------------------

export function updateFares(state, dt) {
  const p = state.player;
  if (!state.fare) {
    state.fareCd -= dt;
    if (state.fareCd <= 0 && p.inCar && state.missions.active === -1) {
      // Offer a fare: a waiting pedestrian near a road, flagged with a $ marker.
      const candidates = state.peds.filter((ped) => ped.health > 0 && ped.state === 'walk'
        && Math.hypot(ped.x - p.x, ped.y - p.y) < 900);
      if (candidates.length > 0) {
        const ped = candidates[Math.floor(state.rng() * candidates.length)];
        ped.state = 'fare';
        const dest = randomSidewalkPoint(state.rng);
        state.fare = { ped, dest: { x: dest.x, y: dest.y, label: 'Drop-off' }, state: 'wait', t: 0 };
      }
    }
    return;
  }
  const fare = state.fare;
  if (fare.state === 'wait') {
    fare.t += dt;
    if (fare.ped.health <= 0) {
      state.fare = null;
      state.fareCd = 8;
      return;
    }
    if (p.inCar && Math.hypot(p.x - fare.ped.x, p.y - fare.ped.y) < 70) {
      fare.state = 'ride';
      state.peds.splice(state.peds.indexOf(fare.ped), 1);
      state.dialogue = { name: 'Fare', text: 'Take me across town, quick as you can.', t: 3 };
      state.audio.blip();
    } else if (fare.t > 60) {
      fare.ped.state = 'walk';
      state.fare = null;
      state.fareCd = 10;
    }
  } else {
    const d = Math.hypot(p.x - fare.dest.x, p.y - fare.dest.y);
    if (p.inCar && d < 70) {
      const pay = state.rng.int(ECONOMY.fareMin, ECONOMY.fareMax);
      p.money += pay;
      state.stats.moneyEarned += pay;
      state.banner = { title: `Fare complete \u2014 $${pay}`, sub: '', t: 2.5 };
      state.audio.cash();
      state.fare = null;
      state.fareCd = 8;
      state.save();
    } else if (!p.inCar) {
      // The fare leaves if the player abandons the car.
      state.fare = null;
      state.fareCd = 12;
    }
  }
}

// ---- Hidden packages ----------------------------------------------------------

export function initPackages(state) {
  state.packages = PACKAGE_SPOTS.map((spot) => ({ x: spot.x, y: spot.y, taken: false }));
  state.collected = 0;
}

export function updatePackages(state) {
  const p = state.player;
  for (const pack of state.packages) {
    if (pack.taken) continue;
    if (Math.hypot(p.x - pack.x, p.y - pack.y) < 44) {
      pack.taken = true;
      state.collected += 1;
      p.money += ECONOMY.packagePay;
      state.stats.moneyEarned += ECONOMY.packagePay;
      state.banner = { title: `Hidden package ${state.collected}/10`, sub: `+$${ECONOMY.packagePay}`, t: 2.5 };
      state.audio.cash();
      state.save();
    }
  }
}
