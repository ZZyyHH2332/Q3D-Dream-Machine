/**
 * Q3D Pet Animation — SVG 骨骼动画控制器
 * Phase 4: 常驻生命动画 + 7 种心情状态 + 嘴型变形
 */

const PetAnimation = (function() {
  'use strict';

  // ========== 嘴型路径表 ==========
  const MOUTH_PATHS = {
    neutral: 'M 40,65 Q 50,65 60,65',
    smile:   'M 40,65 Q 50,75 60,65',
    frown:   'M 40,70 Q 50,60 60,70',
    open:    'M 42,62 Q 50,75 58,62 Q 50,55 42,62',
    o:       'M 47,65 A 3,3 0 1,1 47,64.9',
    small:   'M 47,67 Q 50,68 53,67',
  };

  // ========== 眼睛形状配置 ==========
  const EYE_CONFIG = {
    normal: { rx: 6, ry: 8, fill: '#333', extra: '' },
    happy:  { rx: 6, ry: 5, fill: '#333', extra: 'arc' },
    star:   { rx: 6, ry: 8, fill: '#FFD700', extra: 'star' },
    closed: { rx: 6, ry: 1, fill: '#333', extra: '' },
    wide:   { rx: 7, ry: 9, fill: '#333', extra: '' },
    tear:   { rx: 6, ry: 8, fill: '#333', extra: 'tear' },
    heart:  { rx: 6, ry: 8, fill: '#FF69B4', extra: 'heart' },
  };

  // ========== DOM 引用 ==========
  let boneHead, eyeL, eyeR, mouth, fxLayer;
  let rafId = null;
  let time = 0;
  let currentMood = 'idle';
  let nextBlink = 2; // 秒后下一次眨眼
  let blinkState = 0; // 0=睁开, 1=眨眼动画中
  let blinkTime = 0;
  let tempMoodTimer = null;

  function init() {
    boneHead = document.getElementById('bone-head');
    eyeL = document.getElementById('eye-l');
    eyeR = document.getElementById('eye-r');
    mouth = document.getElementById('mouth');
    fxLayer = document.getElementById('fx-layer');
    if (!boneHead || !eyeL || !eyeR || !mouth) {
      console.warn('[PetAnimation] SVG bones not found, skipping animation.');
      return false;
    }
    start();
    return true;
  }

  // ========== 动画主循环 ==========
  function start() {
    if (rafId) cancelAnimationFrame(rafId);
    time = 0;
    loop();
  }
  function stop() {
    if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  }

  function loop() {
    const dt = 0.016; // ~60fps
    time += dt;

    // 常驻：呼吸
    applyBreathe(time);

    // 常驻：眨眼
    applyBlink(dt);

    // 心情动画
    const cfg = window.PET_MOODS?.[currentMood];
    if (cfg) {
      applyMoodAnim(cfg.anim, time);
      updateMouth(cfg.mouth);
      updateEyes(cfg.eyeShape);
      applyFx(cfg.anim, time);
    }

    rafId = requestAnimationFrame(loop);
  }

  // ========== 常驻动画：呼吸 ==========
  function applyBreathe(t) {
    const s = 1 + Math.sin(t * 2) * 0.03; // 缩放 ±3%
    const transform = `scale(${s}) translate(${50 * (1 - s)}, ${50 * (1 - s)})`;
    // 以中心点缩放：translate 补偿 scale 导致的位移
    if (boneHead) boneHead.setAttribute('transform', transform);
  }

  // ========== 常驻动画：眨眼 ==========
  function applyBlink(dt) {
    nextBlink -= dt;
    if (nextBlink <= 0 && blinkState === 0) {
      blinkState = 1;
      blinkTime = 0;
      nextBlink = 3 + Math.random() * 3; // 3-6 秒间隔
    }
    if (blinkState === 1) {
      blinkTime += dt;
      const duration = 0.15; // 150ms
      let sy;
      if (blinkTime < duration / 2) {
        sy = 1 - (blinkTime / (duration / 2)) * 0.9; // 1 → 0.1
      } else if (blinkTime < duration) {
        sy = 0.1 + ((blinkTime - duration / 2) / (duration / 2)) * 0.9; // 0.1 → 1
      } else {
        sy = 1;
        blinkState = 0;
      }
      if (eyeL) {
        const cyL = 45, cyR = 45;
        eyeL.setAttribute('transform', `translate(0, ${cyL * (1 - sy)}) scale(1, ${sy})`);
        eyeR.setAttribute('transform', `translate(0, ${cyR * (1 - sy)}) scale(1, ${sy})`);
      }
    } else {
      // 确保睁开状态无 transform
      if (eyeL) { eyeL.removeAttribute('transform'); eyeR.removeAttribute('transform'); }
    }
  }

  // ========== 心情动画 ==========
  function applyMoodAnim(anim, t) {
    if (!boneHead) return;
    // 读取当前的呼吸 transform（在 applyBreathe 中已设置）
    // 心情动画叠加在呼吸之上，使用 bone-head 的子元素或直接修改属性
    let extraTransform = '';
    switch (anim) {
      case 'bounce': {
        const y = Math.abs(Math.sin(t * 4)) * -6;
        extraTransform = `translate(0, ${y})`;
        break;
      }
      case 'jump': {
        const y = Math.abs(Math.sin(t * 6)) * -10;
        const s = 1 + Math.sin(t * 6) * 0.05;
        extraTransform = `translate(0, ${y}) scale(${s})`;
        break;
      }
      case 'slow-breathe': {
        // 更慢的呼吸已在 applyBreathe 中处理（周期固定 3s）
        break;
      }
      case 'tilt': {
        const r = Math.sin(t * 1.5) * 12;
        extraTransform = `rotate(${r}, 50, 50)`;
        break;
      }
      case 'shiver': {
        const x = Math.sin(t * 25) * 1.5;
        extraTransform = `translate(${x}, 0)`;
        break;
      }
      case 'heartbeat': {
        const hs = 1 + Math.sin(t * 5) * 0.06;
        extraTransform = `scale(${hs}) translate(${50 * (1 - hs)}, ${50 * (1 - hs)})`;
        break;
      }
    }
    if (extraTransform) {
      const base = boneHead.getAttribute('transform') || '';
      boneHead.setAttribute('transform', `${base} ${extraTransform}`.trim());
    }
  }

  // ========== 嘴型变形 ==========
  let currentMouth = '';
  function updateMouth(shape) {
    if (!mouth || currentMouth === shape) return;
    currentMouth = shape;
    const d = MOUTH_PATHS[shape] || MOUTH_PATHS.neutral;
    mouth.style.transition = 'd 0.3s ease';
    mouth.setAttribute('d', d);
  }

  // ========== 眼睛形状 ==========
  let currentEyeShape = '';
  function updateEyes(shape) {
    if (!eyeL || currentEyeShape === shape) return;
    currentEyeShape = shape;
    const cfg = EYE_CONFIG[shape] || EYE_CONFIG.normal;
    [eyeL, eyeR].forEach(eye => {
      eye.setAttribute('rx', cfg.rx);
      eye.setAttribute('ry', cfg.ry);
      eye.setAttribute('fill', cfg.fill);
    });
  }

  // ========== 特效层 ==========
  function applyFx(anim, t) {
    if (!fxLayer) return;
    // 简单特效：根据动画类型偶尔生成粒子
    if (anim === 'heartbeat' && Math.random() < 0.02) spawnFx('heart');
    if (anim === 'jump' && Math.random() < 0.015) spawnFx('star');
    if (anim === 'shiver' && Math.random() < 0.01) spawnFx('tear');
    if (anim === 'slow-breathe' && Math.random() < 0.005) spawnFx('zzz');
    // 清理过期特效
    cleanupFx();
  }

  function spawnFx(type) {
    const el = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    const x = 20 + Math.random() * 60;
    const y = 30 + Math.random() * 40;
    const symbols = { heart: '❤️', star: '⭐', tear: '💧', zzz: '💤' };
    el.textContent = symbols[type] || '✨';
    el.setAttribute('x', x);
    el.setAttribute('y', y);
    el.setAttribute('font-size', '10');
    el.setAttribute('opacity', '0.8');
    el.dataset.born = Date.now();
    fxLayer.appendChild(el);
  }

  function cleanupFx() {
    if (!fxLayer) return;
    const now = Date.now();
    Array.from(fxLayer.children).forEach(el => {
      const age = now - parseInt(el.dataset.born || 0);
      if (age > 2000) {
        el.remove();
      } else {
        const y = parseFloat(el.getAttribute('y'));
        el.setAttribute('y', y - 0.3); // 缓慢上升
        el.setAttribute('opacity', String(0.8 * (1 - age / 2000)));
      }
    });
  }

  // ========== 心情状态机 ==========
  function setMood(mood, durationSec) {
    if (!(window.PET_MOODS && window.PET_MOODS[mood])) return;
    currentMood = mood;
    if (tempMoodTimer) clearTimeout(tempMoodTimer);
    if (durationSec && durationSec > 0) {
      tempMoodTimer = setTimeout(() => {
        currentMood = 'idle';
      }, durationSec * 1000);
    }
  }
  function getMood() { return currentMood; }

  // ========== Sprite Sheet 预留架构 ==========
  const PET_SPRITES = {
    walk:  { sheet: 'pet-walk.png',  frames: 8,  fps: 12, frameWidth: 128, frameHeight: 128 },
    dance: { sheet: 'pet-dance.png', frames: 12, fps: 10, frameWidth: 128, frameHeight: 128 },
  };

  class SpriteRenderer {
    constructor(canvas, config) {
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.config = config;
      this.currentFrame = 0;
      this.lastFrameTime = 0;
    }
    play(animName) {
      const cfg = PET_SPRITES[animName];
      if (!cfg) return;
      this.config = cfg;
      this.currentFrame = 0;
    }
    renderFrame(frameIndex) {
      // 预留：绘制指定帧到 canvas
      // const sx = (frameIndex % cols) * this.config.frameWidth;
      // const sy = Math.floor(frameIndex / cols) * this.config.frameHeight;
    }
  }

  // ========== 导出 ==========
  return { init, start, stop, setMood, getMood, SpriteRenderer };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PetAnimation };
}
