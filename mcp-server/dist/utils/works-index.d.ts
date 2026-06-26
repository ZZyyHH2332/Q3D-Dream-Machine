export interface WorkEntry {
    sessionId: string;
    status: "uploaded" | "avatar_generated" | "preview_created" | "pet_spawned";
    style: "kawaii" | "guofeng" | "trendy" | "simple";
    styleName: string;
    createdAt: string;
    updatedAt: string;
    avatarPath: string | null;
    previewPath: string | null;
    petPath: string | null;
    petName: string | null;
    personality: string | null;
    originalPath: string | null;
}
export interface WorksIndex {
    version: string;
    updatedAt: string;
    works: WorkEntry[];
}
export declare function addOrUpdateWork(sessionId: string, updates: Partial<Omit<WorkEntry, "sessionId" | "createdAt" | "updatedAt">>): void;
export declare function removeWork(sessionId: string): boolean;
export declare function readWorksIndex(): WorksIndex;
//# sourceMappingURL=works-index.d.ts.map