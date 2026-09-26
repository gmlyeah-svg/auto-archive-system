import { db } from './db'
import type {
  Customer,
  Vehicle,
  WorkOrder,
  WorkOrderDetail,
  WorkOrderItem,
  WorkOrderPart,
  ImageRecord,
  Part,
  StockTransaction,
  Payment,
  CustomerStats,
  DashboardSummary,
  TimelineEntry,
  VehicleArchive,
  Appointment,
  Supplier,
  ReportResult,
  ReportRow,
  ReminderItem,
  Attachment
} from '../shared/types'

type ReminderStatus = ReminderItem['status']

type RunResult = { changes: number; lastInsertRowid: number }

function now(): string {
  return new Date().toISOString().slice(0, 19).replace('T', ' ')
}

function getLevel(spent: number): CustomerStats['level'] {
  if (spent >= 50000) return '钻石'
  if (spent >= 20000) return '金卡'
  if (spent >= 5000) return '银卡'
  return '普通'
}

function customerStats(customerId: number): CustomerStats {
  const vehicleCount = db()
    .prepare('SELECT COUNT(*) AS c FROM vehicles WHERE customer_id = ?')
    .get(customerId) as { c: number }
  const spent = db()
    .prepare('SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE customer_id = ?')
    .get(customerId) as { s: number }
  const visits = db()
    .prepare(
      "SELECT COUNT(*) AS c FROM work_orders WHERE customer_id = ? AND status = '已完成'"
    )
    .get(customerId) as { c: number }
  const lastVisit = db()
    .prepare(
      "SELECT MAX(created_at) AS l FROM work_orders WHERE customer_id = ? AND status = '已完成'"
    )
    .get(customerId) as { l: string | null }
  return {
    vehicle_count: vehicleCount.c,
    total_spent: spent.s,
    visit_count: visits.c,
    last_visit: lastVisit.l,
    level: getLevel(spent.s)
  }
}

// ---------------- Customers ----------------

export function listCustomers(search?: string): Array<Customer & { stats: CustomerStats }> {
  let rows: Customer[]
  if (search && search.trim()) {
    const kw = `%${search.trim()}%`
    rows = db()
      .prepare(
        `SELECT DISTINCT c.* FROM customers c
         LEFT JOIN vehicles v ON v.customer_id = c.id
         WHERE c.name LIKE ? OR c.phone LIKE ? OR v.plate_number LIKE ?
         ORDER BY COALESCE(c.updated_at, c.created_at) DESC`
      )
      .all(kw, kw, kw) as Customer[]
  } else {
    rows = db().prepare('SELECT * FROM customers ORDER BY COALESCE(updated_at, created_at) DESC').all() as Customer[]
  }
  return rows.map((r) => ({ ...r, stats: customerStats(r.id) }))
}

export function getCustomer(id: number): (Customer & { stats: CustomerStats }) | null {
  const row = db().prepare('SELECT * FROM customers WHERE id = ?').get(id) as Customer | undefined
  if (!row) return null
  return { ...row, stats: customerStats(id) }
}

export function createCustomer(input: Partial<Customer>): number {
  const res = db()
    .prepare(
      `INSERT INTO customers (name, phone, wechat, gender, birthday, address, tags, source, note, avatar_path)
       VALUES (@name, @phone, @wechat, @gender, @birthday, @address, @tags, @source, @note, @avatar_path)`
    )
    .run({
      name: input.name ?? '',
      phone: input.phone ?? null,
      wechat: input.wechat ?? null,
      gender: input.gender ?? null,
      birthday: input.birthday ?? null,
      address: input.address ?? null,
      tags: input.tags ?? null,
      source: input.source ?? null,
      note: input.note ?? null,
      avatar_path: input.avatar_path ?? null
    }) as RunResult
  return Number(res.lastInsertRowid)
}

export function updateCustomer(id: number, input: Partial<Customer>): void {
  db()
    .prepare(
      `UPDATE customers SET name=@name, phone=@phone, wechat=@wechat, gender=@gender,
        birthday=@birthday, address=@address, tags=@tags, source=@source, note=@note,
        avatar_path=@avatar_path, updated_at=@now WHERE id=@id`
    )
    .run({
      id,
      now: now(),
      name: input.name ?? '',
      phone: input.phone ?? null,
      wechat: input.wechat ?? null,
      gender: input.gender ?? null,
      birthday: input.birthday ?? null,
      address: input.address ?? null,
      tags: input.tags ?? null,
      source: input.source ?? null,
      note: input.note ?? null,
      avatar_path: input.avatar_path ?? null
    })
}

export function deleteCustomer(id: number): void {
  db().prepare('DELETE FROM customers WHERE id = ?').run(id)
}

export function deriveOrderSnapshot(customerId: number | null, vehicleId: number | null): {
  customer_name: string | null
  customer_phone: string | null
  vehicle_plate: string | null
  vehicle_info: string | null
} {
  let customer_name: string | null = null
  let customer_phone: string | null = null
  let vehicle_plate: string | null = null
  let vehicle_info: string | null = null
  if (customerId) {
    const c = db().prepare('SELECT name, phone FROM customers WHERE id = ?').get(customerId) as
      | { name: string; phone: string | null }
      | undefined
    if (c) {
      customer_name = c.name
      customer_phone = c.phone
    }
  }
  if (vehicleId) {
    const v = db().prepare('SELECT plate_number, brand, model FROM vehicles WHERE id = ?').get(vehicleId) as
      | { plate_number: string | null; brand: string | null; model: string | null }
      | undefined
    if (v) {
      vehicle_plate = v.plate_number
      vehicle_info = [v.brand, v.model].filter(Boolean).join(' ') || null
    }
  }
  return { customer_name, customer_phone, vehicle_plate, vehicle_info }
}

// ---------------- Vehicles ----------------

export function listVehicles(search?: string): Vehicle[] {
  if (search && search.trim()) {
    const kw = `%${search.trim()}%`
    return db()
      .prepare(
        `SELECT * FROM vehicles WHERE plate_number LIKE ? OR brand LIKE ? OR model LIKE ? OR vin LIKE ?
         ORDER BY COALESCE(updated_at, created_at) DESC`
      )
      .all(kw, kw, kw, kw) as Vehicle[]
  }
  return db().prepare('SELECT * FROM vehicles ORDER BY COALESCE(updated_at, created_at) DESC').all() as Vehicle[]
}

export function getVehicle(id: number): Vehicle | null {
  return (db().prepare('SELECT * FROM vehicles WHERE id = ?').get(id) as Vehicle) ?? null
}

export function createVehicle(input: Partial<Vehicle>): number {
  const res = db()
    .prepare(
      `INSERT INTO vehicles (plate_number, brand, model, year, color, vin, engine, transmission,
        displacement, drive_type, current_mileage, last_maintenance_date, last_maintenance_km,
        insurance_expire, inspection_expire, customer_id)
       VALUES (@plate_number, @brand, @model, @year, @color, @vin, @engine, @transmission,
        @displacement, @drive_type, @current_mileage, @last_maintenance_date, @last_maintenance_km,
        @insurance_expire, @inspection_expire, @customer_id)`
    )
    .run({
      plate_number: input.plate_number ?? null,
      brand: input.brand ?? null,
      model: input.model ?? null,
      year: input.year ?? null,
      color: input.color ?? null,
      vin: input.vin ?? null,
      engine: input.engine ?? null,
      transmission: input.transmission ?? null,
      displacement: input.displacement ?? null,
      drive_type: input.drive_type ?? null,
      current_mileage: input.current_mileage ?? 0,
      last_maintenance_date: input.last_maintenance_date ?? null,
      last_maintenance_km: input.last_maintenance_km ?? null,
      insurance_expire: input.insurance_expire ?? null,
      inspection_expire: input.inspection_expire ?? null,
      customer_id: input.customer_id ?? null
    }) as RunResult
  return Number(res.lastInsertRowid)
}

export function updateVehicle(id: number, input: Partial<Vehicle>): void {
  db()
    .prepare(
      `UPDATE vehicles SET plate_number=@plate_number, brand=@brand, model=@model, year=@year,
        color=@color, vin=@vin, engine=@engine, transmission=@transmission, displacement=@displacement,
        drive_type=@drive_type, current_mileage=@current_mileage, last_maintenance_date=@last_maintenance_date,
        last_maintenance_km=@last_maintenance_km, insurance_expire=@insurance_expire,
        inspection_expire=@inspection_expire, customer_id=@customer_id, updated_at=@now WHERE id=@id`
    )
    .run({
      id,
      now: now(),
      plate_number: input.plate_number ?? null,
      brand: input.brand ?? null,
      model: input.model ?? null,
      year: input.year ?? null,
      color: input.color ?? null,
      vin: input.vin ?? null,
      engine: input.engine ?? null,
      transmission: input.transmission ?? null,
      displacement: input.displacement ?? null,
      drive_type: input.drive_type ?? null,
      current_mileage: input.current_mileage ?? 0,
      last_maintenance_date: input.last_maintenance_date ?? null,
      last_maintenance_km: input.last_maintenance_km ?? null,
      insurance_expire: input.insurance_expire ?? null,
      inspection_expire: input.inspection_expire ?? null,
      customer_id: input.customer_id ?? null
    })
}

export function deleteVehicle(id: number): void {
  db().prepare('DELETE FROM vehicles WHERE id = ?').run(id)
}

export function vehicleArchive(vehicleId: number): VehicleArchive | null {
  const vehicle = getVehicle(vehicleId)
  if (!vehicle) return null
  const customer = vehicle.customer_id
    ? (db().prepare('SELECT * FROM customers WHERE id = ?').get(vehicle.customer_id) as Customer)
    : null

  const orders = db()
    .prepare('SELECT * FROM work_orders WHERE vehicle_id = ? ORDER BY created_at DESC')
    .all(vehicleId) as WorkOrder[]
  const images = db()
    .prepare('SELECT * FROM images WHERE vehicle_id = ? ORDER BY taken_at DESC, id DESC')
    .all(vehicleId) as ImageRecord[]

  const timeline: TimelineEntry[] = [
    ...orders.map((o) => ({
      type: 'work_order' as const,
      at: o.created_at,
      title: `${o.order_no} · ${o.type}`,
      subtitle: o.customer_name ?? undefined,
      status: o.status,
      order_id: o.id
    })),
    ...images.map((im) => ({
      type: 'image' as const,
      at: im.taken_at ?? im.rel_path,
      title: im.note || '施工照片',
      image_rel_path: im.rel_path,
      image_thumb_path: im.thumb_path ?? undefined
    }))
  ]
  timeline.sort((a, b) => (a.at < b.at ? 1 : -1))

  const orderCount = orders.filter((o) => o.status === '已完成').length
  const spent = db()
    .prepare('SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE vehicle_id = ?')
    .get(vehicleId) as { s: number }
  const lastVisit = orders.length ? orders[0].created_at : null

  return {
    vehicle,
    customer,
    timeline,
    stats: {
      order_count: orderCount,
      total_spent: spent.s,
      last_visit: lastVisit,
      next_maintenance_date: vehicle.last_maintenance_date ?? null,
      next_maintenance_km: vehicle.last_maintenance_km ?? null
    }
  }
}

// ---------------- Work Orders ----------------

let orderSeq = 0

export function generateOrderNo(date = new Date()): string {
  const d = `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, '0')}${String(
    date.getDate()
  ).padStart(2, '0')}`
  while (true) {
    orderSeq += 1
    const no = `WO${d}${String(orderSeq).padStart(3, '0')}`
    const exists = db().prepare('SELECT id FROM work_orders WHERE order_no = ?').get(no)
    if (!exists) return no
  }
}

export function listOrders(filter?: { status?: string; vehicleId?: number; customerId?: number }): WorkOrder[] {
  let sql = 'SELECT * FROM work_orders'
  const conds: string[] = []
  const args: unknown[] = []
  if (filter?.status) {
    conds.push('status = ?')
    args.push(filter.status)
  }
  if (filter?.vehicleId) {
    conds.push('vehicle_id = ?')
    args.push(filter.vehicleId)
  }
  if (filter?.customerId) {
    conds.push('customer_id = ?')
    args.push(filter.customerId)
  }
  if (conds.length) sql += ' WHERE ' + conds.join(' AND ')
  sql += ' ORDER BY COALESCE(created_at, datetime("now")) DESC'
  return db().prepare(sql).all(...args) as WorkOrder[]
}

export function getOrder(id: number): WorkOrderDetail | null {
  const order = db().prepare('SELECT * FROM work_orders WHERE id = ?').get(id) as WorkOrder | undefined
  if (!order) return null
  const items = db()
    .prepare('SELECT * FROM work_order_items WHERE order_id = ? ORDER BY sort, id')
    .all(id) as WorkOrderItem[]
  const parts = db()
    .prepare('SELECT * FROM work_order_parts WHERE order_id = ? ORDER BY id')
    .all(id) as WorkOrderPart[]
  return { ...order, items, parts }
}

export function createOrder(input: Partial<WorkOrder>): number {
  const snap = deriveOrderSnapshot(input.customer_id ?? null, input.vehicle_id ?? null)
  const orderNo = input.order_no ?? generateOrderNo()
  const res = db()
    .prepare(
      `INSERT INTO work_orders (order_no, type, status, customer_id, vehicle_id, shop_time, due_time,
        receptionist, technicians, to_shop_mileage, fault_desc, note, priority,
        customer_name, customer_phone, vehicle_plate, vehicle_info)
       VALUES (@order_no, @type, @status, @customer_id, @vehicle_id, @shop_time, @due_time,
        @receptionist, @technicians, @to_shop_mileage, @fault_desc, @note, @priority,
        @customer_name, @customer_phone, @vehicle_plate, @vehicle_info)`
    )
    .run({
      order_no: orderNo,
      type: input.type ?? '检查',
      status: input.status ?? '草稿',
      customer_id: input.customer_id ?? null,
      vehicle_id: input.vehicle_id ?? null,
      shop_time: input.shop_time ?? now(),
      due_time: input.due_time ?? null,
      receptionist: input.receptionist ?? null,
      technicians: input.technicians ?? null,
      to_shop_mileage: input.to_shop_mileage ?? null,
      fault_desc: input.fault_desc ?? null,
      note: input.note ?? null,
      priority: input.priority ?? null,
      customer_name: snap.customer_name,
      customer_phone: snap.customer_phone,
      vehicle_plate: snap.vehicle_plate,
      vehicle_info: snap.vehicle_info
    }) as RunResult
  return Number(res.lastInsertRowid)
}

export function updateOrder(id: number, input: Partial<WorkOrder>): void {
  db()
    .prepare(
      `UPDATE work_orders SET type=@type, customer_id=@customer_id, vehicle_id=@vehicle_id,
        shop_time=@shop_time, due_time=@due_time, receptionist=@receptionist, technicians=@technicians,
        to_shop_mileage=@to_shop_mileage, fault_desc=@fault_desc, note=@note, priority=@priority,
        updated_at=@now WHERE id=@id`
    )
    .run({
      id,
      now: now(),
      type: input.type ?? '检查',
      customer_id: input.customer_id ?? null,
      vehicle_id: input.vehicle_id ?? null,
      shop_time: input.shop_time ?? null,
      due_time: input.due_time ?? null,
      receptionist: input.receptionist ?? null,
      technicians: input.technicians ?? null,
      to_shop_mileage: input.to_shop_mileage ?? null,
      fault_desc: input.fault_desc ?? null,
      note: input.note ?? null,
      priority: input.priority ?? null
    })
  // 刷新快照
  const order = getOrder(id)
  if (order) {
    const snap = deriveOrderSnapshot(order.customer_id, order.vehicle_id)
    db()
      .prepare(
        `UPDATE work_orders SET customer_name=@customer_name, customer_phone=@customer_phone,
          vehicle_plate=@vehicle_plate, vehicle_info=@vehicle_info WHERE id=@id`
      )
      .run({ id, ...snap })
  }
}

export function deleteOrder(id: number): void {
  db().prepare('DELETE FROM work_orders WHERE id = ?').run(id)
}

export function addItem(orderId: number, input: Partial<WorkOrderItem>): number {
  const res = db()
    .prepare(
      `INSERT INTO work_order_items (order_id, name, type, desc, labor_fee, discount, actual_fee,
        technician_id, status, sort)
       VALUES (@order_id, @name, @type, @desc, @labor_fee, @discount, @actual_fee, @technician_id, @status, @sort)`
    )
    .run({
      order_id: orderId,
      name: input.name ?? '',
      type: input.type ?? null,
      desc: input.desc ?? null,
      labor_fee: input.labor_fee ?? 0,
      discount: input.discount ?? 0,
      actual_fee: input.actual_fee ?? input.labor_fee ?? 0,
      technician_id: input.technician_id ?? null,
      status: input.status ?? null,
      sort: input.sort ?? 0
    }) as RunResult
  return Number(res.lastInsertRowid)
}

export function updateItem(id: number, input: Partial<WorkOrderItem>): void {
  db()
    .prepare(
      `UPDATE work_order_items SET name=@name, type=@type, desc=@desc, labor_fee=@labor_fee,
        discount=@discount, actual_fee=@actual_fee, technician_id=@technician_id, status=@status, sort=@sort
       WHERE id=@id`
    )
    .run({
      id,
      name: input.name ?? '',
      type: input.type ?? null,
      desc: input.desc ?? null,
      labor_fee: input.labor_fee ?? 0,
      discount: input.discount ?? 0,
      actual_fee: input.actual_fee ?? input.labor_fee ?? 0,
      technician_id: input.technician_id ?? null,
      status: input.status ?? null,
      sort: input.sort ?? 0
    })
}

export function deleteItem(id: number): void {
  db().prepare('DELETE FROM work_order_items WHERE id = ?').run(id)
}

export function addPart(orderId: number, input: Partial<WorkOrderPart>): number {
  const res = db()
    .prepare(
      `INSERT INTO work_order_parts (order_id, item_id, part_id, part_name, qty, unit_price, discount, actual_fee)
       VALUES (@order_id, @item_id, @part_id, @part_name, @qty, @unit_price, @discount, @actual_fee)`
    )
    .run({
      order_id: orderId,
      item_id: input.item_id ?? null,
      part_id: input.part_id ?? null,
      part_name: input.part_name ?? null,
      qty: input.qty ?? 1,
      unit_price: input.unit_price ?? 0,
      discount: input.discount ?? 0,
      actual_fee: input.actual_fee ?? (input.qty ?? 1) * (input.unit_price ?? 0)
    }) as RunResult
  return Number(res.lastInsertRowid)
}

export function updatePartOrderLine(id: number, input: Partial<WorkOrderPart>): void {
  db()
    .prepare(
      `UPDATE work_order_parts SET item_id=@item_id, part_id=@part_id, part_name=@part_name, qty=@qty,
        unit_price=@unit_price, discount=@discount, actual_fee=@actual_fee WHERE id=@id`
    )
    .run({
      id,
      item_id: input.item_id ?? null,
      part_id: input.part_id ?? null,
      part_name: input.part_name ?? null,
      qty: input.qty ?? 1,
      unit_price: input.unit_price ?? 0,
      discount: input.discount ?? 0,
      actual_fee: input.actual_fee ?? (input.qty ?? 1) * (input.unit_price ?? 0)
    })
}

export function deletePartOrderLine(id: number): void {
  db().prepare('DELETE FROM work_order_parts WHERE id = ?').run(id)
}

function orderTotal(orderId: number): { labor: number; parts: number } {
  const l = db()
    .prepare('SELECT COALESCE(SUM(actual_fee), 0) AS s FROM work_order_items WHERE order_id = ?')
    .get(orderId) as { s: number }
  const p = db()
    .prepare('SELECT COALESCE(SUM(actual_fee), 0) AS s FROM work_order_parts WHERE order_id = ?')
    .get(orderId) as { s: number }
  return { labor: l.s, parts: p.s }
}

export function orderTotalDetail(orderId: number): { labor: number; parts: number; total: number } {
  const t = orderTotal(orderId)
  return { labor: t.labor, parts: t.parts, total: t.labor + t.parts }
}

/**
 * 工单完成联动：扣减库存（去重）、更新车辆里程/保养信息、标记已完成。
 */
export function completeOrder(orderId: number): void {
  const order = getOrder(orderId)
  if (!order) return

  // 1. 扣减库存（确保不重复）
  const already = db()
    .prepare("SELECT id, part_id FROM stock_transactions WHERE ref_no = ? AND part_id IS NOT NULL")
    .all(`WO:${order.order_no}`) as Array<{ id: number; part_id: number | null }>
  const alreadyParts = new Set(already.map((a) => a.part_id))

  const deductStock = db().prepare(
    'SELECT stock FROM parts WHERE id = ?'
  )
  const updateStock = db().prepare('UPDATE parts SET stock = ? WHERE id = ?')
  const insertTx = db().prepare(
    `INSERT INTO stock_transactions (part_id, type, qty, before_stock, after_stock, ref_no, note)
     VALUES (?, '出库', ?, ?, ?, ?, ?)`
  )

  db().transaction(() => {
    for (const p of order.parts) {
      if (p.part_id && !alreadyParts.has(p.part_id)) {
        const row = deductStock.get(p.part_id) as { stock: number }
        const before = row.stock
        const after = before - p.qty
        updateStock.run(after, p.part_id)
        insertTx.run(p.part_id, -p.qty, before, after, `WO:${order.order_no}`, `工单 ${order.order_no} 出库`)
        alreadyParts.add(p.part_id)
      }
    }
    // 2. 更新车辆档案
    if (order.vehicle_id) {
      const setVehicle: string[] = []
      const args: Record<string, unknown> = { id: order.vehicle_id }
      if (order.to_shop_mileage != null) {
        setVehicle.push('current_mileage = @current_mileage')
        args.current_mileage = order.to_shop_mileage
      }
      if (order.type === '保养') {
        const md = db()
          .prepare('SELECT * FROM maintenance_details WHERE order_id = ?')
          .get(orderId) as
          | { next_maintenance_at: string | null; next_maintenance_km: number | null }
          | undefined
        if (md) {
          if (md.next_maintenance_at) {
            setVehicle.push('last_maintenance_date = @lmd')
            args.lmd = md.next_maintenance_at
          }
          if (md.next_maintenance_km != null) {
            setVehicle.push('last_maintenance_km = @lmk')
            args.lmk = md.next_maintenance_km
          }
        }
      }
      if (setVehicle.length) {
        db()
          .prepare(`UPDATE vehicles SET ${setVehicle.join(', ')} WHERE id = @id`)
          .run(args)
      }
    }
    // 3. 标记完成
    db()
      .prepare("UPDATE work_orders SET status = '已完成', updated_at = ? WHERE id = ?")
      .run(now(), orderId)
  })
}

export function updateOrderStatus(orderId: number, status: string): void {
  if (status === '已完成') {
    completeOrder(orderId)
  } else {
    db()
      .prepare('UPDATE work_orders SET status = ?, updated_at = ? WHERE id = ?')
      .run(status, now(), orderId)
  }
}

// ---------------- Parts & Stock ----------------

export function listParts(search?: string): Part[] {
  if (search && search.trim()) {
    const kw = `%${search.trim()}%`
    return db()
      .prepare(
        `SELECT * FROM parts WHERE name LIKE ? OR part_no LIKE ? OR category LIKE ? OR brand LIKE ?
         ORDER BY name`
      )
      .all(kw, kw, kw, kw) as Part[]
  }
  return db().prepare('SELECT * FROM parts ORDER BY name').all() as Part[]
}

export function createPart(input: Partial<Part>): number {
  const res = db()
    .prepare(
      `INSERT INTO parts (part_no, name, category, brand, model, spec, unit, purchase_price, sale_price,
        stock, min_stock, location, supplier_id)
       VALUES (@part_no, @name, @category, @brand, @model, @spec, @unit, @purchase_price, @sale_price,
        @stock, @min_stock, @location, @supplier_id)`
    )
    .run({
      part_no: input.part_no ?? null,
      name: input.name ?? '',
      category: input.category ?? null,
      brand: input.brand ?? null,
      model: input.model ?? null,
      spec: input.spec ?? null,
      unit: input.unit ?? null,
      purchase_price: input.purchase_price ?? 0,
      sale_price: input.sale_price ?? 0,
      stock: input.stock ?? 0,
      min_stock: input.min_stock ?? 0,
      location: input.location ?? null,
      supplier_id: input.supplier_id ?? null
    }) as RunResult
  return Number(res.lastInsertRowid)
}

export function updatePart(id: number, input: Partial<Part>): void {
  db()
    .prepare(
      `UPDATE parts SET part_no=@part_no, name=@name, category=@category, brand=@brand, model=@model,
        spec=@spec, unit=@unit, purchase_price=@purchase_price, sale_price=@sale_price, stock=@stock,
        min_stock=@min_stock, location=@location, supplier_id=@supplier_id WHERE id=@id`
    )
    .run({
      id,
      part_no: input.part_no ?? null,
      name: input.name ?? '',
      category: input.category ?? null,
      brand: input.brand ?? null,
      model: input.model ?? null,
      spec: input.spec ?? null,
      unit: input.unit ?? null,
      purchase_price: input.purchase_price ?? 0,
      sale_price: input.sale_price ?? 0,
      stock: input.stock ?? 0,
      min_stock: input.min_stock ?? 0,
      location: input.location ?? null,
      supplier_id: input.supplier_id ?? null
    })
}

export function deletePart(id: number): void {
  db().prepare('DELETE FROM parts WHERE id = ?').run(id)
}

function recordStock(
  partId: number,
  type: string,
  qty: number,
  refNo: string,
  note: string
): void {
  const row = db().prepare('SELECT stock FROM parts WHERE id = ?').get(partId) as { stock: number }
  const before = row.stock
  const after = before + qty
  db()
    .prepare('UPDATE parts SET stock = ? WHERE id = ?')
    .run(after, partId)
  db()
    .prepare(
      `INSERT INTO stock_transactions (part_id, type, qty, before_stock, after_stock, ref_no, note)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(partId, type, qty, before, after, refNo, note)
}

export function stockInbound(partId: number, qty: number, refNo?: string, note?: string): void {
  recordStock(partId, '入库', Math.abs(qty), refNo ?? '', note ?? '')
}
export function stockOutbound(partId: number, qty: number, refNo?: string, note?: string): void {
  recordStock(partId, '出库', -Math.abs(qty), refNo ?? '', note ?? '')
}
export function stockAdjust(partId: number, target: number, note?: string): void {
  const row = db().prepare('SELECT stock FROM parts WHERE id = ?').get(partId) as { stock: number }
  const diff = target - row.stock
  if (diff === 0) return
  recordStock(partId, '盘点', diff, '', note ?? '盘点调整')
}

export function stockTransactions(partId: number): StockTransaction[] {
  return db()
    .prepare('SELECT * FROM stock_transactions WHERE part_id = ? ORDER BY id DESC')
    .all(partId) as StockTransaction[]
}

export function lowStockParts(): Part[] {
  return db()
    .prepare('SELECT * FROM parts WHERE stock <= min_stock ORDER BY stock ASC')
    .all() as Part[]
}

// ---------------- Payments ----------------

export function createPayment(input: Partial<Payment>): number {
  const res = db()
    .prepare(
      `INSERT INTO payments (order_id, customer_id, vehicle_id, amount, method, paid_at, operator, note)
       VALUES (@order_id, @customer_id, @vehicle_id, @amount, @method, @paid_at, @operator, @note)`
    )
    .run({
      order_id: input.order_id ?? null,
      customer_id: input.customer_id ?? null,
      vehicle_id: input.vehicle_id ?? null,
      amount: input.amount ?? 0,
      method: input.method ?? null,
      paid_at: input.paid_at ?? now(),
      operator: input.operator ?? null,
      note: input.note ?? null
    }) as RunResult
  return Number(res.lastInsertRowid)
}

export function paymentsByOrder(orderId: number): Payment[] {
  return db()
    .prepare('SELECT * FROM payments WHERE order_id = ? ORDER BY created_at DESC')
    .all(orderId) as Payment[]
}

export function refundPayment(id: number): void {
  db().prepare('DELETE FROM payments WHERE id = ?').run(id)
}

// ---------------- Images ----------------

export function addImage(input: Partial<ImageRecord>): number {
  const res = db()
    .prepare(
      `INSERT INTO images (vehicle_id, order_id, item_id, rel_path, thumb_path, stage, part, tags, note, taken_at, uploader)
       VALUES (@vehicle_id, @order_id, @item_id, @rel_path, @thumb_path, @stage, @part, @tags, @note, @taken_at, @uploader)`
    )
    .run({
      vehicle_id: input.vehicle_id ?? null,
      order_id: input.order_id ?? null,
      item_id: input.item_id ?? null,
      rel_path: input.rel_path ?? '',
      thumb_path: input.thumb_path ?? null,
      stage: input.stage ?? null,
      part: input.part ?? null,
      tags: input.tags ?? null,
      note: input.note ?? null,
      taken_at: input.taken_at ?? now(),
      uploader: input.uploader ?? null
    }) as RunResult
  return Number(res.lastInsertRowid)
}

export function imagesByOrder(orderId: number): ImageRecord[] {
  return db()
    .prepare('SELECT * FROM images WHERE order_id = ? ORDER BY id DESC')
    .all(orderId) as ImageRecord[]
}

export function imagesByVehicle(vehicleId: number): ImageRecord[] {
  return db()
    .prepare('SELECT * FROM images WHERE vehicle_id = ? ORDER BY id DESC')
    .all(vehicleId) as ImageRecord[]
}

export function deleteImage(id: number): ImageRecord | null {
  const row = db().prepare('SELECT * FROM images WHERE id = ?').get(id) as ImageRecord | undefined
  if (!row) return null
  db().prepare('DELETE FROM images WHERE id = ?').run(id)
  return row
}

// ---------------- Attachments (文档附件，与工单关联) ----------------

export function addAttachment(input: Partial<Attachment>): number {
  const res = db()
    .prepare(
      `INSERT INTO attachments (order_id, customer_id, vehicle_id, rel_path, title, file_type, uploader)
       VALUES (@order_id, @customer_id, @vehicle_id, @rel_path, @title, @file_type, @uploader)`
    )
    .run({
      order_id: input.order_id ?? null,
      customer_id: input.customer_id ?? null,
      vehicle_id: input.vehicle_id ?? null,
      rel_path: input.rel_path ?? '',
      title: input.title ?? null,
      file_type: input.file_type ?? null,
      uploader: input.uploader ?? null
    }) as RunResult
  return Number(res.lastInsertRowid)
}

export function attachmentsByOrder(orderId: number): Attachment[] {
  return db()
    .prepare('SELECT * FROM attachments WHERE order_id = ? ORDER BY id DESC')
    .all(orderId) as Attachment[]
}

export function deleteAttachment(id: number): Attachment | null {
  const row = db().prepare('SELECT * FROM attachments WHERE id = ?').get(id) as Attachment | undefined
  if (!row) return null
  db().prepare('DELETE FROM attachments WHERE id = ?').run(id)
  return row
}

// ---------------- Maintenance / Repair / Modification details ----------------

export function saveMaintenance(orderId: number, input: Partial<Record<string, unknown>>): void {
  db()
    .prepare(
      `INSERT INTO maintenance_details (order_id, oil_brand, oil_model, oil_qty, next_maintenance_at, next_maintenance_km)
       VALUES (@order_id, @oil_brand, @oil_model, @oil_qty, @next_maintenance_at, @next_maintenance_km)
       ON CONFLICT(order_id) DO UPDATE SET oil_brand=@oil_brand, oil_model=@oil_model, oil_qty=@oil_qty,
         next_maintenance_at=@next_maintenance_at, next_maintenance_km=@next_maintenance_km`
    )
    .run({
      order_id: orderId,
      oil_brand: input.oil_brand ?? null,
      oil_model: input.oil_model ?? null,
      oil_qty: input.oil_qty ?? null,
      next_maintenance_at: input.next_maintenance_at ?? null,
      next_maintenance_km: input.next_maintenance_km ?? null
    })
}

export function getMaintenance(orderId: number): Record<string, unknown> | null {
  return (db().prepare('SELECT * FROM maintenance_details WHERE order_id = ?').get(orderId) as
    | Record<string, unknown>
    | undefined) ?? null
}

export function saveRepair(orderId: number, input: Partial<Record<string, unknown>>): void {
  db()
    .prepare(
      `INSERT INTO repair_details (order_id, fault_code, diagnosis, plan, result, result_note)
       VALUES (@order_id, @fault_code, @diagnosis, @plan, @result, @result_note)
       ON CONFLICT(order_id) DO UPDATE SET fault_code=@fault_code, diagnosis=@diagnosis, plan=@plan,
         result=@result, result_note=@result_note`
    )
    .run({
      order_id: orderId,
      fault_code: input.fault_code ?? null,
      diagnosis: input.diagnosis ?? null,
      plan: input.plan ?? null,
      result: input.result ?? null,
      result_note: input.result_note ?? null
    })
}

export function getRepair(orderId: number): Record<string, unknown> | null {
  return (db().prepare('SELECT * FROM repair_details WHERE order_id = ?').get(orderId) as
    | Record<string, unknown>
    | undefined) ?? null
}

export function saveModification(orderId: number, input: Partial<Record<string, unknown>>): void {
  db()
    .prepare(
      `INSERT INTO modification_details (order_id, proj_name, brand, model, serial, install_date, remove_date, status)
       VALUES (@order_id, @proj_name, @brand, @model, @serial, @install_date, @remove_date, @status)
       ON CONFLICT(order_id) DO UPDATE SET proj_name=@proj_name, brand=@brand, model=@model, serial=@serial,
         install_date=@install_date, remove_date=@remove_date, status=@status`
    )
    .run({
      order_id: orderId,
      proj_name: input.proj_name ?? null,
      brand: input.brand ?? null,
      model: input.model ?? null,
      serial: input.serial ?? null,
      install_date: input.install_date ?? null,
      remove_date: input.remove_date ?? null,
      status: input.status ?? null
    })
}

export function getModification(orderId: number): Record<string, unknown> | null {
  return (db().prepare('SELECT * FROM modification_details WHERE order_id = ?').get(orderId) as
    | Record<string, unknown>
    | undefined) ?? null
}

// ---------------- Settings ----------------

export function getSettings(): Record<string, string> {
  const rows = db().prepare('SELECT key, value FROM settings').all() as Array<{ key: string; value: string }>
  return Object.fromEntries(rows.map((r) => [r.key, r.value]))
}

export function setSetting(key: string, value: string): void {
  db()
    .prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = ?')
    .run(key, value, value)
}

// ---------------- 提醒忽略 ----------------

const IGNORED_KEY = 'ignored_reminders'

export function getIgnoredReminders(): string[] {
  const v = getSettings()[IGNORED_KEY]
  if (!v) return []
  try {
    const arr = JSON.parse(v)
    return Array.isArray(arr) ? arr.filter((x) => typeof x === 'string') : []
  } catch {
    return []
  }
}

export function ignoreReminder(ref: string): string[] {
  const list = getIgnoredReminders()
  if (!ref) return list
  if (!list.includes(ref)) list.push(ref)
  setSetting(IGNORED_KEY, JSON.stringify(list))
  return list
}

export function restoreReminders(ref?: string): string[] {
  let list = getIgnoredReminders()
  if (ref) list = list.filter((x) => x !== ref)
  else list = []
  setSetting(IGNORED_KEY, JSON.stringify(list))
  return list
}

// ---------------- Dashboard ----------------

export function dashboardSummary(): DashboardSummary {
  const today = now().slice(0, 10)
  const month = today.slice(0, 7)
  const d = db()
  const todayOrders = (
    d.prepare("SELECT COUNT(*) AS c FROM work_orders WHERE created_at LIKE ?").get(today + '%') as { c: number }
  ).c
  const monthOrders = (
    d.prepare("SELECT COUNT(*) AS c FROM work_orders WHERE created_at LIKE ?").get(month + '%') as { c: number }
  ).c
  const todayRevenue = (
    d.prepare("SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE created_at LIKE ?").get(today + '%') as {
      s: number
    }
  ).s
  const monthRevenue = (
    d.prepare("SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE created_at LIKE ?").get(month + '%') as {
      s: number
    }
  ).s

  const remindAdvanceDays = Math.max(0, Number(getSettings()['remind_advance_days']) || 3)
  const ignored = new Set(getIgnoredReminders())

  const todayDate = new Date()
  const todayKey = `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, '0')}-${String(todayDate.getDate()).padStart(2, '0')}`
  const calc = (dateStr: string | null): { status: ReminderStatus; days_left: number } => {
    if (!dateStr) return { status: 'upcoming', days_left: 9999 }
    const t = new Date(todayKey + 'T00:00:00').getTime()
    const d = new Date(dateStr.slice(0, 10) + 'T00:00:00').getTime()
    const days = Math.round((d - t) / 86400000)
    const status: ReminderStatus = days < 0 ? 'overdue' : days <= remindAdvanceDays ? 'near' : 'upcoming'
    return { status, days_left: days }
  }
  const decorate = (rows: any[], kind: string, dateField: string, keyFn: (r: any) => string) => {
    const out: any[] = []
    for (const r of rows) {
      const key = keyFn(r)
      if (ignored.has(key)) continue
      const { status, days_left } = calc(r[dateField])
      if (status === 'upcoming') continue
      out.push({ ...r, kind, ref: key, status, days_left, at: r[dateField] })
    }
    return out
  }

  let upcomingMaintenance = decorate(
    d
      .prepare(
        "SELECT v.id AS vehicle_id, v.plate_number, c.name AS customer_name, v.last_maintenance_date AS date FROM vehicles v LEFT JOIN customers c ON c.id = v.customer_id WHERE v.last_maintenance_date IS NOT NULL AND v.last_maintenance_date <> ''"
      )
      .all(),
    '保养',
    'date',
    (r) => `maintenance_${r.vehicle_id}`
  ) as DashboardSummary['upcomingMaintenance']

  const insRows = decorate(
    d
      .prepare(
        "SELECT v.id AS vehicle_id, v.plate_number, c.name AS customer_name, v.insurance_expire AS date FROM vehicles v LEFT JOIN customers c ON c.id = v.customer_id WHERE v.insurance_expire IS NOT NULL AND v.insurance_expire <> ''"
      )
      .all(),
    '保险',
    'date',
    (r) => `insurance_${r.vehicle_id}`
  ) as any[]
  const inspRows = decorate(
    d
      .prepare(
        "SELECT v.id AS vehicle_id, v.plate_number, c.name AS customer_name, v.inspection_expire AS date FROM vehicles v LEFT JOIN customers c ON c.id = v.customer_id WHERE v.inspection_expire IS NOT NULL AND v.inspection_expire <> ''"
      )
      .all(),
    '年检',
    'date',
    (r) => `inspection_${r.vehicle_id}`
  ) as any[]
  const upcomingExpiries = [...insRows, ...inspRows]
    .sort((a, b) => a.days_left - b.days_left)
    .slice(0, 10) as DashboardSummary['upcomingExpiries']

  upcomingMaintenance.sort((a, b) => a.days_left - b.days_left)
  upcomingMaintenance = upcomingMaintenance.slice(0, 10)

  return {
    todayOrders,
    monthOrders,
    todayRevenue,
    monthRevenue,
    lowStock: lowStockParts(),
    remindAdvanceDays,
    upcomingMaintenance,
    upcomingExpiries
  }
}

export function customerConsumption(customerId: number): number {
  const row = db()
    .prepare('SELECT COALESCE(SUM(amount), 0) AS s FROM payments WHERE customer_id = ?')
    .get(customerId) as { s: number }
  return row.s
}

// ---------------- Appointments ----------------

export function listAppointments(search?: string): Appointment[] {
  if (search && search.trim()) {
    const kw = `%${search.trim()}%`
    return db()
      .prepare(
        `SELECT a.* FROM appointments a
         LEFT JOIN customers c ON c.id = a.customer_id
         LEFT JOIN vehicles v ON v.id = a.vehicle_id
         WHERE c.name LIKE ? OR v.plate_number LIKE ? OR a.service_type LIKE ?
         ORDER BY a.date ASC, a.time ASC`
      )
      .all(kw, kw, kw) as Appointment[]
  }
  return db()
    .prepare('SELECT * FROM appointments ORDER BY date ASC, time ASC')
    .all() as Appointment[]
}

export function createAppointment(input: Partial<Appointment>): number {
  const res = db()
    .prepare(
      `INSERT INTO appointments (customer_id, vehicle_id, date, time, duration, service_type, note, status)
       VALUES (@customer_id, @vehicle_id, @date, @time, @duration, @service_type, @note, @status)`
    )
    .run({
      customer_id: input.customer_id ?? null,
      vehicle_id: input.vehicle_id ?? null,
      date: input.date ?? null,
      time: input.time ?? null,
      duration: input.duration ?? null,
      service_type: input.service_type ?? null,
      note: input.note ?? null,
      status: input.status ?? '待接待'
    }) as RunResult
  return Number(res.lastInsertRowid)
}

export function updateAppointment(id: number, input: Partial<Appointment>): void {
  db()
    .prepare(
      `UPDATE appointments SET customer_id=@customer_id, vehicle_id=@vehicle_id, date=@date, time=@time,
        duration=@duration, service_type=@service_type, note=@note, status=@status WHERE id=@id`
    )
    .run({
      id,
      customer_id: input.customer_id ?? null,
      vehicle_id: input.vehicle_id ?? null,
      date: input.date ?? null,
      time: input.time ?? null,
      duration: input.duration ?? null,
      service_type: input.service_type ?? null,
      note: input.note ?? null,
      status: input.status ?? '待接待'
    })
}

export function deleteAppointment(id: number): void {
  db().prepare('DELETE FROM appointments WHERE id = ?').run(id)
}

// ---------------- Suppliers ----------------

export function listSuppliers(search?: string): Supplier[] {
  if (search && search.trim()) {
    const kw = `%${search.trim()}%`
    return db()
      .prepare(
        'SELECT * FROM suppliers WHERE name LIKE ? OR contact LIKE ? OR phone LIKE ? OR address LIKE ? ORDER BY name'
      )
      .all(kw, kw, kw, kw) as Supplier[]
  }
  return db().prepare('SELECT * FROM suppliers ORDER BY name').all() as Supplier[]
}

export function createSupplier(input: Partial<Supplier>): number {
  const res = db()
    .prepare(
      `INSERT INTO suppliers (name, contact, phone, address, last_term, note)
       VALUES (@name, @contact, @phone, @address, @last_term, @note)`
    )
    .run({
      name: input.name ?? '',
      contact: input.contact ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      last_term: input.last_term ?? null,
      note: input.note ?? null
    }) as RunResult
  return Number(res.lastInsertRowid)
}

export function updateSupplier(id: number, input: Partial<Supplier>): void {
  db()
    .prepare(
      `UPDATE suppliers SET name=@name, contact=@contact, phone=@phone, address=@address,
        last_term=@last_term, note=@note WHERE id=@id`
    )
    .run({
      id,
      name: input.name ?? '',
      contact: input.contact ?? null,
      phone: input.phone ?? null,
      address: input.address ?? null,
      last_term: input.last_term ?? null,
      note: input.note ?? null
    })
}

export function deleteSupplier(id: number): void {
  db().prepare('DELETE FROM suppliers WHERE id = ?').run(id)
}

// ---------------- Operators (技师/操作人，仅记录归属，无权限) ----------------

export function listOperators(): Array<{ id: number; name: string; role: string | null }> {
  return db()
    .prepare('SELECT id, name, role FROM operators ORDER BY id')
    .all() as Array<{ id: number; name: string; role: string | null }>
}

export function createOperator(input: { name: string; role?: string | null }): number {
  const res = db()
    .prepare('INSERT INTO operators (name, role) VALUES (@name, @role)')
    .run({ name: input.name ?? '', role: input.role ?? null }) as RunResult
  return Number(res.lastInsertRowid)
}

export function updateOperator(id: number, input: { name: string; role?: string | null }): void {
  db()
    .prepare('UPDATE operators SET name = @name, role = @role WHERE id = @id')
    .run({ id, name: input.name ?? '', role: input.role ?? null })
}

export function deleteOperator(id: number): void {
  db().prepare('DELETE FROM operators WHERE id = ?').run(id)
}

// ---------------- Reports ----------------

function toReport(rows: any[], columns?: string[]): ReportResult {
  const cols = columns ?? (rows.length ? Object.keys(rows[0]) : [])
  return { columns: cols, rows: rows as ReportRow[] }
}

export function revenueReport(from: string, to: string): ReportResult {
  const rows = db()
    .prepare(
      `SELECT date(COALESCE(paid_at, created_at)) AS day,
              COUNT(*) AS orders,
              ROUND(COALESCE(SUM(amount), 0), 2) AS revenue
       FROM payments
       WHERE date(COALESCE(paid_at, created_at)) BETWEEN ? AND ?
       GROUP BY day ORDER BY day ASC`
    )
    .all(cleanDate(from), cleanDate(to))
  return toReport(rows)
}

export function customerReport(): ReportResult {
  const rows = db()
    .prepare(
      `SELECT c.name AS 客户, c.phone AS 手机号,
              COUNT(wo.id) AS 到店次数,
              ROUND(COALESCE(SUM(p.amount), 0), 2) AS 累计消费
       FROM customers c
       LEFT JOIN work_orders wo ON wo.customer_id = c.id AND wo.status = '已完成'
       LEFT JOIN payments p ON p.customer_id = c.id
       GROUP BY c.id ORDER BY 累计消费 DESC`
    )
    .all()
  return toReport(rows)
}

export function modelReport(): ReportResult {
  const rows = db()
    .prepare(
      `SELECT v.brand AS 品牌, v.model AS 车型,
              COUNT(wo.id) AS 工单数,
              ROUND(COALESCE(SUM(pa.amount), 0), 2) AS 消费
       FROM vehicles v
       LEFT JOIN work_orders wo ON wo.vehicle_id = v.id
       LEFT JOIN payments pa ON pa.vehicle_id = v.id
       GROUP BY v.brand, v.model
       ORDER BY 工单数 DESC`
    )
    .all()
  return toReport(rows)
}

export function maintenanceReport(): ReportResult {
  const rows = db()
    .prepare(
      `SELECT i.name AS 保养项目, COUNT(i.id) AS 次数, ROUND(COALESCE(SUM(i.actual_fee), 0), 2) AS 金额
       FROM work_order_items i
       JOIN work_orders wo ON wo.id = i.order_id
       WHERE wo.type = '保养'
       GROUP BY i.name ORDER BY 次数 DESC`
    )
    .all()
  return toReport(rows)
}

export function inventoryReport(): ReportResult {
  const rows = db()
    .prepare(
      `SELECT part_no AS 编号, name AS 名称, category AS 分类, brand AS 品牌, spec AS 规格, unit AS 单位,
              stock AS 库存, min_stock AS 最低库存,
              ROUND(purchase_price, 2) AS 进价, ROUND(sale_price, 2) AS 售价,
              ROUND(stock * purchase_price, 2) AS 库存成本,
              ROUND(stock * sale_price, 2) AS 库存价值
       FROM parts ORDER BY name`
    )
    .all()
  return toReport(rows)
}

function cleanDate(d: string | null): string {
  return (d ?? new Date().toISOString().slice(0, 10)).slice(0, 10)
}
