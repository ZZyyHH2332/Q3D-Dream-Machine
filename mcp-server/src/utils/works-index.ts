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
  "preview_created",
  "pet_spawned",
];

export interface WorkEntry {
  sessionId: string;
  status: "uploaded" | "avatar_generated" | "preview_created" | "pet_spawned" | "model_generated";
  style: "kawaii" | "guofeng" | "trendy" | "simple";
  styleName: string;
  createdAt: string;
  updatedAt: string;
  avatarPath: string | null;
  previewPath: string | null;
  petPath: string | null;
  glbPath: string | null;
  petName: string | null;
  personality: string | null;
  originalPath: string | null;
}

export interface WorksIndex {
  version: string;
  updatedAt: string;
  works: WorkEntry[];
}

function toRelativePath(absPath: string): string {
  if (!absPath) return "";
  const rel = path.relative(projectRoot, absPath);
  return rel.replace(/\\/g, "/");
}

function readIndex(): WorksIndex {
  if (!fs.existsSync(indexPath)) {
    return { version: "1.0", updatedAt: new Date().toISOString(), works: [] };
  }
  try {
    const content = fs.readFileSync(indexPath, "utf-8");
    const data = JSON.parse(content) as WorksIndex;
    if (!Array.isArray(data.works)) data.works = [];
    return data;
  } catch {
    return { version: "1.0", updatedAt: new Date().toISOString(), works: [] };
  }
}

function writeIndex(data: WorksIndex): void {
  data.updatedAt = new Date().toISOString();
  const tmpPath = indexPath + ".tmp";
  fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), "utf-8");
  fs.renameSync(tmpPath, indexPath);
}

function canAdvance(from: string, to: string): boolean {
  return STATUS_ORDER.indexOf(to) >= STATUS_ORDER.indexOf(from);
}

export function addOrUpdateWork(
  sessionId: string,
  updates: Partial<Omit<WorkEntry, "sessionId" | "createdAt" | "updatedAt">>
): void {
  const index = readIndex();
  let entry = index.works.find((w) => w.sessionId === sessionId);
  const now = new Date().toISOString();

  if (!entry) {
    entry = {
      sessionId,
      status: (updates.status as WorkEntry["status"]) || "uploaded",
      style: updates.style || "kawaii",
      styleName: updates.styleName || "软萌大头",
      createdAt: now,
      updatedAt: now,
      avatarPath: updates.avatarPath ? toRelativePath(updates.avatarPath) : null,
      previewPath: updates.previewPath ? toRelativePath(updates.previewPath) : null,
      petPath: updates.petPath ? toRelativePath(updates.petPath) : null,
      glbPath: updates.glbPath ? toRelativePath(updates.glbPath) : null,
      petName: updates.petName || null,
      personality: updates.personality || null,
      originalPath: updates.originalPath ? toRelativePath(updates.originalPath) : null,
    };
    index.works.unshift(entry);
  } else {
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
    entry.updatedAt = now;
  }

  writeIndex(index);
}

export function removeWork(sessionId: string): boolean {
  const index = readIndex();
  const before = index.works.length;
  index.works = index.works.filter((w) => w.sessionId !== sessionId);
  if (index.works.length < before) {
    writeIndex(index);
    return true;
  }
  return false;
}

export function readWorksIndex(): WorksIndex {
  return readIndex();
}
