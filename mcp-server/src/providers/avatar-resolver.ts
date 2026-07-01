/**
 * Avatar Provider 解析器
 * 按优先级自动选择可用的 AI Provider
 *
 * 优先级：TRAE Native → External API → Mock
 * 可通过 Q3D_AI_PROVIDER 环境变量指定，或使用 auto 自动探测
 */

import { config } from "../config.js";
import { IAvatarProvider } from "./types.js";
import { traeNativeProvider } from "./trae-native.js";
import { externalApiProvider } from "./external-api.js";
import { mockAvatarProvider } from "./mock-avatar.js";

/**
 * 解析当前应该使用的 Avatar Provider
 * 按配置和可用性自动选择
 */
export async function resolveAvatarProvider(
  forceProvider?: "trae" | "external" | "mock" | "auto"
): Promise<IAvatarProvider> {
  const target = forceProvider || config.aiProvider;

  // Mock 模式优先级最高
  if (config.testMode || target === "mock") {
    return mockAvatarProvider;
  }

  // 指定 trae 模式
  if (target === "trae") {
    if (await traeNativeProvider.isAvailable()) {
      return traeNativeProvider;
    }
    // 指定 trae 但不可用，降级到 external
    if (externalApiProvider.isAvailable()) {
      return externalApiProvider;
    }
    return mockAvatarProvider;
  }

  // 指定 external 模式
  if (target === "external") {
    if (externalApiProvider.isAvailable()) {
      return externalApiProvider;
    }
    return mockAvatarProvider;
  }

  // auto 模式：按优先级探测
  if (await traeNativeProvider.isAvailable()) {
    return traeNativeProvider;
  }
  if (externalApiProvider.isAvailable()) {
    return externalApiProvider;
  }
  return mockAvatarProvider;
}

/**
 * 获取当前有效 provider 的名称
 */
export async function getCurrentProviderName(): Promise<string> {
  const provider = await resolveAvatarProvider();
  return provider.name;
}

/**
 * 检测 TRAE Native Provider 是否在自动模式下可用
 */
export async function isTraeNativeActive(): Promise<boolean> {
  const provider = await resolveAvatarProvider();
  return provider.name === "trae-native";
}

// 导出所有 provider 供直接使用
export { traeNativeProvider, externalApiProvider, mockAvatarProvider };
