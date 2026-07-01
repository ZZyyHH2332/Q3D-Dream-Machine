/**
 * Avatar Provider 解析器
 * 按优先级自动选择可用的 AI Provider
 *
 * 优先级：TRAE Native → External API → Mock
 * 可通过 Q3D_AI_PROVIDER 环境变量指定，或使用 auto 自动探测
 */
import { IAvatarProvider } from "./types.js";
import { traeNativeProvider } from "./trae-native.js";
import { externalApiProvider } from "./external-api.js";
import { mockAvatarProvider } from "./mock-avatar.js";
/**
 * 解析当前应该使用的 Avatar Provider
 * 按配置和可用性自动选择
 */
export declare function resolveAvatarProvider(forceProvider?: "trae" | "external" | "mock" | "auto"): Promise<IAvatarProvider>;
/**
 * 获取当前有效 provider 的名称
 */
export declare function getCurrentProviderName(): Promise<string>;
/**
 * 检测 TRAE Native Provider 是否在自动模式下可用
 */
export declare function isTraeNativeActive(): Promise<boolean>;
export { traeNativeProvider, externalApiProvider, mockAvatarProvider };
//# sourceMappingURL=avatar-resolver.d.ts.map