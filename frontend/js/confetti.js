/**
 * High-performance, zero-dependency canvas confetti celebration
 */
export function fireVictoryConfetti() {
  const canvas = document.getElementById('victory-confetti-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  canvas.classList.remove('hidden');
  canvas.style.display = 'block';

  const dpr = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = width * dpr;
  canvas.height = height * dpr;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.scale(dpr, dpr);

  const colors = [
    '#ffd700', // Gold
    '#ffb703', // Amber
    '#00f0ff', // Electric cyan
    '#06d6a0', // Mint green
    '#ff007f', // Rose neon
    '#7209b7', // Purple
    '#ffffff'  // Silver white
  ];

  const particleCount = 120;
  const particles = [];

  for (let i = 0; i < particleCount; i++) {
    particles.push({
      x: width * 0.5 + (Math.random() - 0.5) * 80,
      y: height * 0.35,
      vx: (Math.random() - 0.5) * 14,
      vy: (Math.random() - 1.2) * 16,
      size: Math.random() * 8 + 4,
      color: colors[Math.floor(Math.random() * colors.length)],
      rotation: Math.random() * 360,
      rotationSpeed: (Math.random() - 0.5) * 12,
      gravity: 0.38,
      drag: 0.96,
      opacity: 1
    });
  }

  let animationFrameId;
  const startTime = Date.now();
  const maxDuration = 3800;

  function render() {
    const elapsed = Date.now() - startTime;
    if (elapsed > maxDuration) {
      canvas.classList.add('hidden');
      canvas.style.display = 'none';
      ctx.clearRect(0, 0, width, height);
      return;
    }

    ctx.clearRect(0, 0, width, height);

    const fadeStart = 2400;
    const globalAlpha = elapsed > fadeStart ? Math.max(0, 1 - (elapsed - fadeStart) / (maxDuration - fadeStart)) : 1;

    for (let i = 0; i < particles.length; i++) {
      const p = particles[i];
      p.x += p.vx;
      p.y += p.vy;
      p.vy += p.gravity;
      p.vx *= p.drag;
      p.rotation += p.rotationSpeed;

      ctx.save();
      ctx.globalAlpha = p.opacity * globalAlpha;
      ctx.translate(p.x, p.y);
      ctx.rotate((p.rotation * Math.PI) / 180);

      ctx.fillStyle = p.color;
      ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.6);
      ctx.restore();
    }

    animationFrameId = requestAnimationFrame(render);
  }

  render();
}
