import path from "path";
import fs from "fs";
import { config } from "../config.js";
import { getSessionPath } from "../utils/file.js";

// 等级系统配置（200 级）
const MAX_LEVEL = 200;
const BASE_EXP = 100;
const EXP_GROWTH = 1.15; // 每级经验增长系数

// 计算升级所需经验
function getExpForLevel(level: number): number {
  if (level <= 1) return 0;
  return Math.floor(BASE_EXP * Math.pow(EXP_GROWTH, level - 2));
}

// 计算总经验对应的等级
function getLevelFromExp(totalExp: number): { level: number; currentExp: number; nextLevelExp: number } {
  let level = 1;
  let accumulated = 0;
  let nextExp = getExpForLevel(2);

  while (level < MAX_LEVEL) {
    const expForNext = getExpForLevel(level + 1);
    if (totalExp < accumulated + expForNext) {
      nextExp = expForNext;
      break;
    }
    accumulated += expForNext;
    level++;
  }

  if (level >= MAX_LEVEL) {
    return { level: MAX_LEVEL, currentExp: totalExp - accumulated, nextLevelExp: 0 };
  }

  return {
    level,
    currentExp: totalExp - accumulated,
    nextLevelExp: nextExp,
  };
}

// 默认宠物状态
function getDefaultPetState(name: string = "小Q"): any {
  return {
    name,
    level: 1,
    totalExp: 0,
    affection: 0, // 好感度 0-100
    hunger: 80, // 饱食度 0-100
    energy: 90, // 精力值 0-100
    cleanliness: 85, // 清洁度 0-100
    happiness: 70, // 快乐值 0-100
    currentMood: "idle",
    personality: "friendly", // friendly / naughty / lazy / shy
    createdAt: Date.now(),
    lastUpdated: Date.now(),
    totalInteractions: 0,
    totalFeeds: 0,
    totalPlays: 0,
    streakDays: 1, // 连续互动天数
  };
}

/**
 * q3d_pet_care
 * 宠物养成系统：喂食、玩耍、状态查询、改名、性格设置
 */
export function registerPetCare(server: any): void {
  server.registerTool(
    "q3d_pet_care",
    "宠物养成系统 - 喂食、玩耍、查看状态、改名、设置性格（200级好感度养成）",
    {
      action: {
        type: "string",
        description:
          "操作类型：status（查看状态）/ feed（喂食）/ play（玩耍）/ rename（改名）/ set_personality（设置性格）/ reset（重置）",
        required: true,
      },
      sessionId: {
        type: "string",
        description: "宠物会话 ID（必需）",
        required: true,
      },
      name: {
        type: "string",
        description: "宠物新名字（action=rename 时需要）",
      },
      personality: {
        type: "string",
        description: "性格：friendly（友好）/ naughty（调皮）/ lazy（慵懒）/ shy（害羞）",
      },
      foodType: {
        type: "string",
        description: "食物类型：snack（小食）/ meal（正餐）/ dessert（甜点），默认 snack",
      },
      playType: {
        type: "string",
        description: "玩耍类型：ball（球）/ chase（追逐）/ puzzle（解谜），默认 ball",
      },
    },
    async (args: {
      action: string;
      sessionId: string;
      name?: string;
      personality?: string;
      foodType?: string;
      playType?: string;
    }) => {
      try {
        const { action, sessionId } = args;

        if (!sessionId) {
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  success: false,
                  error: {
                    code: "SESSION_REQUIRED",
                    message: "需要提供 sessionId",
                  },
                }),
              },
            ],
            isError: true,
          };
        }

        // 加载或初始化宠物状态
        let state = loadPetState(sessionId);
        let message = "";
        let leveledUp = false;
        let oldLevel = state.level;

        switch (action) {
          case "status": {
            const levelInfo = getLevelFromExp(state.totalExp);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      pet: formatPetState(state, levelInfo),
                      message: `${state.name} 的状态`,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          case "feed": {
            const foodType = args.foodType || "snack";
            const foodEffects: Record<string, { hunger: number; happiness: number; exp: number }> = {
              snack: { hunger: 15, happiness: 5, exp: 5 },
              meal: { hunger: 40, happiness: 10, exp: 15 },
              dessert: { hunger: 10, happiness: 20, exp: 10 },
            };
            const effect = foodEffects[foodType] || foodEffects.snack;

            state.hunger = Math.min(100, state.hunger + effect.hunger);
            state.happiness = Math.min(100, state.happiness + effect.happiness);
            state.totalExp += effect.exp;
            state.affection = Math.min(100, state.affection + 2);
            state.totalFeeds++;
            state.totalInteractions++;

            const levelInfo = getLevelFromExp(state.totalExp);
            state.level = levelInfo.level;
            leveledUp = levelInfo.level > oldLevel;

            // 根据饱食度调整心情
            if (state.hunger < 30) {
              state.currentMood = "sad";
            } else if (state.happiness > 80) {
              state.currentMood = "happy";
            } else {
              state.currentMood = "idle";
            }

            message = leveledUp
              ? `🎉 升级了！${state.name} 升到了 ${state.level} 级！吃了${foodType === "meal" ? "正餐" : foodType === "dessert" ? "甜点" : "小食"}，好满足~`
              : `${state.name} 吃饱了，好开心！（+${effect.exp} 经验）`;
            break;
          }

          case "play": {
            const playType = args.playType || "ball";
            const playEffects: Record<string, { happiness: number; energy: number; exp: number }> = {
              ball: { happiness: 15, energy: -10, exp: 10 },
              chase: { happiness: 20, energy: -20, exp: 15 },
              puzzle: { happiness: 10, energy: -5, exp: 20 },
            };
            const effect = playEffects[playType] || playEffects.ball;

            if (state.energy < Math.abs(effect.energy)) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      success: false,
                      error: {
                        code: "TOO_TIRED",
                        message: `${state.name} 太累了，让它休息一下吧~`,
                        suggestion: "精力不足，可以等它恢复或者让它睡觉",
                      },
                    }),
                  },
                ],
                isError: true,
              };
            }

            state.happiness = Math.min(100, state.happiness + effect.happiness);
            state.energy = Math.max(0, state.energy + effect.energy);
            state.totalExp += effect.exp;
            state.affection = Math.min(100, state.affection + 3);
            state.hunger = Math.max(0, state.hunger - 5);
            state.totalPlays++;
            state.totalInteractions++;

            const levelInfo = getLevelFromExp(state.totalExp);
            state.level = levelInfo.level;
            leveledUp = levelInfo.level > oldLevel;

            // 玩耍后心情
            if (state.happiness > 85) {
              state.currentMood = "excited";
            } else if (state.happiness > 60) {
              state.currentMood = "happy";
            } else {
              state.currentMood = "idle";
            }

            const playNames: Record<string, string> = {
              ball: "玩球",
              chase: "追逐游戏",
              puzzle: "解谜游戏",
            };

            message = leveledUp
              ? `🎉 升级了！${state.name} 升到了 ${state.level} 级！${playNames[playType] || "玩耍"}好开心~`
              : `${state.name} 玩得很开心！（+${effect.exp} 经验）`;
            break;
          }

          case "rename": {
            if (!args.name || args.name.trim().length === 0) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      success: false,
                      error: {
                        code: "NAME_REQUIRED",
                        message: "请输入新名字",
                      },
                    }),
                  },
                ],
                isError: true,
              };
            }
            const oldName = state.name;
            state.name = args.name.trim().slice(0, 20);
            state.totalInteractions++;
            message = `${oldName} 改名为 ${state.name} 啦！`;
            break;
          }

          case "set_personality": {
            const validPersonalities = ["friendly", "naughty", "lazy", "shy"];
            const personality = args.personality || "friendly";
            if (!validPersonalities.includes(personality)) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      success: false,
                      error: {
                        code: "INVALID_PERSONALITY",
                        message: `无效性格：${personality}`,
                        suggestion: "可选：friendly / naughty / lazy / shy",
                      },
                    }),
                  },
                ],
                isError: true,
              };
            }
            state.personality = personality;
            const personalityNames: Record<string, string> = {
              friendly: "友好",
              naughty: "调皮",
              lazy: "慵懒",
              shy: "害羞",
            };
            message = `${state.name} 的性格设为了「${personalityNames[personality]}」`;
            break;
          }

          case "reset": {
            state = getDefaultPetState();
            message = `${state.name} 的状态已重置`;
            break;
          }

          default:
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    success: false,
                    error: {
                      code: "INVALID_ACTION",
                      message: `无效操作：${action}`,
                      suggestion: "可用操作：status / feed / play / rename / set_personality / reset",
                    },
                  }),
                },
              ],
              isError: true,
            };
        }

        state.lastUpdated = Date.now();
        savePetState(sessionId, state);

        const levelInfo = getLevelFromExp(state.totalExp);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  action,
                  leveledUp,
                  pet: formatPetState(state, levelInfo),
                  message,
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
                  code: "PET_CARE_FAILED",
                  message: error.message || "宠物操作失败",
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

function loadPetState(sessionId: string): any {
  const statusPath = getPetStatusPath(sessionId);
  if (fs.existsSync(statusPath)) {
    try {
      const state = JSON.parse(fs.readFileSync(statusPath, "utf-8"));
      // 补充缺失的字段
      const defaults = getDefaultPetState();
      return { ...defaults, ...state };
    } catch (e) {
      // 解析失败，返回默认
    }
  }
  return getDefaultPetState();
}

function savePetState(sessionId: string, state: any): void {
  const statusPath = getPetStatusPath(sessionId);
  const dir = path.dirname(statusPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(statusPath, JSON.stringify(state, null, 2), "utf-8");
}

function formatPetState(state: any, levelInfo: any): any {
  const personalityNames: Record<string, string> = {
    friendly: "友好",
    naughty: "调皮",
    lazy: "慵懒",
    shy: "害羞",
  };
  const moodNames: Record<string, string> = {
    idle: "平静",
    happy: "开心",
    excited: "兴奋",
    sleeping: "困倦",
    curious: "好奇",
    sad: "难过",
    love: "喜爱",
    climbing: "攀爬中",
    crawling_upside: "倒挂中",
  };

  return {
    name: state.name,
    level: state.level,
    totalExp: state.totalExp,
    currentExp: levelInfo.currentExp,
    nextLevelExp: levelInfo.nextLevelExp,
    expProgress: levelInfo.nextLevelExp > 0
      ? Math.floor((levelInfo.currentExp / levelInfo.nextLevelExp) * 100)
      : 100,
    affection: state.affection, // 好感度
    hunger: state.hunger, // 饱食度
    energy: state.energy, // 精力值
    cleanliness: state.cleanliness, // 清洁度
    happiness: state.happiness, // 快乐值
    currentMood: state.currentMood,
    currentMoodName: moodNames[state.currentMood] || state.currentMood,
    personality: state.personality,
    personalityName: personalityNames[state.personality] || state.personality,
    totalInteractions: state.totalInteractions,
    totalFeeds: state.totalFeeds,
    totalPlays: state.totalPlays,
    createdAt: state.createdAt,
    lastUpdated: state.lastUpdated,
  };
}
