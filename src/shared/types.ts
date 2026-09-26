// 共享领域类型：主进程 / preload / 渲染层共用

export interface Customer {
  id: number
  name: string
  phone: string | null
  wechat: string | null
  gender: string | null
  birthday: string | null
  address: string | null
  tags: string | null
  source: string | null
  note: string | null
  avatar_path: string | null
  created_at: string
  updated_at: string | null
}

export interface Vehicle {
  id: number
  plate_number: string | null
  brand: string | null
  model: string | null
  year: string | null
  color: string | null
  vin: string | null
  engine: string | null
  transmission: string | null
  displacement: string | null
  drive_type: string | null
  current_mileage: number | null
  last_maintenance_date: string | null
  last_maintenance_km: number | null
  insurance_expire: string | null
  inspection_expire: string | null
  customer_id: number | null
  created_at: string
  updated_at: string | null
}

export type WorkOrderType = '保养' | '维修' | '改装' | '检查'
export type WorkOrderStatus =
  | '草稿'
  | '待施工'
  | '施工中'
  | '待验收'
  | '待收款'
  | '已完成'
  | '已取消'
  | '已退款'

export interface WorkOrderItem {
  id: number
  order_id: number
  name: string
  type: string | null
  desc: string | null
  labor_fee: number
  discount: number
  actual_fee: number
  technician_id: number | null
  status: string | null
  sort: number
}

export interface WorkOrderPart {
  id: number
  order_id: number
  item_id: number | null
  part_id: number | null
  part_name: string | null
  qty: number
  unit_price: number
  discount: number
  actual_fee: number
}

export interface WorkOrder {
  id: number
  order_no: string
  type: WorkOrderType | string
  status: WorkOrderStatus | string
  customer_id: number | null
  vehicle_id: number | null
  shop_time: string | null
  due_time: string | null
  receptionist: string | null
  technicians: string | null
  to_shop_mileage: number | null
  fault_desc: string | null
  note: string | null
  priority: string | null
  customer_name: string | null
  customer_phone: string | null
  vehicle_plate: string | null
  vehicle_info: string | null
  created_at: string
  updated_at: string | null
}

export interface WorkOrderDetail extends WorkOrder {
  items: WorkOrderItem[]
  parts: WorkOrderPart[]
}

export interface ImageRecord {
  id: number
  vehicle_id: number | null
  order_id: number | null
  item_id: number | null
  rel_path: string
  thumb_path: string | null
  stage: string | null
  part: string | null
  tags: string | null
  note: string | null
  taken_at: string | null
  uploader: string | null
}

export interface Part {
  id: number
  part_no: string | null
  name: string
  category: string | null
  brand: string | null
  model: string | null
  spec: string | null
  unit: string | null
  purchase_price: number
  sale_price: number
  stock: number
  min_stock: number
  location: string | null
  supplier_id: number | null
}

export interface StockTransaction {
  id: number
  part_id: number | null
  type: string
  qty: number
  before_stock: number | null
  after_stock: number | null
  ref_no: string | null
  operator_id: number | null
  note: string | null
  created_at: string
}

export interface Payment {
  id: number
  order_id: number | null
  customer_id: number | null
  vehicle_id: number | null
  amount: number
  method: string | null
  paid_at: string | null
  operator: string | null
  note: string | null
  created_at: string
}

export interface ReminderItem {
  vehicle_id: number
  plate_number: string | null
  customer_name: string | null
  at: string | null
  status: 'overdue' | 'near' | 'upcoming'
  days_left: number
  ref: string
}

export interface DashboardSummary {
  todayOrders: number
  monthOrders: number
  todayRevenue: number
  monthRevenue: number
  lowStock: Part[]
  remindAdvanceDays: number
  upcomingMaintenance: ReminderItem[]
  upcomingExpiries: Array<ReminderItem & { kind: '保险' | '年检' }>
}

export interface CustomerStats {
  vehicle_count: number
  total_spent: number
  visit_count: number
  last_visit: string | null
  level: '普通' | '银卡' | '金卡' | '钻石'
}

export interface TimelineEntry {
  type: 'work_order' | 'image'
  at: string
  title: string
  subtitle?: string
  status?: string
  order_id?: number
  image_rel_path?: string
  image_thumb_path?: string
}

export interface VehicleArchive {
  vehicle: Vehicle
  customer: Customer | null
  timeline: TimelineEntry[]
  stats: {
    order_count: number
    total_spent: number
    last_visit: string | null
    next_maintenance_date: string | null
    next_maintenance_km: number | null
  }
}

export interface Appointment {
  id: number
  customer_id: number | null
  vehicle_id: number | null
  date: string | null
  time: string | null
  duration: string | null
  service_type: string | null
  note: string | null
  status: string | null
}

export interface Supplier {
  id: number
  name: string
  contact: string | null
  phone: string | null
  address: string | null
  last_term: string | null
  note: string | null
}

export interface ReportRow {
  [key: string]: string | number | null
}

export interface ReportResult {
  columns: string[]
  rows: ReportRow[]
}

export interface Attachment {
  id: number
  order_id: number | null
  customer_id: number | null
  vehicle_id: number | null
  rel_path: string
  title: string | null
  file_type: string | null
  uploader: string | null
  created_at: string
}
