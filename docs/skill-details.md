# Q3D Skill 详细用法

## q3d-avatar-creator

### 触发词

以下任意表述均可触发 Skill：
- "生成我的 Q 版形象"
- "我想做个卡通头像"
- "上传照片变 Q 版"
- "创建虚拟角色"
- "Q版3D形象"
- "形象造梦机"
- "桌面宠物"
- "宠物养成"
- "生成艺术"
- "作品画廊"

### 完整对话流程

```
用户：生成我的 Q 版形象
TRAE：好呀！Q3D形象造梦机已启动 🎨 请上传你的照片~

用户：[上传照片]
TRAE：收到！想要哪种风格？
      [软萌大头] [国风Q版] [潮玩手办] [简约卡通]

用户：软萌大头
TRAE：[调用 q3d_upload_photo + 生成形象]
      生成完成！保存至 assets/generated/{sessionId}/avatar.png
      接下来可以：
      [骨骼预览] [领养宠物] [重新生成] [换风格] [生成艺术] [查看作品]

用户：骨骼预览
TRAE：[调用 q3d_create_bones_preview]
      已打开 3D 骨骼动画预览 🦴 共 9 种动画：
      平静/开心/兴奋/困倦/好奇/难过/喜爱/攀爬/倒挂

用户：领养宠物
TRAE：[调用 q3d_spawn_pet]
      桌面宠物已生成并打开！点击宠物开始对话~
      还可以喂食、玩耍、改名哦 🐾

用户：喂食
TRAE：[调用 q3d_pet_care action=feed]
      小Q吃饱啦，好开心！（+15 经验，当前 Lv.1）
```

### 核心功能总览

| 功能模块 | 说明 | 关键工具 |
|---------|------|---------|
| AI 形象生成 | 4 种风格，TRAE Native 三级降级 | `q3d_generate_avatar` |
| 3D 骨骼动画 | 9 种动画（7 心情 + 2 行为） | `q3d_create_bones_preview` |
| 桌面宠物 | PiP 置顶 + AI 对话 | `q3d_spawn_pet` |
| 宠物养成 | 200 级好感度系统 | `q3d_pet_care` |
| 心情系统 | 9 种心情/行为切换 | `q3d_control_mood` |
| 作品画廊 | 作品管理与统计 | `q3d_manage_gallery` |
| 生成艺术 | Dream Lattice 粒子艺术 | `q3d_generate_dream_lattice` |
| 项目信息 | 配置/状态/功能查询 | `q3d_get_project_info` |

### TRAE Native 架构

Q3D 采用 TRAE Native 优先的三级降级架构：

```
TRAE Native（内置 Vision + GenerateImage）
    ↓ 失败时降级
External API（OpenAI 兼容接口）
    ↓ 失败时降级
Mock（本地模拟数据）
```

**优势**：
- 零配置即可使用（TRAE 内置能力）
- 自动降级，永不掉线
- 可配置外部 API 提升质量

### 环境要求

- Node.js >= 18
- npm >= 9
- 操作系统：Windows / macOS / Linux
- 浏览器：Chrome / Edge（推荐，支持 PiP）/ Firefox / Safari

### API 配置指南

#### TRAE Native（推荐，零配置）

无需任何配置，直接使用 TRAE 内置的图像生成能力。

#### OpenAI 兼容接口

1. 访问 API 服务商控制台创建 API Key
2. 在 `mcp-server/.env` 中填写：
   ```
   Q3D_API_KEY=sk-xxxxxxxx
   Q3D_API_BASE=https://api.openai.com/v1
   ```

#### 阿里云百炼

1. 访问 https://bailian.console.aliyun.com/ 获取 API Key
2. 在 `mcp-server/.env` 中填写：
   ```
   Q3D_API_KEY=sk-xxxxxxxx
   Q3D_API_BASE=https://dashscope.aliyuncs.com/compatible-mode/v1
   ```

### 3D 骨骼动画系统

基于 Three.js Bone 层级的程序化骨骼角色系统，采用手动驱动方式（不依赖 AnimationMixer），性能更优、调试更方便。

**骨骼结构（7 根骨骼）**：
- root（根节点）
- spine（脊柱）
- head（头部）
- leftArm / rightArm（左右手臂）
- leftLeg / rightLeg（左右腿）

**9 种动画**：

| 动画 ID | 名称 | 类型 | 描述 |
|---------|------|------|------|
| idle | 平静 | 心情 | 缓慢呼吸 + 轻微摇摆 |
| happy | 开心 | 心情 | 弹跳 + 手臂挥动 |
| excited | 兴奋 | 心情 | 跳跃 + 全身缩放 + 高举双手 |
| sleeping | 困倦 | 心情 | 慢速呼吸 + 低头 + 放松 |
| curious | 好奇 | 心情 | 歪头 + 前倾 + 手臂微抬 |
| sad | 难过 | 心情 | 下垂 + 颤抖 + 低头含胸 |
| love | 喜爱 | 心情 | 心跳脉冲 + 双手抱胸 |
| climbing | 攀爬 | 行为 | 向上攀爬姿态（借鉴 Shimeji 经典行为） |
| crawling_upside | 倒挂 | 行为 | 顶部倒挂爬行（借鉴 WindowPet 开源项目） |

**技术特点**：
- 0.3 秒平滑过渡（smoothstep 缓动）
- 每根骨骼独立状态管理
- 自动降级到几何角色（骨骼系统失败时）

### 宠物养成系统

#### 等级系统
- 最高 200 级
- 每级经验增长系数 1.15
- 喂食/玩耍均可获得经验

#### 五维属性
| 属性 | 说明 | 范围 |
|------|------|------|
| 好感度 | 宠物与主人的亲密程度 | 0-100 |
| 饱食度 | 饥饿程度，喂食可恢复 | 0-100 |
| 精力值 | 玩耍消耗，休息恢复 | 0-100 |
| 清洁度 | 卫生状态 | 0-100 |
| 快乐值 | 心情好坏的量化 | 0-100 |

#### 四种性格
| 性格 | 特点 |
|------|------|
| friendly（友好） | 互动时快乐值提升更多 |
| naughty（调皮） | 玩耍时经验更多 |
| lazy（慵懒） | 精力消耗更少 |
| shy（害羞） | 好感度提升较慢但更持久 |

#### 互动方式
- **喂食**：小食（+15 饱食）/ 正餐（+40 饱食）/ 甜点（+20 快乐）
- **玩耍**：玩球 / 追逐 / 解谜（不同经验和精力消耗）
- **改名**：自定义宠物名字（最多 20 字符）
- **设置性格**：切换宠物性格类型

### Dream Lattice 生成艺术

基于 p5.js 的粒子升腾生成艺术，4 种风格色板：

| 风格 | 色调 | 氛围 |
|------|------|------|
| kawaii（软萌粉） | 粉色系 | 甜美梦幻 |
| guofeng（国风沙） | 金棕红系 | 古典雅致 |
| trendy（潮玩霓虹） | 蓝紫霓虹 | 赛博朋克 |
| simple（简约灰） | 灰阶系 | 极简高级 |

**可调参数**：粒子数量（30-300）、动画速度（慢/正常/快）

### 故障排查

| 问题 | 原因 | 解决 |
|---|---|---|
| "API 未配置" | 未配置外部 API | 使用 TRAE Native 模式（默认），或配置 API Key |
| "API 调用超时" | 网络问题或 API 服务不稳定 | 自动降级到 TRAE Native / Mock |
| "额度不足" | API 账户余额用完 | 切换到 TRAE Native 模式 |
| "内容审核拒绝" | 图片内容触发安全策略 | 尝试其他照片 |
| "3D 预览黑屏" | 浏览器 WebGL 不支持 | 使用 Chrome/Edge，开启硬件加速 |
| "宠物页面打不开" | 浏览器安全策略阻止本地文件 | 使用 Chrome/Edge，或通过 HTTP 服务器访问 |
| "PiP 置顶失败" | 浏览器不支持 Document PiP | 升级至 Chrome/Edge 116+ |
| "骨骼动画不显示" | 浏览器缓存旧版本 | 强制刷新页面（Ctrl+Shift+R） |

### MCP 工具清单（共 15 个）

#### 核心工具（5 个）

| 工具名 | 功能 | 输入参数 | 输出 |
|---|---|---|---|
| `q3d_health_check` | 健康检查 | 无 | 服务状态、Provider 状态 |
| `q3d_upload_photo` | 保存上传照片 | `imagePath`, `style` | `uploadId`, `savedPath` |
| `q3d_generate_avatar` | 生成 Q 版形象 | `uploadId`, `style`, `customPrompt` | `avatarPath`, `metadataPath` |
| `q3d_save_avatar` | 保存已生成头像 | `imagePath`, `uploadId`, `style` | `avatarPath` |
| `q3d_regenerate_avatar` | 重新生成/换风格 | `workId`, `newStyle`, `reason` | `newWorkId`, `nextStep` |

#### 3D 工具（3 个）

| 工具名 | 功能 | 输入参数 | 输出 |
|---|---|---|---|
| `q3d_generate_3d_model` | 转换 3D GLB 模型 | `avatarPath`, `provider` | `glbPath` |
| `q3d_create_3d_preview` | 创建 3D 预览页 | `avatarPath`, `sessionId` | `previewPath` |
| `q3d_create_bones_preview` | 骨骼动画预览 | `avatarPath`, `mood`, `autoRotate` | `previewPath`, `availableAnimations` |

#### 宠物工具（4 个）

| 工具名 | 功能 | 输入参数 | 输出 |
|---|---|---|---|
| `q3d_spawn_pet` | 创建桌面宠物 | `avatarPath`, `personality`, `name` | `petUrl`, `sessionId` |
| `q3d_chat_with_pet` | 与宠物对话 | `message`, `sessionId`, `personality` | `reply`, `emotion` |
| `q3d_control_mood` | 心情系统控制 | `action`, `mood`, `sessionId`, `target` | `currentMood`, `moodInfo` |
| `q3d_pet_care` | 宠物养成系统 | `action`, `sessionId`, `name`, `foodType`, `playType` | `pet`, `leveledUp` |

#### 实用工具（3 个）

| 工具名 | 功能 | 输入参数 | 输出 |
|---|---|---|---|
| `q3d_manage_gallery` | 作品画廊管理 | `action`, `workId`, `limit`, `style`, `status` | `works`, `stats` |
| `q3d_generate_dream_lattice` | Dream Lattice 生成艺术 | `style`, `particleCount`, `speed` | `outputPath`, `styleName` |
| `q3d_get_project_info` | 项目信息查询 | `infoType` | `config`, `providers`, `stats`, `features`, `tools` |

### 作品状态流转

```
uploaded（已上传）
    ↓
avatar_generated（形象已生成）
    ↓
bones_preview_created（骨骼预览已创建）
    ↓
preview_created（3D预览已创建）
    ↓
model_generated（3D模型已生成）
    ↓
pet_spawned（宠物已领养）
```
