import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from mcp-server directory
dotenv.config({ path: path.join(__dirname, "..", ".env") });
function getConfig() {
    const projectRoot = path.join(__dirname, "..", "..");
    const aiProviderRaw = (process.env.Q3D_AI_PROVIDER || "auto").toLowerCase();
    const aiProvider = ["trae", "external", "auto"].includes(aiProviderRaw)
        ? aiProviderRaw
        : "auto";
    return {
        aiProvider,
        traeVisionEnabled: process.env.Q3D_TRAE_VISION_ENABLED !== "false",
        traeImageModel: process.env.Q3D_TRAE_IMAGE_MODEL || "auto",
        apiKey: process.env.Q3D_API_KEY || undefined,
        apiBase: process.env.Q3D_API_BASE || "https://api.openai.com/v1",
        outputDir: process.env.Q3D_OUTPUT_DIR
            ? path.resolve(process.env.Q3D_OUTPUT_DIR)
            : path.join(projectRoot, "assets", "generated"),
        uploadsDir: process.env.Q3D_UPLOADS_DIR
            ? path.resolve(process.env.Q3D_UPLOADS_DIR)
            : path.join(projectRoot, "assets", "uploads"),
        worksIndexPath: process.env.Q3D_WORKS_INDEX
            ? path.resolve(process.env.Q3D_WORKS_INDEX)
            : path.join(projectRoot, "works-index.json"),
        testMode: process.env.Q3D_TEST_MODE === "mock",
        provider3D: process.env.Q3D_3D_PROVIDER || "auto",
        hunyuanApiUrl: process.env.Q3D_HUNYUAN_API_URL || "http://localhost:8080",
        api302Key: process.env.Q3D_302AI_API_KEY || undefined,
        tripoApiKey: process.env.Q3D_TRIPO_API_KEY || undefined,
    };
}
// Dynamic config: re-reads process.env on every property access
// This allows runtime changes (e.g., Q3D_TEST_MODE) to take effect immediately
function createConfigProxy() {
    return new Proxy({}, {
        get(_target, prop) {
            return getConfig()[prop];
        },
        set(_target, prop, value) {
            // Allow setting properties on the underlying config for flexibility
            getConfig()[prop] = value;
            return true;
        },
    });
}
export const config = createConfigProxy();
/**
 * 检测是否运行在 TRAE IDE 环境中
 * 通过检查 TRAE 相关的环境变量来判断
 */
export function isTraeEnvironment() {
    return !!(process.env.TRAE ||
        process.env.TRAE_IDE ||
        process.env.TRAE_ENV ||
        process.env.TRAE_WORKSPACE ||
        process.env.TRAE_MCP_CONTEXT);
}
/**
 * TRAE Native 模式是否可用
 * 需要同时满足：配置允许 + 运行在 TRAE 环境中
 */
export function isTraeNativeAvailable() {
    if (config.testMode)
        return false;
    if (config.aiProvider === "external")
        return false;
    return isTraeEnvironment();
}
/**
 * AI 能力是否已配置
 * - TRAE Native 可用时返回 true
 * - 外部 API Key 已配置时返回 true
 * - mock 模式下也返回 true
 */
export function isApiConfigured() {
    if (config.testMode)
        return true;
    if (isTraeNativeAvailable())
        return true;
    return !!config.apiKey;
}
//# sourceMappingURL=config.js.map