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
    };
}
export const config = getConfig();
export function isApiConfigured() {
    return !!config.apiKey;
}
//# sourceMappingURL=config.js.map