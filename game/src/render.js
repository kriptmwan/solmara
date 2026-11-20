// Drawing only: the city, its cars and people, and the effects — world coordinates in, pixels
// out. The camera (centre + zoom) lives on the state; this module turns it into a transform
// and paints everything inside the view. The HUD and menus live in hud.js.
import { BEACH_X, CAR_MODELS, H_ROADS, PALETTE, ROAD_W, V_ROADS, WATER_X, WORLD } from './config.js';

const VIEW_W = 1280;
const VIEW_H = 720;

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');
  const view = { scale: 1, ox: 0, oy: 0 };

  function resize() {
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(window.innerWidth * ratio);
    canvas.height = Math.round(window.innerHeight * ratio);
    view.scale = Math.min(canvas.width / VIEW_W, canvas.height / VIEW_H);
    view.ox = (canvas.width - VIEW_W * view.scale) / 2;
    view.oy = (canvas.height - VIEW_H * view.scale) / 2;
  }
  window.addEventListener('resize', resize);
  resize();

  function inView(state, x, y, margin) {
    const cam = state.camera;
    const hw = VIEW_W / cam.zoom / 2 + (margin || 100);
    const hh = VIEW_H / cam.zoom / 2 + (margin || 100);
    return x > cam.x - hw && x < cam.x + hw && y > cam.y - hh && y < cam.y + hh;
  }

  function drawGround(state) {
    const t = state.time;
    // Base ground.
    ctx.fillStyle = PALETTE.ground;
    ctx.fillRect(0, 0, WORLD.w, WORLD.h);
    // Sea and beach on the west edge.
    ctx.fillStyle = PALETTE.waterDeep;
    ctx.fillRect(0, 0, WATER_X, WORLD.h);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(0, 0, WATER_X - 12, WORLD.h);
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 2;
    for (let y = 0; y < WORLD.h; y += 90) {
      ctx.beginPath();
      for (let x = 0; x < WATER_X - 12; x += 18) {
        const yy = y + Math.sin(x * 0.09 + t * 1.4 + y) * 4;
        if (x === 0) ctx.moveTo(x, yy);
        else ctx.lineTo(x, yy);
      }
      ctx.stroke();
    }
    ctx.fillStyle = PALETTE.sand;
    ctx.fillRect(WATER_X, 0, BEACH_X - WATER_X, WORLD.h);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(BEACH_X - 6, 0, 6, WORLD.h);

    // Parks.
    for (const park of state.world.parks) {
      ctx.fillStyle = PALETTE.park;
      ctx.fillRect(park.x, park.y, park.w, park.h);
      ctx.fillStyle = PALETTE.parkDark;
      ctx.fillRect(park.x, park.y + park.h - 14, park.w, 14);
    }

    // Sidewalks: a pale frame around every road.
    ctx.fillStyle = PALETTE.sidewalk;
    for (const vx of V_ROADS) ctx.fillRect(vx - ROAD_W / 2 - 26, 0, ROAD_W + 52, WORLD.h);
    for (const hy of H_ROADS) ctx.fillRect(0, hy - ROAD_W / 2 - 26, WORLD.w, ROAD_W + 52);
    // Roads on top.
    ctx.fillStyle = PALETTE.road;
    for (const vx of V_ROADS) ctx.fillRect(vx - ROAD_W / 2, 0, ROAD_W, WORLD.h);
    for (const hy of H_ROADS) ctx.fillRect(0, hy - ROAD_W / 2, WORLD.w, ROAD_W);

    // Lane dashes down the middle of each road, and edge lines.
    ctx.fillStyle = PALETTE.lane;
    for (const vx of V_ROADS) {
      for (let y = 0; y < WORLD.h; y += 64) ctx.fillRect(vx - 3, y, 6, 34);
    }
    for (const hy of H_ROADS) {
      for (let x = 0; x < WORLD.w; x += 64) ctx.fillRect(x, hy - 3, 34, 6);
    }
    // Crosswalks at every intersection.
    ctx.fillStyle = PALETTE.crosswalk;
    for (const vx of V_ROADS) {
      for (const hy of H_ROADS) {
        for (let i = -3; i <= 3; i += 1) {
          ctx.fillRect(vx + i * 16 - 5, hy - ROAD_W / 2 - 4, 10, 8);
          ctx.fillRect(vx + i * 16 - 5, hy + ROAD_W / 2 - 4, 10, 8);
          ctx.fillRect(vx - ROAD_W / 2 - 4, hy + i * 16 - 5, 8, 10);
          ctx.fillRect(vx + ROAD_W / 2 - 4, hy + i * 16 - 5, 8, 10);
        }
      }
    }
    // Marina docks.
    ctx.fillStyle = '#8a6f4d';
    for (const dock of state.world.docks) ctx.fillRect(dock.x, dock.y, dock.w, dock.h);
    ctx.fillStyle = '#6d5638';
    for (const dock of state.world.docks) {
      for (let x = dock.x + 12; x < dock.x + dock.w; x += 24) ctx.fillRect(x, dock.y, 3, dock.h);
    }
  }

  function drawBuildings(state) {
    for (const b of state.world.buildings) {
      if (!inView(state, b.x + b.w / 2, b.y + b.h / 2, 120)) continue;
      // A 2.5D look: a dark offset slab under the roof, as if the sun throws a shadow.
      ctx.fillStyle = 'rgba(0,0,0,0.28)';
      ctx.fillRect(b.x + b.tall * 0.45, b.y + b.tall * 0.45, b.w, b.h);
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = 'rgba(255,255,255,0.16)';
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(b.x + 6, b.y + b.h - 22, b.w - 12, 16);
      if (b.tower) {
        // Window grid on the towers.
        ctx.fillStyle = 'rgba(220,235,245,0.75)';
        for (let wy = b.y + 16; wy < b.y + b.h - 14; wy += 22) {
          for (let wx = b.x + 12; wx < b.x + b.w - 14; wx += 20) {
            ctx.fillRect(wx, wy, 10, 12);
          }
        }
      } else {
        // Rooftop clutter: vents and units.
        ctx.fillStyle = 'rgba(0,0,0,0.22)';
        ctx.fillRect(b.x + b.w * 0.2, b.y + b.h * 0.25, 14, 10);
        ctx.fillRect(b.x + b.w * 0.6, b.y + b.h * 0.55, 18, 12);
      }
      if (b.label) {
        ctx.fillStyle = '#222';
        ctx.font = 'bold 15px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const names = { bank: 'BANK', cafe: 'CAFE', garage: 'GARAGE', safehouse: 'SAFEHOUSE' };
        ctx.fillText(names[b.label] || b.label, b.x + b.w / 2, b.y + b.h / 2);
      }
    }
    // Palms and park trees.
    for (const palm of state.world.palms) {
      if (!inView(state, palm.x, palm.y, 60)) continue;
      if (palm.kind === 'tree') {
        ctx.fillStyle = '#3f7d3a';
        ctx.beginPath();
        ctx.arc(palm.x, palm.y, 20, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#57a04e';
        ctx.beginPath();
        ctx.arc(palm.x - 6, palm.y - 6, 13, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#6d4c2f';
        ctx.fillRect(palm.x - 2, palm.y + 12, 4, 12);
      } else {
        ctx.strokeStyle = '#7a5a38';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(palm.x, palm.y + 14);
        ctx.lineTo(palm.x + 3, palm.y - 12);
        ctx.stroke();
        ctx.strokeStyle = '#3f8a3a';
        ctx.lineWidth = 3;
        for (let i = 0; i < 5; i += 1) {
          const a = -Math.PI / 2 + (i - 2) * 0.55;
          ctx.beginPath();
          ctx.moveTo(palm.x + 3, palm.y - 12);
          ctx.quadraticCurveTo(palm.x + 3 + Math.cos(a) * 14, palm.y - 12 + Math.sin(a) * 10, palm.x + 3 + Math.cos(a) * 24, palm.y - 12 + Math.sin(a) * 16);
          ctx.stroke();
        }
      }
    }
    // Street lamps and decorative traffic lights at intersections.
    ctx.fillStyle = '#2e3238';
    for (const lamp of state.world.lamps) {
      if (!inView(state, lamp.x, lamp.y, 40)) continue;
      ctx.fillRect(lamp.x - 2, lamp.y - 16, 4, 16);
      ctx.fillStyle = '#ffd21f';
      ctx.beginPath();
      ctx.arc(lamp.x, lamp.y - 16, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2e3238';
    }
    for (const vx of V_ROADS) {
      for (const hy of H_ROADS) {
        if (!inView(state, vx, hy, 60)) continue;
        ctx.fillStyle = '#222';
        ctx.fillRect(vx + ROAD_W / 2 - 2, hy - ROAD_W / 2 - 26, 5, 26);
        ctx.fillStyle = state.time % 3 < 1.5 ? '#e84b3f' : '#3fb84b';
        ctx.beginPath();
        ctx.arc(vx + ROAD_W / 2 + 0.5, hy - ROAD_W / 2 - 22, 4, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  function drawCar(car, state) {
    if (!inView(state, car.x, car.y, 80)) return;
    const spec = CAR_MODELS[car.model];
    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.ellipse(3, 4, spec.len / 2, spec.wid / 2 + 2, 0, 0, Math.PI * 2);
    ctx.fill();
    // Wheels.
    ctx.fillStyle = '#16181c';
    const wl = spec.len * 0.28;
    const ww = spec.wid / 2 + 2;
    ctx.fillRect(-wl, -ww - 3, 14, 6);
    ctx.fillRect(wl - 4, -ww - 3, 14, 6);
    ctx.fillRect(-wl, ww - 3, 14, 6);
    ctx.fillRect(wl - 4, ww - 3, 14, 6);
    // Body.
    ctx.fillStyle = car.color;
    roundRect(ctx, -spec.len / 2, -spec.wid / 2, spec.len, spec.wid, 8);
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Roof and windows.
    ctx.fillStyle = 'rgba(20,30,40,0.85)';
    roundRect(ctx, -spec.len * 0.18, -spec.wid / 2 + 4, spec.len * 0.36, spec.wid - 8, 4);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(-spec.len / 2 + 6, -spec.wid / 2 + 3, 8, spec.wid - 6);
    // Model dressing.
    if (car.model === 'taxi') {
      ctx.fillStyle = '#222';
      for (let x = -spec.len / 2 + 8; x < spec.len / 2 - 8; x += 10) ctx.fillRect(x, -2, 5, 4);
      ctx.fillStyle = '#f2c200';
      ctx.fillRect(-8, -spec.wid / 2 - 4, 16, 5);
      ctx.fillStyle = '#222';
      ctx.font = 'bold 6px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('TAXI', 0, -spec.wid / 2 - 8);
    }
    if (car.model === 'sports') {
      ctx.fillStyle = 'rgba(0,0,0,0.4)';
      ctx.fillRect(-spec.len / 2 - 2, -spec.wid / 2 + 2, 5, spec.wid - 4);
      ctx.fillStyle = '#ffd21f';
      ctx.fillRect(spec.len / 2 - 8, -spec.wid / 2 + 4, 4, 3);
      ctx.fillRect(spec.len / 2 - 8, spec.wid / 2 - 7, 4, 3);
    }
    if (car.model === 'police') {
      ctx.fillStyle = '#1b2a4a';
      ctx.fillRect(-spec.len * 0.1, -spec.wid / 2, spec.len * 0.2, spec.wid);
      ctx.fillStyle = '#222';
      ctx.font = 'bold 8px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('PD', 0, 3);
      // Flashing light bar.
      const flash = Math.floor(state.time * 6) % 2 === 0;
      ctx.fillStyle = flash ? '#ff2f2f' : '#2f6bff';
      ctx.fillRect(-10, -spec.wid / 2 - 2, 8, 5);
      ctx.fillStyle = flash ? '#2f6bff' : '#ff2f2f';
      ctx.fillRect(2, -spec.wid / 2 - 2, 8, 5);
    }
    if (car.model === 'van') {
      ctx.fillStyle = 'rgba(255,255,255,0.20)';
      ctx.fillRect(-spec.len / 2 + 4, -spec.wid / 2 + 4, spec.len - 8, spec.wid - 8);
    }
    if (car.model === 'pickup') {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      ctx.fillRect(-spec.len / 2 + 4, -spec.wid / 2 + 3, spec.len * 0.34, spec.wid - 6);
    }
    // Headlights.
    ctx.fillStyle = '#fff8c0';
    ctx.fillRect(spec.len / 2 - 3, -spec.wid / 2 + 4, 3, 4);
    ctx.fillRect(spec.len / 2 - 3, spec.wid / 2 - 8, 3, 4);
    // Damage: smoke is a particle; a wrecked car darkens.
    if (car.health < 40) {
      ctx.fillStyle = 'rgba(0,0,0,0.25)';
      roundRect(ctx, -spec.len / 2, -spec.wid / 2, spec.len, spec.wid, 8);
      ctx.fill();
    }
    ctx.restore();
    // Mission car marker.
    if (car.missionCar && !car.dead) {
      const bounce = Math.sin(state.time * 4) * 4;
      ctx.fillStyle = '#ffd21f';
      ctx.beginPath();
      ctx.moveTo(car.x, car.y - 46 + bounce);
      ctx.lineTo(car.x + 10, car.y - 32 + bounce);
      ctx.lineTo(car.x, car.y - 18 + bounce);
      ctx.lineTo(car.x - 10, car.y - 32 + bounce);
      ctx.closePath();
      ctx.fill();
      ctx.strokeStyle = '#8a6d00';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
  }

  function drawPerson(x, y, angle, bob, shirt, pants, isPlayer, state) {
    if (!inView(state, x, y, 60)) return;
    ctx.save();
    ctx.translate(x, y);
    // Shadow.
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath();
    ctx.ellipse(0, 8, 10, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    const swing = Math.sin(bob) * 4;
    // Legs.
    ctx.strokeStyle = pants;
    ctx.lineWidth = 4;
    ctx.beginPath();
    ctx.moveTo(0, 2);
    ctx.lineTo(-4 + swing, 12);
    ctx.moveTo(0, 2);
    ctx.lineTo(4 - swing, 12);
    ctx.stroke();
    // Body, rotated to face the walking direction.
    ctx.rotate(angle + Math.PI / 2);
    ctx.fillStyle = shirt;
    roundRect(ctx, -7, -8, 14, 16, 5);
    ctx.fill();
    // Head.
    ctx.fillStyle = '#e8b88a';
    ctx.beginPath();
    ctx.arc(0, -12, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a2a1a';
    ctx.beginPath();
    ctx.arc(0, -14, 6, Math.PI, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    if (isPlayer) {
      // Aim line and gun when the player is armed on foot.
      const p = state.player;
      if (!p.inCar && p.aimAngle !== undefined) {
        ctx.strokeStyle = 'rgba(255,255,255,0.5)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + Math.cos(p.aimAngle) * 34, y + Math.sin(p.aimAngle) * 34);
        ctx.stroke();
        ctx.fillStyle = '#222';
        ctx.beginPath();
        ctx.arc(x + Math.cos(p.aimAngle) * 20, y + Math.sin(p.aimAngle) * 20, 3, 0, Math.PI * 2);
        ctx.fill();
        if (p.muzzleT > 0) {
          ctx.fillStyle = '#ffd21f';
          ctx.beginPath();
          ctx.arc(x + Math.cos(p.aimAngle) * 28, y + Math.sin(p.aimAngle) * 28, 7, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      if (p.swingT > 0) {
        ctx.strokeStyle = 'rgba(255,255,255,0.8)';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(x, y, 30, p.aimAngle - 0.9, p.aimAngle + 0.9);
        ctx.stroke();
      }
    }
  }

  function drawWaypoint(state) {
    const wp = state.waypoint;
    if (!wp) return;
    const p = state.player;
    const dist = Math.hypot(p.x - wp.x, p.y - wp.y);
    if (dist < 60) return;
    const bounce = Math.sin(state.time * 5) * 6;
    // A light beam so the target is visible from anywhere on screen.
    ctx.fillStyle = 'rgba(255,210,31,0.18)';
    ctx.fillRect(wp.x - 14, wp.y - 260, 28, 260);
    ctx.fillStyle = '#ffd21f';
    ctx.save();
    ctx.translate(wp.x, wp.y - 34 + bounce);
    ctx.rotate(Math.PI / 4);
    ctx.fillRect(-11, -11, 22, 22);
    ctx.restore();
    ctx.strokeStyle = '#8a6d00';
    ctx.lineWidth = 2;
    ctx.save();
    ctx.translate(wp.x, wp.y - 34 + bounce);
    ctx.rotate(Math.PI / 4);
    ctx.strokeRect(-11, -11, 22, 22);
    ctx.restore();
    ctx.fillStyle = '#ffd21f';
    ctx.font = 'bold 15px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(`${wp.label || 'Target'}  ${Math.round(dist / 50) * 5}m`, wp.x, wp.y - 72 + bounce);
  }

  function drawEffects(state) {
    // Skid marks.
    ctx.strokeStyle = 'rgba(20,20,20,0.45)';
    ctx.lineWidth = 5;
    for (const skid of state.skids) {
      if (!inView(state, skid.x, skid.y, 40)) continue;
      ctx.beginPath();
      ctx.moveTo(skid.x - Math.cos(skid.angle) * 14, skid.y - Math.sin(skid.angle) * 14);
      ctx.lineTo(skid.x + Math.cos(skid.angle) * 14, skid.y + Math.sin(skid.angle) * 14);
      ctx.stroke();
    }
    // Hidden packages glow.
    for (const pack of state.packages) {
      if (pack.taken || !inView(state, pack.x, pack.y, 60)) continue;
      const pulse = 0.6 + Math.sin(state.time * 4) * 0.3;
      ctx.fillStyle = `rgba(255,140,31,${pulse})`;
      ctx.beginPath();
      ctx.arc(pack.x, pack.y, 16, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#ff8c1f';
      ctx.fillRect(pack.x - 8, pack.y - 8, 16, 16);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 13px system-ui, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('$', pack.x, pack.y + 1);
    }
    // Bullets.
    ctx.strokeStyle = '#ffe14d';
    ctx.lineWidth = 3;
    for (const b of state.bullets) {
      ctx.beginPath();
      ctx.moveTo(b.x - b.vx * 0.02, b.y - b.vy * 0.02);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
    }
    // Particles.
    for (const part of state.parts) {
      ctx.globalAlpha = Math.max(0, part.life / part.max);
      ctx.fillStyle = part.color;
      ctx.beginPath();
      ctx.arc(part.x, part.y, part.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // Explosions.
    for (const boom of state.booms) {
      const k = boom.t / boom.life;
      ctx.fillStyle = `rgba(255,${Math.round(180 - 120 * k)},31,${0.85 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(boom.x, boom.y, boom.r * (0.4 + 0.8 * k), 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = `rgba(255,255,255,${0.7 * (1 - k)})`;
      ctx.beginPath();
      ctx.arc(boom.x, boom.y, boom.r * 0.4 * (1 - k * 0.5), 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawWorld(state) {
    const cam = state.camera;
    const scale = view.scale * cam.zoom;
    const cx = canvas.width / 2 - (cam.x + (cam.ox || 0)) * scale;
    const cy = canvas.height / 2 - (cam.y + (cam.oy || 0)) * scale;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    // Sky-coloured letterbox, then the world.
    ctx.fillStyle = '#87b5d6';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(scale, 0, 0, scale, cx, cy);
    drawGround(state);
    drawBuildings(state);
    drawWaypoint(state);
    drawEffects(state);
    // Vehicles, then people, then the player on top.
    for (const car of state.vehicles) {
      if (!car.dead) drawCar(car, state);
    }
    for (const car of state.vehicles) {
      if (car.dead) {
        // A wreck stays on the street, charred.
        ctx.save();
        ctx.translate(car.x, car.y);
        ctx.rotate(car.angle);
        ctx.fillStyle = '#2a2a2a';
        roundRect(ctx, -car.len / 2, -car.wid / 2, car.len, car.wid, 8);
        ctx.fill();
        ctx.restore();
      }
    }
    for (const ped of state.peds) {
      if (ped.health <= 0) {
        if (!inView(state, ped.x, ped.y, 40)) continue;
        ctx.fillStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(ped.x, ped.y + 4, 14, 6, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = ped.shirt;
        ctx.beginPath();
        ctx.ellipse(ped.x, ped.y, 13, 7, ped.angle, 0, Math.PI * 2);
        ctx.fill();
        continue;
      }
      drawPerson(ped.x, ped.y, ped.angle, ped.bob, ped.shirt, ped.pants, false, state);
      if (ped.state === 'fare') {
        ctx.fillStyle = '#2fbf5a';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('$', ped.x, ped.y - 30);
      }
    }
    for (const cop of state.cops) {
      drawPerson(cop.x, cop.y, cop.angle, state.time * 10, '#1b2a4a', '#1b2a4a', false, state);
      // Cop cap.
      ctx.fillStyle = '#12203a';
      ctx.beginPath();
      ctx.arc(cop.x, cop.y - 12, 6, Math.PI, Math.PI * 2);
      ctx.fill();
      if (cop.arrestT > 0.2) {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('STOP!', cop.x, cop.y - 34);
      }
    }
    const p = state.player;
    if (!p.inCar && p.health > 0) {
      drawPerson(p.x, p.y, p.angle, state.time * (p.speed > 0 ? 10 : 2), '#ff7b2f', '#2e3a4d', true, state);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  // Screen-space transform for the HUD: logical 1280x720, letterboxed.
  function beginScreenSpace() {
    ctx.setTransform(view.scale, 0, 0, view.scale, view.ox, view.oy);
  }

  return { drawWorld, beginScreenSpace, ctx, view };
}

// The camera: a smooth follow with a velocity lookahead, zooming out a little in a car, and a
// shake that decays after impacts. The renderer reads state.camera each frame.
export function updateCamera(state, dt) {
  const cam = state.camera;
  const p = state.player;
  const targetZoom = p.inCar ? 0.85 : 1.0;
  cam.zoom += (targetZoom - cam.zoom) * Math.min(1, dt * 2);
  const look = p.inCar ? 90 : 40;
  const speedK = Math.min(1, (p.speed || 0) / 200);
  const tx = p.x + Math.cos(p.angle) * look * speedK;
  const ty = p.y + Math.sin(p.angle) * look * speedK;
  cam.x += (tx - cam.x) * Math.min(1, dt * 5);
  cam.y += (ty - cam.y) * Math.min(1, dt * 5);
  if (cam.shakeT > 0) cam.shakeT -= dt;
  const mag = cam.shakeT > 0 ? cam.shakeMag * (cam.shakeT / 0.4) : 0;
  cam.ox = (Math.random() * 2 - 1) * mag;
  cam.oy = (Math.random() * 2 - 1) * mag;
}

// A tiny screen shake for impacts: sets the camera's shake magnitude and duration.
export function shakeCamera(state, mag) {
  state.camera.shakeMag = Math.max(state.camera.shakeMag || 0, mag);
  state.camera.shakeT = 0.4;
}

