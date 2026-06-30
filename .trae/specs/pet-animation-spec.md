# Phase 4 桌宠动画规范 — SVG 骨骼动画 + Sprite Sheet

## 1. 目标

将宠物头像从静态图片/简单 SVG 升级为可分层控制的 SVG 骨骼系统，7 种心情各对应独特姿态、表情、动画循环。

## 2. 技术架构

```
pet.html
├── SVG 宠物骨骼层 (id="pet-skeleton")
│   ├── <g id="bone-head">         <!-- 头部组，可旋转/位移 -->
│   │   ├── <image id="avatar-img"> <!-- 用户头像（圆形裁切）-->
│   │   ├── <g id="bone-eyes">     <!-- 眼睛组，独立眨眼动画 -->
│   │   │   ├── <ellipse id="eye-l"> <!-- 左眼 -->
│   │   │   └── <ellipse id="eye-r"> <!-- 右眼 -->
│   │   ├── <path id="mouth">      <!-- 嘴巴，不同心情变形 -->
│   │   └── <g id="cheeks">        <!-- 腮红，可透明度动画 -->
│   ├── <g id="bone-body">         <!-- 身体/手，可摆动 -->
│   └── <g id="fx-layer">          <!-- 特效层（爱心/星星/泪滴/Zzz） -->
├── 动画控制器 (assets/js/pet-animation.js)
│   ├── AnimationLoop (requestAnimationFrame)
│   ├── MoodStateMachine (心情状态机)
│   └── BoneTransformer (SVG transform 计算)
└── 心情定义表 (PET_MOODS)
```

## 3. PET_MOODS 定义

```javascript
const PET_MOODS = {
  idle:    { label: '平静', icon: '😌', anim: 'breathe',     eyeShape: 'normal',  mouth: 'neutral', color: '#FF8FAB' },
  happy:   { label: '开心', icon: '😊', anim: 'bounce',      eyeShape: 'happy',   mouth: 'smile',   color: '#FFD700' },
  excited: { label: '兴奋', icon: '🤩', anim: 'jump',        eyeShape: 'star',    mouth: 'open',    color: '#FF6B6B' },
  sleeping:{ label: '困倦', icon: '😴', anim: 'slow-breathe',eyeShape:'closed',   mouth: 'small',   color: '#B0C4DE' },
  curious: { label: '好奇', icon: '🤔', anim: 'tilt',        eyeShape: 'wide',    mouth: 'o',       color: '#87CEEB' },
  sad:     { label: '难过', icon: '😢', anim: 'shiver',      eyeShape: 'tear',    mouth: 'frown',   color: '#708090' },
  love:    { label: '喜爱', icon: '😍', anim: 'heartbeat',   eyeShape: 'heart',   mouth: 'smile',   color: '#FF69B4' },
};
```

## 4. SVG 骨骼分层

### 4.1 头部骨骼 (`#bone-head`)
- 圆形/椭圆形基础，支持 rotate/translate 变换
- 头像底图使用 `<image clip-path="url(#avatar-clip)">` 圆形裁切

### 4.2 眼睛骨骼 (`#bone-eyes`)
- 左右眼独立，支持 scaleY 眨眼、fill 颜色变化
- 7 种 eyeShape：normal / happy / star / closed / wide / tear / heart

### 4.3 嘴巴骨骼 (`#mouth`)
- 使用 `<path d="...">`，通过 `d` 属性插值实现嘴型变化
- 6 种 mouth：neutral / smile / frown / open / o / small

### 4.4 特效层 (`#fx-layer`)
- 心情特效粒子：爱心（love）、星星（excited）、泪滴（sad）、Zzz（sleeping）

## 5. 动画控制器 (`pet-animation.js`)

### 5.1 常驻动画
- **呼吸**：头部缩放 3%（sin 波，周期 3s）
- **眨眼**：随机间隔 3-6 秒，scaleY 1 → 0.1 → 1，耗时 150ms

### 5.2 心情动画
| 动画 | 描述 |
|------|------|
| breathe | 呼吸缩放 |
| bounce | 开心弹跳（sin 波上下位移） |
| jump | 兴奋跳跃（快速上下 + 缩放） |
| slow-breathe | 困倦慢呼吸（周期 5s） |
| tilt | 好奇歪头（rotate ±15°） |
| shiver | 难过颤抖（x 轴高频微震） |
| heartbeat | 喜爱心跳（缩放脉冲 + 爱心特效） |

### 5.3 嘴型变形
```javascript
const MOUTH_PATHS = {
  neutral: 'M 40,65 Q 50,65 60,65',
  smile:   'M 40,65 Q 50,75 60,65',
  frown:   'M 40,70 Q 50,60 60,70',
  open:    'M 42,62 Q 50,75 58,62 Q 50,55 42,62',
  o:       'M 47,65 A 3,3 0 1,1 47,64.9',
  small:   'M 47,67 Q 50,68 53,67',
};
```

## 6. 集成点

- `pet.html`: 重构 `#pet-head` 为 SVG 骨骼容器，引入 `pet-animation.js`
- `pet-nurture.js`: `getSummary()` 增加动画状态；互动后触发 3 秒心情动画
- `pet-llm-bridge.js`: 确保 `PET_MOODS` 全局对象在加载前可用

## 7. Sprite Sheet 预留架构

```javascript
const PET_SPRITES = {
  walk:  { sheet: 'pet-walk.png',  frames: 8,  fps: 12 },
  dance: { sheet: 'pet-dance.png', frames: 12, fps: 10 },
};

class SpriteRenderer {
  constructor(canvas, config) { /* 预留 */ }
  play(animName) { /* 预留 */ }
}
```

## 8. 验收标准

| 检查项 | 标准 |
|--------|------|
| 7 种心情 SVG 视觉区分 | 每种心情有独特眼睛 + 嘴型 + 专属动画 |
| 常驻生命动画 | 呼吸 + 眨眼持续运行 |
| 心情切换过渡 | 0.3s 内完成嘴型/颜色/动画过渡 |
| 向后兼容 | 无 avatar 时显示完整 SVG 默认形象；有 avatar 时头像底图 + 动态表情层 |
| 性能 | requestAnimationFrame 占用 < 5% CPU |
| 浏览器兼容 | Chrome/Edge/Firefox/Safari 均正常显示 SVG 动画 |
