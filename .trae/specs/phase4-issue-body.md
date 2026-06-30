## 目标

将宠物头像从静态图片/简单 SVG 升级为可分层控制的 SVG 骨骼系统，7 种心情各对应独特姿态、表情、动画循环。

## 技术方案

### 架构

```
pet.html
├── SVG 宠物骨骼层 (id="pet-skeleton")
│   ├── <g id="bone-head">         <!-- 头部组 -->
│   │   ├── <image id="avatar-img"> <!-- 用户头像 -->
│   │   ├── <g id="bone-eyes">     <!-- 眼睛组 -->
│   │   ├── <path id="mouth">      <!-- 嘴巴 -->
│   │   └── <g id="cheeks">        <!-- 腮红 -->
│   └── <g id="fx-layer">          <!-- 特效层 -->
├── 动画控制器 (assets/js/pet-animation.js)
│   ├── AnimationLoop (requestAnimationFrame)
│   ├── MoodStateMachine
│   └── BoneTransformer
└── 心情定义表 (PET_MOODS)
```

### 实施步骤

- [ ] Step 1: 定义 `PET_MOODS` 全局对象（7 种心情的动画配置）
- [ ] Step 2: 创建 SVG 骨骼素材（重构 `#pet-head` 为 SVG 骨骼容器）
- [ ] Step 3: 实现 `pet-animation.js` 动画控制器（呼吸 + 眨眼 + 心情动画）
- [ ] Step 4: 集成到 `pet.html` 和 `pet-nurture.js`
- [ ] Step 5: 完善心情触发逻辑（对话检测/互动反馈/双击随机）
- [ ] Step 6: Sprite Sheet 架构预留

### 验收标准

| 检查项 | 标准 |
|--------|------|
| 7 种心情 SVG 视觉区分 | 每种心情有独特眼睛 + 嘴型 + 专属动画 |
| 常驻生命动画 | 呼吸 + 眨眼持续运行 |
| 心情切换过渡 | 0.3s 内完成过渡 |
| 向后兼容 | 无 avatar 时显示默认 SVG；有 avatar 时头像 + 动态层 |
| 性能 | requestAnimationFrame 占用 < 5% CPU |

## 关联文件

- `pet-template/pet.html`
- `assets/js/pet-animation.js` (新增)
- `assets/js/pet-nurture.js` (修改)
- `assets/js/pet-llm-bridge.js` (修改)
- `.trae/specs/pet-animation-spec.md`
