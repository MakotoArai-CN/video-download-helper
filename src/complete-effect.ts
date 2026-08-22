import { setHTML } from './ui.ts';

export const CompleteEffect = {
  show(root: ShadowRoot | null, progressCircle?: HTMLElement | null): void {
    const overlay = document.createElement('div');
    overlay.className = 'bdl-complete-overlay';
    // 经 setHTML 赋值，兼容启用 Trusted Types 的站点
    setHTML(overlay, '<div class="bdl-complete-container">' +
      '<div class="bdl-complete-ripple"></div>' +
      '<div class="bdl-complete-ripple"></div>' +
      '<div class="bdl-complete-ripple"></div>' +
      '<div class="bdl-complete-particles"></div>' +
      '<div class="bdl-complete-sparkles"></div>' +
      '<div class="bdl-complete-icon"><svg viewBox="0 0 24 24"><path d="M5 12l5 5L20 7"/></svg></div>' +
      '</div>' +
      '<div class="bdl-complete-text">✨ 下载完成 ✨</div>');
    (root || document.body).appendChild(overlay);
    this.createParticles(overlay.querySelector('.bdl-complete-particles')!);
    this.createSparkles(overlay.querySelector('.bdl-complete-sparkles')!);
    this.addBubbles(progressCircle);
    setTimeout(() => {
      overlay.style.animation = 'bdlFadeOut 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards';
      setTimeout(() => { overlay.parentNode?.removeChild(overlay); }, 500);
    }, 2500);
  },

  createParticles(container: Element): void {
    // 颜色由样式表按平台与深浅色决定，此处只分配色位：
    // 主色、主色提亮、点缀色三种，避免同屏出现两套色系。
    const tints = ['', 'is-light', 'is-spark'];
    for (let i = 0; i < 30; i++) {
      const particle = document.createElement('div');
      particle.className = ('bdl-particle ' + tints[i % tints.length]).trim();
      const angle = (Math.PI * 2 * i) / 30;
      const velocity = 120 + Math.random() * 80;
      const size = 6 + Math.random() * 10;
      particle.style.width = size + 'px';
      particle.style.height = size + 'px';
      particle.style.setProperty('--tx', (Math.cos(angle) * velocity) + 'px');
      particle.style.setProperty('--ty', (Math.sin(angle) * velocity) + 'px');
      particle.style.animationDelay = (Math.random() * 0.3) + 's';
      container.appendChild(particle);
    }
  },

  createSparkles(container: Element): void {
    const positions = [
      { top: '10%', left: '15%', delay: 0.2, duration: 1.5 },
      { top: '20%', right: '20%', delay: 0.4, duration: 1.8 },
      { top: '40%', left: '10%', delay: 0.6, duration: 1.6 },
      { top: '60%', right: '15%', delay: 0.3, duration: 1.7 },
      { bottom: '30%', left: '25%', delay: 0.5, duration: 1.9 },
      { bottom: '20%', right: '25%', delay: 0.7, duration: 1.4 },
      { top: '30%', left: '50%', delay: 0.1, duration: 2.0 },
      { bottom: '40%', right: '50%', delay: 0.8, duration: 1.3 }
    ] as any[];
    for (const pos of positions) {
      const sparkle = document.createElement('div');
      sparkle.className = 'bdl-sparkle';
      if (pos.top) sparkle.style.top = pos.top;
      if (pos.bottom) sparkle.style.bottom = pos.bottom;
      if (pos.left) sparkle.style.left = pos.left;
      if (pos.right) sparkle.style.right = pos.right;
      sparkle.style.animationDelay = pos.delay + 's';
      sparkle.style.animationDuration = pos.duration + 's';
      container.appendChild(sparkle);
    }
  },

  addBubbles(progressCircle?: HTMLElement | null): void {
    const circleProgress = progressCircle || document.getElementById('bdl-progress-circle');
    if (!circleProgress) return;
    for (let i = 1; i <= 3; i++) {
      const bubble = document.createElement('div');
      bubble.className = 'bdl-progress-bubble';
      circleProgress.appendChild(bubble);
    }
  }
};
