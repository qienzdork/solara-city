// HUD: DOM elements for cash, health, wanted stars, speed, mission
// objective, banners and prompts; plus a 2D canvas minimap drawn top-down
// (roads, beach, player arrow, mission marker, police dots).

import { CITY } from './config.js';

export function createHud(doc) {
  const el = (id) => doc.getElementById(id);
  const hud = {
    cash: el('cash'),
    healthFill: el('health-fill'),
    healthText: el('health-text'),
    wanted: el('wanted'),
    speed: el('speed'),
    objective: el('objective'),
    objectiveTitle: el('objective-title'),
    objectiveText: el('objective-text'),
    objectiveDist: el('objective-dist'),
    banner: el('banner'),
    bannerTitle: el('banner-title'),
    bannerSub: el('banner-sub'),
    prompt: el('prompt'),
    minimap: el('minimap'),
    ctx: el('minimap').getContext('2d'),
    time: el('time'),
    rank: el('rank'),
    bannerTimer: null,
  };
  return {
    setCash(cash) {
      hud.cash.textContent = `$${cash.toLocaleString('en-US')}`;
    },
    setHealth(h) {
      const pct = Math.max(0, Math.round(h));
      hud.healthFill.style.width = `${pct}%`;
      hud.healthText.textContent = `${pct}`;
      hud.healthFill.style.background = pct > 50 ? '#2ecc71' : pct > 25 ? '#f39c12' : '#e74c3c';
    },
    setWanted(stars) {
      hud.wanted.textContent = '★'.repeat(stars) + '☆'.repeat(5 - stars);
      hud.wanted.style.color = stars > 0 ? '#ff4444' : '#ffd166';
    },
    setSpeed(kmh) {
      hud.speed.textContent = `${Math.round(kmh)}`;
    },
    setObjective(title, text, dist) {
      if (!title) {
        hud.objective.style.display = 'none';
        return;
      }
      hud.objective.style.display = 'block';
      hud.objectiveTitle.textContent = title;
      hud.objectiveText.textContent = text;
      hud.objectiveDist.textContent = dist === null || dist === undefined ? '' : `${Math.round(dist)}m`;
    },
    banner(title, sub) {
      hud.bannerTitle.textContent = title;
      hud.bannerSub.textContent = sub || '';
      hud.banner.classList.add('show');
      clearTimeout(hud.bannerTimer);
      hud.bannerTimer = setTimeout(() => hud.banner.classList.remove('show'), 3200);
    },
    setPrompt(text) {
      if (!text) {
        hud.prompt.style.display = 'none';
        return;
      }
      hud.prompt.style.display = 'block';
      hud.prompt.textContent = text;
    },
    setTime(minutes) {
      const h = Math.floor(minutes / 60);
      const m = Math.floor(minutes % 60);
      hud.time.textContent = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
    },
    setRank(rank) {
      hud.rank.textContent = rank;
    },
    // Top-down minimap: dark panel, streets, beach, markers.
    drawMinimap(G) {
      const ctx = hud.ctx;
      const W = hud.minimap.width;
      const H = hud.minimap.height;
      const half = CITY.bounds + 20;
      const toMap = (x, z) => [(x / half) * (W / 2) + W / 2, (z / half) * (H / 2) + H / 2];
      ctx.clearRect(0, 0, W, H);
      ctx.fillStyle = 'rgba(10, 22, 34, 0.85)';
      ctx.fillRect(0, 0, W, H);
      // beach
      const [bx0, by0] = toMap(CITY.coastX, -half);
      const [bx1, by1] = toMap(half, half);
      ctx.fillStyle = '#c2a878';
      ctx.fillRect(bx0, by0, bx1 - bx0, by1 - by0);
      // water
      ctx.fillStyle = '#1e6f8e';
      ctx.fillRect(bx1, 0, W - bx1, H);
      // streets
      ctx.strokeStyle = '#5a6b7a';
      ctx.lineWidth = 3;
      for (const s of G.city.streets) {
        const [x0, y0] = toMap(s, -half);
        const [x1, y1] = toMap(s, half);
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        const [x2, y2] = toMap(-half, s);
        const [x3, y3] = toMap(half, s);
        ctx.beginPath();
        ctx.moveTo(x2, y2);
        ctx.lineTo(x3, y3);
        ctx.stroke();
      }
      // mission marker
      if (G.missions.targetPos) {
        const [mx, my] = toMap(G.missions.targetPos.x, G.missions.targetPos.z);
        ctx.fillStyle = '#ffd166';
        ctx.beginPath();
        ctx.arc(mx, my, 5, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(mx, my, 8, 0, Math.PI * 2);
        ctx.stroke();
      }
      // police dots
      ctx.fillStyle = '#ff4444';
      for (const car of G.police.cars) {
        const [px, py] = toMap(car.pos.x, car.pos.z);
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
      }
      // player arrow
      const playerPos = G.player.inCar ? G.player.car.pos : G.player.pos;
      const heading = G.player.inCar ? G.player.car.heading : G.player.heading;
      const [px, py] = toMap(playerPos.x, playerPos.z);
      ctx.save();
      ctx.translate(px, py);
      ctx.rotate(heading);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.moveTo(0, -6);
      ctx.lineTo(4, 5);
      ctx.lineTo(-4, 5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      // north label
      ctx.fillStyle = '#9fb3c8';
      ctx.font = '10px sans-serif';
      ctx.fillText('N', W - 12, 12);
    },
  };
}
