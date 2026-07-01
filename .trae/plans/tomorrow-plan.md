# Q3D 形象造梦机 — 明日工作计划 (2026-07-01)

## 当前状态
- Phase 4 已完成：SVG 骨骼动画 + E2E 测试框架 (7/7 PASS)
- Commit: 3b99dfd 已推送至 main
- CI: 80 Loop 回归测试 + Pages 自动部署均正常

## 待解决问题

### P0: SVG 头像在 Playwright headless 中不渲染
**现象**: `avatarImg.setAttribute('href', path)` 在 headless Chromium 中设值成功（getAttribute 返回正确值），但视觉上 SVG 仍显示默认 data URI
**影响**: E2E 测试无法验证真实头像渲染效果
**候选方案**:
1. 换用 `<foreignObject>` + `<img>` 替代 SVG `<image>`（兼容性更好）
2. 换用 CSS `background-image` + `border-radius` 实现圆形裁剪（绕过 SVG）
3. 在 E2E 测试中用 non-headless 模式截图验证

### P1: 真实 API 联测
**阻塞**: 需要有效的 API Key
**可用选项**:
- OpenAI API（当前 key 无效）
- DeepSeek（余额不足）
- 其他兼容 OpenAI 格式的国内 API
- TRAE GenerateImage（已验证可用，可作为 fallback demo）

### P2: 将 E2E 测试集成到 demo 展示
**用户意向**: 将今天的 Playwright 测试逻辑纳入 demo 展示流程
**思路**: 
- 在 q3d-dream-machine-app.html 中嵌入自动化测试按钮
- 点击后自动运行 pet 渲染验证 + 心情切换 demo
- 输出 PASS/FAIL 报告到页面

## 建议执行顺序
1. 先解决 P0（SVG 头像渲染）— 选择 foreignObject 或 CSS 方案
2. P2（demo 集成测试展示）— 评委可一键看到自动化验证
3. P1（真实 API）— 等用户提供有效 Key 或使用 TRAE GenerateImage 替代
