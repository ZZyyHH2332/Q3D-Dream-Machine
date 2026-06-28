#!/usr/bin/env node
/**
 * Q3D MCP Server Test Runner v2
 * Usage: node test-runner-v2.mjs <agent-id> <loop-start> <loop-end>
 *   agent-id: A | B | C
 *   loop-start: 1-70
 *   loop-end: 1-70
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..");
const distDir = path.join(projectRoot, "mcp-server", "dist");

// Parse args
const agentId = process.argv[2] || "X";
const loopStart = parseInt(process.argv[3] || "1");
const loopEnd = parseInt(process.argv[4] || "70");

// Set test environment - per-agent isolation
process.env.Q3D_UPLOADS_DIR = path.join(__dirname, `uploads-test-${agentId}`);
process.env.Q3D_OUTPUT_DIR = path.join(__dirname, `generated-test-${agentId}`);
process.env.Q3D_WORKS_INDEX = path.join(__dirname, `works-index-test-${agentId}.json`);
process.env.Q3D_TEST_MODE = "mock";

// Ensure dirs exist
fs.mkdirSync(process.env.Q3D_UPLOADS_DIR, { recursive: true });
fs.mkdirSync(process.env.Q3D_OUTPUT_DIR, { recursive: true });

// Clean test index before start
if (fs.existsSync(process.env.Q3D_WORKS_INDEX)) {
  fs.unlinkSync(process.env.Q3D_WORKS_INDEX);
}

// Helper: convert path to file URL (required for ESM on Windows)
function toFileUrl(p) {
  return "file://" + p.replace(/\\/g, "/");
}

// Import tool registers from dist (7 tools)
const { registerUploadPhoto } = await import(toFileUrl(path.join(distDir, "tools", "upload-photo.js")));
const { registerGenerateAvatar } = await import(toFileUrl(path.join(distDir, "tools", "generate-avatar.js")));
const { registerCreate3DPreview } = await import(toFileUrl(path.join(distDir, "tools", "create-3d-preview.js")));
const { registerSpawnPet } = await import(toFileUrl(path.join(distDir, "tools", "spawn-pet.js")));
const { registerChatWithPet } = await import(toFileUrl(path.join(distDir, "tools", "chat-with-pet.js")));
const { registerHealthCheck } = await import(toFileUrl(path.join(distDir, "tools", "health-check.js")));
const { registerGenerate3DModel } = await import(toFileUrl(path.join(distDir, "tools", "generate-3d-model.js")));

// Mock server to capture handlers
const handlers = {};
const mockServer = {
  registerTool: (name, description, inputSchema, handler) => {
    handlers[name] = handler;
  },
};

registerHealthCheck(mockServer);
registerUploadPhoto(mockServer);
registerGenerateAvatar(mockServer);
registerCreate3DPreview(mockServer);
registerSpawnPet(mockServer);
registerChatWithPet(mockServer);
registerGenerate3DModel(mockServer);

console.error(`[TestRunner] Agent ${agentId} loaded ${Object.keys(handlers).length} handlers`);

// Helper: measure async function
async function measure(fn, ...args) {
  const start = Date.now();
  try {
    const result = await fn(...args);
    return { success: true, result, durationMs: Date.now() - start };
  } catch (err) {
    return { success: false, error: err.message, durationMs: Date.now() - start };
  }
}

// Helper: parse MCP response
function parseResponse(result) {
  if (!result || !result.content || !result.content[0]) {
    return { parsed: null, text: "" };
  }
  const text = result.content[0].text || "";
  try {
    return { parsed: JSON.parse(text), text };
  } catch {
    return { parsed: null, text };
  }
}

// Helper: verify file exists
function verifyFile(filePath) {
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath);
  if (!fs.existsSync(absPath)) return { exists: false, sizeBytes: 0 };
  const stat = fs.statSync(absPath);
  return { exists: true, sizeBytes: stat.size };
}

// Helper: verify PNG magic
function isPng(filePath) {
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath);
  if (!fs.existsSync(absPath)) return false;
  const fd = fs.openSync(absPath, "r");
  const buf = Buffer.alloc(8);
  fs.readSync(fd, buf, 0, 8, 0);
  fs.closeSync(fd);
  return buf[0] === 0x89 && buf[1] === 0x50;
}

// Helper: verify GLB magic
function isGlb(filePath) {
  const absPath = path.isAbsolute(filePath) ? filePath : path.join(projectRoot, filePath);
  if (!fs.existsSync(absPath)) return false;
  const fd = fs.openSync(absPath, "r");
  const buf = Buffer.alloc(4);
  fs.readSync(fd, buf, 0, 4, 0);
  fs.closeSync(fd);
  return buf.toString("ascii") === "glTF";
}

// Shared sample image path
const sampleImage = path.join(__dirname, "test-data", "sample-portrait.jpg");

// ===== Scenarios: 70 loops partitioned by Agent =====
const scenarios = {
  // ===== Agent A: Loop 1-40 (效果测试) =====
  // --- kawaii 专项 (Loop 1-8) ---
  1: { name: "kawaii_基础生成", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
  ]},
  2: { name: "kawaii_customPrompt", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii", customPrompt: "戴眼镜的程序员" } },
  ]},
  3: { name: "kawaii_重复生成", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
  ]},
  4: { name: "kawaii_3D集成", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_generate_3d_model", args: { sessionId: "@last.sessionId" } },
  ]},
  5: { name: "kawaii_端到端", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小Q", personality: "活泼可爱" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "你好呀" } },
  ]},
  6: { name: "kawaii_metadata完整", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
  ]},
  7: { name: "kawaii_风格一致性A", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
  ]},
  8: { name: "kawaii_风格一致性B", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii", customPrompt: "粉色头发" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii", customPrompt: "粉色头发" } },
  ]},

  // --- guofeng 专项 (Loop 9-16) ---
  9: { name: "guofeng_基础生成", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "guofeng" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "guofeng" } },
  ]},
  10: { name: "guofeng_customPrompt", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "guofeng" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "guofeng", customPrompt: "手持折扇的书生" } },
  ]},
  11: { name: "guofeng_重复生成", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "guofeng" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "guofeng" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "guofeng" } },
  ]},
  12: { name: "guofeng_3D集成", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "guofeng" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "guofeng" } },
    { tool: "q3d_generate_3d_model", args: { sessionId: "@last.sessionId" } },
  ]},
  13: { name: "guofeng_端到端", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "guofeng" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "guofeng" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小竹", personality: "温婉优雅" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "你是谁" } },
  ]},
  14: { name: "guofeng_metadata完整", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "guofeng" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "guofeng" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
  ]},
  15: { name: "guofeng_风格一致性A", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "guofeng" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "guofeng" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "guofeng" } },
  ]},
  16: { name: "guofeng_风格一致性B", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "guofeng" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "guofeng", customPrompt: "青衣剑客" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "guofeng", customPrompt: "青衣剑客" } },
  ]},

  // --- trendy 专项 (Loop 17-24) ---
  17: { name: "trendy_基础生成", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "trendy" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "trendy" } },
  ]},
  18: { name: "trendy_customPrompt", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "trendy" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "trendy", customPrompt: "街头涂鸦风" } },
  ]},
  19: { name: "trendy_重复生成", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "trendy" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "trendy" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "trendy" } },
  ]},
  20: { name: "trendy_3D集成", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "trendy" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "trendy" } },
    { tool: "q3d_generate_3d_model", args: { sessionId: "@last.sessionId" } },
  ]},
  21: { name: "trendy_端到端", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "trendy" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "trendy" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小潮", personality: "酷炫个性" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "你好" } },
  ]},
  22: { name: "trendy_metadata完整", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "trendy" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "trendy" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
  ]},
  23: { name: "trendy_风格一致性A", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "trendy" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "trendy" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "trendy" } },
  ]},
  24: { name: "trendy_风格一致性B", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "trendy" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "trendy", customPrompt: "霓虹灯下的DJ" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "trendy", customPrompt: "霓虹灯下的DJ" } },
  ]},

  // --- simple 专项 (Loop 25-32) ---
  25: { name: "simple_基础生成", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "simple" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "simple" } },
  ]},
  26: { name: "simple_customPrompt", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "simple" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "simple", customPrompt: "极简线条头像" } },
  ]},
  27: { name: "simple_重复生成", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "simple" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "simple" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "simple" } },
  ]},
  28: { name: "simple_3D集成", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "simple" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "simple" } },
    { tool: "q3d_generate_3d_model", args: { sessionId: "@last.sessionId" } },
  ]},
  29: { name: "simple_端到端", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "simple" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "simple" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小简", personality: "安静内向" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "Hi" } },
  ]},
  30: { name: "simple_metadata完整", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "simple" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "simple" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
  ]},
  31: { name: "simple_风格一致性A", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "simple" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "simple" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "simple" } },
  ]},
  32: { name: "simple_风格一致性B", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "simple" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "simple", customPrompt: "黑白剪影" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "simple", customPrompt: "黑白剪影" } },
  ]},

  // --- 风格切换 (Loop 33-34) ---
  33: { name: "风格切换_kawaii到guofeng", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "guofeng" } },
  ]},
  34: { name: "风格切换_trendy到simple", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "trendy" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "trendy" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "simple" } },
  ]},

  // --- customPrompt边界 (Loop 35-38) ---
  35: { name: "customPrompt_A到B切换", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii", customPrompt: "红发战士" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii", customPrompt: "蓝发法师" } },
  ]},
  36: { name: "customPrompt_无到有", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii", customPrompt: "有 Prompt 了" } },
  ]},
  37: { name: "customPrompt_空字符串", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii", customPrompt: "" } },
  ]},
  38: { name: "customPrompt_长文本", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii", customPrompt: "这是一段非常长的描述文本，用来测试系统在处理超长 customPrompt 时的行为表现和稳定性，确保不会因为字符串过长而导致截断或异常。" } },
  ]},

  // --- 其他 (Loop 39-40) ---
  39: { name: "路径格式验证", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
  ]},
  40: { name: "全工件覆盖矩阵", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_generate_3d_model", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小全", personality: "全能" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "全覆盖测试" } },
  ]},

  // ===== Agent B: Loop 41-60 (全流程测试) =====
  41: { name: "标准链路_kawaii完整5步", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小K", personality: "活泼可爱" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "kawaii标准链路" } },
  ]},
  42: { name: "标准链路_guofeng完整5步", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "guofeng" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "guofeng" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小G", personality: "温婉优雅" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "guofeng标准链路" } },
  ]},
  43: { name: "标准链路_trendy完整5步", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "trendy" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "trendy" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小T", personality: "酷炫个性" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "trendy标准链路" } },
  ]},
  44: { name: "标准链路_simple完整5步", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "simple" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "simple" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小S", personality: "安静内向" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "simple标准链路" } },
  ]},
  45: { name: "标准链路_customPrompt", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii", customPrompt: "戴着眼镜的程序猿" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小C", personality: "极客" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "customPrompt链路" } },
  ]},
  46: { name: "跳过preview直接spawn", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小跳", personality: "急性子" } },
  ]},
  47: { name: "跳过generate直接preview", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" }, expectError: true },
  ]},
  48: { name: "跳过generate直接spawn", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小越", personality: "叛逆" } },
  ]},
  49: { name: "跳过spawn直接chat", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "没spawn就chat" } },
  ]},
  50: { name: "最小链路仅upload", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
  ]},
  51: { name: "多轮对话3轮", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小聊", personality: "话痨" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "第一轮" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "第二轮" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "第三轮" } },
  ]},
  52: { name: "多轮对话历史边界_chatx15", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小历", personality: "记忆大师" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "1" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "2" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "3" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "4" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "5" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "6" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "7" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "8" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "9" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "10" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "11" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "12" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "13" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "14" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "15" } },
  ]},
  53: { name: "对话性格覆盖", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小性", personality: "高冷孤傲" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "你性格怎样" } },
  ]},
  54: { name: "对话空消息错误恢复", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小恢", personality: " resilient" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "" }, expectError: true },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "恢复对话" } },
  ]},
  55: { name: "3D集成_generate3D后preview", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_generate_3d_model", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
  ]},
  56: { name: "3D集成无avatar生成3D失败", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_3d_model", args: { sessionId: "@last.sessionId" }, expectError: true },
  ]},
  57: { name: "3D集成指定avatarPath", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_generate_3d_model", args: { sessionId: "@last.sessionId" } },
  ]},
  58: { name: "错误恢复_聊天失败后继续", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小坚", personality: "坚韧不拔" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "" }, expectError: true },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "继续" } },
  ]},
  59: { name: "状态覆盖_preview重新生成", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
  ]},
  60: { name: "全链路含3D与对话恢复", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_generate_3d_model", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小全", personality: "全能" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "" }, expectError: true },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "恢复" } },
  ]},

  // ===== Agent C: Loop 61-70 (全功能测试) =====
  61: { name: "health_check基础", steps: [
    { tool: "q3d_health_check", args: {} },
  ]},
  62: { name: "3D_auto无Provider", env: { Q3D_3D_PROVIDER: "auto" }, steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_generate_3d_model", args: { sessionId: "@last.sessionId" } },
  ]},
  63: { name: "3D_指定Hunyuan", env: { Q3D_HUNYUAN_API_URL: "http://localhost:9999", Q3D_3D_PROVIDER: "hunyuan" }, steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_generate_3d_model", args: { sessionId: "@last.sessionId" } },
  ]},
  64: { name: "3D_指定302AI", env: { Q3D_302AI_API_KEY: "dummy", Q3D_3D_PROVIDER: "302ai" }, steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_generate_3d_model", args: { sessionId: "@last.sessionId" } },
  ]},
  65: { name: "3D_指定Tripo3D", env: { Q3D_TRIPO_API_KEY: "dummy", Q3D_3D_PROVIDER: "tripo" }, steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_generate_3d_model", args: { sessionId: "@last.sessionId" } },
  ]},
  66: { name: "3D_auto优先级", env: { Q3D_HUNYUAN_API_URL: "http://localhost:9999", Q3D_302AI_API_KEY: "dummy", Q3D_TRIPO_API_KEY: "dummy", Q3D_3D_PROVIDER: "auto" }, steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_generate_3d_model", args: { sessionId: "@last.sessionId" } },
  ]},
  67: { name: "7工具全调用", steps: [
    { tool: "q3d_health_check", args: {} },
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_generate_3d_model", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小七", personality: "全能" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "7工具全调用" } },
  ]},
  68: { name: "并发边界_快速chatx3", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小并", personality: "极速" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "快1" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "快2" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "快3" } },
  ]},
  69: { name: "3D_无avatar错误", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_3d_model", args: { sessionId: "@last.sessionId" }, expectError: true },
  ]},
  70: { name: "综合_跨工具一致性", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: sampleImage, style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_generate_3d_model", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小综", personality: "一致" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "一致性检查" } },
    { tool: "q3d_health_check", args: {} },
  ]},
};

// Run a single loop
async function runLoop(loopId) {
  const scenario = scenarios[loopId];
  if (!scenario) {
    throw new Error(`Unknown loopId: ${loopId}`);
  }

  // Handle noMock flag for legacy loops
  if (scenario.noMock) {
    process.env.Q3D_TEST_MODE = "";
    process.env.Q3D_API_KEY = "";
  } else {
    process.env.Q3D_TEST_MODE = "mock";
  }

  // Save original env and apply per-loop env
  const originalEnv = {};
  if (scenario.env && typeof scenario.env === "object") {
    for (const [key, value] of Object.entries(scenario.env)) {
      originalEnv[key] = process.env[key];
      process.env[key] = value;
    }
  }

  console.error(`[Loop ${loopId}] ${scenario.name}`);

  const stepResults = [];
  let lastSessionId = null;
  let overallPass = true;
  const loopStartTime = Date.now();

  for (let i = 0; i < scenario.steps.length; i++) {
    const step = scenario.steps[i];
    let args = { ...step.args };

    // Resolve @last.sessionId placeholder
    if (args.uploadId === "@last.sessionId") args.uploadId = lastSessionId;
    if (args.sessionId === "@last.sessionId") args.sessionId = lastSessionId;

    const handler = handlers[step.tool];
    if (!handler) {
      stepResults.push({
        stepOrder: i + 1,
        toolName: step.tool,
        success: false,
        error: "Handler not found",
        durationMs: 0,
      });
      overallPass = false;
      continue;
    }

    const { success, result, error, durationMs } = await measure(handler, args);
    const { parsed, text } = success ? parseResponse(result) : { parsed: null, text: error };

    // Extract sessionId from response
    if (parsed && parsed.sessionId) {
      lastSessionId = parsed.sessionId;
    } else if (parsed && parsed.uploadId) {
      lastSessionId = parsed.uploadId;
    }

    // v2 fix: strict per-step expectError (no prefix-based global detection)
    const stepExpectError = step.expectError === true;
    const isNormalResponse = parsed && (parsed.success === true || parsed.status === "ok" || parsed.message || parsed.tools || parsed.savedPath);
    const stepPassed = stepExpectError
      ? !success || (parsed && parsed.success === false)
      : success && isNormalResponse;

    if (!stepPassed) overallPass = false;

    stepResults.push({
      stepOrder: i + 1,
      toolName: step.tool,
      success: stepPassed,
      durationMs,
      responseSummary: text.substring(0, 200),
      errorCode: !stepPassed ? (parsed?.error?.code || error || "UNKNOWN") : null,
    });
  }

  // Verify artifacts
  const artifactsVerified = {};
  if (lastSessionId) {
    const uploadDir = path.join(process.env.Q3D_UPLOADS_DIR, lastSessionId);
    const genDir = path.join(process.env.Q3D_OUTPUT_DIR, lastSessionId);

    const uploadFile = fs.readdirSync(process.env.Q3D_UPLOADS_DIR).find(d => d === lastSessionId)
      ? fs.readdirSync(path.join(process.env.Q3D_UPLOADS_DIR, lastSessionId))[0]
      : null;
    if (uploadFile) {
      artifactsVerified[`uploads/${lastSessionId}/${uploadFile}`] = verifyFile(path.join(uploadDir, uploadFile));
    }

    const avatarPath = path.join(genDir, "avatar.png");
    artifactsVerified[`generated/${lastSessionId}/avatar.png`] = { ...verifyFile(avatarPath), isPng: isPng(avatarPath) };

    // Prompt quality verification (for generate_avatar scenarios)
    const metadataPath = path.join(genDir, "metadata.json");
    let promptCheck = null;
    if (fs.existsSync(metadataPath)) {
      try {
        const metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
        const revisedPrompt = metadata.revisedPrompt || "";
        const customPrompt = metadata.customPrompt || "";
        const style = metadata.style || "";

        // Check 1: style keyword presence
        const styleKeywords = {
          kawaii: ["chibi", "cute", "kawaii", "Q版", "软萌"],
          guofeng: ["Chinese", "traditional", "国风", "水墨", "汉服"],
          trendy: ["toy", "figure", "trendy", "潮玩", "盲盒"],
          simple: ["minimalist", "simple", "简约", "极简", "flat"],
        };
        const keywords = styleKeywords[style] || [];
        const hasStyleKeyword = keywords.some(kw => revisedPrompt.toLowerCase().includes(kw.toLowerCase()));

        // Check 2: customPrompt coverage
        const hasCustomPrompt = !customPrompt || revisedPrompt.includes(customPrompt) || customPrompt.split(/\s+/).some(word => word.length > 1 && revisedPrompt.includes(word));

        // Check 3: length check
        const lengthOk = revisedPrompt.length >= 100 && revisedPrompt.length <= 1000;

        // Check 4: no placeholder residue
        const noPlaceholder = !/\[\w+\]|\{\{\w+\}\}/.test(revisedPrompt);

        promptCheck = {
          hasStyleKeyword,
          hasCustomPrompt,
          lengthOk,
          noPlaceholder,
          revisedPromptLength: revisedPrompt.length,
          style,
        };
      } catch (e) {
        promptCheck = { error: e.message };
      }
    }
    artifactsVerified[`generated/${lastSessionId}/prompt-check`] = promptCheck;

    artifactsVerified[`generated/${lastSessionId}/preview-3d.html`] = verifyFile(path.join(genDir, "preview-3d.html"));
    artifactsVerified[`generated/${lastSessionId}/pet.html`] = verifyFile(path.join(genDir, "pet.html"));
    artifactsVerified[`generated/${lastSessionId}/chat-history.json`] = verifyFile(path.join(genDir, "chat-history.json"));

    // v2: enhanced artifact verification
    artifactsVerified[`generated/${lastSessionId}/metadata.json`] = verifyFile(path.join(genDir, "metadata.json"));
    const modelGlbPath = path.join(genDir, "model.glb");
    artifactsVerified[`generated/${lastSessionId}/model.glb`] = { ...verifyFile(modelGlbPath), isGlb: isGlb(modelGlbPath) };
  }

  // Check works-index
  let worksIndexEntry = null;
  if (fs.existsSync(process.env.Q3D_WORKS_INDEX)) {
    const idx = JSON.parse(fs.readFileSync(process.env.Q3D_WORKS_INDEX, "utf-8"));
    const entry = idx.works.find(w => w.sessionId === lastSessionId);
    if (entry) {
      worksIndexEntry = {
        sessionId: entry.sessionId,
        status: entry.status,
        style: entry.style,
        hasAvatarPath: !!entry.avatarPath,
        hasPreviewPath: !!entry.previewPath,
        hasPetPath: !!entry.petPath,
        // v2: enhanced
        hasGlbPath: !!entry.glbPath,
      };
    }
  }

  // Restore original env
  if (scenario.env && typeof scenario.env === "object") {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }

  return {
    loopId,
    scenario: scenario.name,
    overallResult: overallPass ? "PASS" : "FAIL",
    totalDurationMs: Date.now() - loopStartTime,
    stepResults,
    artifactsVerified,
    worksIndexEntry,
    lastSessionId,
  };
}

// Main
async function main() {
  const report = {
    agentId,
    loopStart,
    loopEnd,
    timestamp: new Date().toISOString(),
    passCount: 0,
    failCount: 0,
    totalDurationMs: 0,
    loopResults: [],
  };

  const globalStart = Date.now();

  for (let loopId = loopStart; loopId <= loopEnd; loopId++) {
    try {
      const result = await runLoop(loopId);
      report.loopResults.push(result);
      if (result.overallResult === "PASS") {
        report.passCount++;
      } else {
        report.failCount++;
      }
    } catch (err) {
      report.loopResults.push({
        loopId,
        scenario: scenarios[loopId]?.name || "unknown",
        overallResult: "FAIL",
        error: err.message,
      });
      report.failCount++;
    }
  }

  report.totalDurationMs = Date.now() - globalStart;

  // Write report
  const reportDir = path.join(__dirname, "reports");
  fs.mkdirSync(reportDir, { recursive: true });
  const reportPath = path.join(reportDir, `agent-${agentId}-report.json`);
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), "utf-8");
  console.error(`[TestRunner] Agent ${agentId} done. Report: ${reportPath}`);
  console.error(`[TestRunner] PASS: ${report.passCount}/${report.loopResults.length}, FAIL: ${report.failCount}/${report.loopResults.length}`);

  // Print summary to stdout for parent agent
  console.log(JSON.stringify({
    agentId,
    passCount: report.passCount,
    failCount: report.failCount,
    totalDurationMs: report.totalDurationMs,
    loops: report.loopResults.map(r => ({ loopId: r.loopId, result: r.overallResult, scenario: r.scenario })),
  }));
}

main().catch(err => {
  console.error("[TestRunner] Fatal error:", err);
  process.exit(1);
});
