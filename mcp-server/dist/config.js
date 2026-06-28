import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// Load .env from mcp-server directory
dotenv.config({ path: path.join(__dirname, "..", ".env") });
function getConfig() {
    const projectRoot = path.join(__dirname, "..", "..");
    return {
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
export function isApiConfigured() {
    return !!config.apiKey;
}
//# sourceMappingURL=config.js.map