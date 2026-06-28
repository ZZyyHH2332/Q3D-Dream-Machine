export interface Generate3DInput {
    avatarPath: string;
    sessionId: string;
    outputDir: string;
}
export interface Generate3DResult {
    success: boolean;
    glbPath: string;
    message?: string;
    error?: {
        code: string;
        message: string;
        suggestion?: string;
    };
}
export interface Provider3D {
    name: string;
    isAvailable(): Promise<boolean>;
    generate(input: Generate3DInput): Promise<Generate3DResult>;
}
export declare function resolveProvider(): Promise<Provider3D | null>;
export declare function saveGlb(buffer: Buffer, outputDir: string, sessionId: string): string;
//# sourceMappingURL=index.d.ts.map