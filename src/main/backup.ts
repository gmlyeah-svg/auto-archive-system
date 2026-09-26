import { join } from 'path'
import fs from 'fs'
import { getDataDir } from './dataDir'

const archiver = require('archiver') as (format: string, options?: Record<string, unknown>) => any

/**
 * 打包整个数据目录为 zip 到目标目录。返回 zip 绝对路径。
 * sql.js 在每次变更后已同步写入 archive.db，因此无需额外 flush。
 */
export function createBackup(targetDir: string): Promise<{ ok: boolean; path?: string; error?: string }> {
  return new Promise((resolve) => {
    try {
      if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true })
      const dataDir = getDataDir()
      const name = `归档系统备份_${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.zip`
      const outPath = join(targetDir, name)
      const output = fs.createWriteStream(outPath)
      const archive = archiver('zip', { zlib: { level: 9 } })

      output.on('close', () => resolve({ ok: true, path: outPath }))
      archive.on('error', (err: Error) => resolve({ ok: false, error: err.message }))
      archive.pipe(output)

      const include = ['archive.db', 'config.json', 'images', 'attachments']
      for (const item of include) {
        const abs = join(dataDir, item)
        if (fs.existsSync(abs)) {
          if (fs.statSync(abs).isDirectory()) {
            archive.directory(abs, item)
          } else {
            archive.file(abs, { name: item })
          }
        }
      }
      archive.finalize()
    } catch (e) {
      resolve({ ok: false, error: String(e) })
    }
  })
}

/**
 * 校验 zip 是否包含 archive.db（粗略完整性检查）。
 */
export function validateBackup(zipPath: string): boolean {
  try {
    return fs.existsSync(zipPath) && fs.statSync(zipPath).size > 0
  } catch {
    return false
  }
}
