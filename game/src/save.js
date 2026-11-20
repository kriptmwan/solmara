// Save games: money, which missions are done, how many packages were found, and the best
// (most money ever held). One localStorage key, guarded so a blocked storage never breaks play.
import { SAVE_KEY } from './config.js';

export function loadSave() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return {
      money: typeof data.money === 'number' ? data.money : 0,
      missionsDone: Array.isArray(data.missionsDone) ? data.missionsDone.map(Boolean) : [],
      packages: typeof data.packages === 'number' ? data.packages : 0,
      best: typeof data.best === 'number' ? data.best : 0,
    };
  } catch {
    return null;
  }
}

export function saveGame(state) {
  try {
    const data = {
      money: state.player.money,
      missionsDone: state.missions.done,
      packages: state.collected,
      best: Math.max(state.best, state.player.money),
    };
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch {
    // Storage can be off (private windows): progress then lasts this visit only.
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch {
    // Nothing to do: the save was never stored.
  }
}
