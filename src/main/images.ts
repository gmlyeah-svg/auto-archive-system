import { nativeImage } from 'electron'
import { join, basename } from 'path'
import fs from 'fs'
import { getDataDir } from './dataDir'

export function sanitizeName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim()
}

interface ImportResult {
  rel_path: string
  thumb_path: string | null
  width: number
  height: number
}

/**
 * 将源图片复制进数据目录 images/ 下并生成缩略图。
 * @param srcPath 用户选中的图片绝对路径
 * @param folder 目标子文件夹（如工单号 WOxxx 或 other）
 */
export function importImage(srcPath: string, folder: string): ImportResult {
  const dir = getDataDir()
  const targetDir = join(dir, 'images', sanitizeName(folder))
  const thumbsDir = join(targetDir, 'thumbnails')
  fs.mkdirSync(thumbsDir, { recursive: true })

  const base = sanitizeName(basename(srcPath))
  const stamp = new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '')
  const uniqueName = `${stamp}_${base}`
  const targetAbs = join(targetDir, uniqueName)
  fs.copyFileSync(srcPath, targetAbs)

  let thumb_path: string | null = null
  let width = 0
  let height = 0
  try {
    const img = nativeImage.createFromPath(targetAbs)
    const size = img.getSize()
    width = size.width
    height = size.height
    let thumb = img
    if (width > 640) {
      thumb = img.resize({ width: 640 })
    }
    const thumbAbs = join(thumbsDir, `${uniqueName.replace(/\.[^.]+$/, '')}.jpg`)
    fs.writeFileSync(thumbAbs, thumb.toJPEG(80))
    thumb_path = relJoin('images', sanitizeName(folder), `${uniqueName.replace(/\.[^.]+$/, '')}.jpg`)
  } catch (e) {
    console.error('thumbnail failed', e)
  }

  const rel_path = relJoin('images', sanitizeName(folder), uniqueName)
  return { rel_path, thumb_path, width, height }
}

function relJoin(...parts: string[]): string {
  return parts.join('/').replace(/\\/g, '/')
}

export function resolveImagePath(relPath: string): string {
  const norm = relPath.replace(/\//g, '\\')
  return join(getDataDir(), norm)
}

export function imageExists(relPath: string): boolean {
  try {
    return fs.existsSync(resolveImagePath(relPath))
  } catch {
    return false
  }
}

export function deleteImageFile(relPath: string, thumbPath?: string | null): void {
  try {
    const p = resolveImagePath(relPath)
    if (fs.existsSync(p)) fs.unlinkSync(p)
  } catch {
    /* ignore */
  }
  if (thumbPath) {
    try {
      const t = resolveImagePath(thumbPath)
      if (fs.existsSync(t)) fs.unlinkSync(t)
    } catch {
      /* ignore */
    }
  }
}
