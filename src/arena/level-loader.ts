import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { LevelConfigSchema, WorldConfigSchema } from './schemas/level-config';
import type { LevelConfig, WorldConfig } from './schemas/level-config';

export interface LoadedLevel {
  config: LevelConfig;
  worldId: string;
}

export interface LoadedWorld {
  config: WorldConfig;
  levels: LoadedLevel[];
}

// 关卡文件目录（bundled in codebase per D-04）
// 使用 import.meta.url 兼容 ESM 环境
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LEVELS_DIR = path.join(__dirname, 'levels');

/**
 * 加载并校验所有世界和关卡配置。
 * 启动时调用（per LEVL-02），无效配置抛出含具体字段名的错误。
 */
export function loadAllWorlds(): LoadedWorld[] {
  if (!fs.existsSync(LEVELS_DIR)) {
    console.warn('[arena] Levels directory not found:', LEVELS_DIR);
    return [];
  }

  const entries = fs.readdirSync(LEVELS_DIR, { withFileTypes: true });
  const worlds: LoadedWorld[] = [];

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;

    const worldDir = path.join(LEVELS_DIR, entry.name);
    const worldJsonPath = path.join(worldDir, 'world.json');

    if (!fs.existsSync(worldJsonPath)) {
      console.warn(`[arena] Skipping directory without world.json: ${entry.name}`);
      continue;
    }

    // 加载 world.json
    const worldRaw = JSON.parse(fs.readFileSync(worldJsonPath, 'utf-8'));
    const worldResult = WorldConfigSchema.safeParse(worldRaw);
    if (!worldResult.success) {
      throw new Error(`[arena] Invalid world.json in ${entry.name}: ${worldResult.error.message}`);
    }

    // 加载该世界下的所有 level-*.json
    const levelFiles = fs.readdirSync(worldDir)
      .filter(f => f.startsWith('level-') && f.endsWith('.json'))
      .sort();

    const levels: LoadedLevel[] = [];
    for (const levelFile of levelFiles) {
      const levelPath = path.join(worldDir, levelFile);
      const levelRaw = JSON.parse(fs.readFileSync(levelPath, 'utf-8'));
      const levelResult = LevelConfigSchema.safeParse(levelRaw);
      if (!levelResult.success) {
        throw new Error(`[arena] Invalid level config ${entry.name}/${levelFile}: ${levelResult.error.message}`);
      }
      levels.push({ config: levelResult.data, worldId: worldResult.data.id });
    }

    // 按 sortOrder 排序
    levels.sort((a, b) => a.config.sortOrder - b.config.sortOrder);

    worlds.push({ config: worldResult.data, levels });
  }

  // 按 sortOrder 排序世界
  worlds.sort((a, b) => a.config.sortOrder - b.config.sortOrder);
  return worlds;
}

/**
 * 加载单个关卡配置（按 worldId + levelId 查找）
 */
export function loadLevel(worldId: string, levelId: string): LoadedLevel | null {
  const worlds = loadAllWorlds();
  for (const world of worlds) {
    if (world.config.id === worldId) {
      const level = world.levels.find(l => l.config.id === levelId);
      return level || null;
    }
  }
  return null;
}

/**
 * 获取指定世界的所有关卡（按 sortOrder 排序）
 */
export function getWorldLevels(worldId: string): LoadedLevel[] {
  const worlds = loadAllWorlds();
  const world = worlds.find(w => w.config.id === worldId);
  return world?.levels || [];
}
