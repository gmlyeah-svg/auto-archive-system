import { dialog, ipcMain, shell } from 'electron'
import { join } from 'path'
import * as svc from './services'
import { getDataDir, getDefaultDataDir, setDataDir, getConfig } from './dataDir'
import { reopenDb, getDb } from './db'
import { importImage, deleteImageFile } from './images'
import { createBackup } from './backup'
import { exportHtmlPdf, printHtml, exportText } from './print'
import type { ImageRecord } from '../shared/types'

function ipcHandlers(): void {
  // ---- 数据目录 / 配置 ----
  ipcMain.handle('app:getDataDir', () => getDataDir())
  ipcMain.handle('app:getDefaultDataDir', () => getDefaultDataDir())
  ipcMain.handle('app:getConfig', () => getConfig())
  ipcMain.handle('app:chooseDataDir', async () => {
    const res = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    if (res.canceled || !res.filePaths[0]) return { ok: false, dir: getDataDir() }
    const r = setDataDir(res.filePaths[0])
    if (r.ok) await reopenDb()
    return r
  })
  ipcMain.handle('app:setDataDir', async (_e, dir: string) => {
    const r = setDataDir(dir)
    if (r.ok) await reopenDb()
    return r
  })

  // ---- 备份 ----
  ipcMain.handle('backup:create', async () => {
    const res = await dialog.showOpenDialog({ properties: ['openDirectory', 'createDirectory'] })
    if (res.canceled || !res.filePaths[0]) return { ok: false, error: '已取消' }
    return createBackup(res.filePaths[0])
  })

  // ---- 客户 ----
  ipcMain.handle('customers:list', (_e, search?: string) => svc.listCustomers(search))
  ipcMain.handle('customers:get', (_e, id: number) => svc.getCustomer(id))
  ipcMain.handle('customers:create', (_e, input: unknown) => svc.createCustomer(input as never))
  ipcMain.handle('customers:update', (_e, id: number, input: unknown) => svc.updateCustomer(id, input as never))
  ipcMain.handle('customers:delete', (_e, id: number) => svc.deleteCustomer(id))

  // ---- 车辆 ----
  ipcMain.handle('vehicles:list', (_e, search?: string) => svc.listVehicles(search))
  ipcMain.handle('vehicles:create', (_e, input: unknown) => svc.createVehicle(input as never))
  ipcMain.handle('vehicles:update', (_e, id: number, input: unknown) => svc.updateVehicle(id, input as never))
  ipcMain.handle('vehicles:delete', (_e, id: number) => svc.deleteVehicle(id))
  ipcMain.handle('vehicles:archive', (_e, id: number) => svc.vehicleArchive(id))

  // ---- 工单 ----
  ipcMain.handle('orders:list', (_e, filter?: unknown) => svc.listOrders(filter as never))
  ipcMain.handle('orders:get', (_e, id: number) => svc.getOrder(id))
  ipcMain.handle('orders:create', (_e, input: unknown) => svc.createOrder(input as never))
  ipcMain.handle('orders:update', (_e, id: number, input: unknown) => svc.updateOrder(id, input as never))
  ipcMain.handle('orders:delete', (_e, id: number) => svc.deleteOrder(id))
  ipcMain.handle('orders:addItem', (_e, orderId: number, input: unknown) => svc.addItem(orderId, input as never))
  ipcMain.handle('orders:updateItem', (_e, id: number, input: unknown) => svc.updateItem(id, input as never))
  ipcMain.handle('orders:deleteItem', (_e, id: number) => svc.deleteItem(id))
  ipcMain.handle('orders:addPart', (_e, orderId: number, input: unknown) => svc.addPart(orderId, input as never))
  ipcMain.handle('orders:updatePart', (_e, id: number, input: unknown) => svc.updatePartOrderLine(id, input as never))
  ipcMain.handle('orders:deletePart', (_e, id: number) => svc.deletePartOrderLine(id))
  ipcMain.handle('orders:total', (_e, id: number) => svc.orderTotalDetail(id))
  ipcMain.handle('orders:status', (_e, id: number, status: string) => svc.updateOrderStatus(id, status))
  ipcMain.handle('orders:complete', (_e, id: number) => svc.completeOrder(id))
  ipcMain.handle('orders:saveMaintenance', (_e, id: number, input: unknown) => svc.saveMaintenance(id, input as never))
  ipcMain.handle('orders:getMaintenance', (_e, id: number) => svc.getMaintenance(id))
  ipcMain.handle('orders:saveRepair', (_e, id: number, input: unknown) => svc.saveRepair(id, input as never))
  ipcMain.handle('orders:getRepair', (_e, id: number) => svc.getRepair(id))
  ipcMain.handle('orders:saveModification', (_e, id: number, input: unknown) => svc.saveModification(id, input as never))
  ipcMain.handle('orders:getModification', (_e, id: number) => svc.getModification(id))

  // ---- 配件 / 库存 ----
  ipcMain.handle('parts:list', (_e, search?: string) => svc.listParts(search))
  ipcMain.handle('parts:create', (_e, input: unknown) => svc.createPart(input as never))
  ipcMain.handle('parts:update', (_e, id: number, input: unknown) => svc.updatePart(id, input as never))
  ipcMain.handle('parts:delete', (_e, id: number) => svc.deletePart(id))
  ipcMain.handle('parts:lowStock', () => svc.lowStockParts())
  ipcMain.handle('stock:inbound', (_e, partId: number, qty: number, refNo?: string, note?: string) =>
    svc.stockInbound(partId, qty, refNo, note)
  )
  ipcMain.handle('stock:outbound', (_e, partId: number, qty: number, refNo?: string, note?: string) =>
    svc.stockOutbound(partId, qty, refNo, note)
  )
  ipcMain.handle('stock:adjust', (_e, partId: number, target: number, note?: string) =>
    svc.stockAdjust(partId, target, note)
  )
  ipcMain.handle('stock:transactions', (_e, partId: number) => svc.stockTransactions(partId))

  // ---- 收款 ----
  ipcMain.handle('payments:create', (_e, input: unknown) => svc.createPayment(input as never))
  ipcMain.handle('payments:byOrder', (_e, orderId: number) => svc.paymentsByOrder(orderId))
  ipcMain.handle('payments:refund', (_e, id: number) => svc.refundPayment(id))

  // ---- 图片 ----
  ipcMain.handle('images:pickImport', async (_e, opts: {
    orderId?: number
    vehicleId?: number
    folder: string
    stage?: string
    part?: string
    note?: string
  }) => {
    const res = await dialog.showOpenDialog({
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '图片', extensions: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'] }]
    })
    if (res.canceled || res.filePaths.length === 0) return []
    const records: ImageRecord[] = []
    for (const p of res.filePaths) {
      const imported = importImage(p, opts.folder)
      const id = svc.addImage({
        vehicle_id: opts.vehicleId ?? null,
        order_id: opts.orderId ?? null,
        rel_path: imported.rel_path,
        thumb_path: imported.thumb_path,
        stage: opts.stage ?? null,
        part: opts.part ?? null,
        note: opts.note ?? null,
        uploader: null
      })
      const rec = getDb().prepare('SELECT * FROM images WHERE id = ?').get(id) as ImageRecord
      records.push(rec)
    }
    return records
  })
  ipcMain.handle('images:byOrder', (_e, orderId: number) => svc.imagesByOrder(orderId))
  ipcMain.handle('images:byVehicle', (_e, vehicleId: number) => svc.imagesByVehicle(vehicleId))
  ipcMain.handle('images:delete', async (_e, id: number) => {
    const row = svc.deleteImage(id)
    if (row) deleteImageFile(row.rel_path, row.thumb_path)
    return row
  })

  // ---- 设置 / 仪表盘 ----
  ipcMain.handle('settings:get', () => svc.getSettings())
  ipcMain.handle('settings:set', (_e, key: string, value: string) => svc.setSetting(key, value))
  ipcMain.handle('reminders:ignore', (_e, ref: string) => svc.ignoreReminder(ref))
  ipcMain.handle('reminders:restore', (_e, ref?: string) => svc.restoreReminders(ref))
  ipcMain.handle('dashboard:summary', () => svc.dashboardSummary())

  // ---- 预约 ----
  ipcMain.handle('appointments:list', (_e, search?: string) => svc.listAppointments(search))
  ipcMain.handle('appointments:create', (_e, input: unknown) => svc.createAppointment(input as never))
  ipcMain.handle('appointments:update', (_e, id: number, input: unknown) => svc.updateAppointment(id, input as never))
  ipcMain.handle('appointments:delete', (_e, id: number) => svc.deleteAppointment(id))

  // ---- 供应商 ----
  ipcMain.handle('suppliers:list', (_e, search?: string) => svc.listSuppliers(search))
  ipcMain.handle('suppliers:create', (_e, input: unknown) => svc.createSupplier(input as never))
  ipcMain.handle('suppliers:update', (_e, id: number, input: unknown) => svc.updateSupplier(id, input as never))
  ipcMain.handle('suppliers:delete', (_e, id: number) => svc.deleteSupplier(id))

  // ---- 操作人/技师 ----
  ipcMain.handle('operators:list', () => svc.listOperators())
  ipcMain.handle('operators:create', (_e, input: unknown) => svc.createOperator(input as never))
  ipcMain.handle('operators:update', (_e, id: number, input: unknown) => svc.updateOperator(id, input as never))
  ipcMain.handle('operators:delete', (_e, id: number) => svc.deleteOperator(id))

  // ---- 报表 ----
  ipcMain.handle('reports:revenue', (_e, from: string, to: string) => svc.revenueReport(from, to))
  ipcMain.handle('reports:customer', () => svc.customerReport())
  ipcMain.handle('reports:models', () => svc.modelReport())
  ipcMain.handle('reports:maintenance', () => svc.maintenanceReport())
  ipcMain.handle('reports:inventory', () => svc.inventoryReport())

  // ---- 打印 / 导出 ----
  ipcMain.handle('print:pdf', (_e, html: string, filename: string, subdir?: string) =>
    exportHtmlPdf(html, filename, subdir)
  )
  ipcMain.handle('print:html', (_e, html: string) => printHtml(html))
  ipcMain.handle('export:save', (_e, defaultName: string, content: string, filters?: unknown) =>
    exportText(defaultName, content, filters as never)
  )

  // ---- 附件 ----
  ipcMain.handle('attachments:list', (_e, orderId: number) => svc.attachmentsByOrder(orderId))
  ipcMain.handle('attachments:add', (_e, input: unknown) => svc.addAttachment(input as never))
  ipcMain.handle('attachments:delete', (_e, id: number) => svc.deleteAttachment(id))
  ipcMain.handle('attachments:open', (_e, relPath: string) => {
    const abs = join(getDataDir(), relPath)
    return shell.openPath(abs).then((log) => ({ ok: log === '', log }))
  })
}

export function registerIpc(): void {
  ipcHandlers()
}
