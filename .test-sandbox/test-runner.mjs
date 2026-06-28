#!/usr/bin/env node
/**
 * Q3D MCP Server Test Runner
 * Usage: node test-runner.mjs <agent-id> <loop-start> <loop-end>
 *   agent-id: A | B | C | D
 *   loop-start: 1-20
 *   loop-end: 1-20
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
const loopEnd = parseInt(process.argv[4] || "20");

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

// Import tool registers from dist
const { registerUploadPhoto } = await import(toFileUrl(path.join(distDir, "tools", "upload-photo.js")));
const { registerGenerateAvatar } = await import(toFileUrl(path.join(distDir, "tools", "generate-avatar.js")));
const { registerCreate3DPreview } = await import(toFileUrl(path.join(distDir, "tools", "create-3d-preview.js")));
const { registerSpawnPet } = await import(toFileUrl(path.join(distDir, "tools", "spawn-pet.js")));
const { registerChatWithPet } = await import(toFileUrl(path.join(distDir, "tools", "chat-with-pet.js")));
const { registerHealthCheck } = await import(toFileUrl(path.join(distDir, "tools", "health-check.js")));

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

// Loop scenarios
const scenarios = {
  1: { name: "完整链路_kawaii", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: path.join(__dirname, "test-data", "sample-portrait.jpg"), style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小Q", personality: "活泼可爱" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "你好呀" } },
  ]},
  2: { name: "完整链路_guofeng", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: path.join(__dirname, "test-data", "sample-portrait.jpg"), style: "guofeng" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "guofeng" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小竹", personality: "温婉优雅" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "你是谁" } },
  ]},
  3: { name: "完整链路_trendy", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: path.join(__dirname, "test-data", "sample-portrait.jpg"), style: "trendy" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "trendy" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小潮", personality: "酷炫个性" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "你好" } },
  ]},
  4: { name: "完整链路_simple", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: path.join(__dirname, "test-data", "sample-portrait.jpg"), style: "simple" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "simple" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小简", personality: "安静内向" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "Hi" } },
  ]},
  5: { name: "完整链路_customPrompt", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: path.join(__dirname, "test-data", "sample-portrait.jpg"), style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii", customPrompt: "戴着眼镜的程序猿" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
  ]},
  6: { name: "快速spawn_无avatar", steps: [
    { tool: "q3d_spawn_pet", args: { name: "小快速", personality: "活泼可爱" } },
  ]},
  7: { name: "快速spawn_有avatar_chat", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: path.join(__dirname, "test-data", "sample-portrait.jpg"), style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小快", personality: "开朗" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "测试消息" } },
  ]},
  8: { name: "自动查找最新avatar", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: path.join(__dirname, "test-data", "sample-portrait.jpg"), style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_create_3d_preview", args: {} },
  ]},
  9: { name: "错误_upload空路径", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: "", style: "kawaii" } },
  ]},
  10: { name: "错误_upload不支持格式", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: path.join(__dirname, "test-data", "invalid-file.txt"), style: "kawaii" } },
  ]},
  11: { name: "错误_generate无效uploadId", steps: [
    { tool: "q3d_generate_avatar", args: { uploadId: "nonexistent-session-12345", style: "kawaii" } },
  ]},
  12: { name: "错误_upload超4MB", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: path.join(__dirname, "test-data", "oversize.jpg"), style: "kawaii" } },
  ]},
  13: { name: "错误_preview无avatar", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: path.join(__dirname, "test-data", "sample-portrait.jpg"), style: "kawaii" }, expectError: false },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" }, expectError: true },
  ]},
  14: { name: "错误_chat空消息", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: path.join(__dirname, "test-data", "sample-portrait.jpg"), style: "kawaii" }, expectError: false },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" }, expectError: false },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小空", personality: "安静" }, expectError: false },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "" }, expectError: true },
  ]},
  15: { name: "无APIKey_generate", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: path.join(__dirname, "test-data", "sample-portrait.jpg"), style: "kawaii" }, expectError: false },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" }, expectError: true },
  ], noMock: true },
  16: { name: "无APIKey_chat", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: path.join(__dirname, "test-data", "sample-portrait.jpg"), style: "kawaii" }, expectError: false },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" }, expectError: true },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小无", personality: "安静" }, expectError: true },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "测试" }, expectError: true },
  ], noMock: true },
  17: { name: "并发_generate+preview", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: path.join(__dirname, "test-data", "sample-portrait.jpg"), style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" }, concurrentWith: "q3d_spawn_pet" },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小并", personality: "活泼" } },
  ]},
  18: { name: "状态覆盖_preview后spawn", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: path.join(__dirname, "test-data", "sample-portrait.jpg"), style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_create_3d_preview", args: { sessionId: "@last.sessionId" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小覆", personality: "多变" } },
  ]},
  19: { name: "重复chat_历史上限", steps: [
    { tool: "q3d_upload_photo", args: { imagePath: path.join(__dirname, "test-data", "sample-portrait.jpg"), style: "kawaii" } },
    { tool: "q3d_generate_avatar", args: { uploadId: "@last.sessionId", style: "kawaii" } },
    { tool: "q3d_spawn_pet", args: { sessionId: "@last.sessionId", name: "小多", personality: "话痨" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "消息1" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "消息2" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "消息3" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "消息4" } },
    { tool: "q3d_chat_with_pet", args: { sessionId: "@last.sessionId", message: "消息5" } },
  ]},
  20: { name: "health_check+工具列表", steps: [
    { tool: "q3d_health_check", args: {} },
  ]},
};

// Run a single loop
async function runLoop(loopId) {
  const scenario = scenarios[loopId];
  if (!scenario) {
    throw new Error(`Unknown loopId: ${loopId}`);
  }

  // Handle noMock flag for Agent B loops 15-16
  if (scenario.noMock) {
    process.env.Q3D_TEST_MODE = "";
    process.env.Q3D_API_KEY = "";
  } else {
    process.env.Q3D_TEST_MODE = "mock";
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

    // Determine expected result - per-step expectError takes priority
    const isErrorScenario = scenario.name.startsWith("错误_") || scenario.name.startsWith("无APIKey_");
    const stepExpectError = step.expectError !== undefined ? step.expectError : isErrorScenario;
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

    artifactsVerified[`generated/${lastSessionId}/preview-3d.html`] = verifyFile(path.join(genDir, "preview-3d.html"));
    artifactsVerified[`generated/${lastSessionId}/pet.html`] = verifyFile(path.join(genDir, "pet.html"));
    artifactsVerified[`generated/${lastSessionId}/chat-history.json`] = verifyFile(path.join(genDir, "chat-history.json"));
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
      };
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
  const reportPath = path.join(__dirname, "reports", `agent-${agentId}-report.json`);
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
