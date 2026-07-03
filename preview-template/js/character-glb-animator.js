/**
 * Q3D GLB 部件分割动画器
 * 将 Hunyuan3D-2 生成的单体 GLB 模型自动分割为逻辑部件（头/身体/手臂/腿）
 * 然后应用与骨骼角色相同的心情动画系统
 *
 * 使用方式：
 *   import { createGLBAnimator } from './js/character-glb-animator.js';
 *   const animator = createGLBAnimator(THREE, gltfScene, options);
 *   scene.add(animator.group);
 *   animator.setMood('happy');
 *   animator.update(); // 动画循环中调用
 */

// 部件区域检测配置（基于归一化 Y 坐标）
const PART_ZONES = {
  head: { minY: 0.65, maxY: 1.0 },     // 顶部 35% = 头部
  body: { minY: 0.30, maxY: 0.65 },     // 中间 35% = 身体
  arms: { minY: 0.25, maxY: 0.65 },     // 中间偏上（与身体重叠，通过 X 区分）
  legs: { minY: 0.0, maxY: 0.30 },      // 底部 30% = 腿
};

// 动画定义（与 character-bones.js 保持一致）
const GLB_MOOD_ANIMATIONS = {
  idle: (parts, t) => {
    const breathe = Math.sin(t * Math.PI * 2 / 3) * 0.5 + 0.5;
    if (parts.body) {
      parts.body.position.y = breathe * 0.02;
      parts.body.rotation.x = breathe * 0.015 - 0.0075;
    }
    if (parts.head) {
      parts.head.rotation.x = breathe * 0.02 - 0.01;
    }
    if (parts.leftArm) {
      parts.leftArm.rotation.z = 0.15 + Math.sin(t * 2) * 0.03;
    }
    if (parts.rightArm) {
      parts.rightArm.rotation.z = -0.15 - Math.sin(t * 2) * 0.03;
    }
  },

  happy: (parts, t) => {
    const bounce = Math.abs(Math.sin(t * Math.PI * 4));
    if (parts.root) parts.root.position.y = bounce * 0.1;
    if (parts.head) {
      parts.head.rotation.z = Math.sin(t * 6) * 0.06;
      parts.head.rotation.y = Math.sin(t * 3) * 0.08;
    }
    if (parts.leftArm) parts.leftArm.rotation.z = 0.15 + bounce * 0.5;
    if (parts.rightArm) parts.rightArm.rotation.z = -0.15 - bounce * 0.5;
    if (parts.body) parts.body.rotation.z = Math.sin(t * 4) * 0.02;
  },

  excited: (parts, t) => {
    const jump = Math.abs(Math.sin(t * Math.PI * 5));
    if (parts.root) {
      parts.root.position.y = jump * 0.18;
      const sq = 1 + jump * 0.04;
      parts.root.scale.set(sq, 2 - sq, sq);
    }
    if (parts.head) parts.head.scale.setScalar(1 + jump * 0.06);
    if (parts.leftArm) parts.leftArm.rotation.z = 0.3 + jump * 0.8;
    if (parts.rightArm) parts.rightArm.rotation.z = -0.3 - jump * 0.8;
    if (parts.body) parts.body.rotation.z = Math.sin(t * 6) * 0.04;
  },

  sleeping: (parts, t) => {
    const breathe = Math.sin(t * Math.PI / 2) * 0.5 + 0.5;
    if (parts.root) {
      parts.root.position.y = -0.03 + breathe * 0.015;
      parts.root.rotation.z = Math.sin(t * 0.5) * 0.02;
    }
    if (parts.head) {
      parts.head.rotation.x = 0.12 + breathe * 0.015;
      parts.head.position.y = -0.03;
    }
    if (parts.leftArm) parts.leftArm.rotation.z = 0.35 + Math.sin(t * 0.8) * 0.03;
    if (parts.rightArm) parts.rightArm.rotation.z = -0.35 - Math.sin(t * 0.8) * 0.03;
    if (parts.body) parts.body.rotation.x = 0.05;
  },

  curious: (parts, t) => {
    const tiltCycle = t * 1.5;
    if (parts.head) {
      parts.head.rotation.z = Math.sin(tiltCycle) * 0.15;
      parts.head.position.x = Math.sin(tiltCycle) * 0.03;
    }
    if (parts.body) {
      parts.body.rotation.z = Math.sin(tiltCycle) * 0.04;
      parts.body.rotation.x = 0.04;
    }
    if (parts.leftArm) parts.leftArm.rotation.z = 0.15 + Math.sin(tiltCycle * 1.3) * 0.2;
    if (parts.rightArm) parts.rightArm.rotation.z = -0.12;
  },

  sad: (parts, t) => {
    if (parts.root) {
      parts.root.position.y = -0.03 + Math.sin(t * 0.8) * 0.008;
      parts.root.rotation.z = Math.sin(t * 10) * 0.008;
    }
    if (parts.head) {
      parts.head.rotation.x = 0.12;
      parts.head.position.y = -0.03;
    }
    if (parts.body) parts.body.rotation.x = 0.06;
    if (parts.leftArm) parts.leftArm.rotation.z = 0.45 + Math.sin(t * 8) * 0.015;
    if (parts.rightArm) parts.rightArm.rotation.z = -0.45 - Math.sin(t * 8 + 1) * 0.015;
  },

  love: (parts, t) => {
    const beat = (Math.sin(t * Math.PI * 4) + 1) / 2;
    const pulse = beat * beat;
    if (parts.root) parts.root.scale.setScalar(1 + pulse * 0.04);
    if (parts.head) {
      parts.head.scale.setScalar(1 + pulse * 0.03);
      parts.head.rotation.z = Math.sin(t * 2) * 0.04;
      parts.head.rotation.y = Math.sin(t * 1.5) * 0.06;
    }
    if (parts.leftArm) parts.leftArm.rotation.z = 0.3 + pulse * 0.3;
    if (parts.rightArm) parts.rightArm.rotation.z = -0.3 - pulse * 0.3;
    if (parts.body) parts.body.rotation.z = Math.sin(t * 2) * 0.015;
  },

  climbing: (parts, t) => {
    const climbCycle = t * 4;
    const armPhase = Math.sin(climbCycle);
    const armPhase2 = Math.sin(climbCycle + Math.PI);
    if (parts.body) {
      parts.body.rotation.z = 0.06;
      parts.body.rotation.x = -0.04;
    }
    if (parts.head) {
      parts.head.rotation.z = -0.04;
      parts.head.rotation.y = 0.08;
    }
    if (parts.leftArm) {
      parts.leftArm.rotation.z = 0.5 + armPhase * 0.4;
      parts.leftArm.rotation.x = -0.2 + armPhase * 0.3;
    }
    if (parts.rightArm) {
      parts.rightArm.rotation.z = -0.5 + armPhase2 * 0.4;
      parts.rightArm.rotation.x = -0.2 + armPhase2 * 0.3;
    }
    if (parts.root) parts.root.position.y = Math.sin(climbCycle) * 0.02;
  },

  crawling_upside: (parts, t) => {
    const crawlCycle = t * 3;
    const armPhase = Math.sin(crawlCycle);
    const armPhase2 = Math.sin(crawlCycle + Math.PI);
    if (parts.root) {
      parts.root.rotation.x = Math.PI;
      parts.root.rotation.z = 0;
    }
    if (parts.head) {
      parts.head.rotation.x = -0.1;
      parts.head.rotation.z = Math.sin(crawlCycle * 0.5) * 0.04;
    }
    if (parts.leftArm) {
      parts.leftArm.rotation.z = -0.4 + armPhase * 0.3;
      parts.leftArm.rotation.x = 0.15 + armPhase * 0.2;
    }
    if (parts.rightArm) {
      parts.rightArm.rotation.z = 0.4 + armPhase2 * 0.3;
      parts.rightArm.rotation.x = 0.15 + armPhase2 * 0.2;
    }
    if (parts.body) parts.body.rotation.z = Math.sin(crawlCycle) * 0.03;
  },
};

/**
 * 分析 GLB 模型并分割为逻辑部件
 * 策略：基于顶点 Y 坐标分布 + X 坐标区分左右
 */
function analyzeAndSegment(THREE, model) {
  const box = new THREE.Box3().setFromObject(model);
  const size = box.getSize(new THREE.Vector3());
  const center = box.getCenter(new THREE.Vector3());

  // 归一化坐标阈值
  const headThreshold = center.y + size.y * 0.2;
  const bodyThreshold = center.y - size.y * 0.1;
  const legThreshold = center.y - size.y * 0.35;
  const armXThreshold = center.x + size.x * 0.15;
  const armXThresholdNeg = center.x - size.x * 0.15;

  const parts = {
    head: new THREE.Group(),
    body: new THREE.Group(),
    leftArm: new THREE.Group(),
    rightArm: new THREE.Group(),
    legs: new THREE.Group(),
  };

  // 命名
  parts.head.name = 'part_head';
  parts.body.name = 'part_body';
  parts.leftArm.name = 'part_leftArm';
  parts.rightArm.name = 'part_rightArm';
  parts.legs.name = 'part_legs';

  // 遍历所有 Mesh，按位置分配到不同部件组
  const meshesToProcess = [];
  model.traverse((child) => {
    if (child.isMesh) {
      meshesToProcess.push(child);
    }
  });

  if (meshesToProcess.length === 0) {
    // 没有可处理的 mesh
    parts.body.add(model.clone());
    return { parts, isSegmented: false };
  }

  // 对于单体 mesh，尝试按顶点分割
  // 如果 mesh 数量 >= 3，按整体位置分配
  if (meshesToProcess.length >= 3) {
    for (const mesh of meshesToProcess) {
      const meshBox = new THREE.Box3().setFromObject(mesh);
      const meshCenter = meshBox.getCenter(new THREE.Vector3());

      let targetGroup;
      if (meshCenter.y > headThreshold) {
        targetGroup = parts.head;
      } else if (meshCenter.y < legThreshold) {
        targetGroup = parts.legs;
      } else if (meshCenter.x > armXThreshold && meshCenter.y > bodyThreshold) {
        targetGroup = parts.rightArm;
      } else if (meshCenter.x < armXThresholdNeg && meshCenter.y > bodyThreshold) {
        targetGroup = parts.leftArm;
      } else {
        targetGroup = parts.body;
      }

      // 克隆 mesh 到目标组（保持变换）
      const clone = mesh.clone();
      // 计算世界位置
      mesh.updateWorldMatrix(true, false);
      clone.applyMatrix4(mesh.matrixWorld);
      targetGroup.add(clone);
    }
    return { parts, isSegmented: true };
  }

  // 单体 mesh：整体作为身体，通过 pivot offset 模拟部件动画
  for (const mesh of meshesToProcess) {
    const clone = mesh.clone();
    mesh.updateWorldMatrix(true, false);
    clone.applyMatrix4(mesh.matrixWorld);
    parts.body.add(clone);
  }

  // 为头部区域创建一个虚拟 pivot
  // 通过裁剪上半部分作为头部动画目标
  parts.head.visible = false; // 单体 mesh 时隐藏独立头部组
  parts.leftArm.visible = false;
  parts.rightArm.visible = false;
  parts.legs.visible = false;

  return { parts, isSegmented: false, wholeModel: true };
}

/**
 * 创建 GLB 动画器
 * @param {THREE} THREE - Three.js 实例
 * @param {THREE.Object3D} gltfScene - GLTFLoader 加载的 gltf.scene
 * @param {Object} [options] - 配置
 * @returns {Object} 动画器对象
 */
export function createGLBAnimator(THREE, gltfScene, options = {}) {
  const { parts, isSegmented, wholeModel } = analyzeAndSegment(THREE, gltfScene);

  // 创建根组
  const rootGroup = new THREE.Group();
  rootGroup.name = 'glb_animator_root';

  // 创建 pivot 组（用于整体动画）
  const pivotGroup = new THREE.Group();
  pivotGroup.name = 'glb_pivot';

  // 添加部件到 pivot
  const animParts = {
    root: pivotGroup,
    head: parts.head,
    body: parts.body,
    leftArm: parts.leftArm,
    rightArm: parts.rightArm,
    legs: parts.legs,
  };

  pivotGroup.add(parts.head);
  pivotGroup.add(parts.body);
  pivotGroup.add(parts.leftArm);
  pivotGroup.add(parts.rightArm);
  pivotGroup.add(parts.legs);
  rootGroup.add(pivotGroup);

  // 保存初始状态
  const baseState = {};
  for (const [name, part] of Object.entries(animParts)) {
    baseState[name] = {
      position: part.position.clone(),
      rotation: part.rotation.clone(),
      scale: part.scale.clone(),
    };
  }

  function resetParts() {
    for (const [name, part] of Object.entries(animParts)) {
      const base = baseState[name];
      part.position.copy(base.position);
      part.rotation.copy(base.rotation);
      part.scale.copy(base.scale);
    }
  }

  // 动画状态
  let currentMood = 'idle';
  let moodTime = 0;
  let transitionTime = 0;
  const TRANSITION_DURATION = 0.3;

  const prevPartState = {};
  for (const [name, part] of Object.entries(animParts)) {
    prevPartState[name] = {
      position: part.position.clone(),
      rotation: part.rotation.clone(),
      scale: part.scale.clone(),
    };
  }

  function savePartState(state) {
    for (const [name, part] of Object.entries(animParts)) {
      state[name].position.copy(part.position);
      state[name].rotation.copy(part.rotation);
      state[name].scale.copy(part.scale);
    }
  }

  function lerpPartState(fromState, toState, t) {
    for (const [name, part] of Object.entries(animParts)) {
      const from = fromState[name];
      const to = toState[name];
      part.position.lerpVectors(from.position, to.position, t);
      part.rotation.x = from.rotation.x + (to.rotation.x - from.rotation.x) * t;
      part.rotation.y = from.rotation.y + (to.rotation.y - from.rotation.y) * t;
      part.rotation.z = from.rotation.z + (to.rotation.z - from.rotation.z) * t;
      part.scale.lerpVectors(from.scale, to.scale, t);
    }
  }

  const targetPartState = {};
  for (const name of Object.keys(animParts)) {
    targetPartState[name] = {
      position: new THREE.Vector3(),
      rotation: new THREE.Euler(),
      scale: new THREE.Vector3(),
    };
  }

  function setMood(moodName) {
    if (!GLB_MOOD_ANIMATIONS[moodName]) {
      console.warn(`[GLBAnimator] Unknown mood: ${moodName}`);
      return;
    }
    if (moodName === currentMood) return;
    savePartState(prevPartState);
    currentMood = moodName;
    moodTime = 0;
    transitionTime = 0;
  }

  const clock = new THREE.Clock();

  function update() {
    const delta = clock.getDelta();
    moodTime += delta;

    const animFn = GLB_MOOD_ANIMATIONS[currentMood];
    if (!animFn) return;

    if (transitionTime < TRANSITION_DURATION) {
      transitionTime += delta;
      const t = Math.min(transitionTime / TRANSITION_DURATION, 1);
      const easeT = t * t * (3 - 2 * t);

      resetParts();
      animFn(animParts, moodTime);
      savePartState(targetPartState);

      resetParts();
      lerpPartState(prevPartState, targetPartState, easeT);
    } else {
      resetParts();
      animFn(animParts, moodTime);
    }
  }

  // 初始姿态
  resetParts();
  GLB_MOOD_ANIMATIONS.idle(animParts, 0);

  return {
    group: rootGroup,
    parts: animParts,
    isSegmented,
    setMood,
    update,
    currentMood: () => currentMood,
  };
}

export const GLB_AVAILABLE_MOODS = Object.keys(GLB_MOOD_ANIMATIONS);
