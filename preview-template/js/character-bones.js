/**
 * Q3D 程序化骨骼角色系统 v2
 * 使用 Three.js Bone 层级 + 手动动画驱动（不依赖 AnimationMixer 轨道解析）
 * 支持 7 种心情动画：idle / happy / excited / sleeping / curious / sad / love
 *
 * 使用方式：
 *   import { createBonesCharacter } from './js/character-bones.js';
 *   const char = createBonesCharacter(THREE, avatarTexture);
 *   scene.add(char.group);
 *   char.setMood('happy');
 *   char.update(); // 在动画循环中调用
 */

// 角色配置
const CHAR_CONFIG = {
  headRadius: 1.0,
  bodyHeight: 1.0,
  bodyTopRadius: 0.5,
  bodyBottomRadius: 0.65,
  armLength: 0.6,
  armRadius: 0.18,
  legLength: 0.5,
  legRadius: 0.2,
  colors: {
    skin: 0xFFE4D0,
    body: 0xA8E6CF,
    arms: 0xFFD93D,
    legs: 0xB4D7F0,
    cheeks: 0xFFB6C1,
  }
};

/**
 * 动画驱动函数
 * 每个心情定义一个 update(bones, t) 函数，t 为累计时间（秒）
 */
const MOOD_ANIMATIONS = {
  idle: (bones, t) => {
    // 缓慢呼吸 + 轻微摇摆
    const breathe = Math.sin(t * Math.PI * 2 / 3) * 0.5 + 0.5; // 0~1
    bones.spine.position.y = breathe * 0.03;
    bones.spine.rotation.x = breathe * 0.02 - 0.01;
    bones.head.rotation.x = breathe * 0.03 - 0.015;
    // 手臂自然下垂
    bones.leftArm.rotation.z = 0.3 + Math.sin(t * 2) * 0.05;
    bones.rightArm.rotation.z = -0.3 - Math.sin(t * 2) * 0.05;
  },

  happy: (bones, t) => {
    // 弹跳 + 头部摆动 + 手臂挥动
    const bounce = Math.abs(Math.sin(t * Math.PI * 4));
    bones.root.position.y = bounce * 0.15;
    bones.head.rotation.z = Math.sin(t * 6) * 0.08;
    bones.head.rotation.y = Math.sin(t * 3) * 0.1;
    // 手臂上下挥动
    const armWave = Math.sin(t * Math.PI * 6) * 0.5 + 0.5;
    bones.leftArm.rotation.z = 0.3 + armWave * 0.9;
    bones.rightArm.rotation.z = -0.3 - armWave * 0.9;
    bones.spine.rotation.z = Math.sin(t * 4) * 0.03;
  },

  excited: (bones, t) => {
    // 跳跃 + 全身缩放 + 手臂高举
    const jump = Math.abs(Math.sin(t * Math.PI * 5));
    bones.root.position.y = jump * 0.25;
    // 挤压拉伸（squash & stretch）
    const sq = 1 + jump * 0.05;
    bones.root.scale.set(sq, 2 - sq, sq);
    bones.head.scale.setScalar(1 + jump * 0.08);
    // 手臂高举
    const armUp = Math.sin(t * Math.PI * 5) * 0.3 + 0.7;
    bones.leftArm.rotation.z = 0.5 + armUp * 1.0;
    bones.rightArm.rotation.z = -0.5 - armUp * 1.0;
    bones.spine.rotation.z = Math.sin(t * 6) * 0.05;
  },

  sleeping: (bones, t) => {
    // 慢速呼吸 + 身体微晃 + 低头
    const breathe = Math.sin(t * Math.PI / 2) * 0.5 + 0.5;
    bones.root.position.y = -0.05 + breathe * 0.02;
    bones.root.rotation.z = Math.sin(t * 0.5) * 0.03;
    bones.head.rotation.x = 0.1 + breathe * 0.02; // 低头
    bones.head.position.y = -0.05 + breathe * 0.01;
    // 手臂放松
    bones.leftArm.rotation.z = 0.55 + Math.sin(t * 0.8) * 0.05;
    bones.rightArm.rotation.z = -0.55 - Math.sin(t * 0.8) * 0.05;
    bones.spine.rotation.x = 0.08;
  },

  curious: (bones, t) => {
    // 歪头 + 前倾 + 手臂微抬
    const tiltCycle = t * 1.5;
    bones.head.rotation.z = Math.sin(tiltCycle) * 0.2;
    bones.head.position.x = Math.sin(tiltCycle) * 0.05;
    bones.head.position.y = 0.04 + Math.sin(tiltCycle * 2) * 0.02;
    bones.spine.rotation.z = Math.sin(tiltCycle) * 0.05;
    bones.spine.rotation.x = 0.05; // 前倾
    // 一只手抬起
    bones.leftArm.rotation.z = 0.3 + Math.sin(tiltCycle * 1.3) * 0.3;
    bones.rightArm.rotation.z = -0.25;
  },

  sad: (bones, t) => {
    // 下垂 + 颤抖 + 低头
    bones.root.position.y = -0.05 + Math.sin(t * 0.8) * 0.01;
    bones.head.rotation.x = 0.15; // 低头
    bones.head.position.y = -0.05;
    bones.spine.rotation.x = 0.08; // 含胸
    // 肩膀下垂
    bones.leftArm.rotation.z = 0.7 + Math.sin(t * 8) * 0.02; // 微颤抖
    bones.rightArm.rotation.z = -0.7 - Math.sin(t * 8 + 1) * 0.02;
    // 身体微微颤抖
    bones.root.rotation.z = Math.sin(t * 10) * 0.01;
  },

  love: (bones, t) => {
    // 心跳脉冲 + 头部轻晃 + 双手抱胸
    const beat = (Math.sin(t * Math.PI * 4) + 1) / 2; // 0~1 心跳节奏
    const pulse = beat * beat; // 更尖锐的脉冲
    bones.root.scale.setScalar(1 + pulse * 0.06);
    bones.head.scale.setScalar(1 + pulse * 0.05);
    // 头部左右轻摆
    bones.head.rotation.z = Math.sin(t * 2) * 0.05;
    bones.head.rotation.y = Math.sin(t * 1.5) * 0.08;
    // 双手抱胸（靠近身体）
    const hug = 0.5 + pulse * 0.3;
    bones.leftArm.rotation.z = 0.5 + hug * 0.5;
    bones.rightArm.rotation.z = -0.5 - hug * 0.5;
    bones.spine.rotation.z = Math.sin(t * 2) * 0.02;
  },

  // 攀爬行为（借鉴 WindowPet / Shimeji）—— 向上攀爬姿态
  climbing: (bones, t) => {
    // 身体侧转 + 双手交替向上爬
    const climbCycle = t * 4; // 攀爬速度
    const armPhase = Math.sin(climbCycle);
    const armPhase2 = Math.sin(climbCycle + Math.PI);

    // 身体微微倾斜，呈攀爬姿态
    bones.spine.rotation.z = 0.08;
    bones.spine.rotation.x = -0.05;
    bones.head.rotation.z = -0.05;
    bones.head.rotation.y = 0.1; // 脸朝前方
    bones.head.position.y = 0.02;

    // 双手交替向上伸（攀爬动作）
    bones.leftArm.rotation.z = 0.8 + armPhase * 0.5;
    bones.leftArm.rotation.x = -0.3 + armPhase * 0.4;
    bones.rightArm.rotation.z = -0.8 + armPhase2 * 0.5;
    bones.rightArm.rotation.x = -0.3 + armPhase2 * 0.4;

    // 身体随攀爬轻微上下浮动
    bones.root.position.y = Math.sin(climbCycle) * 0.03;
  },

  // 倒挂爬行（借鉴 WindowPet / Shimeji）—— 顶部倒挂行走
  crawling_upside: (bones, t) => {
    // 全身翻转 180 度 + 双手交替抓握移动
    const crawlCycle = t * 3;
    const armPhase = Math.sin(crawlCycle);
    const armPhase2 = Math.sin(crawlCycle + Math.PI);

    // 全身倒挂
    bones.root.rotation.x = Math.PI;
    bones.root.rotation.z = 0; // 保持正面

    // 头部微微抬起（倒过来时脸朝下看）
    bones.head.rotation.x = -0.15;
    bones.head.rotation.z = Math.sin(crawlCycle * 0.5) * 0.05;

    // 双手交替向前抓（倒挂行走）
    bones.leftArm.rotation.z = -0.6 + armPhase * 0.4;
    bones.leftArm.rotation.x = 0.2 + armPhase * 0.3;
    bones.rightArm.rotation.z = 0.6 + armPhase2 * 0.4;
    bones.rightArm.rotation.x = 0.2 + armPhase2 * 0.3;

    // 身体随步伐轻微晃动
    bones.spine.rotation.z = Math.sin(crawlCycle) * 0.04;
  },
};

/**
 * 创建带骨骼的 Q 版角色
 * @param {THREE} THREE - Three.js 实例
 * @param {THREE.Texture} [avatarTexture] - 头像贴图（可选）
 * @param {Object} [options] - 配置选项
 * @returns {Object} 角色对象
 */
export function createBonesCharacter(THREE, avatarTexture = null, options = {}) {
  const config = { ...CHAR_CONFIG, ...options };
  const { Vector3, Bone, Group } = THREE;

  // ===== 1. 创建骨骼层级 =====
  const rootBone = new Bone();
  rootBone.name = 'root';

  const spineBone = new Bone();
  spineBone.name = 'spine';
  spineBone.position.y = config.bodyHeight / 2;
  rootBone.add(spineBone);

  const headBone = new Bone();
  headBone.name = 'head';
  headBone.position.y = config.bodyHeight / 2 + config.headRadius * 0.3;
  spineBone.add(headBone);

  const leftArmBone = new Bone();
  leftArmBone.name = 'leftArm';
  leftArmBone.position.set(-config.bodyTopRadius - 0.1, config.bodyHeight * 0.6, 0);
  spineBone.add(leftArmBone);

  const rightArmBone = new Bone();
  rightArmBone.name = 'rightArm';
  rightArmBone.position.set(config.bodyTopRadius + 0.1, config.bodyHeight * 0.6, 0);
  spineBone.add(rightArmBone);

  const leftLegBone = new Bone();
  leftLegBone.name = 'leftLeg';
  leftLegBone.position.set(-config.bodyBottomRadius * 0.4, -config.bodyHeight / 2, 0);
  rootBone.add(leftLegBone);

  const rightLegBone = new Bone();
  rightLegBone.name = 'rightLeg';
  rightLegBone.position.set(config.bodyBottomRadius * 0.4, -config.bodyHeight / 2, 0);
  rootBone.add(rightLegBone);

  // 保存骨骼引用
  const bones = {
    root: rootBone,
    spine: spineBone,
    head: headBone,
    leftArm: leftArmBone,
    rightArm: rightArmBone,
    leftLeg: leftLegBone,
    rightLeg: rightLegBone,
  };

  // 保存骨骼初始状态（用于重置）
  const boneBaseState = {};
  for (const [name, bone] of Object.entries(bones)) {
    boneBaseState[name] = {
      position: bone.position.clone(),
      rotation: bone.rotation.clone(),
      scale: bone.scale.clone(),
    };
  }

  // ===== 2. 创建身体部位网格并绑定到骨骼 =====
  const characterGroup = new Group();
  characterGroup.add(rootBone);

  // Toon gradient
  const gradientMap = options.gradientMap || null;

  function createMaterial(color, map = null) {
    if (gradientMap) {
      return new THREE.MeshToonMaterial({
        color,
        gradientMap,
        ...(map ? { map } : {}),
      });
    }
    return new THREE.MeshStandardMaterial({
      color,
      roughness: 0.5,
      metalness: 0.1,
      ...(map ? { map } : {}),
    });
  }

  // 头部
  const headGeo = new THREE.SphereGeometry(config.headRadius, 32, 32);
  const headMat = avatarTexture
    ? createMaterial(0xffffff, avatarTexture)
    : createMaterial(config.colors.skin);
  const headMesh = new THREE.Mesh(headGeo, headMat);
  headMesh.castShadow = true;
  headBone.add(headMesh);

  // 腮红
  const cheekGeo = new THREE.SphereGeometry(0.15, 16, 16);
  const cheekMat = new THREE.MeshBasicMaterial({
    color: config.colors.cheeks,
    transparent: true,
    opacity: 0.5,
  });
  const leftCheek = new THREE.Mesh(cheekGeo, cheekMat);
  leftCheek.position.set(-0.4, -0.15, config.headRadius * 0.85);
  headBone.add(leftCheek);
  const rightCheek = new THREE.Mesh(cheekGeo, cheekMat.clone());
  rightCheek.position.set(0.4, -0.15, config.headRadius * 0.85);
  headBone.add(rightCheek);

  // 眼睛（用小球体模拟）
  const eyeGeo = new THREE.SphereGeometry(0.12, 16, 16);
  const eyeMat = new THREE.MeshBasicMaterial({ color: 0x333333 });
  const leftEye = new THREE.Mesh(eyeGeo, eyeMat);
  leftEye.position.set(-0.3, 0.1, config.headRadius * 0.88);
  headBone.add(leftEye);
  const rightEye = new THREE.Mesh(eyeGeo, eyeMat.clone());
  rightEye.position.set(0.3, 0.1, config.headRadius * 0.88);
  headBone.add(rightEye);

  // 眼睛高光
  const eyeShineGeo = new THREE.SphereGeometry(0.04, 8, 8);
  const eyeShineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const leftShine = new THREE.Mesh(eyeShineGeo, eyeShineMat);
  leftShine.position.set(-0.26, 0.14, config.headRadius * 0.97);
  headBone.add(leftShine);
  const rightShine = new THREE.Mesh(eyeShineGeo, eyeShineMat.clone());
  rightShine.position.set(0.34, 0.14, config.headRadius * 0.97);
  headBone.add(rightShine);

  // 身体（圆柱）
  const bodyGeo = new THREE.CylinderGeometry(config.bodyTopRadius, config.bodyBottomRadius, config.bodyHeight, 24);
  const bodyMat = createMaterial(config.colors.body);
  const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
  bodyMesh.castShadow = true;
  spineBone.add(bodyMesh);

  // 手臂（胶囊体）
  const armGeo = new THREE.CapsuleGeometry(config.armRadius, config.armLength, 8, 16);
  const armMat = createMaterial(config.colors.arms);

  const leftArmMesh = new THREE.Mesh(armGeo, armMat);
  leftArmMesh.rotation.z = Math.PI / 2;
  leftArmMesh.position.x = -config.armLength / 2;
  leftArmMesh.castShadow = true;
  leftArmBone.add(leftArmMesh);

  const rightArmMesh = new THREE.Mesh(armGeo, armMat.clone());
  rightArmMesh.rotation.z = -Math.PI / 2;
  rightArmMesh.position.x = config.armLength / 2;
  rightArmMesh.castShadow = true;
  rightArmBone.add(rightArmMesh);

  // 腿部
  const legGeo = new THREE.CapsuleGeometry(config.legRadius, config.legLength, 8, 16);
  const legMat = createMaterial(config.colors.legs);

  const leftLegMesh = new THREE.Mesh(legGeo, legMat);
  leftLegMesh.position.y = -config.legLength / 2;
  leftLegMesh.castShadow = true;
  leftLegBone.add(leftLegMesh);

  const rightLegMesh = new THREE.Mesh(legGeo, legMat.clone());
  rightLegMesh.position.y = -config.legLength / 2;
  rightLegMesh.castShadow = true;
  rightLegBone.add(rightLegMesh);

  // ===== 3. 动画状态 =====
  let currentMood = 'idle';
  let moodTime = 0;
  let transitionTime = 0;
  const TRANSITION_DURATION = 0.3; // 过渡时间（秒）

  // 记录上一帧的骨骼状态（用于过渡）
  const prevBoneState = {};
  for (const [name, bone] of Object.entries(bones)) {
    prevBoneState[name] = {
      position: bone.position.clone(),
      rotation: bone.rotation.clone(),
      scale: bone.scale.clone(),
    };
  }

  // 重置骨骼到初始状态
  function resetBonesToBase() {
    for (const [name, bone] of Object.entries(bones)) {
      const base = boneBaseState[name];
      bone.position.copy(base.position);
      bone.rotation.copy(base.rotation);
      bone.scale.copy(base.scale);
    }
  }

  // 保存当前骨骼状态
  function saveBoneState(state) {
    for (const [name, bone] of Object.entries(bones)) {
      state[name].position.copy(bone.position);
      state[name].rotation.copy(bone.rotation);
      state[name].scale.copy(bone.scale);
    }
  }

  // 线性插值骨骼状态
  function lerpBoneState(fromState, toState, t) {
    for (const [name, bone] of Object.entries(bones)) {
      const from = fromState[name];
      const to = toState[name];
      bone.position.lerpVectors(from.position, to.position, t);
      bone.rotation.x = from.rotation.x + (to.rotation.x - from.rotation.x) * t;
      bone.rotation.y = from.rotation.y + (to.rotation.y - from.rotation.y) * t;
      bone.rotation.z = from.rotation.z + (to.rotation.z - from.rotation.z) * t;
      bone.scale.lerpVectors(from.scale, to.scale, t);
    }
  }

  // 临时存储目标状态
  const targetBoneState = {};
  for (const name of Object.keys(bones)) {
    targetBoneState[name] = {
      position: new Vector3(),
      rotation: new THREE.Euler(),
      scale: new Vector3(),
    };
  }

  // ===== 4. 心情切换 =====
  function setMood(moodName) {
    if (!MOOD_ANIMATIONS[moodName]) {
      console.warn(`[BonesCharacter] Unknown mood: ${moodName}`);
      return;
    }
    if (moodName === currentMood) return;

    // 保存当前状态作为过渡起点
    saveBoneState(prevBoneState);
    currentMood = moodName;
    moodTime = 0;
    transitionTime = 0;
  }

  // ===== 5. 更新方法 =====
  const clock = new THREE.Clock();

  function update() {
    const delta = clock.getDelta();
    moodTime += delta;

    const animFn = MOOD_ANIMATIONS[currentMood];
    if (!animFn) return;

    if (transitionTime < TRANSITION_DURATION) {
      // 过渡阶段：先计算目标姿态，再插值
      transitionTime += delta;
      const t = Math.min(transitionTime / TRANSITION_DURATION, 1);
      const easeT = t * t * (3 - 2 * t); // smoothstep

      // 先计算目标姿态
      resetBonesToBase();
      animFn(bones, moodTime);
      saveBoneState(targetBoneState);

      // 从旧姿态插值到新姿态
      resetBonesToBase();
      lerpBoneState(prevBoneState, targetBoneState, easeT);
    } else {
      // 正常播放
      resetBonesToBase();
      animFn(bones, moodTime);
    }
  }

  // 初始姿态
  resetBonesToBase();
  MOOD_ANIMATIONS.idle(bones, 0);

  // 调整整体位置
  characterGroup.position.y += 0.5;

  return {
    group: characterGroup,
    bones,
    meshes: {
      head: headMesh,
      body: bodyMesh,
      leftArm: leftArmMesh,
      rightArm: rightArmMesh,
      leftLeg: leftLegMesh,
      rightLeg: rightLegMesh,
    },
    setMood,
    update,
    currentMood: () => currentMood,
  };
}

// 导出可用的心情列表
export const AVAILABLE_MOODS = Object.keys(MOOD_ANIMATIONS);

// 导出配置
export { CHAR_CONFIG, MOOD_ANIMATIONS };
