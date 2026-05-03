const canvas = document.querySelector('#game');
const ctx = canvas.getContext('2d');
const scoreEl = document.querySelector('#score');
const statusEl = document.querySelector('#status');

const W = canvas.width;
const H = canvas.height;
const keys = new Set();
const rand = (min, max) => Math.random() * (max - min) + min;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

const state = {
  playing: true,
  score: 0,
  best: Number(localStorage.getItem('meteor-muncher-best') || 0),
  time: 0,
  shake: 0,
  stars: [],
  meteors: [],
  particles: [],
  player: { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 17, angle: 0 }
};

function reset() {
  state.playing = true;
  state.score = 0;
  state.time = 0;
  state.shake = 0;
  state.stars = [];
  state.meteors = [];
  state.particles = [];
  state.player = { x: W / 2, y: H / 2, vx: 0, vy: 0, r: 17, angle: 0 };
  for (let i = 0; i < 8; i++) spawnStar();
  for (let i = 0; i < 4; i++) spawnMeteor();
  statusEl.textContent = 'Collect 10 stars to wake the comet storm.';
}

function spawnStar() {
  state.stars.push({
    x: rand(40, W - 40),
    y: rand(40, H - 40),
    r: rand(7, 11),
    pulse: rand(0, Math.PI * 2)
  });
}

function spawnMeteor() {
  const side = Math.floor(rand(0, 4));
  const speed = rand(1.2, 2.6) + state.score * 0.035;
  const meteor = {
    x: side === 0 ? -40 : side === 1 ? W + 40 : rand(0, W),
    y: side === 2 ? -40 : side === 3 ? H + 40 : rand(0, H),
    r: rand(14, 32),
    spin: rand(-0.04, 0.04),
    angle: rand(0, Math.PI * 2)
  };
  const targetX = state.player.x + rand(-160, 160);
  const targetY = state.player.y + rand(-120, 120);
  const dx = targetX - meteor.x;
  const dy = targetY - meteor.y;
  const len = Math.hypot(dx, dy) || 1;
  meteor.vx = (dx / len) * speed;
  meteor.vy = (dy / len) * speed;
  state.meteors.push(meteor);
}

function burst(x, y, color, count = 16) {
  for (let i = 0; i < count; i++) {
    const a = rand(0, Math.PI * 2);
    const s = rand(0.8, 4.8);
    state.particles.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s, life: rand(24, 46), color });
  }
}

function inputVector() {
  let ax = 0;
  let ay = 0;
  if (keys.has('arrowleft') || keys.has('a')) ax--;
  if (keys.has('arrowright') || keys.has('d')) ax++;
  if (keys.has('arrowup') || keys.has('w')) ay--;
  if (keys.has('arrowdown') || keys.has('s')) ay++;
  const len = Math.hypot(ax, ay) || 1;
  return { x: ax / len, y: ay / len };
}

function update() {
  state.time++;
  if (!state.playing) return;

  const p = state.player;
  const input = inputVector();
  const boost = keys.has(' ');
  const accel = boost ? 0.58 : 0.34;
  p.vx += input.x * accel;
  p.vy += input.y * accel;
  p.vx *= 0.94;
  p.vy *= 0.94;
  const topSpeed = boost ? 8.4 : 5.8;
  const speed = Math.hypot(p.vx, p.vy);
  if (speed > topSpeed) {
    p.vx = (p.vx / speed) * topSpeed;
    p.vy = (p.vy / speed) * topSpeed;
  }
  p.x = clamp(p.x + p.vx, p.r, W - p.r);
  p.y = clamp(p.y + p.vy, p.r, H - p.r);
  p.angle = Math.atan2(p.vy, p.vx);

  for (const meteor of state.meteors) {
    meteor.x += meteor.vx;
    meteor.y += meteor.vy;
    meteor.angle += meteor.spin;
    if (meteor.x < -90 || meteor.x > W + 90 || meteor.y < -90 || meteor.y > H + 90) {
      Object.assign(meteor, state.meteors.pop());
      spawnMeteor();
    }
  }

  for (let i = state.stars.length - 1; i >= 0; i--) {
    const star = state.stars[i];
    star.pulse += 0.07;
    if (Math.hypot(p.x - star.x, p.y - star.y) < p.r + star.r + 4) {
      state.stars.splice(i, 1);
      state.score++;
      scoreEl.textContent = state.score;
      burst(star.x, star.y, '#ffe66d', 22);
      spawnStar();
      if (state.score % 4 === 0) spawnMeteor();
      if (state.score === 10) statusEl.textContent = 'Comet storm awake. Survive as long as you can!';
    }
  }

  for (const meteor of state.meteors) {
    if (Math.hypot(p.x - meteor.x, p.y - meteor.y) < p.r + meteor.r * 0.78) {
      gameOver();
      break;
    }
  }

  for (let i = state.particles.length - 1; i >= 0; i--) {
    const part = state.particles[i];
    part.x += part.vx;
    part.y += part.vy;
    part.vx *= 0.98;
    part.vy *= 0.98;
    part.life--;
    if (part.life <= 0) state.particles.splice(i, 1);
  }

  if (state.time % Math.max(28, 90 - state.score * 2) === 0) spawnMeteor();
  state.shake *= 0.86;
}

function gameOver() {
  state.playing = false;
  state.shake = 18;
  burst(state.player.x, state.player.y, '#ff5d73', 48);
  state.best = Math.max(state.best, state.score);
  localStorage.setItem('meteor-muncher-best', String(state.best));
  statusEl.textContent = `Game over. Score ${state.score}. Best ${state.best}. Press Enter to retry.`;
}

function drawStar(x, y, r, phase) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(phase * 0.5);
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? r * (1.15 + Math.sin(phase) * 0.12) : r * 0.48;
    const a = (i / 10) * Math.PI * 2 - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * radius, Math.sin(a) * radius);
  }
  ctx.closePath();
  ctx.fillStyle = '#ffe66d';
  ctx.shadowColor = '#ffe66d';
  ctx.shadowBlur = 18;
  ctx.fill();
  ctx.restore();
}

function drawMeteor(m) {
  ctx.save();
  ctx.translate(m.x, m.y);
  ctx.rotate(m.angle);
  ctx.fillStyle = '#7d6174';
  ctx.strokeStyle = '#ff9f6e';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let i = 0; i < 11; i++) {
    const a = (i / 11) * Math.PI * 2;
    const jag = 0.78 + ((i * 37) % 10) / 28;
    ctx.lineTo(Math.cos(a) * m.r * jag, Math.sin(a) * m.r * jag);
  }
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function drawPlayer() {
  const p = state.player;
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate(p.angle || 0);
  ctx.shadowColor = '#8ff6ff';
  ctx.shadowBlur = 24;
  ctx.fillStyle = '#8ff6ff';
  ctx.beginPath();
  ctx.ellipse(0, 0, 22, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#2d1f65';
  ctx.beginPath();
  ctx.arc(5, -5, 8, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.arc(8, -7, 2, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ff5d73';
  ctx.beginPath();
  ctx.moveTo(-19, -7);
  ctx.lineTo(-34 - Math.random() * 7, 0);
  ctx.lineTo(-19, 7);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function draw() {
  const sx = rand(-state.shake, state.shake);
  const sy = rand(-state.shake, state.shake);
  ctx.clearRect(0, 0, W, H);
  ctx.save();
  ctx.translate(sx, sy);

  const gradient = ctx.createLinearGradient(0, 0, W, H);
  gradient.addColorStop(0, '#070716');
  gradient.addColorStop(0.55, '#151032');
  gradient.addColorStop(1, '#05040d');
  ctx.fillStyle = gradient;
  ctx.fillRect(-30, -30, W + 60, H + 60);

  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  for (let i = 0; i < 90; i++) {
    const x = (i * 97 + state.time * (i % 5)) % W;
    const y = (i * 53 + Math.sin(state.time / 70 + i) * 10) % H;
    ctx.fillRect(x, y, i % 3 === 0 ? 2 : 1, i % 3 === 0 ? 2 : 1);
  }

  for (const star of state.stars) drawStar(star.x, star.y, star.r, star.pulse);
  for (const meteor of state.meteors) drawMeteor(meteor);
  for (const part of state.particles) {
    ctx.globalAlpha = clamp(part.life / 34, 0, 1);
    ctx.fillStyle = part.color;
    ctx.beginPath();
    ctx.arc(part.x, part.y, 3, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  drawPlayer();

  if (!state.playing) {
    ctx.fillStyle = 'rgba(5, 4, 13, 0.72)';
    ctx.fillRect(0, 0, W, H);
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.font = '800 56px system-ui';
    ctx.fillText('METEOR MUNCHED YOU', W / 2, H / 2 - 28);
    ctx.fillStyle = '#8ff6ff';
    ctx.font = '600 24px system-ui';
    ctx.fillText(`Score ${state.score} · Best ${state.best} · Press Enter`, W / 2, H / 2 + 24);
  }

  ctx.restore();
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}

window.addEventListener('keydown', (event) => {
  keys.add(event.key.toLowerCase());
  if (!state.playing && event.key === 'Enter') reset();
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(event.key)) event.preventDefault();
});
window.addEventListener('keyup', (event) => keys.delete(event.key.toLowerCase()));

canvas.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'mouse' && event.buttons === 0) return;
  const rect = canvas.getBoundingClientRect();
  const x = ((event.clientX - rect.left) / rect.width) * W;
  const y = ((event.clientY - rect.top) / rect.height) * H;
  const p = state.player;
  p.vx += clamp((x - p.x) / 42, -1.5, 1.5);
  p.vy += clamp((y - p.y) / 42, -1.5, 1.5);
});

reset();
loop();
