# Q3D Avatar Prompt Optimizer — Defect Log

> **Skill**: q3d-avatar-prompt-optimizer
> **Format**: Append-only. Each iteration adds a new `## Iteration N` section.
> **Human Review**: Add `<!-- human: confirmed -->` at the end of a section after review.

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
