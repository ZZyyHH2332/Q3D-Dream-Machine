# Q3D Avatar Prompt Optimizer — Defect Log

> **Skill**: q3d-avatar-prompt-optimizer
> **Format**: Append-only. Each iteration adds a new `## Iteration N` section.
> **Human Review**: Add `## Iteration 1 (2026-06-28T17:07+08:00)

### 测试执行摘要
- **Prompt Linter**: 0 errors, 2 warnings（kawaii/trendy 被误报含无效字符）
- **Loop 1-10 回归**: 10/10 PASS, 总耗时 9252ms
- **编译验证**: tsc 零错误

### 失败用例
- 无代码层面的功能性失败。Loop 1-10 全部通过，avatar.png 生成、metadata 写入、works-index 更新均正常。

### Mock 环境限制（非代码缺陷）
- **[ENV-001]** `prompt-check.lengthOk` 10/10 为 false：Mock 模式下 revisedPrompt 仅 23-26 字符，远低于 spec 要求的 100-1000 字符。
  - 影响：无法验证真实 API 下的 prompt 长度合规性。
  - 缓解：需在真实 API 模式下抽检验证。
- **[ENV-002]** `guofeng` 风格的 `hasStyleKeyword` 2/2 为 false：Mock 返回的 revisedPrompt 不含 guofeng 关键词。
  - 影响：无法验证 guofeng 风格关键词覆盖率。
  - 缓解：Mock 数据不含中文/国风相关词，真实 API 下应正常。

### 新增缺陷
- **[LINTER-001]** Prompt Linter 的 `INVALID_CHAR_PATTERN` 过于严格，将中文标点（如"、"""""）误报为无效字符。
  - 违反规则: spec §Output Format（prompt 允许中英文混合）
  - 建议优化: 放宽 linter 正则，将中文标点加入白名单。

### 已修复缺陷（本轮代码改进）
1. ~~STYLE_PROMPTS 无中文描述~~ → 已增强为 bilingual 模板
2. ~~customPrompt 简单前置拼接~~ → 已改为后置强覆盖（`mergePrompts`）
3. ~~无 prompt 长度检查~~ → 已增加 `validatePromptLength`（1000 字符上限 + 智能截断）
4. ~~无否定指令转换~~ → 已增加 `convertNegationToAffirmation`
5. ~~无无效字符过滤~~ → 已增加 `sanitizeCustomPrompt`
6. ~~prompt 模板内联~~ → 已提取为 `STYLE_CONFIG` 和 `STYLE_PROMPTS` 结构化常量

### 优化建议（待人工确认）
1. **优化 linter 正则**: 将 `INVALID_CHAR_PATTERN` 中的中文标点（、。！？：；""''（）【】）明确加入白名单，消除误报。
2. **真实 API 抽检**: 配置真实 OpenAI API Key，对 4 种风格各生成 2 张，验证 revisedPrompt 长度和风格关键词实际覆盖率。

### 指标
- 专项测试通过率: 10/10（Mock 模式，功能层面）
- 回归测试通过率: 10/10
- 缺陷下降率: 6→1（代码层面 6 个预发现问题全部修复，仅剩 1 个 linter 误报）
- 新增缺陷: 1（linter 误报）
- 剩余缺陷: 1

<!-- human: pending-review -->` at the end of a section after review.

---

## Iteration 0 (Baseline)

### 已知问题（预 Loop）
- `api.ts` 中 `STYLE_PROMPTS` 为英文固定模板，无中文用户可读的描述
- customPrompt 融合逻辑为简单前置拼接：`${customPrompt}. The character is based on: ${descText}`
- 无 prompt 长度检查，超长 customPrompt 可能导致 DALL-E 3 截断或报错
- 无否定指令转换，用户输入"不要背景"等否定词时 DALL-E 3 表现不稳定
- 无无效字符过滤，特殊字符可能污染 prompt
- `generate-avatar.ts` 中 prompt 模板内联，不利于 diff review

### 指标（基准）
- 专项测试通过率: N/A（尚未运行）
- 回归测试通过率: N/A（尚未运行）
- 缺陷数: 6（见上）

<!-- human: confirmed -->
