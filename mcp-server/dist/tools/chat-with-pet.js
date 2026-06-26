import path from "path";
import { config, isApiConfigured } from "../config.js";
import { chatCompletion } from "../utils/api.js";
import { readJsonFile, writeJsonFile } from "../utils/file.js";
const MAX_HISTORY = 20;
export function registerChatWithPet(server) {
    server.registerTool("q3d_chat_with_pet", "与桌面宠物进行 AI 对话", {
        message: {
            type: "string",
            description: "用户发送的消息",
        },
        sessionId: {
            type: "string",
            description: "会话 ID（用于保持对话历史）",
        },
        personality: {
            type: "string",
            description: "宠物性格设定（可选）",
        },
        style: {
            type: "string",
            description: "形象风格（可选，影响对话语气）",
        },
    }, async (args) => {
        try {
            const { message, sessionId, personality = "活泼可爱", style = "kawaii" } = args;
            if (!message || typeof message !== "string") {
                return {
                    content: [
                        {
                            type: "text",
                            text: JSON.stringify({
                                success: false,
                                error: {
                                    code: "CHAT_EMPTY_MESSAGE",
                                    message: "消息内容不能为空",
                                    suggestion: "请输入要发送的消息",
                                },
                            }),
                        },
                    ],
                    isError: true,
                };
            }
            // Load history
            const historyPath = path.join(config.outputDir, sessionId, "chat-history.json");
            let history = readJsonFile(historyPath) || [];
            // Build system prompt
            const styleNames = {
                kawaii: "软萌可爱的",
                guofeng: "国风优雅的",
                trendy: "潮酷时尚的",
                simple: "简约清新的",
            };
            const styleName = styleNames[style] || styleNames.kawaii;
            const systemPrompt = `你是 Q3D 形象造梦机的桌面宠物，一个${styleName}、${personality}的 Q 版虚拟角色。你的名字是小Q。
你的知识范围：Q3D 产品功能、Q 版形象设计、虚拟角色应用场景。
回答要简短活泼，带适当的 emoji，每次回复不超过 80 字。
保持友好、积极的语气，像朋友一样和用户聊天。`;
            const messages = [
                { role: "system", content: systemPrompt },
                ...history.slice(-MAX_HISTORY),
                { role: "user", content: message },
            ];
            let reply;
            let emotion = "happy";
            if (isApiConfigured()) {
                try {
                    reply = await chatCompletion(messages, {
                        maxTokens: 150,
                        temperature: 0.8,
                    });
                    // Simple emotion detection
                    if (reply.includes("😄") || reply.includes("🎉") || reply.includes("✨")) {
                        emotion = "excited";
                    }
                    else if (reply.includes("😢") || reply.includes("💔")) {
                        emotion = "sad";
                    }
                    else if (reply.includes("🤔") || reply.includes("💭")) {
                        emotion = "thinking";
                    }
                }
                catch (apiErr) {
                    reply = "哎呀，网络有点问题呢~ 稍后再试好吗？🥺";
                    emotion = "confused";
                }
            }
            else {
                // Fallback replies when API not configured
                const fallbacks = [
                    "你好呀！我是小Q，你的专属 Q 版宠物~ 🎉",
                    "这个话题好有趣！可以多跟我说说吗~ ✨",
                    "我也觉得呢！你很有眼光哦~ 💕",
                    "哈哈，你真可爱！跟我聊聊天吧~ 😄",
                    "我在听呢，继续说呀~ 👂",
                ];
                reply = fallbacks[Math.floor(Math.random() * fallbacks.length)];
            }
            // Update history
            history.push({ role: "user", content: message });
            history.push({ role: "assistant", content: reply });
            if (history.length > MAX_HISTORY * 2) {
                history = history.slice(-MAX_HISTORY * 2);
            }
            writeJsonFile(historyPath, history);
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            reply,
                            emotion,
                            sessionId,
                            historyLength: history.length,
                            message: `${reply}`,
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
                                code: "CHAT_FAILED",
                                message: error.message || "对话失败",
                                suggestion: "请检查网络连接和 API 配置",
                            },
                        }),
                    },
                ],
                isError: true,
            };
        }
    });
}
//# sourceMappingURL=chat-with-pet.js.map