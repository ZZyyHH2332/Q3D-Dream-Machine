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
    +-- q3d_upload_photo     --> assets/uploads/
    +-- q3d_generate_avatar  --> AI API (OpenAI兼容) --> assets/generated/
    +-- q3d_create_3d_preview --> preview-template/ --> 浏览器打开
    +-- q3d_spawn_pet        --> pet-template/ --> 浏览器打开
    +-- q3d_chat_with_pet    --> AI API --> chat-history.json
```

## 核心功能

| 模块 | 功能说明 |
|---|---|
| **TRAE Skill 触发** | 在 TRAE 中输入"生成Q版形象"即可触发完整工作流 |
| **图片上传** | TRAE 对话中上传照片，自动保存到本地 |
| **AI 形象生成** | GPT-4o vision 分析 + DALL-E 3 生成 Q 版图（支持 4 种风格） |
| **3D 预览** | Three.js 真 3D 场景，球体头部贴 AI 生成图，支持拖拽旋转 |
| **桌面宠物** | 生成独立本地 HTML 页面，浮动宠物 + 对话面板 + PiP 置顶 |
| **AI 对话** | 接入真实 LLM（GPT-4o-mini），支持历史记忆，API 未配置时友好降级 |
| **TRAE 唤起** | 宠物页面内置 `solo-cn://` 深度链接一键唤起 TRAE IDE |

## 技术栈

- **TRAE Skill**：`SKILL.md` 定义意图识别与对话流
- **MCP Server**：TypeScript + MCP SDK，stdio transport
- **AI 生成**：OpenAI 兼容 API（GPT-4o vision + DALL-E 3）
- **3D 渲染**：Three.js（CDN）+ OrbitControls
- **桌面宠物**：原生 HTML5/CSS3/JS，Document PiP API
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

### 3. 配置 AI API

```bash
cp .env.example .env
# 编辑 .env，填写你的 API Key
```

支持任意 OpenAI 兼容接口：
- OpenAI（默认）
- 阿里云百炼
- 通义万相
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
├── .trae/skills/
│   └── q3d-avatar-creator/
│       └── SKILL.md              # TRAE Skill 定义
├── mcp-server/
│   ├── src/
│   │   ├── index.ts              # MCP Server 入口
│   │   ├── config.ts             # 环境变量配置
│   │   ├── utils/
│   │   │   ├── file.ts           # 文件操作工具
│   │   │   └── api.ts            # AI API 封装
│   │   └── tools/
│   │       ├── health-check.ts
│   │       ├── upload-photo.ts
│   │       ├── generate-avatar.ts
│   │       ├── create-3d-preview.ts
│   │       ├── spawn-pet.ts
│   │       └── chat-with-pet.ts
│   ├── dist/                     # 编译输出
│   ├── package.json
│   ├── tsconfig.json
│   └── .env.example
├── preview-template/
│   └── preview-3d.html           # Three.js 3D 预览模板
├── pet-template/
│   └── pet.html                  # 桌面宠物页面模板
├── assets/
│   ├── uploads/                  # 用户上传照片
│   ├── generated/                # AI 生成产物
│   ├── css/
│   ├── js/
│   └── images/
├── docs/
│   ├── 报名帖文案.md
│   └── skill-details.md          # Skill 详细用法
├── index.html                    # 项目展示页
├── README.md
└── .gitignore
```

## 历史版本

### v1.0 Demo（2026-06-26）

早期概念演示版本，63KB 单 HTML 文件，包含：
- 图片上传/拖拽、4 种风格切换
- CSS 3D 立方体预览
- 桌面宠物（浮动 + Document PiP）
- AI 模拟对话（15+ 组问答 + 打字机效果）
- `solo-cn://` TRAE 深度链接

此版本所有 AI 功能为模拟，仅用于产品概念验证。当前版本已全面升级为真实 AI 驱动。

## 开发记录

| 日期 | 里程碑 |
|---|---|
| 2026-06-26 | 完成交互式 HTML Demo v1.0（概念演示） |
| 2026-06-26 | 转型 TRAE Native 架构，完成 Skill + MCP Server 骨架 |
| 2026-06-26 | 实现真实 AI 形象生成（GPT-4o + DALL-E 3） |
| 2026-06-26 | 完成 Three.js 3D 预览 + 桌面宠物 + AI 对话 |

## 后续规划

- [ ] 接入更多 AI 图像生成供应商（百炼、通义万相、Replicate）
- [ ] 3D 模型导出（GLB / GLTF 格式）
- [ ] 接入 OpenAvatarChat 实现本地语音对话
- [ ] 增加更多 Q 版风格模板和自定义 LoRA
- [ ] 支持视频/动图素材上传

## 许可

MIT License — ZZyyHH2332

---

Built with ❤️ using TRAE Work Auto
