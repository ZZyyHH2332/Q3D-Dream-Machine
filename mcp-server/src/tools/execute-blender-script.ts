import path from "path";
import fs from "fs";
import { config } from "../config.js";
import {
  getSessionPath,
  ensureDir,
} from "../utils/file.js";
import { addOrUpdateWork } from "../utils/works-index.js";

const BLENDER_BRIDGE_URL = process.env.Q3D_BLENDER_BRIDGE_URL || "http://localhost:8777";

/**
 * 检查 Blender Bridge 健康状态
 */
async function checkBlenderBridge(): Promise<{ ok: boolean; status?: any; error?: string }> {
  try {
    const res = await fetch(`${BLENDER_BRIDGE_URL}/status`, {
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) {
      return { ok: false, error: `Bridge returned ${res.status}` };
    }
    const status = await res.json();
    return { ok: true, status };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

/**
 * 通过 Blender Bridge 执行 Python 脚本
 */
async function executePythonScript(scriptContent: string): Promise<{ ok: boolean; result?: any; error?: string }> {
  try {
    const res = await fetch(`${BLENDER_BRIDGE_URL}/execute-python`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: scriptContent }),  // Bridge 使用 'code' 字段
      signal: AbortSignal.timeout(120000), // 2 分钟超时
    });
    
    if (!res.ok) {
      const errorText = await res.text();
      return { ok: false, error: `Bridge returned ${res.status}: ${errorText}` };
    }
    
    const result = await res.json();
    return { ok: true, result };
  } catch (err: any) {
    return { ok: false, error: err.message };
  }
}

/**
 * 等待 GLB 文件生成
 */
async function waitForGlb(glbPath: string, timeoutMs: number = 60000): Promise<boolean> {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    if (fs.existsSync(glbPath)) {
      // 等待文件写入完成
      await new Promise(resolve => setTimeout(resolve, 1000));
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  return false;
}

export function registerExecuteBlenderScript(server: any): void {
  server.registerTool(
    "q3d_execute_blender_script",
    "通过 Blender Bridge 执行 Blender Python 脚本，生成 3D 模型 GLB 文件。" +
      "【前置条件】需要 Blender Bridge 运行中（node bridge/q3d-blender-bridge.js），" +
      "且 Blender 已启动并连接 Bridge。",
    {
      sessionId: {
        type: "string",
        description: "会话 ID",
      },
      scriptPath: {
        type: "string",
        description: "Blender Python 脚本路径",
      },
      glbOutputPath: {
        type: "string",
        description: "GLB 输出路径（可选，默认从脚本中推断）",
      },
    },
    async (args: {
      sessionId: string;
      scriptPath: string;
      glbOutputPath?: string;
    }) => {
      try {
        const { sessionId, scriptPath, glbOutputPath } = args;

        // 检查脚本文件
        if (!fs.existsSync(scriptPath)) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: {
                    code: "SCRIPT_NOT_FOUND",
                    message: `脚本文件不存在: ${scriptPath}`,
                    suggestion: "请先调用 q3d_generate_blender_script 生成脚本",
                  },
                }),
              },
            ],
            isError: true,
          };
        }

        // 检查 Blender Bridge 健康状态
        const bridgeStatus = await checkBlenderBridge();
        if (!bridgeStatus.ok) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: {
                    code: "BLENDER_BRIDGE_OFFLINE",
                    message: `Blender Bridge 未运行或无法连接: ${bridgeStatus.error}`,
                    suggestion:
                      "请启动 Blender Bridge:\n" +
                      "1. cd bridge\n" +
                      "2. npm install express cors\n" +
                      "3. node q3d-blender-bridge.js\n" +
                      "4. 确保 Blender 已启动并连接 Bridge",
                  },
                }),
              },
            ],
            isError: true,
          };
        }

        // 读取脚本内容
        const scriptContent = fs.readFileSync(scriptPath, "utf-8");

        // 推断 GLB 输出路径
        let outputGlbPath = glbOutputPath;
        if (!outputGlbPath) {
          // 尝试从脚本中解析输出路径
          const match = scriptContent.match(/export_glb\(["']([^"']+)["']\)/);
          if (match) {
            outputGlbPath = match[1];
          } else {
            // 默认输出路径
            const outputDir = getSessionPath(config.outputDir, sessionId);
            outputGlbPath = path.join(outputDir, "model.glb");
          }
        }

        // 执行脚本
        console.log(`[execute-blender-script] Executing script: ${scriptPath}`);
        const execResult = await executePythonScript(scriptContent);

        if (!execResult.ok) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: {
                    code: "SCRIPT_EXECUTION_FAILED",
                    message: `脚本执行失败: ${execResult.error}`,
                    suggestion:
                      "请检查脚本语法是否正确，或查看 Blender 控制台错误信息。\n" +
                      "可以使用 q3d_refine_blender_script 工具根据错误反馈修改脚本。",
                  },
                }),
              },
            ],
            isError: true,
          };
        }

        // 等待 GLB 文件生成
        console.log(`[execute-blender-script] Waiting for GLB: ${outputGlbPath}`);
        const glbExists = await waitForGlb(outputGlbPath, 60000);

        if (!glbExists) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: {
                    code: "GLB_NOT_GENERATED",
                    message: `GLB 文件未生成: ${outputGlbPath}`,
                    suggestion:
                      "脚本可能执行成功但未导出 GLB，请检查脚本中是否包含 export_glb() 调用。\n" +
                      "或检查 Blender 控制台是否有导出错误。",
                  },
                }),
              },
            ],
            isError: true,
          };
        }

        // 更新元数据
        const outputDir = getSessionPath(config.outputDir, sessionId);
        const metadataPath = path.join(outputDir, "metadata.json");
        let metadata: any = {};
        if (fs.existsSync(metadataPath)) {
          metadata = JSON.parse(fs.readFileSync(metadataPath, "utf-8"));
        }
        metadata.glbPath = outputGlbPath;
        metadata.modelGeneratedAt = new Date().toISOString();
        metadata.bridgeStatus = bridgeStatus.status;

        // 获取 GLB 文件大小
        const glbStats = fs.statSync(outputGlbPath);
        metadata.glbSize = glbStats.size;

        const { writeJsonFile } = await import("../utils/file.js");
        writeJsonFile(metadataPath, metadata);

        // 更新 works index
        addOrUpdateWork(sessionId, {
          status: "model_generated",
          glbPath: outputGlbPath,
        });

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  sessionId,
                  scriptPath,
                  glbPath: outputGlbPath,
                  glbSize: `${(glbStats.size / 1024).toFixed(1)} KB`,
                  message:
                    "3D 模型生成成功！下一步：调用 q3d_assess_model 评估模型质量，或调用 q3d_refine_blender_script 根据反馈优化。",
                  previewUrl: `q3d-dream-machine-app.html?session=${sessionId}`,
                  nextStep: "q3d_assess_model",
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: {
                  code: "EXECUTE_SCRIPT_FAILED",
                  message: error.message || "脚本执行失败",
                },
              }),
            },
          ],
          isError: true,
        };
      }
    }
  );
}
