## 问题描述

在多 Agent 集群测试中发现，`q3d_upload_photo` 工具未对上传文件大小进行限制，超过 4MB 的文件被成功接受并保存。

## 测试数据

- **测试场景**：Loop 12 —— `错误_upload超4MB`
- **测试文件**：`oversize.jpg`
- **文件大小**：4,920,051 bytes（约 4.7MB）
- **实际结果**：文件被成功保存到 `uploads-test-B/1782542605405-6559/original.jpg`
- **预期结果**：上传阶段应拒绝超过 4MB 的文件，返回 `UPLOAD_FILE_TOO_LARGE` 错误

## 根因分析

`mcp-server/src/tools/upload-photo.ts` 中仅实现了格式校验（`.jpg`, `.png`, `.webp`, `.gif`），未实现文件大小校验。

对比 `generate-avatar.ts` 中已存在的大小检查逻辑：
```typescript
const stats = fs.statSync(uploadPath);
if (stats.size > 4 * 1024 * 1024) {
  return { success: false, error: { code: "UPLOAD_FILE_TOO_LARGE", ... } };
}
```

但此检查位于生成阶段，为时已晚——大文件已进入系统。

## 影响评估

- **影响等级**：中
- **用户场景**：用户可能意外上传手机原图（通常 5-15MB），浪费存储空间并在生成阶段才收到报错
- **体验问题**：上传阶段无反馈，等到生成时才失败，用户感知差

## 修复建议

在 `mcp-server/src/tools/upload-photo.ts` 的格式校验之后，增加与 `generate-avatar.ts` 一致的 4MB 大小限制：

```typescript
// 在格式校验通过后
const stats = fs.statSync(imagePath);
const MAX_SIZE = 4 * 1024 * 1024; // 4MB
if (stats.size > MAX_SIZE) {
  return {
    content: [{
      type: "text",
      text: JSON.stringify({
        success: false,
        error: {
          code: "UPLOAD_FILE_TOO_LARGE",
          message: `图片文件过大 (${(stats.size / 1024 / 1024).toFixed(1)}MB)，请上传小于 4MB 的图片`,
          suggestion: "请压缩图片后重试，或选择更小的文件"
        }
      })
    }],
    isError: true
  };
}
```

## 关联信息

- 测试报告：`d:\Trae CN\Q3D_Dream_Machine\.test-sandbox\reports\final-test-report.md`
- 相关代码：`mcp-server/src/tools/upload-photo.ts`
- 测试框架：`d:\Trae CN\Q3D_Dream_Machine\.test-sandbox\test-runner.mjs`
