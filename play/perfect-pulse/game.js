const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

// --- Hi-DPI support ---
function resize() {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
window.addEventListener('resize', resize);
resize();

const W = () => window.innerWidth;
const H = () => window.innerHeight;
const CX = () => W() / 2;
const CY = () => H() / 2;

// --- Audio (procedural via Web Audio API) ---
let audioCtx = null;
function ensureAudio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
}

function playTone(freq, duration, type = 'sine', volume = 0.15) {
  ensureAudio();
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(volume, audioCtx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start();
  osc.stop(audioCtx.currentTime + duration);
}

function playHit(rating, comboCount) {
  const baseFreq = 400 + comboCount * 40; // pitch rises with combo
  if (rating === 'PERFECT') {
    playTone(baseFreq, 0.3, 'sine', 0.2);
    playTone(baseFreq * 1.5, 0.2, 'sine', 0.12); // harmony
    playTone(baseFreq * 2, 0.15, 'sine', 0.08);
  } else if (rating === 'GREAT') {
    playTone(baseFreq, 0.25, 'sine', 0.15);
    playTone(baseFreq * 1.25, 0.15, 'sine', 0.08);
  } else if (rating === 'OK') {
    playTone(300, 0.15, 'triangle', 0.1);
  } else {
    playTone(150, 0.3, 'sawtooth', 0.1);
    playTone(120, 0.4, 'sawtooth', 0.08);
  }
}

// --- Haptics ---
function vibrate(ms) {
  if (navigator.vibrate) navigator.vibrate(ms);
}

// --- Delta time ---
let lastTime = 0;
const TARGET_DT = 1000 / 60; // normalize to 60fps

// --- Game state ---
let state = 'menu'; // 'menu' | 'playing' | 'gameover'
let score = 0;
let displayScore = 0; // for animated score counter
let highScore = parseInt(localStorage.getItem('pp_high') || '0', 10);
let combo = 0;
let bestCombo = 0;
let lives = 3;
let level = 0;

// Pulse circle
let pulseRadius = 0;
let pulseSpeed = 2.5;
let pulseGrowing = true;
const PULSE_MIN = 20;

// Pulse trail
let trailPoints = [];
const TRAIL_LENGTH = 12;

// Target ring
let targetRadius = 0;
let targetAppearT = 0; // animation timer 0-1
const TARGET_THICKNESS = 4;

// Floating result texts (no more pause!)
let floatingTexts = [];

// Particles
let particles = [];

// Locked rings
let rings = [];
const MAX_RINGS = 10;

// Screen shake
let shakeX = 0;
let shakeY = 0;
let shakeIntensity = 0;

// Background hue — shifts with combo
let bgHue = 240; // base blue-purple
let bgSaturation = 15;
let bgBrightness = 6;

// Game over animation
let gameOverT = 0;

// --- Helpers ---
function lerp(a, b, t) { return a + (b - a) * t; }
function rand(min, max) { return Math.random() * (max - min) + min; }
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function easeOutBack(t) { const c = 1.7; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
function easeOutElastic(t) {
  if (t === 0 || t === 1) return t;
  return Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * (2 * Math.PI / 3)) + 1;
}

function newTarget() {
  const minR = 50;
  const maxR = Math.min(W(), H()) * 0.38;
  // Avoid targets too close to current pulse position
  let r;
  do {
    r = rand(minR, maxR);
  } while (Math.abs(r - pulseRadius) < 30);
  targetRadius = r;
  targetAppearT = 0;
}

function resetPulse() {
  pulseRadius = PULSE_MIN;
  pulseGrowing = true;
  trailPoints = [];
}

function startGame() {
  state = 'playing';
  score = 0;
  displayScore = 0;
  combo = 0;
  bestCombo = 0;
  lives = 3;
  level = 0;
  pulseSpeed = 2.5;
  rings = [];
  particles = [];
  floatingTexts = [];
  shakeIntensity = 0;
  bgHue = 240;
  bgSaturation = 15;
  resetPulse();
  newTarget();
}

function spawnParticles(radius, color, count) {
  const cx = CX(), cy = CY();
  for (let i = 0; i < count; i++) {
    const angle = rand(0, Math.PI * 2);
    const speed = rand(1, 5);
    particles.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: 1,
      decay: rand(0.01, 0.03),
      size: rand(2, 6),
      color,
    });
  }
}

// Spawn a ring of particles that expands outward (for perfect hits)
function spawnRingBurst(radius, color) {
  const cx = CX(), cy = CY();
  const count = 40;
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * Math.PI * 2;
    particles.push({
      x: cx + Math.cos(angle) * radius,
      y: cy + Math.sin(angle) * radius,
      vx: Math.cos(angle) * rand(2, 4),
      vy: Math.sin(angle) * rand(2, 4),
      life: 1,
      decay: rand(0.015, 0.025),
      size: rand(2, 4),
      color,
    });
  }
}

function addFloatingText(text, color, points) {
  floatingTexts.push({
    text,
    color,
    points,
    y: CY() - 70,
    alpha: 1,
    scale: 0,
    age: 0,
  });
}

function shake(intensity) {
  shakeIntensity = intensity;
}

function handleTap() {
  ensureAudio();

  if (state === 'menu') {
    startGame();
    return;
  }

  if (state === 'gameover') {
    if (gameOverT > 0.5) { // prevent accidental instant restart
      state = 'menu';
      gameOverT = 0;
    }
    return;
  }

  if (state !== 'playing') return;

  const diff = Math.abs(pulseRadius - targetRadius);
  const maxR = Math.min(W(), H()) * 0.38;
  const tolerance = maxR * 0.018;
  const goodTolerance = maxR * 0.055;
  const okTolerance = maxR * 0.11;

  let points = 0;
  let rating;

  if (diff <= tolerance) {
    rating = 'PERFECT';
    combo++;
    points = 10 * combo;
    spawnRingBurst(targetRadius, '#00ffaa');
    spawnParticles(targetRadius, '#00ffaa', 20);
    rings.push({ radius: targetRadius, alpha: 1, color: '#00ffaa', thickness: 3 });
    shake(3);
    vibrate(10);
  } else if (diff <= goodTolerance) {
    rating = 'GREAT';
    combo++;
    points = 5 * combo;
    spawnParticles(targetRadius, '#44aaff', 20);
    rings.push({ radius: targetRadius, alpha: 0.8, color: '#44aaff', thickness: 2 });
    shake(2);
    vibrate(8);
  } else if (diff <= okTolerance) {
    rating = 'OK';
    combo = 1;
    points = 3;
    spawnParticles(targetRadius, '#ffaa00', 10);
    rings.push({ radius: targetRadius, alpha: 0.5, color: '#ffaa00', thickness: 2 });
  } else {
    rating = 'MISS';
    combo = 0;
    lives--;
    spawnParticles(pulseRadius, '#ff3344', 20);
    shake(8);
    vibrate([30, 50, 30]);
  }

  if (combo > bestCombo) bestCombo = combo;
  playHit(rating, combo);

  const colors = { PERFECT: '#00ffaa', GREAT: '#44aaff', OK: '#ffaa00', MISS: '#ff3344' };
  score += points;
  addFloatingText(rating, colors[rating], points);

  if (lives <= 0) {
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('pp_high', String(highScore));
    }
    state = 'gameover';
    gameOverT = 0;
    return;
  }

  // Trim old rings
  while (rings.length > MAX_RINGS) rings.shift();

  // Level up
  level++;
  pulseSpeed = 2.5 + level * 0.12;

  // No pause! Immediately set new target, pulse keeps going
  newTarget();
}

canvas.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  handleTap();
});

// Keyboard support for desktop
window.addEventListener('keydown', (e) => {
  if (e.code === 'Space' || e.code === 'Enter') {
    e.preventDefault();
    handleTap();
  }
});

// --- Update ---
function update(dt) {
  const f = dt / TARGET_DT; // frame factor (1.0 at 60fps)

  if (state === 'playing') {
    const maxR = Math.min(W(), H()) * 0.43;

    if (pulseGrowing) {
      pulseRadius += pulseSpeed * f;
      if (pulseRadius >= maxR) {
        pulseRadius = maxR;
        pulseGrowing = false;
      }
    } else {
      pulseRadius -= pulseSpeed * f;
      if (pulseRadius <= PULSE_MIN) {
        pulseRadius = PULSE_MIN;
        pulseGrowing = true;
      }
    }

    // Pulse trail
    trailPoints.unshift(pulseRadius);
    if (trailPoints.length > TRAIL_LENGTH) trailPoints.pop();

    // Target appear animation
    if (targetAppearT < 1) {
      targetAppearT = Math.min(1, targetAppearT + 0.05 * f);
    }

    // Background evolves with combo
    const targetHue = combo >= 5 ? 280 : combo >= 3 ? 260 : 240;
    const targetSat = clamp(15 + combo * 4, 15, 45);
    bgHue = lerp(bgHue, targetHue, 0.02 * f);
    bgSaturation = lerp(bgSaturation, targetSat, 0.02 * f);
  }

  if (state === 'gameover') {
    gameOverT = Math.min(1, gameOverT + 0.02 * f);
    // Slowly desaturate background
    bgSaturation = lerp(bgSaturation, 5, 0.03 * f);
  }

  // Animated score counter
  if (displayScore < score) {
    displayScore = Math.min(score, displayScore + Math.max(1, Math.ceil((score - displayScore) * 0.15)));
  }

  // Screen shake decay
  if (shakeIntensity > 0) {
    shakeX = (Math.random() - 0.5) * shakeIntensity * 2;
    shakeY = (Math.random() - 0.5) * shakeIntensity * 2;
    shakeIntensity *= 0.85;
    if (shakeIntensity < 0.3) shakeIntensity = 0;
  } else {
    shakeX = 0;
    shakeY = 0;
  }

  // Floating texts
  for (let i = floatingTexts.length - 1; i >= 0; i--) {
    const ft = floatingTexts[i];
    ft.age += 0.02 * f;
    ft.y -= 0.8 * f;
    ft.scale = ft.age < 0.15 ? easeOutBack(ft.age / 0.15) : 1;
    ft.alpha = ft.age > 0.6 ? Math.max(0, 1 - (ft.age - 0.6) / 0.4) : 1;
    if (ft.age >= 1) floatingTexts.splice(i, 1);
  }

  // Particles
  for (let i = particles.length - 1; i >= 0; i--) {
    const p = particles[i];
    p.x += p.vx * f;
    p.y += p.vy * f;
    p.vx *= 0.98;
    p.vy *= 0.98;
    p.life -= p.decay * f;
    if (p.life <= 0) particles.splice(i, 1);
  }

  // Fade rings
  for (let i = rings.length - 1; i >= 0; i--) {
    rings[i].alpha -= 0.006 * f;
    if (rings[i].alpha <= 0) rings.splice(i, 1);
  }
}

// --- Draw ---
function draw() {
  const w = W();
  const h = H();

  // Dynamic background
  ctx.fillStyle = `hsl(${bgHue}, ${bgSaturation}%, ${bgBrightness}%)`;
  ctx.fillRect(0, 0, w, h);

  // Subtle radial gradient overlay
  const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, Math.max(w, h) * 0.6);
  grad.addColorStop(0, `hsla(${bgHue}, ${bgSaturation + 10}%, ${bgBrightness + 4}%, 0.3)`);
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, w, h);

  ctx.save();
  ctx.translate(shakeX, shakeY);

  const cx = CX();
  const cy = CY();

  if (state === 'menu') {
    drawMenu(cx, cy);
    ctx.restore();
    return;
  }

  if (state === 'gameover') {
    drawGameOver(cx, cy);
    ctx.restore();
    return;
  }

  // Draw subtle guide circles
  ctx.globalAlpha = 0.04;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  const guideCount = 5;
  const maxR = Math.min(w, h) * 0.38;
  for (let i = 1; i <= guideCount; i++) {
    ctx.beginPath();
    ctx.arc(cx, cy, (maxR / guideCount) * i, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Draw locked rings
  for (const ring of rings) {
    ctx.beginPath();
    ctx.arc(cx, cy, ring.radius, 0, Math.PI * 2);
    ctx.strokeStyle = ring.color;
    ctx.globalAlpha = ring.alpha * 0.4;
    ctx.lineWidth = ring.thickness;
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // Draw target ring with appear animation
  const targetScale = easeOutElastic(targetAppearT);
  const drawTargetR = targetRadius * targetScale;
  ctx.beginPath();
  ctx.arc(cx, cy, drawTargetR, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.35 * targetAppearT})`;
  ctx.lineWidth = TARGET_THICKNESS;
  ctx.setLineDash([8, 8]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Target ring glow
  ctx.beginPath();
  ctx.arc(cx, cy, drawTargetR, 0, Math.PI * 2);
  ctx.strokeStyle = `rgba(255, 255, 255, ${0.08 * targetAppearT})`;
  ctx.lineWidth = 12;
  ctx.stroke();

  // Draw pulse trail
  for (let i = 1; i < trailPoints.length; i++) {
    const alpha = (1 - i / trailPoints.length) * 0.15;
    ctx.beginPath();
    ctx.arc(cx, cy, trailPoints[i], 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.lineWidth = 2;
    ctx.stroke();
  }

  // Draw pulse circle
  // Glow when close to target
  const proximity = 1 - clamp(Math.abs(pulseRadius - targetRadius) / 40, 0, 1);
  const glowColor = proximity > 0.3 ? `rgba(0, 255, 170, ${proximity * 0.3})` : 'transparent';

  if (proximity > 0.3) {
    ctx.beginPath();
    ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
    ctx.strokeStyle = glowColor;
    ctx.lineWidth = 10;
    ctx.stroke();
  }

  ctx.beginPath();
  ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.stroke();

  // Pulse fill
  ctx.beginPath();
  ctx.arc(cx, cy, pulseRadius, 0, Math.PI * 2);
  ctx.fillStyle = `rgba(255, 255, 255, 0.02)`;
  ctx.fill();

  // Center dot
  ctx.beginPath();
  ctx.arc(cx, cy, 3, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.fill();

  // Particles
  for (const p of particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life * 0.8;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Floating result texts
  for (const ft of floatingTexts) {
    ctx.save();
    ctx.translate(cx, ft.y);
    ctx.scale(ft.scale, ft.scale);
    ctx.globalAlpha = ft.alpha;
    ctx.font = 'bold 36px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = ft.color;
    ctx.fillText(ft.text, 0, 0);
    if (ft.points > 0) {
      ctx.font = 'bold 20px -apple-system, system-ui, sans-serif';
      ctx.fillText('+' + ft.points, 0, 30);
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;

  // HUD
  drawHUD();
  ctx.restore();
}

function drawHUD() {
  const w = W();
  const safeTop = 50; // safe area for notch

  // Score (animated)
  ctx.font = 'bold 32px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(displayScore, w / 2, safeTop);

  // Combo badge
  if (combo > 1) {
    const comboText = combo + 'x';
    ctx.font = 'bold 16px -apple-system, system-ui, sans-serif';
    const comboAlpha = Math.min(1, 0.5 + combo * 0.1);
    ctx.fillStyle = `rgba(0, 255, 170, ${comboAlpha})`;
    ctx.fillText(comboText, w / 2, safeTop + 22);
  }

  // Lives
  ctx.font = '18px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'left';
  let heartsStr = '';
  for (let i = 0; i < 3; i++) {
    heartsStr += i < lives ? '\u2764\uFE0F ' : '\u2661 ';
  }
  ctx.fillStyle = '#ff3344';
  ctx.fillText(heartsStr, 20, safeTop);

  // High score
  ctx.font = '13px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.fillStyle = 'rgba(255,255,255,0.35)';
  ctx.fillText('BEST ' + highScore, W() - 20, safeTop);
}

function drawMenu(cx, cy) {
  // Title with subtle glow
  const t = Date.now() / 1000;
  ctx.save();

  ctx.font = 'bold 52px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffffff';
  ctx.shadowColor = '#00ffaa';
  ctx.shadowBlur = 20 + Math.sin(t * 2) * 10;
  ctx.fillText('Perfect Pulse', cx, cy - 90);
  ctx.shadowBlur = 0;
  ctx.restore();

  // Animated demo — pulse and target
  const demoRadius = 55 + Math.sin(t * 2.5) * 35;
  const demoTarget = 75;
  const demoDist = Math.abs(demoRadius - demoTarget);
  const demoProximity = 1 - clamp(demoDist / 30, 0, 1);

  // Target
  ctx.beginPath();
  ctx.arc(cx, cy + 25, demoTarget, 0, Math.PI * 2);
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.lineWidth = TARGET_THICKNESS;
  ctx.setLineDash([8, 8]);
  ctx.stroke();
  ctx.setLineDash([]);

  // Pulse glow near target
  if (demoProximity > 0.3) {
    ctx.beginPath();
    ctx.arc(cx, cy + 25, demoRadius, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(0, 255, 170, ${demoProximity * 0.4})`;
    ctx.lineWidth = 8;
    ctx.stroke();
  }

  // Pulse
  ctx.beginPath();
  ctx.arc(cx, cy + 25, demoRadius, 0, Math.PI * 2);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3;
  ctx.globalAlpha = 0.7;
  ctx.stroke();
  ctx.globalAlpha = 1;

  // Instructions
  ctx.font = '17px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.textAlign = 'center';
  ctx.fillText('Tap when the pulse matches the ring', cx, cy + 120);

  // Start prompt
  ctx.font = 'bold 22px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.globalAlpha = 0.5 + Math.sin(t * 3) * 0.35;
  ctx.fillText('TAP TO START', cx, cy + 170);
  ctx.globalAlpha = 1;

  // High score
  if (highScore > 0) {
    ctx.font = '15px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('BEST: ' + highScore, cx, cy + 210);
  }
}

function drawGameOver(cx, cy) {
  const t = Date.now() / 1000;
  const eased = easeOutBack(Math.min(1, gameOverT * 1.5));

  // Draw remaining particles
  for (const p of particles) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fillStyle = p.color;
    ctx.globalAlpha = p.life;
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.scale(eased, eased);

  ctx.font = 'bold 42px -apple-system, system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ff3344';
  ctx.fillText('GAME OVER', 0, -70);

  ctx.font = '18px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = 'rgba(255,255,255,0.45)';
  ctx.fillText('SCORE', 0, -30);

  ctx.font = 'bold 64px -apple-system, system-ui, sans-serif';
  ctx.fillStyle = '#ffffff';
  ctx.fillText(score, 0, 20);

  if (bestCombo > 1) {
    ctx.font = '16px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(0, 255, 170, 0.6)';
    ctx.fillText('BEST COMBO: ' + bestCombo + 'x', 0, 55);
  }

  if (score >= highScore && score > 0) {
    ctx.font = 'bold 22px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = '#ffaa00';
    ctx.shadowColor = '#ffaa00';
    ctx.shadowBlur = 15;
    ctx.fillText('NEW BEST!', 0, 90);
    ctx.shadowBlur = 0;
  } else {
    ctx.font = '15px -apple-system, system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillText('BEST: ' + highScore, 0, 85);
  }

  ctx.restore();

  // Tap to continue (delayed)
  if (gameOverT > 0.5) {
    ctx.font = '17px -apple-system, system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#ffffff';
    ctx.globalAlpha = 0.35 + Math.sin(t * 3) * 0.25;
    ctx.fillText('TAP TO CONTINUE', cx, cy + 140);
    ctx.globalAlpha = 1;
  }
}

// --- Game loop (delta-time based) ---
function loop(timestamp) {
  const dt = lastTime ? Math.min(timestamp - lastTime, 50) : TARGET_DT; // cap at 50ms
  lastTime = timestamp;

  update(dt);
  draw();
  requestAnimationFrame(loop);
}

requestAnimationFrame(loop);
