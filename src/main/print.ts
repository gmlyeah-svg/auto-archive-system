import { app, BrowserWindow, dialog, shell } from 'electron'
import { join } from 'path'
import fs from 'fs'
import { getDataDir } from './dataDir'

const PDF_MARGIN = { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 }

function safeName(name: string): string {
  return name.replace(/[<>:"/\\|?*\x00-\x1f]/g, '_').trim()
}

/** 生成隐藏打印窗口并加载 HTML 字符串 */
async function renderHtml(html: string): Promise<BrowserWindow> {
  const win = new BrowserWindow({
    show: false,
    webPreferences: { sandbox: true, contextIsolation: true }
  })
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  return win
}

/**
 * 把 HTML 转成 A4 PDF 保存到数据目录 attachments/<subdir>/ 下。
 */
export async function exportHtmlPdf(
  html: string,
  filename: string,
  subdir?: string
): Promise<{ ok: boolean; path?: string; error?: string }> {
  try {
    const win = await renderHtml(html)
    const pdf = await win.webContents.printToPDF({ printBackground: true, pageSize: 'A4', margins: PDF_MARGIN })
    win.destroy()
    const outDir = join(getDataDir(), 'attachments', subdir ? safeName(subdir) : '')
    if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true })
    const outPath = join(outDir, `${safeName(filename)}.pdf`)
    fs.writeFileSync(outPath, pdf)
    // 导出后自动用系统默认 PDF 查看器打开，方便直接查看
    shell.openPath(outPath).catch(() => undefined)
    return { ok: true, path: outPath }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

/**
 * 把 HTML 交给系统打印对话框（用户可选打印机 / 尺寸）。
 */
export async function printHtml(html: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const win = await renderHtml(html)
    await new Promise<void>((resolve) => {
      win.webContents.print({ silent: false, printBackground: true }, () => resolve())
    })
    win.destroy()
    return { ok: true }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}

/**
 * 弹出保存对话框并写入文本内容（用于导出 CSV / 伪 Excel HTML / 文本）。
 */
export async function exportText(
  defaultName: string,
  content: string,
  filters?: Array<{ name: string; extensions: string[] }>
): Promise<{ ok: boolean; path?: string; error?: string }> {
  const res = await dialog.showSaveDialog({
    defaultPath: join(app.getPath('documents'), defaultName),
    filters: filters ?? [{ name: '文件', extensions: ['csv'] }]
  })
  if (res.canceled || !res.filePath) return { ok: false, error: '已取消' }
  try {
    fs.writeFileSync(res.filePath, content, 'utf-8')
    return { ok: true, path: res.filePath }
  } catch (e) {
    return { ok: false, error: String(e) }
  }
}
