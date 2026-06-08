(() => {
  const canvas = document.getElementById('canvas');
  const ctx = canvas.getContext('2d');
  const hint = document.getElementById('hint');
  const showBtn = document.getElementById('showBtn');
  const finaleBtn = document.getElementById('finaleBtn');

  let W, H;
  function resize() {
    W = canvas.width = window.innerWidth;
    H = canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  // ── Background: Van Gogh's Starry Night ───────────────
  const bgImage = new Image();
  bgImage.src = 'starry-night.jpg';
  let bgReady = false;
  bgImage.onload = () => { bgReady = true; };

  function drawBackground() {
    if (!bgReady) {
      ctx.fillStyle = '#0a0a2e';
      ctx.fillRect(0, 0, W, H);
      return;
    }
    // Cover the canvas while preserving aspect ratio
    const imgRatio = bgImage.width / bgImage.height;
    const canvasRatio = W / H;
    let drawW, drawH, offsetX, offsetY;
    if (canvasRatio > imgRatio) {
      drawW = W;
      drawH = W / imgRatio;
      offsetX = 0;
      offsetY = (H - drawH) / 2;
    } else {
      drawH = H;
      drawW = H * imgRatio;
      offsetX = (W - drawW) / 2;
      offsetY = 0;
    }
    ctx.drawImage(bgImage, offsetX, offsetY, drawW, drawH);
    // Slight dark overlay so fireworks pop against the painting
    ctx.fillStyle = 'rgba(0, 0, 10, 0.25)';
    ctx.fillRect(0, 0, W, H);
  }

  // ── Color palettes ────────────────────────────────────
  const palettes = [
    ['#ff4444', '#ff6644', '#ffaa33', '#ffdd44'],           // warm
    ['#44aaff', '#66ddff', '#aaeeff', '#ffffff'],           // ice
    ['#ff44aa', '#ff66cc', '#ffaaee', '#ffddff'],           // pink
    ['#44ff88', '#66ffaa', '#aaffcc', '#ddffee'],           // green
    ['#ffaa00', '#ffcc33', '#ffdd66', '#ffee99'],           // gold
    ['#aa44ff', '#cc66ff', '#dd88ff', '#eeaaff'],           // purple
    ['#ff4444', '#44ff44', '#4444ff', '#ffff44'],           // rainbow
    ['#ff6600', '#ff3300', '#ffcc00', '#ff9900'],           // fire
    ['#ffffff', '#ccddff', '#aabbee', '#8899dd'],           // silver
    ['#ff2266', '#ff4488', '#ff66aa', '#ffffff'],           // rose
  ];

  function randomPalette() {
    return palettes[Math.floor(Math.random() * palettes.length)];
  }

  function hexToRgb(hex) {
    const n = parseInt(hex.slice(1), 16);
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  }

  // ── Particle pool ─────────────────────────────────────
  const particles = [];
  const trails = [];
  const flashes = [];

  class Trail {
    constructor(x, y, targetX, targetY, palette) {
      this.x = x;
      this.y = y;
      this.targetX = targetX;
      this.targetY = targetY;
      this.palette = palette;
      const dx = targetX - x;
      const dy = targetY - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const speed = 6 + dist * 0.004;
      this.vx = (dx / dist) * speed;
      this.vy = (dy / dist) * speed;
      this.alpha = 1;
      this.alive = true;
      this.history = [];
      this.maxHistory = 18;
      const [r, g, b] = hexToRgb(palette[0]);
      this.r = r; this.g = g; this.b = b;
    }

    update() {
      this.history.push({ x: this.x, y: this.y });
      if (this.history.length > this.maxHistory) this.history.shift();

      this.vy += 0.04; // slight gravity on trail
      this.x += this.vx;
      this.y += this.vy;

      const dx = this.targetX - this.x;
      const dy = this.targetY - this.y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < 12 || this.y < this.targetY) {
        this.alive = false;
        explode(this.targetX, this.targetY, this.palette);
      }
    }

    draw() {
      // trail line
      for (let i = 0; i < this.history.length; i++) {
        const p = this.history[i];
        const a = (i / this.history.length) * 0.6;
        const size = 1.5 + (i / this.history.length) * 1.5;
        ctx.beginPath();
        ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.r},${this.g},${this.b},${a.toFixed(3)})`;
        ctx.fill();
      }
      // bright head
      ctx.beginPath();
      ctx.arc(this.x, this.y, 3, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255,255,220,0.95)`;
      ctx.fill();

      // glow
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, 12);
      grad.addColorStop(0, `rgba(${this.r},${this.g},${this.b},0.4)`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(this.x, this.y, 12, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  class Particle {
    constructor(x, y, color, speed, angle, life, size) {
      this.x = x;
      this.y = y;
      const [r, g, b] = hexToRgb(color);
      this.r = r; this.g = g; this.b = b;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.alpha = 1;
      this.life = life;
      this.maxLife = life;
      this.size = size;
      this.alive = true;
      this.decay = 0.96 + Math.random() * 0.02;
      this.gravity = 0.04 + Math.random() * 0.02;
      this.history = [];
      this.maxHistory = 5;
    }

    update() {
      this.history.push({ x: this.x, y: this.y, a: this.alpha * 0.3 });
      if (this.history.length > this.maxHistory) this.history.shift();

      this.vx *= this.decay;
      this.vy *= this.decay;
      this.vy += this.gravity;
      this.x += this.vx;
      this.y += this.vy;
      this.life--;
      this.alpha = Math.max(0, this.life / this.maxLife);
      this.size *= 0.995;
      if (this.life <= 0) this.alive = false;
    }

    draw() {
      // trail
      for (const h of this.history) {
        ctx.beginPath();
        ctx.arc(h.x, h.y, this.size * 0.5, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${this.r},${this.g},${this.b},${(h.a * this.alpha).toFixed(3)})`;
        ctx.fill();
      }
      // main dot
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${this.r},${this.g},${this.b},${this.alpha.toFixed(3)})`;
      ctx.fill();

      // glow
      if (this.alpha > 0.3) {
        const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.size * 4);
        grad.addColorStop(0, `rgba(${this.r},${this.g},${this.b},${(this.alpha * 0.2).toFixed(3)})`);
        grad.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size * 4, 0, Math.PI * 2);
        ctx.fillStyle = grad;
        ctx.fill();
      }
    }
  }

  class Flash {
    constructor(x, y, palette) {
      this.x = x;
      this.y = y;
      this.alpha = 0.6;
      this.radius = 10;
      this.maxRadius = 80 + Math.random() * 40;
      const [r, g, b] = hexToRgb(palette[0]);
      this.r = r; this.g = g; this.b = b;
      this.alive = true;
    }

    update() {
      this.radius += (this.maxRadius - this.radius) * 0.15;
      this.alpha *= 0.88;
      if (this.alpha < 0.01) this.alive = false;
    }

    draw() {
      const grad = ctx.createRadialGradient(this.x, this.y, 0, this.x, this.y, this.radius);
      grad.addColorStop(0, `rgba(${this.r},${this.g},${this.b},${this.alpha.toFixed(3)})`);
      grad.addColorStop(0.4, `rgba(${this.r},${this.g},${this.b},${(this.alpha * 0.3).toFixed(3)})`);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    }
  }

  // ── Explosion type selector ────────────────────────────
  let selectedType = 'random';
  const typeBar = document.getElementById('type-bar');
  typeBar.addEventListener('click', (e) => {
    const btn = e.target.closest('.type-btn');
    if (!btn) return;
    typeBar.querySelector('.selected').classList.remove('selected');
    btn.classList.add('selected');
    selectedType = btn.dataset.type;
  });

  // Map type names to numeric ranges used by the explode function
  const typeMap = { spherical: 0, ring: 0.4, double: 0.6, willow: 0.8, crackle: 0.95 };

  // ── Explosion types ───────────────────────────────────
  function explode(x, y, palette) {
    flashes.push(new Flash(x, y, palette));

    const type = selectedType === 'random'
      ? Math.random()
      : typeMap[selectedType];

    if (type < 0.3) {
      // Spherical burst
      const count = 100 + Math.floor(Math.random() * 60);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 1.5 + Math.random() * 5;
        const color = palette[Math.floor(Math.random() * palette.length)];
        const life = 50 + Math.floor(Math.random() * 40);
        const size = 1.5 + Math.random() * 2;
        particles.push(new Particle(x, y, color, speed, angle, life, size));
      }
    } else if (type < 0.55) {
      // Ring burst
      const count = 60 + Math.floor(Math.random() * 30);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const speed = 3.5 + Math.random() * 1.5;
        const color = palette[Math.floor(Math.random() * palette.length)];
        const life = 55 + Math.floor(Math.random() * 30);
        particles.push(new Particle(x, y, color, speed, angle, life, 2));
      }
      // inner sparkle
      for (let i = 0; i < 30; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 2;
        const life = 30 + Math.floor(Math.random() * 20);
        particles.push(new Particle(x, y, '#ffffff', speed, angle, life, 1.2));
      }
    } else if (type < 0.75) {
      // Double burst
      const count = 50;
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2;
        const speed = 4.5 + Math.random() * 0.5;
        const color = palette[0];
        particles.push(new Particle(x, y, color, speed, angle, 50, 2));
      }
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + 0.1;
        const speed = 2.5 + Math.random() * 0.5;
        const color = palette[2] || palette[1];
        particles.push(new Particle(x, y, color, speed, angle, 65, 1.8));
      }
    } else if (type < 0.9) {
      // Willow (long trails, heavy gravity)
      const count = 80 + Math.floor(Math.random() * 40);
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 2 + Math.random() * 4;
        const color = palette[Math.floor(Math.random() * palette.length)];
        const life = 80 + Math.floor(Math.random() * 50);
        const p = new Particle(x, y, color, speed, angle, life, 1.8);
        p.gravity = 0.06 + Math.random() * 0.03;
        p.decay = 0.98;
        p.maxHistory = 10;
        particles.push(p);
      }
    } else {
      // Crackle — small secondary explosions
      const count = 8 + Math.floor(Math.random() * 6);
      for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 + Math.random() * 0.3;
        const speed = 3 + Math.random() * 2;
        const color = palette[Math.floor(Math.random() * palette.length)];
        const life = 30 + Math.floor(Math.random() * 15);
        const p = new Particle(x, y, color, speed, angle, life, 2.5);
        // schedule sub-explosion
        p._subExplode = true;
        p._subPalette = palette;
        particles.push(p);
      }
      // core sparkle
      for (let i = 0; i < 40; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 2;
        particles.push(new Particle(x, y, '#ffffff', speed, angle, 25, 1));
      }
    }
  }

  function launchFirework(targetX, targetY) {
    const startX = targetX + (Math.random() - 0.5) * 60;
    const palette = randomPalette();
    trails.push(new Trail(startX, H + 10, targetX, targetY, palette));
  }

  // ── Auto show ─────────────────────────────────────────
  let autoShow = false;
  let autoTimer = 0;

  showBtn.addEventListener('click', () => {
    autoShow = !autoShow;
    showBtn.classList.toggle('active', autoShow);
    showBtn.textContent = autoShow ? 'Stop Show' : 'Auto Show';
  });

  finaleBtn.addEventListener('click', () => {
    // Grand finale: rapid burst of many fireworks
    for (let i = 0; i < 25; i++) {
      setTimeout(() => {
        const tx = W * 0.15 + Math.random() * W * 0.7;
        const ty = H * 0.1 + Math.random() * H * 0.4;
        launchFirework(tx, ty);
      }, i * 120);
    }
  });

  // ── Prevent UI clicks from launching fireworks ─────────
  document.getElementById('ui').addEventListener('click', (e) => e.stopPropagation());
  typeBar.addEventListener('click', (e) => e.stopPropagation());

  // ── Click to launch ───────────────────────────────────
  let hintVisible = true;
  document.addEventListener('click', (e) => {
    if (hintVisible) {
      hint.style.opacity = '0';
      hintVisible = false;
    }
    launchFirework(e.clientX, e.clientY);
  });

  // ── Main loop ─────────────────────────────────────────
  let frame = 0;

  function loop(t) {
    requestAnimationFrame(loop);
    frame++;

    // Redraw the painting each frame — particles are drawn on top
    // and naturally fade via their own alpha/life, no overlay needed
    drawBackground();

    // Auto show logic
    if (autoShow) {
      autoTimer++;
      if (autoTimer % 30 === 0) {
        const tx = W * 0.1 + Math.random() * W * 0.8;
        const ty = H * 0.08 + Math.random() * H * 0.45;
        launchFirework(tx, ty);
      }
    }

    // Update & draw flashes
    for (let i = flashes.length - 1; i >= 0; i--) {
      flashes[i].update();
      flashes[i].draw();
      if (!flashes[i].alive) flashes.splice(i, 1);
    }

    // Update & draw trails
    for (let i = trails.length - 1; i >= 0; i--) {
      trails[i].update();
      if (trails[i].alive) trails[i].draw();
      else trails.splice(i, 1);
    }

    // Update & draw particles
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.update();

      // Sub-explosions for crackle type
      if (p._subExplode && !p.alive) {
        const subCount = 12 + Math.floor(Math.random() * 8);
        for (let j = 0; j < subCount; j++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.8 + Math.random() * 2;
          const color = p._subPalette[Math.floor(Math.random() * p._subPalette.length)];
          particles.push(new Particle(p.x, p.y, color, speed, angle, 25 + Math.random() * 15, 1.2));
        }
        flashes.push(new Flash(p.x, p.y, p._subPalette));
      }

      if (p.alive) p.draw();
      else particles.splice(i, 1);
    }
  }

  // Initial background
  drawBackground();
  requestAnimationFrame(loop);
})();
