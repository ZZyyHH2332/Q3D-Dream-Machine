export type Provider3D = "hunyuan" | "tripo" | "302ai" | "auto";
export type AiProvider = "trae" | "external" | "auto";
export interface Q3DConfig {
    aiProvider: AiProvider;
    traeVisionEnabled: boolean;
    traeImageModel: string;
    apiKey: string | undefined;
    apiBase: string;
    outputDir: string;
    uploadsDir: string;
    worksIndexPath: string;
    testMode: boolean;
    provider3D: Provider3D;
    hunyuanApiUrl: string;
    api302Key: string | undefined;
    tripoApiKey: string | undefined;
}
export declare const config: Q3DConfig;
/**
 * 检测是否运行在 TRAE IDE 环境中
 * 通过检查 TRAE 相关的环境变量来判断
 */
export declare function isTraeEnvironment(): boolean;
/**
 * TRAE Native 模式是否可用
 * 需要同时满足：配置允许 + 运行在 TRAE 环境中
 */
export declare function isTraeNativeAvailable(): boolean;
/**
 * AI 能力是否已配置
 * - TRAE Native 可用时返回 true
 * - 外部 API Key 已配置时返回 true
 * - mock 模式下也返回 true
 */
export declare function isApiConfigured(): boolean;
//# sourceMappingURL=config.d.ts.map