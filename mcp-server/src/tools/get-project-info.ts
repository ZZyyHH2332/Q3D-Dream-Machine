import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { config } from "../config.js";
import { findLatestAvatar } from "../utils/file.js";
import { getAllWorks, getWorksStats } from "../utils/works-index.js";

/**
 * q3d_get_project_info
 * 获取项目配置、AI Provider 状态、作品统计、功能清单
 */
export function registerGetProjectInfo(server: any): void {
  server.registerTool(
    "q3d_get_project_info",
    "获取 Q3D 项目信息 - 配置、AI Provider 状态、作品统计、功能清单",
    {
      infoType: {
        type: "string",
        description:
          "信息类型：config（配置）/ providers（AI Provider状态）/ stats（作品统计）/ features（功能清单）/ tools（MCP工具列表）/ all（全部）",
      },
    },
    async (args: { infoType?: string }) => {
      try {
        const infoType = args.infoType || "all";
        const result: any = {};

        // ===== 配置信息 =====
        if (infoType === "config" || infoType === "all") {
          result.config = {
            projectName: "Q3D 形象造梦机",
            version: "1.2.0",
            outputDir: config.outputDir,
            defaultStyle: config.defaultStyle,
            supportedStyles: ["kawaii", "guofeng", "trendy", "simple"],
            maxUploadSizeMB: 4,
            supportedImageFormats: ["png", "jpg", "jpeg", "webp"],
          };
        }

        // ===== AI Provider 状态 =====
        if (infoType === "providers" || infoType === "all") {
          // 检查各 Provider 配置状态
          const providers: any[] = [];

          // TRAE Native（总是可用，因为是内置能力）
          providers.push({
            name: "TRAE Native",
            priority: 0,
            status: "available",
            description: "TRAE 内置 Vision + GenerateImage，零配置",
          });

          // 外部 API
          const hasExternalApi = !!(config.apiKey && config.apiBase);
          providers.push({
            name: "External API",
            priority: 1,
            status: hasExternalApi ? "configured" : "not_configured",
            description: hasExternalApi
              ? `已配置：${config.apiBase}`
              : "未配置（需设置 Q3D_API_KEY 和 Q3D_API_BASE）",
          });

          // Mock（总是可用）
          providers.push({
            name: "Mock",
            priority: 2,
            status: "available",
            description: "本地模拟数据（测试/演示用）",
          });

          result.providers = {
            list: providers,
            fallbackChain: "TRAE Native → External API → Mock",
            currentActive: hasExternalApi ? "TRAE Native (primary) + External API (fallback)" : "TRAE Native (primary) + Mock (fallback)",
          };
        }

        // ===== 作品统计 =====
        if (infoType === "stats" || infoType === "all") {
          try {
            const works = getAllWorks();
            const stats = getWorksStats();
            const latestAvatar = findLatestAvatar(config.outputDir);

            result.stats = {
              totalWorks: works.length,
              byStatus: stats.byStatus || {},
              byStyle: stats.byStyle || {},
              latestAvatar,
              outputDir: config.outputDir,
            };
          } catch (e) {
            result.stats = {
              totalWorks: 0,
              error: "无法读取作品索引",
            };
          }
        }

        // ===== 功能清单 =====
        if (infoType === "features" || infoType === "all") {
          result.features = {
            avatarGeneration: {
              name: "AI 形象生成",
              description: "上传照片生成 4 种风格的 Q 版形象",
              styles: ["kawaii（软萌大头）", "guofeng（国风Q版）", "trendy（潮玩手办）", "simple（简约卡通）"],
            },
            threeDPreview: {
              name: "3D 骨骼动画预览",
              description: "Three.js 真 3D 预览，支持 9 种动画",
              animations: [
                "idle（平静）",
                "happy（开心）",
                "excited（兴奋）",
                "sleeping（困倦）",
                "curious（好奇）",
                "sad（难过）",
                "love（喜爱）",
                "climbing（攀爬）",
                "crawling_upside（倒挂）",
              ],
            },
            desktopPet: {
              name: "桌面宠物",
              description: "PiP 置顶窗口，支持 AI 对话和养成系统",
              features: ["AI 对话", "心情系统", "200级养成", "喂食/玩耍", "性格系统"],
            },
            gallery: {
              name: "作品画廊",
              description: "所有生成作品自动收录到作品展示页",
            },
            dreamLattice: {
              name: "Dream Lattice 生成艺术",
              description: "p5.js 粒子升腾艺术，4 种风格色板",
            },
          };
        }

        // ===== MCP 工具列表 =====
        if (infoType === "tools" || infoType === "all") {
          result.tools = {
            total: 15,
            categories: {
              core: [
                "q3d_health_check - 健康检查",
                "q3d_upload_photo - 保存上传照片",
                "q3d_generate_avatar - 生成 Q 版形象",
                "q3d_save_avatar - TRAE 模式保存头像",
                "q3d_regenerate_avatar - 重新生成/换风格",
              ],
              threeD: [
                "q3d_generate_3d_model - 转换 3D GLB 模型",
                "q3d_create_3d_preview - 创建 3D 预览页",
                "q3d_create_bones_preview - 骨骼动画预览",
              ],
              pet: [
                "q3d_spawn_pet - 创建桌面宠物",
                "q3d_chat_with_pet - 与宠物对话",
                "q3d_control_mood - 心情系统控制",
                "q3d_pet_care - 宠物养成系统",
              ],
              utility: [
                "q3d_manage_gallery - 作品画廊管理",
                "q3d_generate_dream_lattice - Dream Lattice 生成艺术",
                "q3d_get_project_info - 项目信息查询",
              ],
            },
          };
        }

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  success: true,
                  infoType,
                  ...result,
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
                  code: "PROJECT_INFO_FAILED",
                  message: error.message || "获取项目信息失败",
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
