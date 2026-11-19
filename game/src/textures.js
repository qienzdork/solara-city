// Procedural canvas textures: every texture in the game is drawn here at
// load time, so the game ships zero image files and makes zero network
// requests. `THREE` is the global from the vendored three.min.js classic
// script, loaded before this module runs.

const THREE = window.THREE;

function canvasTexture(width, height, draw, repeatX = 1, repeatY = 1) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  draw(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = 4;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

// Vertical sky gradient: deep blue zenith down to a warm hazy horizon.
export function makeSkyTexture() {
  return canvasTexture(4, 256, (ctx, w, h) => {
    const grad = ctx.createLinearGradient(0, 0, 0, h);
    grad.addColorStop(0, '#2f6fb8');
    grad.addColorStop(0.55, '#7fb2dd');
    grad.addColorStop(0.8, '#ffd9a0');
    grad.addColorStop(1, '#ffe9c4');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
}

// A building facade: warm plaster, a grid of lit and dark windows, a darker
// ground floor with a shopfront band. The same texture is reused with
// different tints per building.
export function makeBuildingTexture(rng, baseColor) {
  const texture = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = baseColor;
    ctx.fillRect(0, 0, w, h);
    // faint vertical grime
    for (let i = 0; i < 40; i++) {
      ctx.fillStyle = `rgba(0,0,0,${rng.float(0.02, 0.07)})`;
      ctx.fillRect(rng.float(0, w), 0, rng.float(2, 8), h);
    }
    // window grid
    const cols = 5;
    const rows = 8;
    const cw = w / cols;
    const ch = h / rows;
    for (let x = 0; x < cols; x++) {
      for (let y = 0; y < rows; y++) {
        const lit = rng.chance(0.35);
        ctx.fillStyle = lit ? '#ffd98a' : (rng.chance(0.5) ? '#2a3542' : '#3d4a5a');
        ctx.fillRect(x * cw + cw * 0.22, y * ch + ch * 0.2, cw * 0.56, ch * 0.55);
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.fillRect(x * cw + cw * 0.22, y * ch + ch * 0.2, cw * 0.56, ch * 0.12);
      }
    }
    // ground floor shopfront
    ctx.fillStyle = 'rgba(20,24,30,0.85)';
    ctx.fillRect(0, h - ch * 1.1, w, ch * 1.1);
    ctx.fillStyle = rng.pick(['#e86a6a', '#5aa9e6', '#7bc96f', '#e6b85a', '#b07fe6']);
    ctx.fillRect(0, h - ch * 1.1, w, 6);
  });
  return texture;
}

// Asphalt with a dashed centre line and worn edges. Tiled along the road.
export function makeRoadTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#2e3138';
    ctx.fillRect(0, 0, w, h);
    // speckle
    for (let i = 0; i < 500; i++) {
      ctx.fillStyle = `rgba(255,255,255,${Math.random() * 0.05})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
    // edge lines
    ctx.fillStyle = '#d8d8d8';
    ctx.fillRect(4, 0, 2, h);
    ctx.fillRect(w - 6, 0, 2, h);
    // centre dashes
    ctx.fillStyle = '#ffd166';
    ctx.fillRect(w / 2 - 2, 8, 4, 44);
    ctx.fillRect(w / 2 - 2, 72, 4, 44);
  }, 1, 6);
}

// Pavement slabs for sidewalks and plazas.
export function makeSidewalkTexture() {
  return canvasTexture(128, 128, (ctx, w, h) => {
    ctx.fillStyle = '#9aa0a3';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 2;
    for (let i = 0; i <= 4; i++) {
      ctx.beginPath(); ctx.moveTo(0, (i * h) / 4); ctx.lineTo(w, (i * h) / 4); ctx.stroke();
      ctx.beginPath(); ctx.moveTo((i * w) / 4, 0); ctx.lineTo((i * w) / 4, h); ctx.stroke();
    }
    for (let i = 0; i < 200; i++) {
      ctx.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  }, 8, 8);
}

// Large ground plane: dry grass and dirt patches with a warm coastal tone.
export function makeGroundTexture() {
  return canvasTexture(512, 512, (ctx, w, h) => {
    ctx.fillStyle = '#6d8a52';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 900; i++) {
      const g = Math.random();
      ctx.fillStyle = g < 0.5 ? `rgba(90,120,60,${0.2 + Math.random() * 0.3})` : `rgba(150,130,80,${0.15 + Math.random() * 0.25})`;
      const r = 4 + Math.random() * 22;
      ctx.beginPath();
      ctx.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }, 6, 6);
}

// Sand for the beach strip.
export function makeSandTexture() {
  return canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#e0c98f';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1200; i++) {
      ctx.fillStyle = `rgba(120,100,60,${Math.random() * 0.15})`;
      ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
    }
  }, 4, 2);
}

// A soft round sprite used for particles, muzzle flashes and police glow.
export function makeGlowTexture() {
  return canvasTexture(64, 64, (ctx, w, h) => {
    const grad = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
}
