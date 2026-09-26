/// <reference types="vite/client" />

import type {
  Customer,
  Vehicle,
  WorkOrder,
  WorkOrderDetail,
  ImageRecord,
  Part,
  StockTransaction,
  Payment,
  CustomerStats,
  DashboardSummary,
  VehicleArchive,
  Appointment,
  Supplier,
  ReportResult,
  Attachment
} from '../../shared/types'

interface ApiService {
  getDataDir(): Promise<string>
  getDefaultDataDir(): Promise<string>
  getConfig(): Promise<{ dataDir: string }>
  chooseDataDir(): Promise<{ ok: boolean; dir: string; error?: string }>
  setDataDir(dir: string): Promise<{ ok: boolean; dir: string; error?: string }>
}

interface Api {
  app: ApiService
  backup: { create(): Promise<{ ok: boolean; path?: string; error?: string }> }
  customers: {
    list(search?: string): Promise<Array<Customer & { stats: CustomerStats }>>
    get(id: number): Promise<(Customer & { stats: CustomerStats }) | null>
    create(input: Partial<Customer>): Promise<number>
    update(id: number, input: Partial<Customer>): Promise<void>
    delete(id: number): Promise<void>
  }
  vehicles: {
    list(search?: string): Promise<Vehicle[]>
    create(input: Partial<Vehicle>): Promise<number>
    update(id: number, input: Partial<Vehicle>): Promise<void>
    delete(id: number): Promise<void>
    archive(id: number): Promise<VehicleArchive | null>
  }
  orders: {
    list(filter?: { status?: string; vehicleId?: number; customerId?: number }): Promise<WorkOrder[]>
    get(id: number): Promise<WorkOrderDetail | null>
    create(input: Partial<WorkOrder>): Promise<number>
    update(id: number, input: Partial<WorkOrder>): Promise<void>
    delete(id: number): Promise<void>
    addItem(orderId: number, input: Record<string, unknown>): Promise<number>
    updateItem(id: number, input: Record<string, unknown>): Promise<void>
    deleteItem(id: number): Promise<void>
    addPart(orderId: number, input: Record<string, unknown>): Promise<number>
    updatePart(id: number, input: Record<string, unknown>): Promise<void>
    deletePart(id: number): Promise<void>
    total(id: number): Promise<{ labor: number; parts: number; total: number }>
    status(id: number, status: string): Promise<void>
    complete(id: number): Promise<void>
    saveMaintenance(id: number, input: Record<string, unknown>): Promise<void>
    getMaintenance(id: number): Promise<Record<string, unknown> | null>
    saveRepair(id: number, input: Record<string, unknown>): Promise<void>
    getRepair(id: number): Promise<Record<string, unknown> | null>
    saveModification(id: number, input: Record<string, unknown>): Promise<void>
    getModification(id: number): Promise<Record<string, unknown> | null>
  }
  parts: {
    list(search?: string): Promise<Part[]>
    create(input: Partial<Part>): Promise<number>
    update(id: number, input: Partial<Part>): Promise<void>
    delete(id: number): Promise<void>
    lowStock(): Promise<Part[]>
  }
  stock: {
    inbound(partId: number, qty: number, refNo?: string, note?: string): Promise<void>
    outbound(partId: number, qty: number, refNo?: string, note?: string): Promise<void>
    adjust(partId: number, target: number, note?: string): Promise<void>
    transactions(partId: number): Promise<StockTransaction[]>
  }
  payments: {
    create(input: Partial<Payment>): Promise<number>
    byOrder(orderId: number): Promise<Payment[]>
    refund(id: number): Promise<void>
  }
  images: {
    pickImport(opts: {
      orderId?: number
      vehicleId?: number
      folder: string
      stage?: string
      part?: string
      note?: string
    }): Promise<ImageRecord[]>
    byOrder(orderId: number): Promise<ImageRecord[]>
    byVehicle(vehicleId: number): Promise<ImageRecord[]>
    delete(id: number): Promise<ImageRecord | null>
  }
  settings: {
    get(): Promise<Record<string, string>>
    set(key: string, value: string): Promise<void>
  }
  reminders: {
    ignore(ref: string): Promise<string[]>
    restore(ref?: string): Promise<string[]>
  }
  dashboard: { summary(): Promise<DashboardSummary> }
  appointments: {
    list(search?: string): Promise<Appointment[]>
    create(input: Partial<Appointment>): Promise<number>
    update(id: number, input: Partial<Appointment>): Promise<void>
    delete(id: number): Promise<void>
  }
  suppliers: {
    list(search?: string): Promise<Supplier[]>
    create(input: Partial<Supplier>): Promise<number>
    update(id: number, input: Partial<Supplier>): Promise<void>
    delete(id: number): Promise<void>
  }
  operators: {
    list(): Promise<Array<{ id: number; name: string; role: string | null }>>
    create(input: { name: string; role?: string | null }): Promise<number>
    update(id: number, input: { name: string; role?: string | null }): Promise<void>
    delete(id: number): Promise<void>
  }
  reports: {
    revenue(from: string, to: string): Promise<ReportResult>
    customer(): Promise<ReportResult>
    models(): Promise<ReportResult>
    maintenance(): Promise<ReportResult>
    inventory(): Promise<ReportResult>
  }
  print: {
    pdf(html: string, filename: string, subdir?: string): Promise<{ ok: boolean; path?: string; error?: string }>
    html(html: string): Promise<{ ok: boolean; error?: string }>
  }
  export: {
    save(defaultName: string, content: string, filters?: Array<{ name: string; extensions: string[] }>): Promise<{ ok: boolean; path?: string; error?: string }>
  }
  attachments: {
    list(orderId: number): Promise<Attachment[]>
    add(input: Partial<Attachment>): Promise<number>
    delete(id: number): Promise<Attachment | null>
    open(absPath: string): Promise<{ ok: boolean; log?: string }>
  }
}

declare global {
  interface Window {
    api: Api
  }
}
