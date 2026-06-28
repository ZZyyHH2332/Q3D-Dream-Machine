export type Provider3D = "hunyuan" | "tripo" | "302ai" | "auto";
export interface Q3DConfig {
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
export declare function isApiConfigured(): boolean;
//# sourceMappingURL=config.d.ts.map