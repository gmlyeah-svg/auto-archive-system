import type { WorkOrderDetail, ReportResult } from '../../../shared/types'

function money(n: number): string {
  return `¥${(Number(n) || 0).toFixed(2)}`
}

/**
 * 生成 A4 工单/结算单打印 HTML（含客户确认签字栏）。
 */
export function buildWorkOrderPrintHtml(
  order: WorkOrderDetail,
  totals: { labor: number; parts: number; total: number },
  shopName?: string
): string {
  const esc = (v: string | null | undefined) => (v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const itemsHtml =
    order.items.length === 0
      ? '<tr><td colspan="6" style="text-align:center;color:#999">（无施工项目）</td></tr>'
      : order.items
          .map(
            (i, idx) =>
              `<tr><td>${idx + 1}</td><td>${esc(i.name)}</td><td>${esc(i.type)}</td><td>${esc(i.desc)}</td><td>${money(i.labor_fee)}</td><td>${money(i.actual_fee)}</td></tr>`
          )
          .join('')
  const partsHtml =
    order.parts.length === 0
      ? '<tr><td colspan="6" style="text-align:center;color:#999">（无使用配件）</td></tr>'
      : order.parts
          .map(
            (p, idx) =>
              `<tr><td>${idx + 1}</td><td>${esc(p.part_name)}</td><td>${Number(p.qty)}</td><td>${money(p.unit_price)}</td><td>${money(p.discount)}</td><td>${money(p.actual_fee)}</td></tr>`
          )
          .join('')

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"/>
<style>
@page{size:A4;margin:12mm}
body{font-family:-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;color:#1f1f1f;font-size:13px;line-height:1.6}
h1{font-size:18px;text-align:center;margin:0 0 4px}
.sub{text-align:center;color:#666;font-size:12px;margin-bottom:12px}
table{width:100%;border-collapse:collapse;margin:8px 0}
th,td{border:1px solid #d9d9d9;padding:4px 8px;font-size:12px}
th{background:#fafafa}
.info td{border:none;padding:2px 8px 2px 0}
.money{text-align:right}
.sig{margin-top:28px;border:1px dashed #999;padding:14px 18px}
.sig .line{display:inline-block;width:180px;border-bottom:1px solid #333;margin:0 8px}
.total{font-size:15px;font-weight:600}
</style></head><body>
<h1>${esc(shopName || '汽修工单')}</h1>
<div class="sub">维修工单 / 结算单</div>
<table class="info"><tr>
<td><b>工单号：</b>${esc(order.order_no)}</td><td><b>类型：</b>${esc(order.type)}</td>
<td><b>状态：</b>${esc(order.status)}</td><td><b>进厂：</b>${esc(order.shop_time?.slice(0, 16))}</td>
</tr><tr>
<td><b>客户：</b>${esc(order.customer_name || '散客')}</td><td><b>电话：</b>${esc(order.customer_phone)}</td>
<td><b>车牌：</b>${esc(order.vehicle_plate || '-')}</td><td><b>车辆：</b>${esc(order.vehicle_info || '-')}</td>
</tr><tr>
<td><b>里程：</b>${order.to_shop_mileage != null ? order.to_shop_mileage + ' km' : '-'}</td>
<td colspan="3"><b>故障/备注：</b>${esc(order.fault_desc || order.note || '')}</td>
</tr></table>

<b>一、施工项目</b>
<table><thead><tr><th style="width:36px">#</th><th>项目</th><th style="width:90px">类型</th><th>说明</th><th style="width:80px">工时费</th><th style="width:80px">合计</th></tr></thead>
<tbody>${itemsHtml}</tbody></table>

<b>二、使用配件</b>
<table><thead><tr><th style="width:36px">#</th><th>配件</th><th style="width:60px">数量</th><th style="width:80px">单价</th><th style="width:80px">优惠</th><th style="width:80px">小计</th></tr></thead>
<tbody>${partsHtml}</tbody></table>

<table><tr>
<td class="total">工时费：${money(totals.labor)}</td>
<td class="total">材料费：${money(totals.parts)}</td>
<td class="total">合计金额：${money(totals.total)}</td>
</tr></table>

<div class="sig">
<div style="margin-bottom:14px">客户确认：以上项目与金额已核对无误，本人已验收并同意。</div>
<div style="display:flex;justify-content:space-between">
  <span>客户签字：<span class="line"></span></span>
  <span>日期：<span class="line"></span></span>
</div>
</div>
</body></html>`
}

/**
 * 生成附件文件名：姓名_车牌_日期；缺项省略；都缺则用工单号。
 */
export function buildAttachmentFilename(order: WorkOrderDetail): string {
  const name = (order.customer_name ?? '').trim()
  const plate = (order.vehicle_plate ?? '').trim()
  const date = ((order.shop_time || order.created_at) || new Date().toISOString()).slice(0, 10)
  let base = ''
  if (name && plate) base = `${name}_${plate}`
  else if (name) base = name
  else if (plate) base = plate
  else return order.order_no
  return `${base}_${date}`
}

function csvCell(v: unknown): string {
  const s = String(v ?? '')
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
}

export function csvFromReport(r: ReportResult, title?: string): string {
  const lines: string[] = []
  if (title) lines.push(title)
  lines.push(r.columns.map(csvCell).join(','))
  for (const row of r.rows) {
    lines.push(r.columns.map((c) => csvCell(row[c])).join(','))
  }
  return '\ufeff' + lines.join('\r\n')
}

export function xlsFromReport(r: ReportResult, title?: string): string {
  const header = r.columns.map((c) => `<th>${c}</th>`).join('')
  const body = r.rows
    .map((row) => `<tr>${r.columns.map((c) => `<td>${row[c] ?? ''}</td>`).join('')}</tr>`)
    .join('')
  return (
    '\ufeff<html><head><meta charset="utf-8"><style>table{border-collapse:collapse}td,th{border:1px solid #999;padding:4px 8px}</style></head><body>' +
    (title ? `<h3>${title}</h3>` : '') +
    `<table><thead><tr>${header}</tr></thead><tbody>${body}</tbody></table></body></html>`
  )
}
