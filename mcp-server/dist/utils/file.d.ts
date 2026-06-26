export declare function ensureDir(dirPath: string): void;
export declare function generateSessionId(): string;
export declare function getSessionPath(baseDir: string, sessionId: string): string;
export declare function readFileAsBase64(filePath: string): string;
export declare function writeJsonFile(filePath: string, data: unknown): void;
export declare function readJsonFile<T>(filePath: string): T | null;
export declare function copyFile(src: string, dest: string): void;
export declare function openInBrowser(filePath: string): Promise<void>;
export declare function getLatestSessionDir(baseDir: string): string | null;
export declare function findLatestAvatar(baseDir: string): string | null;
//# sourceMappingURL=file.d.ts.map