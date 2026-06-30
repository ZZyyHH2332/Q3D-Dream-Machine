import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import { fileURLToPath } from "url";
const __dirname = path.dirname(fileURLToPath(import.meta.url));
export function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}
export function generateSessionId() {
    return `${Date.now()}-${Math.floor(Math.random() * 10000).toString().padStart(4, "0")}`;
}
export function getSessionPath(baseDir, sessionId) {
    const sessionDir = path.join(baseDir, sessionId);
    ensureDir(sessionDir);
    return sessionDir;
}
export function readFileAsBase64(filePath) {
    const buffer = fs.readFileSync(filePath);
    return buffer.toString("base64");
}
export function writeJsonFile(filePath, data) {
    ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
}
export function readJsonFile(filePath) {
    if (!fs.existsSync(filePath))
        return null;
    const content = fs.readFileSync(filePath, "utf-8");
    try {
        return JSON.parse(content);
    }
    catch {
        return null;
    }
}
export function copyFile(src, dest) {
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
}
export function openInBrowser(filePath) {
    return new Promise((resolve, reject) => {
        // Skip actual browser open in test mode to avoid subprocess blocking
        // and excessive browser windows during automated testing
        if (process.env.Q3D_TEST_MODE === "mock") {
            resolve();
            return;
        }
        const platform = process.platform;
        let command;
        let args;
        if (platform === "win32") {
            command = "cmd";
            args = ["/c", "start", "", filePath];
        }
        else if (platform === "darwin") {
            command = "open";
            args = [filePath];
        }
        else {
            command = "xdg-open";
            args = [filePath];
        }
        const child = spawn(command, args, { detached: true, stdio: "ignore" });
        child.on("error", reject);
        child.on("close", (code) => {
            if (code === 0) {
                resolve();
            }
            else {
                reject(new Error(`Browser open exited with code ${code}`));
            }
        });
    });
}
export function getLatestSessionDir(baseDir) {
    if (!fs.existsSync(baseDir))
        return null;
    const entries = fs.readdirSync(baseDir, { withFileTypes: true });
    const dirs = entries
        .filter((e) => e.isDirectory())
        .map((e) => e.name)
        .sort((a, b) => b.localeCompare(a));
    return dirs.length > 0 ? path.join(baseDir, dirs[0]) : null;
}
export function findLatestAvatar(baseDir) {
    const latestDir = getLatestSessionDir(baseDir);
    if (!latestDir)
        return null;
    const avatarPath = path.join(latestDir, "avatar.png");
    return fs.existsSync(avatarPath) ? avatarPath : null;
}
//# sourceMappingURL=file.js.map