import { config } from "../config.js";
import {
  getAllWorks,
  getWorkById,
  removeWork,
  getWorksStats,
  WorkEntry,
} from "../utils/works-index.js";

/**
 * q3d_manage_gallery
 * 作品画廊管理：查看作品列表、获取作品详情、删除作品、获取统计
 */
export function registerManageGallery(server: any): void {
  server.registerTool(
    "q3d_manage_gallery",
    "作品画廊管理 - 查看作品列表、获取详情、删除作品、统计数据",
    {
      action: {
        type: "string",
        description:
          "操作类型：list（列表）/ get（详情）/ delete（删除）/ stats（统计）",
        required: true,
      },
      workId: {
        type: "string",
        description: "作品 ID（sessionId，action=get/delete 时需要）",
      },
      limit: {
        type: "number",
        description: "每页数量（action=list 时可选，默认 20）",
      },
      offset: {
        type: "number",
        description: "偏移量（action=list 时可选，默认 0）",
      },
      style: {
        type: "string",
        description: "按风格筛选：kawaii / guofeng / trendy / simple",
      },
      status: {
        type: "string",
        description: "按状态筛选：uploaded / avatar_generated / preview_created / pet_spawned / model_generated",
      },
    },
    async (args: {
      action: string;
      workId?: string;
      limit?: number;
      offset?: number;
      style?: string;
      status?: string;
    }) => {
      try {
        const { action, workId } = args;

        switch (action) {
          case "list": {
            let works = getAllWorks();

            // 按风格筛选
            if (args.style) {
              works = works.filter((w: WorkEntry) => w.style === args.style);
            }

            // 按状态筛选
            if (args.status) {
              works = works.filter((w: WorkEntry) => w.status === args.status);
            }

            const total = works.length;
            const limit = args.limit || 20;
            const offset = args.offset || 0;
            const paginated = works.slice(offset, offset + limit);

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      total,
                      page: Math.floor(offset / limit) + 1,
                      pageSize: limit,
                      hasMore: offset + limit < total,
                      works: paginated.map(formatWork),
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          case "get": {
            if (!workId) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      success: false,
                      error: {
                        code: "WORK_ID_REQUIRED",
                        message: "需要提供 workId（即 sessionId）",
                      },
                    }),
                  },
                ],
                isError: true,
              };
            }

            const work = getWorkById(workId);
            if (!work) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      success: false,
                      error: {
                        code: "WORK_NOT_FOUND",
                        message: `未找到作品：${workId}`,
                      },
                    }),
                  },
                ],
                isError: true,
              };
            }

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      work: formatWork(work),
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          case "delete": {
            if (!workId) {
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      success: false,
                      error: {
                        code: "WORK_ID_REQUIRED",
                        message: "需要提供 workId（即 sessionId）",
                      },
                    }),
                  },
                ],
                isError: true,
              };
            }

            const removed = removeWork(workId);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: removed,
                      workId,
                      message: removed
                        ? `作品 ${workId} 已删除`
                        : `未找到作品：${workId}`,
                    },
                    null,
                    2
                  ),
                },
              ],
            };
          }

          case "stats": {
            const stats = getWorksStats();
            const allWorks = getAllWorks();

            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    {
                      success: true,
                      total: allWorks.length,
                      byStatus: stats.byStatus || {},
                      byStyle: stats.byStyle || {},
                      statusNames: {
                        uploaded: "已上传",
                        avatar_generated: "形象已生成",
                        preview_created: "3D预览已创建",
                        pet_spawned: "宠物已领养",
                        model_generated: "3D模型已生成",
                      },
                      styleNames: {
                        kawaii: "软萌大头",
                        guofeng: "国风Q版",
                        trendy: "潮玩手办",
                        simple: "简约卡通",
                      },
                    },
                    null,
                    2
                  ),
                },
              ],
            };
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
                      suggestion: "可用操作：list / get / delete / stats",
                    },
                  }),
                },
              ],
              isError: true,
            };
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify({
                success: false,
                error: {
                  code: "GALLERY_MANAGE_FAILED",
                  message: error.message || "画廊管理失败",
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

function formatWork(work: any): any {
  const statusNames: Record<string, string> = {
    uploaded: "已上传",
    avatar_generated: "形象已生成",
    preview_created: "3D预览已创建",
    pet_spawned: "宠物已领养",
    model_generated: "3D模型已生成",
  };
  const styleNames: Record<string, string> = {
    kawaii: "软萌大头",
    guofeng: "国风Q版",
    trendy: "潮玩手办",
    simple: "简约卡通",
  };

  return {
    sessionId: work.sessionId,
    status: work.status,
    statusName: statusNames[work.status] || work.status,
    style: work.style,
    styleName: styleNames[work.style] || work.style,
    createdAt: work.createdAt,
    updatedAt: work.updatedAt,
    avatarPath: work.avatarPath,
    previewPath: work.previewPath,
    petPath: work.petPath,
    glbPath: work.glbPath,
    petName: work.petName,
    personality: work.personality,
    originalPath: work.originalPath,
  };
}
