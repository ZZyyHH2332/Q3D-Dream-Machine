import { config } from "../config.js";
import { getCurrentProviderName, isTraeNativeActive } from "../providers/avatar-resolver.js";
export function registerHealthCheck(server) {
    server.registerTool("q3d_health_check", "Q3D 服务健康检查，验证 MCP Server 运行状态和 AI Provider 配置", {}, async () => {
        const providerName = await getCurrentProviderName();
        const traeActive = await isTraeNativeActive();
        return {
            content: [
                {
                    type: "text",
                    text: JSON.stringify({
                        status: "ok",
                        service: "q3d-mcp-server",
                        version: "1.1.0",
                        timestamp: new Date().toISOString(),
                        aiProvider: providerName,
                        aiProviderAvailable: config.testMode ||
                            traeActive ||
                            !!config.apiKey,
                        testMode: config.testMode,
                        traeNative: {
                            enabled: config.aiProvider !== "external",
                            active: traeActive,
                            visionEnabled: config.traeVisionEnabled,
                            imageModel: config.traeImageModel,
                        },
                        externalApi: {
                            configured: !!config.apiKey,
                            baseUrl: config.apiBase,
                        },
                        provider3D: config.provider3D,
                    }, null, 2),
                },
            ],
        };
    });
}
//# sourceMappingURL=health-check.js.map