export interface WorkEntry {
    sessionId: string;
    status: "uploaded" | "avatar_generated" | "multiview_generated" | "script_generated" | "script_refined" | "preview_created" | "bones_preview_created" | "pet_spawned" | "model_generated" | "model_validated" | "model_needs_refine" | "pipeline_executing" | "pipeline_max_refine" | "pipeline_complete";
    style: "kawaii" | "guofeng" | "trendy" | "simple";
    styleName: string;
    createdAt: string;
    updatedAt: string;
    avatarPath: string | null;
    previewPath: string | null;
    bonesPreviewPath: string | null;
    petPath: string | null;
    glbPath: string | null;
    petName: string | null;
    personality: string | null;
    qualityScore: number | null;
    modelPath: string | null;
    originalPath: string | null;
    initialMood: string | null;
}
export interface WorksIndex {
    version: string;
    updatedAt: string;
    works: WorkEntry[];
}
export declare function addOrUpdateWork(sessionId: string, updates: Partial<Omit<WorkEntry, "sessionId" | "createdAt" | "updatedAt">>): void;
export declare function removeWork(sessionId: string): boolean;
export declare function readWorksIndex(): WorksIndex;
export declare function getAllWorks(): WorkEntry[];
export declare function getWorkById(sessionId: string): WorkEntry | undefined;
export declare function getWorksStats(): {
    total: number;
    byStatus: Record<string, number>;
    byStyle: Record<string, number>;
};
//# sourceMappingURL=works-index.d.ts.map