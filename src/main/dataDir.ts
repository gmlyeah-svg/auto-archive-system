import { app } from 'electron'
import { join, isAbsolute } from 'path'
import fs from 'fs'

// 应用配置（指向数据目录的指针）存于 userData，独立于数据目录，避免自引用
interface AppConfig {
  dataDir: string
}

const DEFAULT_DATA_DIR = 'D:\\database'

let configPath = ''
let config: AppConfig = { dataDir: 'D:\\database' }

export function initConfig(): void {
  configPath = join(app.getPath('userData'), 'config.json')
  try {
    const raw = fs.readFileSync(configPath, 'utf-8')
    const parsed = JSON.parse(raw) as Partial<AppConfig>
    if (parsed && typeof parsed.dataDir === 'string' && parsed.dataDir.trim()) {
      config.dataDir = parsed.dataDir.trim()
    }
  } catch {
    // 首次运行或无配置文件，用默认值
  }
}

function saveConfig(): void {
  try {
    fs.mkdirSync(configPath.split('\\').slice(0, -1).join('\\'), { recursive: true })
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8')
  } catch (e) {
    console.error('Failed to save config', e)
  }
}

export function getDataDir(): string {
  if (!config.dataDir || !config.dataDir.trim()) {
    config.dataDir = DEFAULT_DATA_DIR
  }
  return config.dataDir
}

export function getDefaultDataDir(): string {
  return DEFAULT_DATA_DIR
}

/**
 * 确保数据目录存在并初始化子目录结构（images/attachments）。
 * 优先使用当前数据目录；若该目录无法创建（如无 D 盘），自动回退到"文档/本地汽修档案数据"。
 */
export function ensureDataDirs(): void {
  let dir = getDataDir()
  try {
    fs.mkdirSync(dir, { recursive: true })
  } catch {
    const fallback = join(app.getPath('documents'), '本地汽修档案数据')
    setDataDir(fallback)
    dir = fallback
  }
  const subs = ['images', 'images/other', 'images/thumbnails', 'attachments']
  for (const sub of subs) {
    const p = join(dir, sub)
    if (!fs.existsSync(p)) {
      fs.mkdirSync(p, { recursive: true })
    }
  }
}

/**
 * 设置数据目录（仅在选择后调用）。目录会被创建。
 */
export function setDataDir(newDir: string): { ok: boolean; dir: string; error?: string } {
  if (!newDir || !newDir.trim()) {
    return { ok: false, dir: config.dataDir, error: '目录不能为空' }
  }
  const resolved = isAbsolute(newDir) ? newDir : join('D:\\', newDir.trim())
  try {
    fs.mkdirSync(resolved, { recursive: true })
  } catch (e) {
    return { ok: false, dir: config.dataDir, error: String(e) }
  }
  config.dataDir = resolved
  saveConfig()
  ensureDataDirs()
  return { ok: true, dir: resolved }
}

export function getConfig(): AppConfig {
  return { ...config }
}
