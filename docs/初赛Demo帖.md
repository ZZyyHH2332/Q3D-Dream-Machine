# 【生活娱乐赛道】Q3D 形象造梦机 —— 上传图片一键生成 Q 版 3D 虚拟角色

**标签**：生活娱乐

---

## 一、Demo 简介

**是什么**：Q3D 形象造梦机是一个基于网页的 AI 生成工具，用户上传照片或手绘素材，自动产出 Q 版 3D 角色模型与配套 2D 角色插画，同时生成可交互的桌面宠物进行 AI 对话。全程在 TRAE 对话框中完成，零额外环境配置。

**面向谁**：短视频博主、虚拟主播（VTuber）、学生创作者、自媒体爱好者、小型文创工作室、二次元爱好者。

**主要功能**：

1. **一键 Q 版形象生成**：上传自拍/手绘/宠物照片，4 种风格可选（软萌大头、国风 Q 版、潮玩手办、简约卡通），AI 分析特征并生成 Q 版角色

2. **Three.js 真 3D 预览**：球体头部贴图 + 几何身体 + 四肢骨骼动画，支持鼠标拖拽 360 度旋转、线框模式、截图、自动旋转

3. **桌面宠物 + AI 对话**：生成角色后宠物出现，可拖拽、双击互动、右键菜单，支持 Chrome/Edge Document PiP 真正置顶到桌面，点击宠物弹出 AI 对话面板

> **【此处插入截图1：Demo 主工作台 — 浅色粉彩主题 + 上传区 + 4 风格切换 + Three.js 卡通角色 3D 预览】**

> **【此处插入截图2：生成完成后 — 作品卡片（SVG 头像）+ 桌面宠物 + 对话面板】**

---

## 二、Demo 创作思路

**灵感来源**：当下短视频、虚拟直播、社交账号、文创手办创作需求持续上涨，大量普通人想拥有专属卡通立体形象。但现有 AI 绘图工具大多仅能输出二维图片，轻量化 3D 生成工具十分稀缺。TRAE 平台 Skill + MCP 架构让我可以用极低成本快速验证这个创意的完整产品体验。

**想解决的问题**：
- Blender 等专业 3D 软件学习成本极高，零基础人群完全无法操作
- 外包定制 3D 角色价格昂贵（数千至上万元），普通创作者难以承担
- 市面多数 AI 绘图工具只能输出二维图片，无法提供可编辑、可驱动的立体模型
- 即使有了角色形象，也缺少让角色"活起来"的桌面互动体验

**为什么做这个方向**：传统 AI 工具的开发流程是"写代码→调 API→打包部署"，用户需要打开独立网页或 App。而 TRAE 的 Skill + MCP 架构让整个产品体验**原生嵌入对话流**——用户只需在 TRAE 对话框中说"生成我的 Q 版形象"，即可触发完整的上传→生成→预览→领养宠物工作流。这种"对话即产品"的范式是 TRAE 独有的优势。

**Mock 模式的诚实取舍**：

在无真实 API 配额的情况下，面临两个选择：
1. 伪造"真实 AI 生成"（用预设图片冒充 DALL-E 3 输出）—— 体验好但不诚实
2. 用程序化生成（Toon 卡通角色 + 风格化 SVG 头像）呈现完整交互流程 —— 诚实且可立即体验

选择方案 2，因为：
- 大赛要求"可直接体验的完整 Demo"，程序化生成满足这一硬性条件
- 架构层面已真实打通 GPT-4o vision + DALL-E 3 链路（MCP Server 代码已实现），配置 API Key 即可启用
- Prompt 优化循环是真实的工程实践（`.trae/loop_logs/` 有完整迭代记录），比"我调了个 API"更能体现 TRAE 工程价值

---

## 三、Demo 体验地址

**在线体验**：https://zzyyhh2332.github.io/Q3D-Dream-Machine/q3d-dream-machine-app.html

**GitHub 仓库**：https://github.com/ZZyyHH2332/Q3D-Dream-Machine（公开，可查看全部源码和 TRAE 实践痕迹）

**体验说明**：
- 浏览器直接打开上方链接即可体验，推荐 Chrome/Edge
- 支持浅色粉彩 / 深色科技双主题切换（导航栏右侧按钮）
- 全静态文件，无后端依赖，断网也可完整体验（需下载离线包）
- 当前为程序化生成演示模式，配置 OpenAI 兼容 API Key 后接入真实 GPT-4o vision + DALL-E 3

---

## 四、TRAE 实践过程

### 开发流程

整个 Q3D 项目完全基于 TRAE IDE 开发，核心经历了以下阶段：

**阶段 1：Skill + MCP Server 架构设计**
- 在 TRAE 对话中设计 Q3D Skill 规范（`.trae/skills/q3d-avatar-creator/SKILL.md`）
- 用 TRAE 编写 TypeScript MCP Server，实现 6 个工具：上传图片、生成头像、生成 3D 模型、3D 预览、生成桌面宠物、AI 对话
- 设计 3D Provider 优先链：SOAP 本地 → Hunyuan3D 本地 → SF3D 本地 → 302AI 云端 → Tripo 云端

**阶段 2：Prompt 优化循环**
- 用 TRAE 编写 Prompt Linter（5 条规则校验）
- 执行 70-loop 回归测试（10 个场景 × 7 轮），修复 6 个预发现问题
- 迭代日志保存在 `.trae/loop_logs/`，是真实的工程实践记录

**阶段 3：前端交互 Demo 开发**
- 用 TRAE 开发 `q3d-dream-machine-app.html`（单文件，20+ 功能无后端可跑）
- 实现：图片上传预览、4 风格切换、Three.js 3D 卡通角色（Toon 材质 + 骨骼动画）、GLB 下载、桌面宠物（拖拽 + PiP + 右键菜单）、AI 对话面板
- CDN 全部离线化（p5.js / three.js / OrbitControls / GLTFLoader / mermaid.js），断网可运行

**阶段 4：主题系统 + Mermaid + GLB 材质修复**
- 实现浅色粉彩 / 深色科技双主题切换（CSS 变量 + localStorage 持久化 + 防闪烁脚本）
- 集成 Mermaid 生成流程图（主题感知，切换时自动重渲染）
- 修复 GLB 下载材质（每部件独立 baseColorFactor，Blender 中打开可见彩色角色）

### Session ID

| Session | 主题 | Session ID | 关键产出 |
|---------|------|------|---------|
| Session 1 | Skill + MCP Server 架构设计 | **【请双击 TRAE 对话头像复制 Session ID】** | 6 个 MCP 工具、SKILL.md、TypeScript MCP Server |
| Session 2 | Prompt 优化循环 + 70-loop 回归测试 | **【请双击 TRAE 对话头像复制 Session ID】** | 修复 6 个预发现问题，10/10 回归通过，迭代日志见 `.trae/loop_logs/` |
| Session 3 | 前端 Demo 开发 + 主题切换 + Mermaid | **【请双击 TRAE 对话头像复制 Session ID】** | q3d-dream-machine-app.html，20+ 功能，双主题，离线化 |
| Session 4 | 3D 骨骼动画 + GLB 材质修复 + 部署 | **【请双击 TRAE 对话头像复制 Session ID】** | character-glb-animator.js，GLB baseColorFactor，GitHub Pages 部署 |

> Session ID 获取方式：双击 TRAE IDE 的对话头像即可复制。

### 关键截图

> **【此处插入截图3：Document PiP 置顶模式 — 宠物小窗浮在其他窗口之上】**

> **【此处插入截图4：TRAE IDE 中触发 Skill 对话 / MCP 工具调用】**

> **【此处插入截图5：深色↔浅色主题切换对比 或 Mermaid 生成流程图】**

### 技术亮点

- **完整 AI 工作流**：架构层面已打通 GPT-4o vision 分析 + DALL-E 3 生成 + Three.js 3D 预览全链路；本次 Demo 以程序化生成呈现可立即体验的完整交互流程，配置 OpenAI 兼容 API Key 后即可接入真实模型生成
- **Three.js 真 3D**：Toon 卡通材质 + 3 级渐变贴图 + 骨骼分层动画 + ACES Filmic 色调映射 + PCFSoft 阴影
- **桌面宠物系统**：浏览器浮动 + Document PiP 真正置顶 + 智能对话（Demo 内置语境问答库，接入 API 后切换为真实 LLM 对话）
- **MCP Server 架构**：TypeScript + MCP SDK，6 个工具完整覆盖上传/生成/预览/宠物/对话
- **离线可体验**：全静态文件，5 个 vendor 库本地化，断网双击 HTML 即可完整体验
- **工程严谨性**：Prompt Linter 5 规则 + 70-loop 回归测试 + Loop 三层引擎

---

## 报名帖链接

https://forum.trae.cn/t/topic/46976
