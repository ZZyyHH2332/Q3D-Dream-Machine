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

### 完整对话流程

```
用户：生成我的 Q 版形象
TRAE：好呀！Q3D形象造梦机已启动 🎨 请上传你的照片~

用户：[上传照片]
TRAE：收到！想要哪种风格？
      [软萌大头] [国风Q版] [潮玩手办] [简约卡通]

用户：软萌大头
TRAE：[调用 q3d_upload_photo + q3d_generate_avatar]
      生成完成！保存至 assets/generated/{sessionId}/avatar.png
      接下来可以：
      [3D预览] [领养宠物] [重新生成] [换风格]

用户：3D预览
TRAE：[调用 q3d_create_3d_preview]
      已打开浏览器展示 3D 预览 🖱️ 拖拽旋转查看

用户：领养宠物
TRAE：[调用 q3d_spawn_pet]
      桌面宠物已生成并打开！点击宠物开始对话~
```

### 环境要求

- Node.js >= 18
- npm >= 9
- 操作系统：Windows / macOS / Linux
- 浏览器：Chrome / Edge（推荐，支持 PiP）/ Firefox / Safari

### API 配置指南

#### OpenAI（默认）

1. 访问 https://platform.openai.com/api-keys 创建 API Key
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
   注意：需确认百炼是否支持 `images.generate` 和 `chat.completions` 接口

#### 通义万相

参考阿里云百炼配置，使用万相模型 ID。

### 故障排查

| 问题 | 原因 | 解决 |
|---|---|---|
| "API 未配置" | `.env` 中未填写 `Q3D_API_KEY` | 复制 `.env.example` 为 `.env` 并填写 Key |
| "API 调用超时" | 网络问题或 API 服务不稳定 | 检查网络，稍后重试，或切换 API 供应商 |
| "额度不足" | API 账户余额用完 | 充值或更换 API Key |
| "内容审核拒绝" | 图片内容触发安全策略 | 尝试其他照片 |
| "3D 预览黑屏" | 浏览器 WebGL 不支持 | 使用 Chrome/Edge，开启硬件加速 |
| "宠物页面打不开" | 浏览器安全策略阻止本地文件 | 使用 Chrome/Edge，或通过 HTTP 服务器访问 |
| "PiP 置顶失败" | 浏览器不支持 Document PiP | 升级至 Chrome/Edge 116+ |

### MCP 工具清单

| 工具名 | 功能 | 输入参数 | 输出 |
|---|---|---|---|
| `q3d_health_check` | 健康检查 | 无 | 服务状态 |
| `q3d_upload_photo` | 保存上传照片 | `imagePath`, `style` | `uploadId`, `savedPath` |
| `q3d_generate_avatar` | 生成 Q 版形象 | `uploadId`, `style`, `customPrompt` | `avatarPath`, `metadataPath` |
| `q3d_create_3d_preview` | 创建 3D 预览页 | `avatarPath` | `previewPath` |
| `q3d_spawn_pet` | 创建桌面宠物 | `avatarPath`, `personality`, `name` | `petUrl`, `sessionId` |
| `q3d_chat_with_pet` | 与宠物对话 | `message`, `sessionId`, `personality`, `style` | `reply`, `emotion` |
