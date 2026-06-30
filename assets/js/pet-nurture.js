/**
 * Q3D Pet Nurture — 角色养成系统
 * 参考 DyberPet：200级好感度、徽章、饱食度/精力离线衰减
 */

const PetNurture = (function() {
  'use strict';

  const STORAGE_KEY = 'q3d_pet_nurture';

  const DEFAULTS = {
    affection: 0,      // 好感度（0~24000，每120点1级）
    satiety: 100,      // 饱食度（0~100）
    energy: 100,       // 精力（0~100）
    lastSave: Date.now(),
    totalChats: 0,
    totalFeeds: 0,
    totalPlays: 0,
    totalRests: 0,
    createdAt: Date.now(),
  };

  // ========== 数据加载（含离线衰减） ==========
  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULTS };
      const data = JSON.parse(raw);
      const now = Date.now();
      const offlineMs = now - (data.lastSave || now);
      const offlineHours = offlineMs / 3600000;

      // 离线衰减：饱食度每小时-2%，精力每小时-1.5%
      if (offlineHours > 0.1) {
        data.satiety = Math.max(0, (data.satiety || 100) - offlineHours * 2);
        data.energy = Math.max(0, (data.energy || 100) - offlineHours * 1.5);
      }
      data.lastSave = now;
      return { ...DEFAULTS, ...data };
    } catch (e) {
      return { ...DEFAULTS };
    }
  }

  function save(data) {
    data.lastSave = Date.now();
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }

  // ========== 等级与徽章 ==========
  function getLevel(affection) {
    return Math.min(200, Math.floor((affection || 0) / 120) + 1);
  }

  function getBadge(level) {
    if (level >= 151) return { icon: '👑', name: '王者', color: '#FFD700', minLv: 151 };
    if (level >= 101) return { icon: '☀️', name: '太阳', color: '#FF8C00', minLv: 101 };
    if (level >= 51)  return { icon: '🌙', name: '月亮', color: '#9370DB', minLv: 51 };
    return { icon: '⭐', name: '星星', color: '#87CEEB', minLv: 1 };
  }

  function getNextLevelAffection(affection) {
    const lv = getLevel(affection);
    if (lv >= 200) return null;
    return lv * 120;
  }

  // ========== 心情映射 ==========
  function getMood(stats) {
    const s = stats.satiety || 0;
    const e = stats.energy || 0;
    if (s < 15 || e < 15) return 'sad';
    if (s < 40 || e < 40) return 'sleepy';
    if (s > 80 && e > 80) return 'happy';
    return 'idle';
  }

  // ========== 互动接口 ==========
  function chat(stats) {
    stats.affection = (stats.affection || 0) + 3;
    stats.energy = Math.max(0, (stats.energy || 100) - 2);
    stats.totalChats = (stats.totalChats || 0) + 1;
    save(stats);
    return stats;
  }

  function feed(stats) {
    if ((stats.satiety || 0) >= 95) {
      stats.affection = (stats.affection || 0) + 1; // 太饱时好感度增加减少
    } else {
      stats.satiety = Math.min(100, (stats.satiety || 0) + 25);
      stats.affection = (stats.affection || 0) + 5;
    }
    stats.totalFeeds = (stats.totalFeeds || 0) + 1;
    save(stats);
    return stats;
  }

  function play(stats) {
    if ((stats.energy || 0) < 10) {
      // 精力不足，无法玩耍
      return stats;
    }
    stats.energy = Math.max(0, (stats.energy || 0) - 10);
    stats.satiety = Math.max(0, (stats.satiety || 0) - 5);
    stats.affection = (stats.affection || 0) + 8;
    stats.totalPlays = (stats.totalPlays || 0) + 1;
    save(stats);
    return stats;
  }

  function rest(stats) {
    stats.energy = Math.min(100, (stats.energy || 0) + 30);
    stats.satiety = Math.max(0, (stats.satiety || 0) - 3);
    stats.totalRests = (stats.totalRests || 0) + 1;
    save(stats);
    return stats;
  }

  // ========== 统计摘要 ==========
  function getSummary(stats) {
    const lv = getLevel(stats.affection);
    const badge = getBadge(lv);
    const next = getNextLevelAffection(stats.affection);
    const progress = next ? Math.min(100, Math.round(((stats.affection - (lv - 1) * 120) / 120) * 100)) : 100;
    return {
      level: lv,
      badge,
      progress,
      nextAffection: next,
      mood: getMood(stats),
      daysSinceCreated: Math.floor((Date.now() - (stats.createdAt || Date.now())) / 86400000),
    };
  }

  // ========== 导出 ==========
  return {
    load, save,
    getLevel, getBadge, getMood, getSummary,
    chat, feed, play, rest,
  };
})();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { PetNurture };
}
