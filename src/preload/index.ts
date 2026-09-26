import { contextBridge, ipcRenderer } from 'electron'

function invoke(channel: string, ...args: unknown[]): Promise<unknown> {
  return ipcRenderer.invoke(channel, ...args)
}

const api = {
  app: {
    getDataDir: () => invoke('app:getDataDir'),
    getDefaultDataDir: () => invoke('app:getDefaultDataDir'),
    getConfig: () => invoke('app:getConfig'),
    chooseDataDir: () => invoke('app:chooseDataDir'),
    setDataDir: (dir: string) => invoke('app:setDataDir', dir)
  },
  backup: {
    create: () => invoke('backup:create')
  },
  customers: {
    list: (search?: string) => invoke('customers:list', search),
    get: (id: number) => invoke('customers:get', id),
    create: (input: unknown) => invoke('customers:create', input),
    update: (id: number, input: unknown) => invoke('customers:update', id, input),
    delete: (id: number) => invoke('customers:delete', id)
  },
  vehicles: {
    list: (search?: string) => invoke('vehicles:list', search),
    create: (input: unknown) => invoke('vehicles:create', input),
    update: (id: number, input: unknown) => invoke('vehicles:update', id, input),
    delete: (id: number) => invoke('vehicles:delete', id),
    archive: (id: number) => invoke('vehicles:archive', id)
  },
  orders: {
    list: (filter?: unknown) => invoke('orders:list', filter),
    get: (id: number) => invoke('orders:get', id),
    create: (input: unknown) => invoke('orders:create', input),
    update: (id: number, input: unknown) => invoke('orders:update', id, input),
    delete: (id: number) => invoke('orders:delete', id),
    addItem: (orderId: number, input: unknown) => invoke('orders:addItem', orderId, input),
    updateItem: (id: number, input: unknown) => invoke('orders:updateItem', id, input),
    deleteItem: (id: number) => invoke('orders:deleteItem', id),
    addPart: (orderId: number, input: unknown) => invoke('orders:addPart', orderId, input),
    updatePart: (id: number, input: unknown) => invoke('orders:updatePart', id, input),
    deletePart: (id: number) => invoke('orders:deletePart', id),
    total: (id: number) => invoke('orders:total', id),
    status: (id: number, status: string) => invoke('orders:status', id, status),
    complete: (id: number) => invoke('orders:complete', id),
    saveMaintenance: (id: number, input: unknown) => invoke('orders:saveMaintenance', id, input),
    getMaintenance: (id: number) => invoke('orders:getMaintenance', id),
    saveRepair: (id: number, input: unknown) => invoke('orders:saveRepair', id, input),
    getRepair: (id: number) => invoke('orders:getRepair', id),
    saveModification: (id: number, input: unknown) => invoke('orders:saveModification', id, input),
    getModification: (id: number) => invoke('orders:getModification', id)
  },
  parts: {
    list: (search?: string) => invoke('parts:list', search),
    create: (input: unknown) => invoke('parts:create', input),
    update: (id: number, input: unknown) => invoke('parts:update', id, input),
    delete: (id: number) => invoke('parts:delete', id),
    lowStock: () => invoke('parts:lowStock')
  },
  stock: {
    inbound: (partId: number, qty: number, refNo?: string, note?: string) =>
      invoke('stock:inbound', partId, qty, refNo, note),
    outbound: (partId: number, qty: number, refNo?: string, note?: string) =>
      invoke('stock:outbound', partId, qty, refNo, note),
    adjust: (partId: number, target: number, note?: string) => invoke('stock:adjust', partId, target, note),
    transactions: (partId: number) => invoke('stock:transactions', partId)
  },
  payments: {
    create: (input: unknown) => invoke('payments:create', input),
    byOrder: (orderId: number) => invoke('payments:byOrder', orderId),
    refund: (id: number) => invoke('payments:refund', id)
  },
  images: {
    pickImport: (opts: unknown) => invoke('images:pickImport', opts),
    byOrder: (orderId: number) => invoke('images:byOrder', orderId),
    byVehicle: (vehicleId: number) => invoke('images:byVehicle', vehicleId),
    delete: (id: number) => invoke('images:delete', id)
  },
  settings: {
    get: () => invoke('settings:get'),
    set: (key: string, value: string) => invoke('settings:set', key, value)
  },
  reminders: {
    ignore: (ref: string) => invoke('reminders:ignore', ref),
    restore: (ref?: string) => invoke('reminders:restore', ref)
  },
  dashboard: {
    summary: () => invoke('dashboard:summary')
  },
  appointments: {
    list: (search?: string) => invoke('appointments:list', search),
    create: (input: unknown) => invoke('appointments:create', input),
    update: (id: number, input: unknown) => invoke('appointments:update', id, input),
    delete: (id: number) => invoke('appointments:delete', id)
  },
  suppliers: {
    list: (search?: string) => invoke('suppliers:list', search),
    create: (input: unknown) => invoke('suppliers:create', input),
    update: (id: number, input: unknown) => invoke('suppliers:update', id, input),
    delete: (id: number) => invoke('suppliers:delete', id)
  },
  operators: {
    list: () => invoke('operators:list'),
    create: (input: unknown) => invoke('operators:create', input),
    update: (id: number, input: unknown) => invoke('operators:update', id, input),
    delete: (id: number) => invoke('operators:delete', id)
  },
  reports: {
    revenue: (from: string, to: string) => invoke('reports:revenue', from, to),
    customer: () => invoke('reports:customer'),
    models: () => invoke('reports:models'),
    maintenance: () => invoke('reports:maintenance'),
    inventory: () => invoke('reports:inventory')
  },
  print: {
    pdf: (html: string, filename: string, subdir?: string) => invoke('print:pdf', html, filename, subdir),
    html: (html: string) => invoke('print:html', html)
  },
  export: {
    save: (defaultName: string, content: string, filters?: unknown[]) => invoke('export:save', defaultName, content, filters)
  },
  attachments: {
    list: (orderId: number) => invoke('attachments:list', orderId),
    add: (input: unknown) => invoke('attachments:add', input),
    delete: (id: number) => invoke('attachments:delete', id),
    open: (absPath: string) => invoke('attachments:open', absPath)
  }
}

contextBridge.exposeInMainWorld('api', api)
