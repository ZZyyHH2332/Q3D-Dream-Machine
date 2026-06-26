import path from "path";
import fs from "fs";
import { config } from "../config.js";
import { getSessionPath, openInBrowser, findLatestAvatar, } from "../utils/file.js";
export function registerSpawnPet(server) {
    server.registerTool("q3d_spawn_pet", "创建桌面宠物页面并打开浏览器", {
        avatarPath: {
            type: "string",
            description: "生成的 Q 版形象图片路径（可选，默认使用最近一次生成）",
        },
        personality: {
            type: "string",
            description: '宠物性格设定（可选，默认活泼可爱）',
        },
        name: {
            type: "string",
            description: '宠物名字（可选，默认小Q）',
        },
    }, async (args) => {
        try {
            let avatarPath = args.avatarPath;
            const personality = args.personality || "活泼可爱";
            const name = args.name || "小Q";
            // If no avatar path provided, find the latest generated one
            if (!avatarPath) {
                avatarPath = findLatestAvatar(config.outputDir) || "";
            }
            // Determine session ID
            let sessionId;
            if (avatarPath) {
                sessionId = path.basename(path.dirname(avatarPath));
            }
            else {
                // Create a new session without avatar
                const { generateSessionId, getSessionPath } = await import("../utils/file.js");
                sessionId = generateSessionId();
                getSessionPath(config.outputDir, sessionId);
            }
            // Read template
            const templatePath = path.join(path.dirname(new URL(import.meta.url).pathname), "..", "..", "..", "pet-template", "pet.html");
            if (!fs.existsSync(templatePath)) {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: "PET_TEMPLATE_MISSING",
                                    message: "宠物模板文件不存在",
                                    suggestion: "请检查 pet-template/pet.html 是否存在",
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            let template = fs.readFileSync(templatePath, "utf-8");
            // Replace placeholders
            const avatarFileUrl = avatarPath
                ? "file://" + avatarPath.replace(/\\/g, "/")
                : "";
            template = template.replace(/\{\{AVATAR_PATH\}\}/g, avatarFileUrl);
            template = template.replace(/\{\{PERSONALITY\}\}/g, personality);
            template = template.replace(/\{\{NAME\}\}/g, name);
            template = template.replace(/\{\{API_KEY\}\}/g, config.apiKey || "");
            template = template.replace(/\{\{BASE_URL\}\}/g, config.apiBase);
            // Write output
            const outputDir = getSessionPath(config.outputDir, sessionId);
            const petPath = path.join(outputDir, "pet.html");
            fs.writeFileSync(petPath, template, "utf-8");
            // Open in browser
            await openInBrowser(petPath);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            petUrl: petPath,
                            sessionId,
                            name,
                            personality,
                            hasAvatar: !!avatarPath,
                            message: `桌面宠物 ${name} 已生成并打开！`,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            error: {
                                code: "SPAWN_PET_FAILED",
                                message: error.message || "桌面宠物创建失败",
                                suggestion: "请检查模板文件和浏览器可用性",
                            },
                        }),
                    },
                ],
                isError: true,
            };
        }
    });
}
//# sourceMappingURL=spawn-pet.js.map