// The HUD and the menus, drawn in screen space (logical 1280x720): health, money, wanted
// stars, the mission objective, speed and ammo, the minimap, banners and dialogue, the title
// screen, pause, how-to-play and the WASTED / BUSTED game-over screen.
import { BEACH_X, H_ROADS, PALETTE, ROAD_W, V_ROADS, WATER_X, WORLD } from './config.js';
import { currentObjective, missionCount } from './missions.js';

const VIEW_W = 1280;
const VIEW_H = 720;

function star(x, y, size, filled, ctx) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const r = i % 2 === 0 ? size : size * 0.45;
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fillStyle = filled ? '#ffd21f' : 'rgba(255,255,255,0.25)';
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.5)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
  ctx.restore();
}

export function drawHud(ctx, state) {
  const p = state.player;
  ctx.textBaseline = 'alphabetic';

  // Top-left: health bar and money.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(16, 16, 240, 54);
  ctx.fillStyle = '#222';
  ctx.fillRect(28, 28, 150, 14);
  ctx.fillStyle = p.health > 50 ? '#3fb84b' : p.health > 25 ? '#e8a13f' : '#e84b3f';
  ctx.fillRect(28, 28, Math.max(0, 150 * (p.health / 100)), 14);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 15px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('HEALTH', 186, 41);
  ctx.fillStyle = '#7be07b';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(`$${p.money}`, 28, 62);

  // Top-right: wanted stars.
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(VIEW_W - 16 - 5 * 30 - 16, 16, 5 * 30 + 16, 44);
  for (let i = 0; i < 5; i += 1) {
    star(VIEW_W - 16 - 5 * 30 + 15 + i * 30, 38, 12, i < state.wanted, ctx);
  }

  // Top-centre: the mission objective.
  const objective = currentObjective(state);
  ctx.font = 'bold 17px system-ui, sans-serif';
  const objW = ctx.measureText(objective).width + 28;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect((VIEW_W - objW) / 2, 16, objW, 36);
  ctx.fillStyle = '#ffd21f';
  ctx.textAlign = 'center';
  ctx.fillText(objective, VIEW_W / 2, 40);

  // Bottom-right: speed and ammo.
  if (p.inCar) {
    const kmh = Math.round(Math.abs(p.inCar.speed) * 0.36);
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(VIEW_W - 176, VIEW_H - 76, 160, 60);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 30px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.fillText(`${kmh}`, VIEW_W - 56, VIEW_H - 34);
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText('km/h', VIEW_W - 28, VIEW_H - 34);
    ctx.textAlign = 'left';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillText(p.inCar.model === 'sports' ? 'Comet GT' : p.inCar.model, VIEW_W - 164, VIEW_H - 34);
    if (p.inCar.health < 40) {
      ctx.fillStyle = '#e84b3f';
      ctx.fillText('DAMAGED', VIEW_W - 164, VIEW_H - 52);
    }
  } else {
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(VIEW_W - 176, VIEW_H - 76, 160, 60);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(`Ammo  ${p.ammo} / ${12}`, VIEW_W - 164, VIEW_H - 46);
    ctx.fillStyle = p.reloadT > 0 ? '#e8a13f' : '#7be07b';
    ctx.fillText(p.reloadT > 0 ? 'Reloading\u2026' : 'Click to fire', VIEW_W - 164, VIEW_H - 26);
  }

  drawMinimap(ctx, state);

  // Robbery progress bar.
  const m = state.missions;
  if (m.active === 4 && m.step === 1) {
    const k = Math.min(1, m.stepT / 5);
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(VIEW_W / 2 - 160, 66, 320, 22);
    ctx.fillStyle = '#ffd21f';
    ctx.fillRect(VIEW_W / 2 - 158, 68, 316 * k, 18);
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('CRACKING THE VAULT\u2026', VIEW_W / 2, 82);
  }

  // Banner (mission complete, fare paid, package found).
  if (state.banner && state.banner.t > 0) {
    const a = Math.min(1, state.banner.t);
    ctx.globalAlpha = a;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(VIEW_W / 2 - 260, 150, 520, state.banner.sub ? 74 : 52);
    ctx.fillStyle = '#ffd21f';
    ctx.font = 'bold 26px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(state.banner.title, VIEW_W / 2, 182);
    if (state.banner.sub) {
      ctx.fillStyle = '#fff';
      ctx.font = '18px system-ui, sans-serif';
      ctx.fillText(state.banner.sub, VIEW_W / 2, 210);
    }
    ctx.globalAlpha = 1;
  }

  // Dialogue box at the bottom, clear of the minimap.
  if (state.dialogue && state.dialogue.t > 0) {
    ctx.fillStyle = 'rgba(10,16,28,0.85)';
    ctx.fillRect(240, VIEW_H - 150, VIEW_W - 480, 84);
    ctx.strokeStyle = '#ffd21f';
    ctx.lineWidth = 2;
    ctx.strokeRect(240, VIEW_H - 150, VIEW_W - 480, 84);
    ctx.fillStyle = '#ffd21f';
    ctx.font = 'bold 16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(state.dialogue.name, 260, VIEW_H - 122);
    ctx.fillStyle = '#fff';
    ctx.font = '17px system-ui, sans-serif';
    wrapText(ctx, state.dialogue.text, 260, VIEW_H - 98, VIEW_W - 520, 22);
  }

  // Controls hint, bottom, to the right of the minimap.
  ctx.fillStyle = 'rgba(0,0,0,0.4)';
  ctx.fillRect(240, VIEW_H - 40, 430, 24);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '13px system-ui, sans-serif';
  ctx.textAlign = 'left';
  ctx.fillText('WASD move/drive \u00b7 E enter car \u00b7 Click shoot \u00b7 F punch \u00b7 R reload \u00b7 Shift run \u00b7 Esc pause \u00b7 M mute', 248, VIEW_H - 23);

  // Damage vignette when hurt, and a red pulse at low health.
  if (p.hurtT > 0 || p.health < 30) {
    const a = p.hurtT > 0 ? p.hurtT * 0.9 : 0.22 + Math.sin(state.time * 5) * 0.08;
    const grad = ctx.createRadialGradient(VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.35, VIEW_W / 2, VIEW_H / 2, VIEW_H * 0.75);
    grad.addColorStop(0, 'rgba(200,0,0,0)');
    grad.addColorStop(1, `rgba(200,0,0,${Math.min(0.55, a)})`);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  }

  // Crosshair on foot.
  if (!p.inCar && state.mouseScreen) {
    const mx = state.mouseScreen.x;
    const my = state.mouseScreen.y;
    ctx.strokeStyle = 'rgba(255,255,255,0.9)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(mx, my, 10, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(mx - 15, my);
    ctx.lineTo(mx - 6, my);
    ctx.moveTo(mx + 6, my);
    ctx.lineTo(mx + 15, my);
    ctx.moveTo(mx, my - 15);
    ctx.lineTo(mx, my - 6);
    ctx.moveTo(mx, my + 6);
    ctx.lineTo(mx, my + 15);
    ctx.stroke();
  }
}

function wrapText(ctx, text, x, y, maxWidth, lineHeight) {
  const words = text.split(' ');
  let line = '';
  let yy = y;
  for (const word of words) {
    const test = line ? `${line} ${word}` : word;
    if (ctx.measureText(test).width > maxWidth && line) {
      ctx.fillText(line, x, yy);
      line = word;
      yy += lineHeight;
    } else {
      line = test;
    }
  }
  if (line) ctx.fillText(line, x, yy);
}

function drawMinimap(ctx, state) {
  const mw = 200;
  const mh = 150;
  const mx = 16;
  const my = VIEW_H - mh - 16;
  const sx = mw / WORLD.w;
  const sy = mh / WORLD.h;
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(mx - 4, my - 4, mw + 8, mh + 8);
  ctx.fillStyle = '#2f8fb5';
  ctx.fillRect(mx, my, mw, mh);
  ctx.fillStyle = '#ecd9a0';
  ctx.fillRect(mx + WATER_X * sx, my, (BEACH_X - WATER_X) * sx, mh);
  ctx.fillStyle = '#b3a98f';
  ctx.fillRect(mx + BEACH_X * sx, my, mw - BEACH_X * sx, mh);
  ctx.fillStyle = '#69a85c';
  for (const park of state.world.parks) {
    ctx.fillRect(mx + park.x * sx, my + park.y * sy, park.w * sx, park.h * sy);
  }
  ctx.fillStyle = '#3b4048';
  for (const vx of V_ROADS) ctx.fillRect(mx + (vx - ROAD_W / 2) * sx, my, ROAD_W * sx, mh);
  for (const hy of H_ROADS) ctx.fillRect(mx, my + (hy - ROAD_W / 2) * sy, mw, ROAD_W * sy);
  // Waypoint.
  const wp = state.waypoint;
  if (wp) {
    const pulse = 3 + Math.sin(state.time * 5) * 1.5;
    ctx.fillStyle = '#ffd21f';
    ctx.beginPath();
    ctx.arc(mx + wp.x * sx, my + wp.y * sy, pulse + 3, 0, Math.PI * 2);
    ctx.fill();
  }
  // Police blips.
  ctx.fillStyle = '#ff2f2f';
  for (const car of state.vehicles) {
    if (car.kind === 'police' && !car.dead) {
      ctx.beginPath();
      ctx.arc(mx + car.x * sx, my + car.y * sy, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (const cop of state.cops) {
    ctx.beginPath();
    ctx.arc(mx + cop.x * sx, my + cop.y * sy, 2.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Fare blip.
  if (state.fare && state.fare.state === 'wait') {
    ctx.fillStyle = '#2fbf5a';
    ctx.beginPath();
    ctx.arc(mx + state.fare.ped.x * sx, my + state.fare.ped.y * sy, 3.5, 0, Math.PI * 2);
    ctx.fill();
  }
  // Player arrow.
  const p = state.player;
  ctx.save();
  ctx.translate(mx + p.x * sx, my + p.y * sy);
  ctx.rotate(p.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -5);
  ctx.lineTo(-5, 5);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = 'rgba(255,255,255,0.6)';
  ctx.lineWidth = 1;
  ctx.strokeRect(mx - 4, my - 4, mw + 8, mh + 8);
}

// ---- Menus --------------------------------------------------------------------

function panel(ctx, title, lines, prompt, accent) {
  const w = 640;
  const h = 150 + lines.length * 34 + 70;
  const x = (VIEW_W - w) / 2;
  const y = (VIEW_H - h) / 2;
  ctx.fillStyle = 'rgba(8,14,24,0.88)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = accent || '#ffd21f';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = accent || '#ffd21f';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(title, VIEW_W / 2, y + 78);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '19px system-ui, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, VIEW_W / 2, y + 140 + i * 34);
  });
  ctx.fillStyle = '#ffd21f';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(prompt, VIEW_W / 2, y + h - 32);
}

export function drawTitle(ctx, state) {
  // Sunset gradient sky behind the logo, drawn over the live city.
  const grad = ctx.createLinearGradient(0, 0, 0, VIEW_H);
  grad.addColorStop(0, 'rgba(255,140,60,0.55)');
  grad.addColorStop(0.55, 'rgba(255,90,90,0.25)');
  grad.addColorStop(1, 'rgba(10,20,40,0.45)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  // The logo sits above the info panel, never behind it.
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 92px system-ui, sans-serif';
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 24;
  ctx.fillText('SOLMARA', VIEW_W / 2, 118);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#ffd21f';
  ctx.font = 'bold 23px system-ui, sans-serif';
  ctx.fillText('A sun-soaked open-world crime story', VIEW_W / 2, 152);
  const done = state.missions.done.filter(Boolean).length;
  const lines = [
    `Missions complete: ${done} / ${missionCount()}    \u00b7    Packages found: ${state.collected} / 10`,
    `Best fortune: $${state.best}    \u00b7    Cash on hand: $${state.player.money}`,
    'Steal cars. Outrun the Solmara PD. Run five missions for Celia, Ray and Marco.',
    'Taxi fares and hidden packages pay cash between jobs.',
  ];
  // Info panel, drawn below the logo.
  const w = 640;
  const h = 60 + lines.length * 34 + 66;
  const x = (VIEW_W - w) / 2;
  const y = 186;
  ctx.fillStyle = 'rgba(8,14,24,0.88)';
  ctx.fillRect(x, y, w, h);
  ctx.strokeStyle = '#ffd21f';
  ctx.lineWidth = 3;
  ctx.strokeRect(x, y, w, h);
  ctx.fillStyle = '#e8e8e8';
  ctx.font = '19px system-ui, sans-serif';
  lines.forEach((line, i) => {
    ctx.fillText(line, VIEW_W / 2, y + 52 + i * 34);
  });
  ctx.fillStyle = '#ffd21f';
  ctx.font = 'bold 20px system-ui, sans-serif';
  ctx.fillText(state.saveExists ? 'Enter or click: Continue' : 'Enter or click: Start', VIEW_W / 2, y + h - 26);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '15px system-ui, sans-serif';
  ctx.fillText('H: How to play', VIEW_W / 2, VIEW_H - 60);
}

export function drawHowTo(ctx) {
  panel(ctx, 'How to play', [
    'WASD / arrows \u2014 move on foot, drive in a car (W accelerate, S brake, A/D steer, Space handbrake)',
    'E \u2014 enter / exit the nearest car (stealing one raises your wanted level)',
    'Mouse aim + click \u2014 fire the pistol (R reload) \u00b7 F \u2014 punch',
    'Shift \u2014 run \u00b7 Esc \u2014 pause \u00b7 M \u2014 mute',
    'Follow the yellow waypoint: missions pay cash. Taxi fares ($) and hidden packages pay too.',
    'Wanted stars bring the Solmara PD. Stay out of sight and the heat cools off.',
    'WASTED if your health hits zero. BUSTED if a cop holds you for 1.5 seconds.',
  ], 'Enter or click: back', '#7be07b');
}

export function drawPaused(ctx) {
  panel(ctx, 'Paused', [
    'The city waits for you.',
    'Progress saves automatically after every job.',
  ], 'Esc / P: resume \u00b7 Enter: resume', '#7be07b');
}

export function drawOver(ctx, state) {
  const wasted = state.over === 'wasted';
  const title = wasted ? 'WASTED' : 'BUSTED';
  const lines = wasted
    ? ['Rico went down in the streets of Solmara.', `You kept $${state.player.money} and your mission progress.`]
    : ['The Solmara PD finally caught up with Rico.', `You kept $${state.player.money} and your mission progress.`];
  panel(ctx, title, lines, 'Enter or click: try again', wasted ? '#e84b3f' : '#4b8fd9');
}

export { PALETTE };
