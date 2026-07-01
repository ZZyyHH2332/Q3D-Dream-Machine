import path from "path";
import fs from "fs";
import { config } from "../config.js";
import { getSessionPath, openInBrowser } from "../utils/file.js";
import { addOrUpdateWork } from "../utils/works-index.js";
// 4 种风格的 Dream Lattice 色板
const STYLE_PALETTES = {
    kawaii: {
        name: "软萌大头",
        bg: "linear-gradient(135deg, #FFF0F5 0%, #FFE4EC 50%, #FFD1DC 100%)",
        particles: ["#FFB6C1", "#FF69B4", "#FFC0CB", "#FFE4E8", "#FFD700"],
        accent: "#FF69B4",
    },
    guofeng: {
        name: "国风Q版",
        bg: "linear-gradient(135deg, #FDF5E6 0%, #F5DEB3 50%, #DEB887 100%)",
        particles: ["#DC143C", "#B22222", "#DAA520", "#CD853F", "#8B4513"],
        accent: "#DC143C",
    },
    trendy: {
        name: "潮玩手办",
        bg: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
        particles: ["#00D4FF", "#FF6B6B", "#FFE66D", "#95E1D3", "#C9B1FF"],
        accent: "#00D4FF",
    },
    simple: {
        name: "简约卡通",
        bg: "linear-gradient(135deg, #F8F9FA 0%, #E9ECEF 50%, #DEE2E6 100%)",
        particles: ["#343A40", "#495057", "#6C757D", "#ADB5BD", "#CED4DA"],
        accent: "#343A40",
    },
};
/**
 * q3d_generate_dream_lattice
 * 生成 Dream Lattice 造梦晶格艺术页面
 * 基于 p5.js 的粒子升腾生成艺术
 */
export function registerGenerateDreamLattice(server) {
    server.registerTool("q3d_generate_dream_lattice", "生成 Dream Lattice 造梦晶格艺术页面（p5.js 粒子升腾生成艺术，4 种风格色板）", {
        style: {
            type: "string",
            description: "风格色板：kawaii（软萌粉）/ guofeng（国风沙）/ trendy（潮玩霓虹）/ simple（简约灰）",
        },
        particleCount: {
            type: "number",
            description: "粒子数量（可选，默认 120，范围 30-300）",
        },
        speed: {
            type: "string",
            description: "动画速度：slow / normal / fast，默认 normal",
        },
        sessionId: {
            type: "string",
            description: "会话 ID（可选）",
        },
        openInBrowser: {
            type: "boolean",
            description: "是否自动打开浏览器（默认 true）",
        },
    }, async (args) => {
        try {
            const style = args.style || "kawaii";
            const particleCount = Math.min(300, Math.max(30, args.particleCount || 120));
            const speed = args.speed || "normal";
            const shouldOpen = args.openInBrowser !== false;
            const sessionId = args.sessionId || `dream_lattice_${Date.now()}`;
            const palette = STYLE_PALETTES[style] || STYLE_PALETTES.kawaii;
            const speedMap = {
                slow: 0.5,
                normal: 1.0,
                fast: 2.0,
            };
            const speedMultiplier = speedMap[speed] || 1.0;
            // 生成 HTML
            const html = generateDreamLatticeHTML({
                style,
                styleName: palette.name,
                palette,
                particleCount,
                speedMultiplier,
                sessionId,
            });
            // 写入文件
            const outputDir = getSessionPath(config.outputDir, sessionId);
            const outputPath = path.join(outputDir, "dream-lattice.html");
            fs.writeFileSync(outputPath, html, "utf-8");
            // 更新作品索引
            addOrUpdateWork(sessionId, {
                status: "avatar_generated",
                style: style,
                styleName: palette.name,
            });
            // 打开浏览器
            if (shouldOpen) {
                await openInBrowser(outputPath);
            }
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: true,
                            outputPath,
                            sessionId,
                            style,
                            styleName: palette.name,
                            particleCount,
                            speed,
                            availableStyles: Object.keys(STYLE_PALETTES).map((k) => ({
                                id: k,
                                name: STYLE_PALETTES[k].name,
                            })),
                            message: `Dream Lattice 生成艺术已生成：${palette.name}风格，${particleCount} 粒子`,
                        }, null, 2),
                    },
                ],
            };
        }
        catch (error) {
            return {
                content: [
                    {
                        type: "text",
                        text: JSON.stringify({
                            success: false,
                            error: {
                                code: "DREAM_LATTICE_FAILED",
                                message: error.message || "Dream Lattice 生成失败",
                            },
                        }),
                    },
                ],
                isError: true,
            };
        }
    });
}
// ===== HTML 生成函数 =====
function generateDreamLatticeHTML(params) {
    const { style, styleName, palette, particleCount, speedMultiplier, sessionId } = params;
    const particleColors = JSON.stringify(palette.particles);
    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Dream Lattice — 造梦晶格 · ${styleName}</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/p5.js/1.7.0/p5.min.js"></script>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background: ${palette.bg};
            min-height: 100vh;
            overflow: hidden;
        }
        #canvas-container {
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
        }
        .info {
            position: fixed;
            top: 20px;
            left: 20px;
            z-index: 10;
            color: ${style === 'trendy' ? '#fff' : '#333'};
        }
        .info h1 {
            font-size: 28px;
            font-weight: 300;
            letter-spacing: 3px;
            margin-bottom: 4px;
        }
        .info p {
            font-size: 13px;
            opacity: 0.6;
            letter-spacing: 1px;
        }
        .controls {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 10;
            display: flex;
            gap: 8px;
        }
        .controls button {
            padding: 8px 16px;
            border: 1px solid ${palette.accent}33;
            background: ${style === 'trendy' ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.8)'};
            color: ${style === 'trendy' ? '#fff' : '#333'};
            border-radius: 20px;
            cursor: pointer;
            font-size: 12px;
            backdrop-filter: blur(10px);
            transition: all 0.3s;
        }
        .controls button:hover {
            background: ${palette.accent};
            color: #fff;
            transform: translateY(-2px);
        }
    </style>
</head>
<body>
    <div id="canvas-container"></div>
    <div class="info">
        <h1>Dream Lattice</h1>
        <p>造梦晶格 · ${styleName} · ${particleCount} particles</p>
    </div>
    <div class="controls">
        <button onclick="togglePause()">暂停/继续</button>
        <button onclick="changeSpeed()">变速</button>
        <button onclick="resetParticles()">重置</button>
    </div>

    <script>
        const PARTICLE_COUNT = ${particleCount};
        const SPEED_MULTIPLIER = ${speedMultiplier};
        const COLORS = ${particleColors};
        const STYLE = '${style}';

        let particles = [];
        let paused = false;
        let currentSpeed = 1;

        class Particle {
            constructor() {
                this.reset(true);
            }

            reset(initial = false) {
                this.x = Math.random() * windowWidth;
                this.y = initial ? Math.random() * windowHeight : windowHeight + 20;
                this.size = Math.random() * 6 + 2;
                this.speedY = (Math.random() * 1.5 + 0.5) * SPEED_MULTIPLIER;
                this.speedX = (Math.random() - 0.5) * 0.5;
                this.color = COLORS[Math.floor(Math.random() * COLORS.length)];
                this.alpha = Math.random() * 0.6 + 0.2;
                this.wobble = Math.random() * Math.PI * 2;
                this.wobbleSpeed = Math.random() * 0.02 + 0.01;
            }

            update() {
                if (paused) return;
                this.y -= this.speedY * currentSpeed;
                this.wobble += this.wobbleSpeed * currentSpeed;
                this.x += Math.sin(this.wobble) * 0.5 + this.speedX * currentSpeed;

                // 超出顶部重置
                if (this.y < -20) {
                    this.reset();
                }
                // 超出左右边界反弹
                if (this.x < -20) this.x = windowWidth + 20;
                if (this.x > windowWidth + 20) this.x = -20;
            }

            draw() {
                noStroke();
                fill(this.color + Math.floor(this.alpha * 255).toString(16).padStart(2, '0'));
                ellipse(this.x, this.y, this.size);
            }
        }

        function setup() {
            const canvas = createCanvas(windowWidth, windowHeight);
            canvas.parent('canvas-container');

            for (let i = 0; i < PARTICLE_COUNT; i++) {
                particles.push(new Particle());
            }
        }

        function draw() {
            // 半透明背景形成拖尾效果
            if (STYLE === 'trendy') {
                background(26, 26, 46, 10);
            } else {
                background(255, 255, 255, 8);
            }

            // 绘制连接线（邻近粒子）
            strokeWeight(0.5);
            for (let i = 0; i < particles.length; i++) {
                for (let j = i + 1; j < particles.length; j++) {
                    const d = dist(particles[i].x, particles[i].y, particles[j].x, particles[j].y);
                    if (d < 80) {
                        const alpha = map(d, 0, 80, 30, 0);
                        stroke(particles[i].color + Math.floor(alpha).toString(16).padStart(2, '0'));
                        line(particles[i].x, particles[i].y, particles[j].x, particles[j].y);
                    }
                }
            }

            // 绘制粒子
            for (const p of particles) {
                p.update();
                p.draw();
            }
        }

        function windowResized() {
            resizeCanvas(windowWidth, windowHeight);
        }

        function togglePause() {
            paused = !paused;
        }

        function changeSpeed() {
            const speeds = [0.5, 1, 2, 3];
            const idx = speeds.indexOf(currentSpeed);
            currentSpeed = speeds[(idx + 1) % speeds.length];
        }

        function resetParticles() {
            particles = [];
            for (let i = 0; i < PARTICLE_COUNT; i++) {
                particles.push(new Particle());
            }
        }
    </script>
</body>
</html>`;
}
//# sourceMappingURL=generate-dream-lattice.js.map