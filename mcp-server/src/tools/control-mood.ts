import path from "path";
import fs from "fs";
import { config } from "../config.js";
import { getSessionPath } from "../utils/file.js";

// 可用心情列表（9 种：7 种心情 + 2 种行为）
const AVAILABLE_MOODS = [
  { id: "idle", name: "平静", emoji: "😌", category: "mood" },
  { id: "happy", name: "开心", emoji: "😄", category: "mood" },
  { id: "excited", name: "兴奋", emoji: "🤩", category: "mood" },
  { id: "sleeping", name: "困倦", emoji: "😴", category: "mood" },
  { id: "curious", name: "好奇", emoji: "🤔", category: "mood" },
  { id: "sad", name: "难过", emoji: "😢", category: "mood" },
  { id: "love", name: "喜爱", emoji: "🥰", category: "mood" },
  { id: "climbing", name: "攀爬", emoji: "🧗", category: "action" },
  { id: "crawling_upside", name: "倒挂", emoji: "🙃", category: "action" },
];

/**
 * q3d_control_mood
 * 心情系统控制：设置心情、获取当前心情、列出可用心情
 * 支持同时控制 3D 预览页和宠物页面
 */
export function registerControlMood(server: any): void {
  server.registerTool(
    "q3d_control_mood",
    "心情系统控制 - 设置角色心情/动画、获取当前状态、列出可用心情（共9种：7种心情 + 攀爬 + 倒挂）",
    {
      action: {
        type: "string",
        description: "操作类型：set（设置心情）/ get（获取当前心情）/ list（列出所有可用心情）",
        required: true,
      },
      mood: {
        type: "string",
        description: "心情 ID（action=set 时需要）：idle/happy/excited/sleeping/curious/sad/love/climbing/crawling_upside",
      },
      sessionId: {
        type: "string",
        description: "会话 ID（可选，用于保存/读取宠物状态）",
      },
      target: {
        type: "string",
        description: "目标：pet（宠物）/ preview-3d（3D预览）/ both（两者），默认 both",
      },
    },
    async (args: {
      action: string;
      mood?: string;
      sessionId?: string;
      target?: string;
    }) => {
      try {
        const { action, mood, sessionId, target = "both" } = args;

        // ===== list 操作 =====
        if (action === "list") {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    total: AVAILABLE_MOODS.length,
                    moods: AVAILABLE_MOODS,
                    message: `共 ${AVAILABLE_MOODS.length} 种动画：7 种心情 + 2 种行为（攀爬/倒挂）`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // ===== get 操作 =====
        if (action === "get") {
          let currentMood = "idle";

          // 从宠物状态文件读取
          if (sessionId) {
            const statusPath = getPetStatusPath(sessionId);
            if (fs.existsSync(statusPath)) {
              try {
                const status = JSON.parse(fs.readFileSync(statusPath, "utf-8"));
                currentMood = status.currentMood || "idle";
              } catch (e) {
                // 解析失败，使用默认
              }
            }
          }

          const moodInfo = AVAILABLE_MOODS.find((m) => m.id === currentMood);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    currentMood,
                    moodInfo: moodInfo || null,
                    sessionId: sessionId || null,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // ===== set 操作 =====
        if (action === "set") {
          if (!mood) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: {
                      code: "MOOD_REQUIRED",
                      message: "设置心情时必须提供 mood 参数",
                      suggestion: "可用心情：" + AVAILABLE_MOODS.map((m) => m.id).join(" / "),
                    },
                  }),
                },
              ],
              isError: true,
            };
          }

          // 验证心情是否有效
          const moodInfo = AVAILABLE_MOODS.find((m) => m.id === mood);
          if (!moodInfo) {
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: {
                      code: "INVALID_MOOD",
                      message: `无效的心情：${mood}`,
                      suggestion: "可用心情：" + AVAILABLE_MOODS.map((m) => m.id).join(" / "),
                    },
                  }),
                },
              ],
              isError: true,
            };
          }

          // 保存到宠物状态文件
          if (sessionId && (target === "pet" || target === "both")) {
            savePetMood(sessionId, mood);
          }

          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  {
                    success: true,
                    mood,
                    moodInfo,
                    target,
                    sessionId: sessionId || null,
                    message: `心情已设置为：${moodInfo.emoji} ${moodInfo.name}（${moodInfo.category === "mood" ? "心情" : "行为"}）`,
                  },
                  null,
                  2
                ),
              },
            ],
          };
        }

        // 未知操作
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: {
                  code: "INVALID_ACTION",
                  message: `无效的操作：${action}`,
                  suggestion: "可用操作：set / get / list",
                },
              }),
            },
          ],
          isError: true,
        };
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: {
                  code: "MOOD_CONTROL_FAILED",
                  message: error.message || "心情控制失败",
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

// ===== 辅助函数 =====

function getPetStatusPath(sessionId: string): string {
  const sessionDir = getSessionPath(config.outputDir, sessionId);
  return path.join(sessionDir, "pet-status.json");
}

function savePetMood(sessionId: string, mood: string): void {
  const statusPath = getPetStatusPath(sessionId);
  let status: any = { currentMood: mood, lastUpdated: Date.now() };

  if (fs.existsSync(statusPath)) {
    try {
      const existing = JSON.parse(fs.readFileSync(statusPath, "utf-8"));
      status = { ...existing, currentMood: mood, lastUpdated: Date.now() };
    } catch (e) {
      // 解析失败，覆盖
    }
  }

  const dir = path.dirname(statusPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(statusPath, JSON.stringify(status, null, 2), "utf-8");
}
