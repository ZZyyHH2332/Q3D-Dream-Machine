# Q3D 形象造梦机 — 多 Agent 集群测试报告

## 执行摘要

| 项目 | 数值 |
|------|------|
| 测试轮次 | Round 2 + Round 3 (Agent B 重跑) |
| 总 Loop 数 | 20 |
| 通过 | 15 / 20 |
| 失败 | 5 / 20 |
| 测试模式 | Mock AI（零成本，无真实 API 调用） |
| 目录策略 | Round 2 共享目录 → Round 3  per-agent 隔离 |

> **重要说明**：Round 2 的 Agent A/C/D 使用共享目录 `uploads-test/` / `generated-test/`，存在跨 Agent 数据污染（详见下文）。Agent B Round 3 改用隔离目录 `uploads-test-B/` / `generated-test-B/`，污染问题已消除。

---

## Agent 维度统计

| Agent | Loops | 场景 | PASS | FAIL | 总耗时 | 目录模式 |
|-------|-------|------|------|------|--------|----------|
| A | 1-5 | 完整链路（4 种风格 + customPrompt） | 5 | 0 | 5,179ms | 共享目录 |
| D | 6-8 | 快速 spawn / 自动查找 | 3 | 0 | 1,714ms | 共享目录 |
| B | 9-16 | 错误场景 / 无 API Key | 3 | 5 | 1,685ms | **隔离目录** |
| C | 17-20 | 并发 / 状态覆盖 / 重复 chat / 健康检查 | 4 | 0 | 2,699ms | 共享目录 |

**合计：15 PASS / 5 FAIL（75% 通过率）**

---

## 失败详情与根因分析

### Loop 12：upload 超 4MB 未拦截 —— 真实产品 Bug

| 属性 | 内容 |
|------|------|
| 场景 | `错误_upload超4MB` |
| Agent | B |
| 状态 | **FAIL（产品 Bug）** |

**现象**：
`oversize.jpg`（4,920,051 bytes，约 4.7MB）被 `q3d_upload_photo` 成功接受并保存到 `uploads-test-B/1782542605405-6559/original.jpg`。

**根因**：
`mcp-server/src/tools/upload-photo.ts` 中未实现文件大小校验。虽然 `generate-avatar.ts` 中存在 4MB 限制检查，但上传阶段已放行，导致大文件进入系统。

**影响等级**：中 —— 用户可能上传过大文件，浪费存储并在生成阶段才报错。

**修复建议**：
在 `upload-photo.ts` 格式校验之后，增加与 `generate-avatar.ts` 一致的 `fs.statSync` + 4MB 上限逻辑。

---

### Loops 13-16：测试框架多步骤错误场景判断局限

| Loop | 场景 | 实际产品行为 | 测试框架判定 |
|------|------|-------------|-------------|
| 13 | 错误_preview无avatar | upload 成功 → preview 正确返回 `PREVIEW_AVATAR_NOT_FOUND` | FAIL（因 upload 步骤返回 success=true） |
| 14 | 错误_chat空消息 | upload/generate/spawn 均成功 → chat 正确返回 `CHAT_EMPTY_MESSAGE` | FAIL（因前 3 步返回 success=true） |
| 15 | 无APIKey_generate | upload 成功 → generate 在 Mock 缓存下仍成功（见下方说明） | FAIL |
| 16 | 无APIKey_chat | upload/generate/spawn 均成功 → chat 成功 | FAIL |

**根因**：测试框架的 `isErrorScenario` 标志对整个 Loop 的所有步骤生效，导致中间的正常操作步骤被误判为"应当失败"。

**Loop 15-16 额外问题**：`noMock` 标志通过运行时修改 `process.env.Q3D_TEST_MODE = ""` 实现，但 `config.testMode` 在模块加载时已被缓存，后续修改环境变量不影响已加载的 `config` 对象。因此 Mock 模式未被真正关闭，`generate_avatar` 仍绕过 API Key 检查。

**结论**：这 4 个 Loop 的 FAIL 标记属于**测试框架设计局限**，非产品 Bug。产品本身的错误处理逻辑（如 `PREVIEW_AVATAR_NOT_FOUND`、`CHAT_EMPTY_MESSAGE`）均正确工作。

---

## 跨 Agent 目录污染分析（Round 2）

Round 2 的 Agent A/C/D 使用共享目录，出现以下污染现象：

| 现象 | 证据 |
|------|------|
| Agent D Loop 6 读取到 Agent C 的 session | `lastSessionId`: `1782542129580-1442`（实为 Agent C Loop 18 的 session） |
| Agent C Loop 18 的 worksIndex 被覆盖 | `hasAvatarPath: false`（实际 avatar.png 存在，被 Agent D 的 spawn 覆盖索引） |

**修复状态**：`test-runner.mjs` 已改为 per-agent 隔离目录（`uploads-test-${agentId}` / `generated-test-${agentId}` / `works-index-test-${agentId}.json`），Agent B Round 3 验证无串扰。

---

## 性能指标

### 各 Agent 总耗时

| Agent | 总耗时 | Loop 数 | 平均 Loop 耗时 |
|-------|--------|---------|---------------|
| A | 5,179ms | 5 | 1,036ms |
| B | 1,685ms | 8 | 211ms |
| C | 2,699ms | 4 | 675ms |
| D | 1,714ms | 3 | 571ms |

### 工具平均响应时间（全部 Loops）

| 工具 | 样本数 | 平均耗时 | 最慢耗时 |
|------|--------|----------|----------|
| q3d_upload_photo | ~20 | ~45ms | ~106ms |
| q3d_generate_avatar | ~14 | ~280ms | ~370ms |
| q3d_create_3d_preview | ~8 | ~340ms | ~473ms |
| q3d_spawn_pet | ~10 | ~340ms | ~477ms |
| q3d_chat_with_pet | ~12 | ~8ms | ~16ms |
| q3d_health_check | 1 | ~0ms | — |

> 注：Mock AI 模式下 `generate_avatar` 无真实网络请求，耗时主要为文件 I/O。

### 最慢 Loop TOP3

| 排名 | Loop | 场景 | 耗时 |
|------|------|------|------|
| 1 | Loop 4 | 完整链路_simple | 1,323ms |
| 2 | Loop 1 | 完整链路_kawaii | 1,099ms |
| 3 | Loop 3 | 完整链路_trendy | 1,073ms |

---

## 工件验证汇总

### 生成文件存在性矩阵（Agent A 代表性样本）

| Loop | avatar.png | preview-3d.html | pet.html | chat-history.json |
|------|-----------|-----------------|----------|-------------------|
| 1 (kawaii) | 69B PNG | 7,416B | 16,694B | 152B |
| 2 (guofeng) | 69B PNG | 7,416B | 16,694B | 163B |
| 5 (customPrompt) | 69B PNG | 7,416B | — | — |

### PNG 魔数验证

全部 `avatar.png` 均通过 PNG 魔数检查（`0x89 0x50` 头），但文件大小仅为 69 bytes，为 Mock 生成的最小占位图。

### works-index 一致性

- 正向链路 Loops：works-index 状态与文件系统一致（`hasAvatarPath`/`hasPreviewPath`/`hasPetPath` 与文件存在性匹配）
- Agent B Round 3 隔离目录：works-index 仅记录当前 Agent 的 session，无跨 Agent 污染

---

## 测试环境

| 配置项 | 值 |
|--------|-----|
| Node.js | v22.x |
| 测试模式 | Mock AI (`Q3D_TEST_MODE=mock`) |
| 目录隔离 | Round 3 启用 per-agent |
| 操作系统 | Windows |

---

## 结论与建议

1. **产品 Bug 1 项**：`upload-photo.ts` 缺少文件大小限制（Loop 12），建议补充 4MB 上限校验。
2. **测试框架局限 2 项**：
   - 多步骤错误场景的判定逻辑需区分"setup 步骤"与"错误触发步骤"
   - `noMock` 标志因模块级 config 缓存而失效，需在调用 handler 前重新加载配置或使用函数级参数传递
3. **基础设施改进**：per-agent 目录隔离已验证有效，后续测试应持续使用。
4. **整体评估**：核心功能链路（上传→生成→预览→宠物→对话）全部正常工作，错误处理边界（空路径、无效格式、无效 ID、空消息、无 avatar）均返回正确错误码。

---

*报告生成时间：2026-06-27*
*测试框架版本：test-runner.mjs (per-agent isolation)*
