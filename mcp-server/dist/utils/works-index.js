import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, "..", "..", "..");
const indexPath = process.env.Q3D_WORKS_INDEX
    ? path.resolve(process.env.Q3D_WORKS_INDEX)
    : path.join(projectRoot, "works-index.json");
const STATUS_ORDER = [
    "uploaded",
    "avatar_generated",
    "multiview_generated",
    "script_generated",
    "script_refined",
    "preview_created",
    "bones_preview_created",
    "model_generated",
    "pet_spawned",
    "model_validated",
    "model_needs_refine",
    "pipeline_executing",
    "pipeline_max_refine",
    "pipeline_complete",
];
function toRelativePath(absPath) {
    if (!absPath)
        return "";
    const rel = path.relative(projectRoot, absPath);
    return rel.replace(/\\/g, "/");
}
function readIndex() {
    if (!fs.existsSync(indexPath)) {
        return { version: "1.0", updatedAt: new Date().toISOString(), works: [] };
    }
    try {
        const content = fs.readFileSync(indexPath, "utf-8");
        const data = JSON.parse(content);
        if (!Array.isArray(data.works))
            data.works = [];
        return data;
    }
    catch {
        return { version: "1.0", updatedAt: new Date().toISOString(), works: [] };
    }
}
function writeIndex(data) {
    data.updatedAt = new Date().toISOString();
    const tmpPath = indexPath + ".tmp";
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
    fs.renameSync(tmpPath, indexPath);
}
function canAdvance(from, to) {
    return STATUS_ORDER.indexOf(to) >= STATUS_ORDER.indexOf(from);
}
export function addOrUpdateWork(sessionId, updates) {
    const index = readIndex();
    let entry = index.works.find((w) => w.sessionId === sessionId);
    const now = new Date().toISOString();
    if (!entry) {
        entry = {
            sessionId,
            status: updates.status || "uploaded",
            style: updates.style || "kawaii",
            styleName: updates.styleName || "软萌大头",
            createdAt: now,
            updatedAt: now,
            avatarPath: updates.avatarPath ? toRelativePath(updates.avatarPath) : null,
            previewPath: updates.previewPath ? toRelativePath(updates.previewPath) : null,
            bonesPreviewPath: updates.bonesPreviewPath ? toRelativePath(updates.bonesPreviewPath) : null,
            petPath: updates.petPath ? toRelativePath(updates.petPath) : null,
            glbPath: updates.glbPath ? toRelativePath(updates.glbPath) : null,
            petName: updates.petName || null,
            personality: updates.personality || null,
            qualityScore: updates.qualityScore || null,
            modelPath: updates.modelPath || null,
            originalPath: updates.originalPath ? toRelativePath(updates.originalPath) : null,
            initialMood: updates.initialMood || null,
        };
        index.works.unshift(entry);
    }
    else {
        // Only allow status to advance forward
        if (updates.status && canAdvance(entry.status, updates.status)) {
            entry.status = updates.status;
        }
        if (updates.style) {
            entry.style = updates.style;
        }
        if (updates.styleName) {
            entry.styleName = updates.styleName;
        }
        if (updates.avatarPath) {
            entry.avatarPath = toRelativePath(updates.avatarPath);
        }
        if (updates.previewPath) {
            entry.previewPath = toRelativePath(updates.previewPath);
        }
        if (updates.bonesPreviewPath) {
            entry.bonesPreviewPath = toRelativePath(updates.bonesPreviewPath);
        }
        if (updates.petPath) {
            entry.petPath = toRelativePath(updates.petPath);
        }
        if (updates.petName !== undefined) {
            entry.petName = updates.petName;
        }
        if (updates.personality !== undefined) {
            entry.personality = updates.personality;
        }
        if (updates.originalPath) {
            entry.originalPath = toRelativePath(updates.originalPath);
        }
        if (updates.initialMood !== undefined) {
            entry.initialMood = updates.initialMood;
        }
        entry.updatedAt = now;
    }
    writeIndex(index);
}
export function removeWork(sessionId) {
    const index = readIndex();
    const before = index.works.length;
    index.works = index.works.filter((w) => w.sessionId !== sessionId);
    if (index.works.length < before) {
        writeIndex(index);
        return true;
    }
    return false;
}
export function readWorksIndex() {
    return readIndex();
}
// 获取所有作品
export function getAllWorks() {
    return readIndex().works;
}
// 根据 ID 获取单个作品
export function getWorkById(sessionId) {
    return readIndex().works.find((w) => w.sessionId === sessionId);
}
// 获取作品统计
export function getWorksStats() {
    const works = readIndex().works;
    const byStatus = {};
    const byStyle = {};
    for (const w of works) {
        byStatus[w.status] = (byStatus[w.status] || 0) + 1;
        byStyle[w.style] = (byStyle[w.style] || 0) + 1;
    }
    return {
        total: works.length,
        byStatus,
        byStyle,
    };
}
//# sourceMappingURL=works-index.js.map