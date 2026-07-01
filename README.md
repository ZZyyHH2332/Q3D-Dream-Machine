# Q3D 形象造梦机

> TRAE Native 创作工作流 —— 在 TRAE 对话中完成 Q 版 3D 虚拟形象全链路生成

## 项目简介

Q3D 形象造梦机是一款面向普通用户的 AI 虚拟形象生成工具。不再是一个需要打开的网页，而是**直接嵌入 TRAE 的 Skill + MCP Server 工作流**。用户在 TRAE 对话框中上传照片、选择风格，AI 自动完成 Q 版形象生成、3D 预览、桌面宠物领养的全流程。

**核心体验**：打开 TRAE → 说"生成我的 Q 版形象" → 上传照片 → 获得专属 3D 角色 + 桌面宠物。

## 架构

```
User (TRAE Chat)
    |
    v
TRAE Skill: q3d-avatar-creator
    |
    v
MCP Server: q3d-tools (stdio)
    |
    +-- AI Provider Layer (优先级: TRAE Native → External API → Mock)
    |   ├── TRAE Native: 使用 TRAE 内置 Vision + GenerateImage（零配置）
    |   ├── External API: OpenAI 兼容接口（GPT-4o + DALL-E 3 / 豆包 / 通义万相）
    |   └── Mock: 本地模拟数据（测试用）
    |
    +-- q3d_upload_photo     --> assets/uploads/
    +-- q3d_generate_avatar  --> AI Provider --> assets/generated/
    +-- q3d_save_avatar      --> TRAE 模式下保存已生成的图片
    +-- q3d_create_3d_preview --> preview-template/ --> 浏览器打开
    +-- q3d_spawn_pet        --> pet-template/ --> 浏览器打开
    +-- q3d_chat_with_pet    --> AI Provider --> chat-history.json
```

### AI Provider 架构

Q3D 采用**多 Provider 自动降级**架构，优先使用 TRAE 原生能力：

| 优先级 | Provider | 说明 | 适用场景 |
|--------|----------|------|---------|
| **P0** | TRAE Native | TRAE 内置多模态模型 + GenerateImage 工具，零配置即用 | TRAE IDE 环境 |
| **P1** | External API | OpenAI 兼容接口（GPT-4o Vision + DALL-E 3） | 非 TRAE 环境，有 API Key |
| **P2** | Mock | 本地模拟数据 | 测试 / 演示 |

通过 `Q3D_AI_PROVIDER` 环境变量切换：`trae` / `external` / `auto`（默认）

## 在线体验

- **项目主页**: https://zzyyhh2332.github.io/Q3D-Dream-Machine/
- **Demo 应用**: https://zzyyhh2332.github.io/Q3D-Dream-Machine/q3d-dream-machine-app.html
- **Dream Lattice 生成艺术**: https://zzyyhh2332.github.io/Q3D-Dream-Machine/q3d-dream-showcase.html

## 核心功能

| 模块 | 功能说明 |
|---|---|
| **TRAE Skill 触发** | 在 TRAE 中输入"生成Q版形象"即可触发完整工作流 |
| **图片上传** | TRAE 对话中上传照片，自动保存到本地 |
| **AI 形象生成** | 多 Provider 自动降级（TRAE 原生 → 外部 API → Mock），支持 4 种风格（kawaii/国风/潮玩/简约） |
| **TRAE Native 模式** | 零配置使用 TRAE 内置 Vision + GenerateImage，无需 API Key |
| **3D 预览** | Three.js 真 3D 场景，球体头部贴 AI 生成图，支持拖拽旋转 |
| **桌面宠物** | 生成独立本地 HTML 页面，浮动宠物 + 对话面板 + PiP 置顶 |
| **桌宠心情系统** | 7 种心情状态（idle/happy/excited/sleeping/curious/sad/love），基于上传图片主色调自动配色，支持关键词情绪检测与双击互动 |
| **AI 对话** | 智能对话（Demo 内置语境问答库，接入 API 后切换为真实 LLM 对话，支持历史记忆） |
| **TRAE 唤起** | 宠物页面内置 `solo-cn://` 深度链接一键唤起 TRAE IDE |

## 技术栈

- **TRAE Skill**：`SKILL.md` 定义意图识别与对话流
- **MCP Server**：TypeScript + MCP SDK，stdio transport
- **AI 生成**：OpenAI 兼容 API（GPT-4o vision + DALL-E 3），Demo 阶段以程序化生成呈现
- **3D 渲染**：Three.js（CDN）+ OrbitControls
- **桌面宠物**：原生 HTML5/CSS3/JS，Document PiP API，Canvas 图片主色调提取
- **测试基础设施**：80 Loop 多 Agent 集群测试（Node.js + Mock 模式），GitHub Actions CI 就绪
- **算法艺术**：p5.js 生成艺术展示页（Dream Lattice 粒子系统）
- **语音**：Web Speech API（概念演示）

## 安装与配置

### 1. 克隆项目

```bash
git clone https://github.com/ZZyyHH2332/Q3D-Dream-Machine.git
cd Q3D-Dream-Machine
```

### 2. 安装 MCP Server 依赖

```bash
cd mcp-server
npm install
npm run build
```

### 3. 配置 AI Provider

Q3D 支持多种 AI Provider，**默认自动选择 TRAE 原生模式**（零配置即用）：

```bash
cp .env.example .env
# 编辑 .env，配置 AI Provider
```

**TRAE Native 模式（默认，推荐）：
```dotenv
Q3D_AI_PROVIDER=auto   # 自动探测，优先 TRAE 原生
```
- 无需 API Key，直接使用 TRAE 内置多模态能力
- Vision 分析：TRAE 内置模型直接解析照片
- 图像生成：TRAE GenerateImage 工具生成 Q 版形象
- 对话：TRAE 内置对话模型

External API 模式（可选）：
```dotenv
Q3D_AI_PROVIDER=external
Q3D_API_KEY=sk-xxx
Q3D_API_BASE=https://api.openai.com/v1
```
支持任意 OpenAI 兼容接口：
- OpenAI（默认）
- 阿里云百炼
- 通义万相
- 豆包
- Together AI 等

### 4. 在 TRAE 中注册 MCP Server

打开 TRAE 设置 → MCP Server → 添加：
- **类型**：stdio
- **命令**：`node /absolute/path/to/Q3D-Dream-Machine/mcp-server/dist/index.js`

### 5. 验证 Skill

在 TRAE 对话框中输入：
```
生成我的 Q 版形象
```

TRAE 应自动加载 `q3d-avatar-creator` Skill 并引导你完成上传和生成。

## 文件结构

```
Q3D_Dream_Machine/
├── .trae/
│   ├── skills/q3d-avatar-creator/SKILL.md   # TRAE Skill 定义
│   ├── specs/avatar-prompt-spec.md          # 验收规范
│   └── loop_logs/                           # 迭代缺陷日志
├── mcp-server/
│   ├── src/
│   │   ├── index.ts                         # MCP Server 入口
│   │   ├── config.ts                        # 环境变量配置
│   │   ├── providers/                       # AI Provider 层
│   │   │   ├── types.ts                     # Provider 接口定义
│   │   │   ├── trae-native.ts               # TRAE 原生 Provider（协作模式）
│   │   │   ├── external-api.ts              # 外部 API Provider
│   │   │   ├── mock-avatar.ts               # Mock Provider
│   │   │   └── avatar-resolver.ts           # Provider 解析器（自动降级）
│   │   ├── utils/
│   │   │   ├── file.ts                      # 文件操作（含 openInBrowser）
│   │   │   ├── api.ts                       # AI API 封装（向后兼容）
│   │   │   ├── api.mock.ts                  # Mock 模式实现（向后兼容）
│   │   │   └── works-index.ts               # 作品索引管理
│   │   └── tools/
│   │       ├── health-check.ts
│   │       ├── upload-photo.ts
│   │       ├── generate-avatar.ts           # 形象生成（支持 photoAnalysis / generatedImagePath 参数）
│   │       ├── save-avatar.ts               # 【新增】保存已生成头像（TRAE 模式用）
│   │       ├── generate-3d-model.ts         # 3D 模型生成
│   │       ├── create-3d-preview.ts         # 3D 预览页面
│   │       ├── spawn-pet.ts                 # 桌宠生成
│   │       └── chat-with-pet.ts             # AI 对话
│   ├── dist/                                # 编译输出
│   └── ...
├── .test-sandbox/                           # 80 Loop 测试基础设施
│   ├── run-70loop-test.mjs                  # 多 Agent 集群测试控制器
│   ├── test-runner-v2.mjs                   # 测试执行引擎
│   ├── prompt-linter.mjs                    # Prompt 质量检查
│   ├── prepare-random-images.mjs            # 测试图片归一化
│   └── test-data/random/                    # 测试图片集
├── preview-template/
│   └── preview-3d.html                      # Three.js 3D 预览模板
├── pet-template/
│   └── pet.html                             # 桌面宠物页面模板
├── bridge/
│   ├── blender-mcp-addon.py                 # Blender MCP 插件
│   └── q3d-blender-bridge.js                # Blender 桥接脚本
├── docs/
│   ├── algorithmic-art/
│   │   └── q3d-dream-philosophy.md          # Dream Lattice 算法哲学
│   ├── skill-details.md
│   └── 报名帖文案.md
├── test-archive/80loop-test/                # 测试报告归档
├── q3d-dream-machine-app.html               # 主应用（单文件 2700+ 行）
├── q3d-dream-showcase.html                  # Dream Lattice 生成艺术
├── index.html                               # 项目着陆页
└── README.md
```

## 历史版本

### v1.0 Demo（2026-06-26）

早期概念演示版本，63KB 单 HTML 文件，包含：
- 图片上传/拖拽、4 种风格切换
- CSS 3D 立方体预览
- 桌面宠物（浮动 + Document PiP）
- AI 模拟对话（15+ 组问答 + 打字机效果）
- `solo-cn://` TRAE 深度链接

此版本所有 AI 功能为模拟，仅用于产品概念验证。当前版本为概念演示版（Concept Demo），以程序化生成呈现完整交互流程；MCP Server 架构已支持真实 AI（配置 API Key 即可启用 GPT-4o vision + DALL-E 3），详见 `.trae/loop_logs/` 的 Prompt 优化迭代记录。

## 开发记录

| 日期 | 里程碑 |
|---|---|
| 2026-06-26 | 完成交互式 HTML Demo v1.0（概念演示） |
| 2026-06-26 | 转型 TRAE Native 架构，完成 Skill + MCP Server 骨架 |
| 2026-06-26 | 完成 AI 工作流架构与 Prompt 优化迭代（架构已支持 GPT-4o + DALL-E 3） |
| 2026-06-26 | 完成 Three.js 3D 预览 + 桌面宠物 + AI 对话 |
| 2026-06-29 | 修复 session-scoped avatar 查找，解决跨会话污染问题 |
| 2026-06-29 | 桌宠心情系统升级：7 种心情 + 图片主色调提取 + CSS 动画 |
| 2026-06-29 | 80 Loop 多 Agent 集群测试通过（80/80 PASS，含 10 张真实图片验证） |
| 2026-06-29 | GitHub Pages 部署完成，公开仓库上线 |
| 2026-06-30 | openInBrowser Mock 模式修复，测试耗时从 >16min 降至 36s |
| 2026-06-30 | Dream Lattice 算法艺术展示页（p5.js 粒子升腾 + 4 风格色板） |
| 2026-06-30 | Phase 1-3 完成：AI 对话（LLM Bridge）+ 物理交互（拖拽/漫游）+ 角色养成（200 级好感度）|

## 测试状态

| 测试项 | 结果 | 说明 |
|---|---|---|
| 80 Loop 多 Agent 集群测试 | 80/80 PASS | Agent A(40) + B(20) + C(10) + X(10) |
| 会话隔离查找 | PASS | sessionId 精准定位，杜绝跨会话 avatar 泄漏 |
| Prompt Linter | PASS | Unicode 白名单，中文标点不再误报 |
| Mock revisedPrompt | PASS | 4 风格描述 ~577 字符，ENV-001/002 通过 |
| 桌宠心情系统 | 7/7 验证 | happy/excited/sleeping/curious/sad/love/idle |
| 桌宠养成系统 | PASS | 饱食度/精力/好感度/离线衰减/徽章等级 |
| LLM Bridge 三级降级 | PASS | Ollama 探测 → OpenAI SSE → Mock 降级 |

## 后续规划

- [x] Phase 0-3：概念 Demo → TRAE Native → 3D 预览 + 桌宠基础 → 心情/养成/LLM 桥接
- [ ] Phase 4：桌宠 SVG 骨骼动画 + Sprite Sheet（进行中）
- [ ] Phase 5：真实 API 端到端联测（GPT-4o vision + DALL-E 3）
- [ ] 接入更多 AI 图像生成供应商（百炼、通义万相、Replicate）
- [x] 3D 模型导出（GLB / GLTF 格式）— 架构已支持，Mock 模式可用
- [ ] 接入 OpenAvatarChat 实现本地语音对话
- [ ] 增加更多 Q 版风格模板和自定义 LoRA
- [ ] 支持视频/动图素材上传
- [ ] GitHub Actions CI：自动化 80 Loop 回归测试（已配置，待验证运行）

## 许可

MIT License — ZZyyHH2332

---

Built with ❤️ using TRAE Work Auto
