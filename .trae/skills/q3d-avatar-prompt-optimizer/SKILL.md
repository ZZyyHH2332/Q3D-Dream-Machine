# q3d-avatar-prompt-optimizer

> **name**: q3d-avatar-prompt-optimizer
> **version**: 1.0.0
> **description**: 迭代优化 Q3D Avatar 生成的 prompt 模板质量

---

## Intent Recognition

当用户输入以下意图时激活本 Skill：
- "优化 avatar prompt"
- "提升形象生成质量"
- "改进风格 prompt"
- "调整 customPrompt 融合逻辑"
- "修复 prompt 问题"

---

## Input Parameters

```json
{
  "targetStyle": {
    "type": "string",
    "enum": ["kawaii", "guofeng", "trendy", "simple", "all"],
    "default": "all",
    "description": "指定要优化的风格，默认全部"
  },
  "mode": {
    "type": "string",
    "enum": ["inner", "outer"],
    "default": "inner",
    "description": "inner=单轮执行+自检, outer=批量测试+问题聚合+建议生成"
  },
  "testScope": {
    "type": "string",
    "enum": ["prompt-only", "full-regression"],
    "default": "prompt-only",
    "description": "prompt-only=10 case 快检, full-regression=70 Loop 全量"
  }
}
```

---

## Workflow

### Phase 1: 环境准备（每轮必做）
1. 读取 `.trae/loop_logs/iteration-state.json`
2. 检查 `maxIterations` 是否已达上限
3. 执行 `git status`，确认工作区干净
4. 读取 `.trae/specs/avatar-prompt-spec.md`，加载验收标准

### Phase 2: 校验执行
1. 运行 prompt linter: `node .test-sandbox/prompt-linter.mjs`
2. 运行 prompt 专项快检（读取 `test-cases-prompt.json`，Mock 模式执行）
3. 若 mode=outer，运行关键回归测试: `node test-runner-v2.mjs X 1 10`

### Phase 3: 问题聚合
1. 对比测试结果与 spec，识别违规项
2. 将新缺陷写入 `.trae/loop_logs/avatar-prompt-defects.md`
3. 计算量化指标: 缺陷下降率、验证通过率

### Phase 4: 优化建议生成
1. 只针对本轮失败的风格生成增量优化建议
2. 将建议写入 defects 日志的 `### 优化建议` 节
3. **标记 `humanConfirmationRequired: true`**
4. **禁止直接修改 `.trae/specs/avatar-prompt-spec.md` 和本 SKILL.md**

### Phase 5: 人工作为 Loop 设计师终审
1. 等待人工回复 "确认" 或 "修改建议: ..."
2. 人工确认后，执行代码修改
3. 修改前自动执行: `git add mcp-server/src/ && git commit -m "[Loop-Iter-N] pre-change snapshot"`

### Phase 6: 编译验证
1. `cd mcp-server && npm run build`
2. 编译错误则回退: `git revert HEAD`

### Phase 7: 状态更新
1. 更新 `iteration-state.json`
2. 检查二进制终止条件（100%通过率 + 零新缺陷）
3. 如未满足且未达 maxIterations，进入下一轮

---

## Safety Constraints

- **maxSteps**: Inner Loop 最多 8 步，Outer Loop 最多 15 步
- **越界检测**: 若请求修改 3D 生成/宠物对话/前端样式，立即终止并提示"超出能力边界"
- **增量修改**: 每轮只修改 1 种风格的 prompt 模板
- **Token 节流**: 只保留最近 3 轮缺陷证据
- **Git 兜底**: 所有代码修改前必须 git commit

---

## Out of Scope

本 Skill **不处理**以下请求：
- 3D 模型生成优化
- 宠物对话性格调整
- 前端页面样式修改
- Blender 自动化脚本修改
- Provider 路由逻辑修改

---

## Example Usage

```
User: 优化 avatar prompt，kawaii 风格的 customPrompt 融合有问题
Skill: 激活 q3d-avatar-prompt-optimizer
       targetStyle=kawaii, mode=inner, testScope=prompt-only
```
