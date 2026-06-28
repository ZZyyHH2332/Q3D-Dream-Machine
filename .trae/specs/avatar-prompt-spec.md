# Q3D Avatar Prompt Specification

> **Version**: 1.0.0
> **Skill**: q3d-avatar-prompt-optimizer
> **Last Updated**: 2026-06-28

---

## Scope

### IN SCOPE
- `mcp-server/src/tools/generate-avatar.ts` 中的风格 prompt 模板定义
- `mcp-server/src/utils/api.ts` 中的 prompt 拼接与融合逻辑
- `mcp-server/src/utils/api.ts` 中的 prompt 预处理（长度检查、否定指令转换、无效字符过滤）
- `mcp-server/src/utils/api.ts` 中的错误分类映射

### OUT OF SCOPE
- 3D 模型生成逻辑（`generate-3d-model.ts` 及其 Provider）
- 宠物对话系统（`chat-with-pet.ts`）
- 前端页面渲染（`q3d-dream-machine-app.html`）
- Blender Bridge（`bridge/`）
- Provider 路由与可用性检测（`providers/`）

---

## Style Prompt Requirements

### kawaii（软萌大头）
- **头部比例**: 头部占全身 1/2 以上
- **五官特征**: 眼睛圆润明亮、占脸 1/3，小鼻子，微笑嘴型
- **配色**: 默认粉色、奶白色、浅紫色为主色调；customPrompt 可覆盖
- **线条**: 圆润柔和，无锐利棱角
- **背景**: 纯色或简单几何图案，不抢主体
- **保留度**: 必须保留原照片的发色、发型、眼镜等核心特征

### guofeng（国风Q版）
- **风格特征**: 水墨感、清雅含蓄、汉服或现代中式穿搭元素
- **配色**: 默认青绿、墨黑、宣纸白为主；customPrompt 可覆盖
- **线条**: 带有书法笔触感，飘逸流畅
- **背景**: 可含淡墨山水或留白
- **保留度**: 必须保留原照片的人物气质和核心面部特征

### trendy（潮玩手办）
- **风格特征**: 类似盲盒玩具质感，高饱和度，轮廓锐利
- **配色**: 霓虹色、金属色、撞色为主；customPrompt 可覆盖
- **线条**: 清晰硬边，阴影分明
- **背景**: 纯色高对比或渐变
- **保留度**: 必须保留原照片的核心识别特征（发型、眼镜、标志性配饰）

### simple（简约卡通）
- **风格特征**: 极简几何感，色块平涂，无复杂纹理
- **配色**: 黑白灰 + 单强调色；customPrompt 可覆盖
- **线条**: 干净一笔画，无多余装饰
- **背景**: 必须极简，无场景元素
- **保留度**: 保留核心轮廓和发色即可，细节可简化

---

## CustomPrompt Fusion Rules

### 优先级
1. **customPrompt 最高优先级**: 当 customPrompt 与风格默认 prompt 冲突时，以 customPrompt 为准
2. **风格约束保底**: 即使 customPrompt 覆盖配色，仍必须保持该风格的基础视觉语言（如 kawaii 的大头比例不能因 customPrompt 改为写实）
3. **描述融合顺序**: `基础风格描述 + 照片特征描述 + customPrompt（后置强覆盖）`

### 防冲突规则
- 禁止直接拼接导致语义矛盾（如"粉色"+"不要粉色"）
- 否定指令必须前置转换为正面描述（"不要背景"→"纯白背景"）
- customPrompt 长度超过 200 字符时需智能截断，保留核心元素

### 长度限制
- 最终 prompt 总长度不超过 1000 字符（DALL-E 3 建议上限）
- customPrompt 单独不超过 300 字符
- 超长时优先截断风格描述，保留照片特征和 customPrompt

---

## Output Format

API 返回的 `revisedPrompt` 必须满足：
- 包含对应风格的关键词（kawaii 含"chibi/cute"，guofeng 含"Chinese/traditional"等）
- 若提供了 customPrompt，revisedPrompt 中必须出现 customPrompt 的核心内容
- 长度在 100-800 字符之间
- 无未替换的模板占位符（如 `[STYLE]`、`{{customPrompt}}`）

---

## Test Case Matrix

| ID | Type | Style | CustomPrompt | Expected Behavior |
|----|------|-------|-------------|-------------------|
| case-001 | normal | kawaii | (empty) | 生成典型 kawaii 特征，粉色系，大头比例 |
| case-002 | normal | guofeng | 手持折扇的书生 | 国风特征 + 折扇元素，customPrompt 被保留 |
| case-003 | extreme | kawaii | 极简线条头像 | customPrompt 配色指令覆盖 kawaii 默认粉色 |
| case-004 | extreme | trendy | 150字超长描述... | prompt 被合理截断，核心元素保留 |
| case-005 | abnormal | simple | 不要背景，不要颜色 | 否定指令被转换为正面描述 |
| case-006 | abnormal | kawaii | !!!@#$% | 无效字符被过滤，不导致 API 错误 |
| case-007 | normal | guofeng | 青衣剑客 | 水墨感 + 青衣 + 剑客元素共存 |
| case-008 | extreme | simple | (empty) | 极简背景，无复杂场景，线条干净 |
| case-009 | abnormal | trendy | 可爱软萌 | trendy 不被 kawaii 化，保持潮玩质感 |
| case-010 | normal | kawaii | 戴眼镜的程序员 | 眼镜特征保留，同时 kawaii 化 |

---

## Acceptance Criteria

### 量化指标
1. **风格区分度**: 4 种风格两两之间在相同照片上的生成结果，人工盲测区分度 >= 80%
2. **customPrompt 覆盖率**: 提供 customPrompt 的 case 中，revisedPrompt 包含 customPrompt 核心内容的比例 >= 90%
3. **否定指令转换率**: 包含否定词的 customPrompt 中，成功转换为正面描述的比例 = 100%
4. **无效字符过滤率**: 包含特殊字符的 customPrompt 中，不导致 API 错误的比例 = 100%
5. **prompt 长度合规率**: 最终 prompt 长度 <= 1000 字符的比例 = 100%

### 回归指标
- 70 Loop 测试通过率 >= 当前基准（67/70）
- 关键回归 Loop（1-10）通过率 = 100%
- 编译零错误（tsc 零 error）

---

## Revision History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 1.0.0 | 2026-06-28 | Initial spec | Loop Engine |
