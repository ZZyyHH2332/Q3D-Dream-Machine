import { config } from "../../../config.js";
import { saveGlb } from "./index.js";
import fs from "fs";
const API_302AI_BASE = "https://api.302.ai";
export const provider302AI = {
    name: "302.AI",
    async isAvailable() {
        return !!config.api302Key;
    },
    async generate(input) {
        if (!config.api302Key) {
            return {
                success: false,
                glbPath: "",
                error: {
                    code: "302AI_NOT_CONFIGURED",
                    message: "未配置 302.AI API Key",
                    suggestion: "请设置环境变量 Q3D_302AI_API_KEY",
                },
            };
        }
        try {
            const imageBuffer = fs.readFileSync(input.avatarPath);
            const base64 = imageBuffer.toString("base64");
            const res = await fetch(`${API_302AI_BASE}/sd/v2beta/3d/stable-fast-3d`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${config.api302Key}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify({ image: base64 }),
            });
            if (!res.ok) {
                const err = await res.text();
                return {
                    success: false,
                    glbPath: "",
                    error: {
                        code: "302AI_API_ERROR",
                        message: `302.AI API 返回错误: ${res.status} - ${err}`,
                        suggestion: "请检查 API Key 是否有效，或免费额度是否已用完",
                    },
                };
            }
            const glbBuffer = Buffer.from(await res.arrayBuffer());
            const glbPath = saveGlb(glbBuffer, input.outputDir, input.sessionId);
            return {
                success: true,
                glbPath,
                message: `302.AI 云生成成功: ${glbPath}`,
            };
        }
        catch (error) {
            return {
                success: false,
                glbPath: "",
                error: {
                    code: "302AI_GENERATE_FAILED",
                    message: error.message || "302.AI 生成失败",
                    suggestion: "请检查网络连接和 API Key 配置",
                },
            };
        }
    },
};
//# sourceMappingURL=302ai.js.map