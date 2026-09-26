import { useEffect, useMemo, useState } from 'react'
import {
  Card,
  Form,
  Select,
  Input,
  DatePicker,
  InputNumber,
  Button,
  Space,
  Tag,
  Table,
  Modal,
  message,
  Row,
  Col,
  Descriptions,
  Image,
  Spin,
  List,
  Empty,
  Popconfirm
} from 'antd'
import { PlusOutlined, DeleteOutlined, SaveOutlined, PrinterOutlined, FilePdfOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useParams } from 'react-router-dom'
import type { WorkOrderDetail, WorkOrderItem, WorkOrderPart, Part, Customer, Vehicle, Attachment } from '../../../shared/types'
import { imageUrl } from '../lib/image'
import { buildWorkOrderPrintHtml, buildAttachmentFilename } from '../lib/printTemplate'

const orderTypes = ['保养', '维修', '改装', '检查']
const statusColor: Record<string, string> = {
  草稿: 'default',
  待施工: 'blue',
  施工中: 'processing',
  待验收: 'warning',
  待收款: 'orange',
  已完成: 'green',
  已取消: 'default',
  已退款: 'red'
}
const stageOptions = ['施工前', '施工中', '施工后', '故障']

const flow: Record<string, Array<{ to: string; label: string }>> = {
  草稿: [
    { to: '待施工', label: '提交' },
    { to: '已取消', label: '取消' }
  ],
  待施工: [
    { to: '施工中', label: '开始施工' },
    { to: '已取消', label: '取消' }
  ],
  施工中: [
    { to: '待验收', label: '完工' },
    { to: '已取消', label: '取消' }
  ],
  待验收: [{ to: '待收款', label: '验收通过' }],
  待收款: [{ to: '已完成', label: '收款完成' }],
  已完成: [{ to: '已退款', label: '退款' }],
  已取消: [],
  已退款: []
}

export default function OrderDetail(): JSX.Element {
  const { id } = useParams()
  const [order, setOrder] = useState<WorkOrderDetail | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [partsAll, setPartsAll] = useState<Part[]>([])
  const [operators, setOperators] = useState<Array<{ id: number; name: string; role: string | null }>>([])
  const [images, setImages] = useState<Array<{ id: number; rel_path: string; thumb_path: string | null; note: string | null }>>([])
  const [attachments, setAttachments] = useState<Attachment[]>([])
  const [basicForm] = Form.useForm()
  const [itemModal, setItemModal] = useState(false)
  const [editingItem, setEditingItem] = useState<WorkOrderItem | null>(null)
  const [itemForm] = Form.useForm()
  const [partModal, setPartModal] = useState(false)
  const [editingPart, setEditingPart] = useState<WorkOrderPart | null>(null)
  const [partForm] = Form.useForm()
  const [payModal, setPayModal] = useState(false)
  const [payForm] = Form.useForm()
  const [detailForm] = Form.useForm()
  const [detailType, setDetailType] = useState('')
  const [empModal, setEmpModal] = useState(false)
  const [empTarget, setEmpTarget] = useState<'receptionist' | 'technicians' | 'item-technician'>('receptionist')
  const [empForm] = Form.useForm()

  const openEmployee = (t: 'receptionist' | 'technicians' | 'item-technician') => {
    setEmpTarget(t)
    empForm.resetFields()
    setEmpModal(true)
  }
  const saveEmployee = async () => {
    const v = await empForm.validateFields()
    const id = await window.api.operators.create(v)
    const list = await window.api.operators.list()
    setOperators((list as Array<{ id: number; name: string; role: string | null }>) ?? [])
    const name = (list.find((o) => o.id === id) as { name: string } | undefined)?.name ?? v.name
    if (empTarget === 'receptionist') {
      basicForm.setFieldsValue({ receptionist: name })
    } else if (empTarget === 'technicians') {
      const cur = basicForm.getFieldValue('technicians')
      basicForm.setFieldsValue({ technicians: Array.isArray(cur) ? [...cur, name] : [name] })
    } else {
      itemForm.setFieldsValue({ technician_id: id })
    }
    setEmpModal(false)
    message.success('已添加员工')
  }

  const pickedPartId = Form.useWatch('part_id', partForm)
  const pickedQty = Form.useWatch('qty', partForm)
  const pickedPart = partsAll.find((p) => p.id === pickedPartId) ?? null
  const stockOver = pickedPart && pickedQty != null ? Number(pickedQty) - pickedPart.stock : 0

  const load = async () => {
    try {
      const o = await window.api.orders.get(Number(id))
      setOrder(o)
      if (o) {
        setDetailType(o.type)
        basicForm.setFieldsValue({
          ...o,
          shop_time: o.shop_time ? dayjs(o.shop_time) : undefined,
          due_time: o.due_time ? dayjs(o.due_time) : undefined,
          technicians: o.technicians ? String(o.technicians).split(',').filter(Boolean) : []
        })
        const imgs = await window.api.images.byOrder(o.id)
        setImages(imgs.map((i) => ({ id: i.id, rel_path: i.rel_path, thumb_path: i.thumb_path, note: i.note })))
        const atts = await window.api.attachments.list(o.id)
        setAttachments((atts as Attachment[]) ?? [])
        if (o.type === '保养') {
          const md = await window.api.orders.getMaintenance(o.id)
          detailForm.setFieldsValue(md ?? {})
        }
      } else {
        message.error('未找到该工单（可能已删除）')
      }
    } catch (e) {
      console.error('[OrderDetail load]', e)
      message.error('加载工单失败：' + String(e))
    }
  }

  useEffect(() => {
    load()
    window.api.customers.list().then((c) => setCustomers((c as Customer[]) ?? []))
    window.api.vehicles.list().then(setVehicles)
    window.api.parts.list().then(setPartsAll)
    window.api.operators.list().then((o) => setOperators((o as Array<{ id: number; name: string; role: string | null }>) ?? []))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const totals = useMemo(() => {
    const labor = (order?.items ?? []).reduce((s, i) => s + (i.actual_fee ?? 0), 0)
    const parts = (order?.parts ?? []).reduce((s, p) => s + (p.actual_fee ?? 0), 0)
    return { labor, parts, total: labor + parts }
  }, [order])

  // --- basic save ---
  const saveBasic = async () => {
    const v = await basicForm.validateFields()
    await window.api.orders.update(order!.id, {
      ...v,
      technicians: Array.isArray(v.technicians) ? v.technicians.join(',') : (v.technicians ?? null),
      shop_time: v.shop_time ? dayjs(v.shop_time).format('YYYY-MM-DD HH:mm') : null,
      due_time: v.due_time ? dayjs(v.due_time).format('YYYY-MM-DD HH:mm') : null
    })
    message.success('已保存基本信息')
    load()
  }

  // --- status flow ---
  const changeStatus = async (to: string) => {
    await window.api.orders.status(order!.id, to)
    message.success(`已移至「${to}」`)
    load()
  }

  // --- 打印 / 导出 PDF（带 A4 预览弹窗）---
  const [preview, setPreview] = useState<{ html: string; filename: string } | null>(null)
  const openPreview = async () => {
    const s = await window.api.settings.get()
    const html = buildWorkOrderPrintHtml(order!, totals, s.shop_name)
    setPreview({ html, filename: `${order!.order_no}_工单` })
  }
  const previewPrint = async () => {
    if (!preview) return
    const r = await window.api.print.html(preview.html)
    if (r.ok) message.success('已发起打印')
    else message.error(r.error || '打印失败')
  }
  const previewPdf = async () => {
    if (!preview) return
    const filename = buildAttachmentFilename(order!)
    const r = await window.api.print.pdf(preview.html, filename, order!.order_no)
    if (r.ok) {
      const dir = await window.api.app.getDataDir()
      let rel = r.path!.startsWith(dir) ? r.path!.slice(dir.length).replace(/\\/g, '/') : ''
      if (rel.startsWith('/')) rel = rel.slice(1)
      await window.api.attachments.add({
        order_id: order!.id,
        customer_id: order!.customer_id,
        vehicle_id: order!.vehicle_id,
        rel_path: rel,
        title: filename,
        file_type: 'pdf'
      })
      const atts = await window.api.attachments.list(order!.id)
      setAttachments((atts as Attachment[]) ?? [])
      message.success(`PDF 已导出并打开：${filename}`)
    } else {
      message.error(r.error || '导出失败')
    }
  }

  // --- items ---
  const openNewItem = () => {
    setEditingItem(null)
    itemForm.resetFields()
    setItemModal(true)
  }
  const openEditItem = (it: WorkOrderItem) => {
    setEditingItem(it)
    itemForm.setFieldsValue(it)
    setItemModal(true)
  }
  const saveItem = async () => {
    const v = await itemForm.validateFields()
    if (editingItem) {
      await window.api.orders.updateItem(editingItem.id, v)
    } else {
      await window.api.orders.addItem(order!.id, v)
    }
    setItemModal(false)
    message.success('已保存项目')
    load()
  }
  const removeItem = async (iid: number) => {
    await window.api.orders.deleteItem(iid)
    message.success('已删除')
    load()
  }

  // --- parts ---
  const openNewPart = () => {
    setEditingPart(null)
    partForm.resetFields()
    setPartModal(true)
  }
  const openEditPart = (p: WorkOrderPart) => {
    setEditingPart(p)
    partForm.setFieldsValue({ ...p, qty: Number(p.qty) })
    setPartModal(true)
  }
  const pickPart = (partId: number) => {
    const p = partsAll.find((x) => x.id === partId)
    if (p) {
      partForm.setFieldsValue({ part_id: p.id, part_name: p.name, unit_price: p.sale_price, qty: 1 })
    }
  }
  const savePart = async () => {
    const v = await partForm.validateFields()
    v.actual_fee = (v.qty ?? 1) * (v.unit_price ?? 0) - (v.discount ?? 0)
    if (editingPart) {
      await window.api.orders.updatePart(editingPart.id, v)
    } else {
      await window.api.orders.addPart(order!.id, v)
    }
    setPartModal(false)
    message.success('已保存配件')
    load()
  }
  const removePart = async (pid: number) => {
    await window.api.orders.deletePart(pid)
    message.success('已删除')
    load()
  }

  // --- type-specific save ---
  const saveDetail = async () => {
    const v = await detailForm.validateFields()
    if (detailType === '保养') await window.api.orders.saveMaintenance(order!.id, v)
    else if (detailType === '维修') await window.api.orders.saveRepair(order!.id, v)
    else if (detailType === '改装') await window.api.orders.saveModification(order!.id, v)
    message.success('已保存类型信息')
    load()
  }

  // --- photos ---
  const pickPhotos = async (stage: string) => {
    await window.api.images.pickImport({
      orderId: order!.id,
      vehicleId: order!.vehicle_id ?? undefined,
      folder: order!.order_no,
      stage
    })
    message.success('已上传')
    load()
  }

  // --- payment ---
  const openPay = () => {
    payForm.resetFields()
    setPayModal(true)
  }
  const savePay = async () => {
    const v = await payForm.validateFields()
    await window.api.payments.create({
      order_id: order!.id,
      customer_id: order!.customer_id,
      vehicle_id: order!.vehicle_id,
      amount: v.amount,
      method: v.method,
      paid_at: v.paid_at ? dayjs(v.paid_at).format('YYYY-MM-DD HH:mm') : undefined,
      note: v.note
    })
    if (order!.status === '待收款' || order!.status === '待验收') {
      await window.api.orders.complete(order!.id)
    }
    setPayModal(false)
    message.success('已记录收款')
    load()
  }

  if (!order) {
    return (
      <div className="page" style={{ paddingTop: 64 }}>
        <Spin size="large" />
      </div>
    )
  }

  const itemColumns = [
    { title: '项目', dataIndex: 'name' },
    { title: '类型', dataIndex: 'type', render: (v: string | null) => v ?? '-' },
    { title: '说明', dataIndex: 'desc', render: (v: string | null) => v ?? '-' },
    {
      title: '技师',
      dataIndex: 'technician_id',
      render: (v: number | null) => (v != null ? operators.find((o) => o.id === v)?.name ?? '-' : '-')
    },
    { title: '工时费', dataIndex: 'labor_fee', render: (v: number) => `¥${Number(v).toFixed(2)}` },
    { title: '优惠', dataIndex: 'discount', render: (v: number) => `¥${Number(v).toFixed(2)}` },
    { title: '实收', dataIndex: 'actual_fee', render: (v: number) => <span className="money">¥{Number(v).toFixed(2)}</span> },
    {
      title: '操作',
      render: (_: unknown, r: WorkOrderItem) => (
        <Space>
          <a onClick={() => openEditItem(r)}>编辑</a>
          <Popconfirm title="删除该项目？" onConfirm={() => removeItem(r.id)}>
            <a style={{ color: '#cf1322' }}>删除</a>
          </Popconfirm>
        </Space>
      )
    }
  ]

  const partColumns = [
    { title: '配件名称', dataIndex: 'part_name', render: (v: string | null) => v ?? '-' },
    { title: '数量', dataIndex: 'qty' },
    { title: '单价', dataIndex: 'unit_price', render: (v: number) => `¥${Number(v).toFixed(2)}` },
    { title: '优惠', dataIndex: 'discount', render: (v: number) => `¥${Number(v).toFixed(2)}` },
    { title: '小计', dataIndex: 'actual_fee', render: (v: number) => <span className="money">¥{Number(v).toFixed(2)}</span> },
    {
      title: '操作',
      render: (_: unknown, r: WorkOrderPart) => (
        <Space>
          <a onClick={() => openEditPart(r)}>编辑</a>
          <Popconfirm title="删除该配件？" onConfirm={() => removePart(r.id)}>
            <a style={{ color: '#cf1322' }}>删除</a>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Space size="large">
          <h2 style={{ margin: 0 }}>{order.order_no}</h2>
          <Tag color="blue">{order.type}</Tag>
          <Tag color={statusColor[order.status]}> {order.status}</Tag>
        </Space>
        <Space>
          {flow[order.status]?.map((f) => (
            <Button key={f.to} type="primary" onClick={() => changeStatus(f.to)}>
              {f.label}
            </Button>
          ))}
          <Button icon={<PrinterOutlined />} onClick={openPreview}>
            打印
          </Button>
          <Button icon={<FilePdfOutlined />} onClick={openPreview}>
            导出PDF
          </Button>
          <Button icon={<SaveOutlined />} onClick={saveBasic}>
            保存
          </Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={14}>
          <Card title="基本信息" size="small">
            <Form form={basicForm} layout="vertical">
              <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
                <Form.Item name="type" label="类型" style={{ minWidth: 140 }}>
                  <Select options={orderTypes.map((t) => ({ value: t }))} />
                </Form.Item>
                <Form.Item name="customer_id" label="客户" style={{ minWidth: 220 }}>
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    options={customers.map((c) => ({ value: c.id, label: `${c.name}${c.phone ? ` (${c.phone})` : ''}` }))}
                  />
                </Form.Item>
                <Form.Item name="vehicle_id" label="车辆" style={{ minWidth: 220 }}>
                  <Select
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    options={vehicles.map((vc) => ({ value: vc.id, label: `${vc.plate_number ?? '未上牌'} ${vc.brand ?? ''}` }))}
                  />
                </Form.Item>
              </Space>
              <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
                <Form.Item name="shop_time" label="进厂时间" style={{ minWidth: 200 }}>
                  <DatePicker showTime style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item name="to_shop_mileage" label="进厂里程" style={{ minWidth: 150 }}>
                  <InputNumber min={0} style={{ width: '100%' }} />
                </Form.Item>
                <Form.Item
                  name="receptionist"
                  label={
                    <Space size={4}>
                      接待
                      <a onClick={() => openEmployee('receptionist')}>＋新建</a>
                    </Space>
                  }
                  style={{ minWidth: 180 }}
                >
                  <Select allowClear options={operators.map((o) => ({ value: o.name }))} placeholder="选择" />
                </Form.Item>
                <Form.Item
                  name="technicians"
                  label={
                    <Space size={4}>
                      技师
                      <a onClick={() => openEmployee('technicians')}>＋新建</a>
                    </Space>
                  }
                  style={{ minWidth: 220 }}
                >
                  <Select allowClear mode="multiple" options={operators.map((o) => ({ value: o.name }))} placeholder="可多选" />
                </Form.Item>
              </Space>
              <Form.Item name="fault_desc" label="故障描述">
                <Input.TextArea rows={2} />
              </Form.Item>
              <Form.Item name="note" label="备注">
                <Input.TextArea rows={2} />
              </Form.Item>
            </Form>
          </Card>

          {detailType === '保养' && (
            <Card title="保养信息" size="small" style={{ marginTop: 16 }}>
              <Form form={detailForm} layout="vertical">
                <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
                  <Form.Item name="oil_brand" label="机油品牌" style={{ minWidth: 160 }}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="oil_model" label="机油型号" style={{ minWidth: 160 }}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="oil_qty" label="加注量(L)" style={{ minWidth: 140 }}>
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Space>
                <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
                  <Form.Item name="next_maintenance_at" label="下次保养日期" style={{ minWidth: 200 }}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="next_maintenance_km" label="下次保养里程" style={{ minWidth: 150 }}>
                    <InputNumber min={0} style={{ width: '100%' }} />
                  </Form.Item>
                </Space>
                <Button icon={<SaveOutlined />} onClick={saveDetail}>
                  保存保养信息
                </Button>
              </Form>
            </Card>
          )}
          {detailType === '维修' && (
            <Card title="维修信息" size="small" style={{ marginTop: 16 }}>
              <Form form={detailForm} layout="vertical">
                <Form.Item name="fault_code" label="故障码">
                  <Input placeholder="如 P0171" />
                </Form.Item>
                <Form.Item name="diagnosis" label="诊断">
                  <Input.TextArea rows={2} />
                </Form.Item>
                <Form.Item name="plan" label="维修方案">
                  <Input.TextArea rows={2} />
                </Form.Item>
                <Form.Item name="result" label="结果">
                  <Input.TextArea rows={2} />
                </Form.Item>
                <Button icon={<SaveOutlined />} onClick={saveDetail}>
                  保存维修信息
                </Button>
              </Form>
            </Card>
          )}
          {detailType === '改装' && (
            <Card title="改装信息" size="small" style={{ marginTop: 16 }}>
              <Form form={detailForm} layout="vertical">
                <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
                  <Form.Item name="proj_name" label="项目名称" style={{ minWidth: 180 }}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="brand" label="品牌" style={{ minWidth: 150 }}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="model" label="型号" style={{ minWidth: 150 }}>
                    <Input />
                  </Form.Item>
                </Space>
                <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
                  <Form.Item name="serial" label="序列号" style={{ minWidth: 180 }}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="install_date" label="安装日期" style={{ minWidth: 160 }}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="remove_date" label="拆除日期" style={{ minWidth: 160 }}>
                    <Input />
                  </Form.Item>
                  <Form.Item name="status" label="状态" style={{ minWidth: 140 }}>
                    <Select allowClear options={['已安装', '已拆除', '已更换'].map((s) => ({ value: s }))} />
                  </Form.Item>
                </Space>
                <Button icon={<SaveOutlined />} onClick={saveDetail}>
                  保存改装信息
                </Button>
              </Form>
            </Card>
          )}
        </Col>

        <Col span={10}>
          <Card title="费用汇总" size="small">
            <Descriptions column={1} size="small">
              <Descriptions.Item label="工时费">¥{totals.labor.toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label="材料费">¥{totals.parts.toFixed(2)}</Descriptions.Item>
              <Descriptions.Item label={<b>合计</b>}>
                <span className="money" style={{ fontSize: 20 }}>
                  ¥{totals.total.toFixed(2)}
                </span>
              </Descriptions.Item>
            </Descriptions>
            <Button type="primary" block style={{ marginTop: 12 }} icon={<PlusOutlined />} onClick={openPay}>
              记录收款
            </Button>
          </Card>

          <Card title="施工照片" size="small" style={{ marginTop: 16 }}>
            <Space wrap>
              {stageOptions.map((s) => (
                <Button key={s} size="small" icon={<PlusOutlined />} onClick={() => pickPhotos(s)}>
                  {s}
                </Button>
              ))}
            </Space>
            <div className="photo-grid" style={{ marginTop: 12 }}>
              {images.map((im) => (
                <div className="photo-item" key={im.id}>
                  <Image src={imageUrl(im.thumb_path)} preview={{ src: imageUrl(im.rel_path) }} />
                  <Popconfirm title="删除该图片？" onConfirm={async () => { await window.api.images.delete(im.id); message.success('已删除'); load() }}>
                    <Button danger size="small" className="remove" icon={<DeleteOutlined />} />
                  </Popconfirm>
                </div>
              ))}
            </div>
          </Card>

          <Card title="附件（单据 / PDF）" size="small" style={{ marginTop: 16 }}>
            {attachments.length === 0 ? (
              <Empty description="暂无附件" />
            ) : (
              <List
                size="small"
                dataSource={attachments}
                renderItem={(a) => (
                  <List.Item
                    actions={[
                      <a key="open" onClick={() => window.api.attachments.open(a.rel_path)}>
                        打开
                      </a>,
                      <Popconfirm
                        key="del"
                        title="删除该附件？"
                        onConfirm={async () => {
                          await window.api.attachments.delete(a.id)
                          const atts = await window.api.attachments.list(order!.id)
                          setAttachments((atts as Attachment[]) ?? [])
                          message.success('已删除')
                        }}
                      >
                        <a style={{ color: '#cf1322' }}>删除</a>
                      </Popconfirm>
                    ]}
                  >
                    {a.title || a.rel_path}
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Card title="施工项目" size="small" style={{ marginTop: 16 }} extra={<Button icon={<PlusOutlined />} onClick={openNewItem}>新增项目</Button>}>
        <Table rowKey="id" columns={itemColumns} dataSource={order.items} pagination={false} size="small" />
      </Card>

      <Card title="使用配件" size="small" style={{ marginTop: 16 }} extra={<Button icon={<PlusOutlined />} onClick={openNewPart}>新增配件</Button>}>
        <Table rowKey="id" columns={partColumns} dataSource={order.parts} pagination={false} size="small" />
      </Card>

      <Modal open={itemModal} title={editingItem ? '编辑项目' : '新增项目'} onCancel={() => setItemModal(false)} onOk={saveItem} destroyOnClose>
        <Form form={itemForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="* 项目名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="type" label="类型" style={{ minWidth: 160 }}>
            <Select allowClear options={['工时', '保养', '维修', '其他'].map((s) => ({ value: s }))} />
          </Form.Item>
          <Form.Item name="desc" label="说明">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Space size="large">
            <Form.Item name="labor_fee" label="工时费" style={{ minWidth: 150 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="discount" label="优惠" style={{ minWidth: 120 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="technician_id"
              label={
                <Space size={4}>
                  技师
                  <a onClick={() => openEmployee('item-technician')}>＋新建</a>
                </Space>
              }
              style={{ minWidth: 180 }}
            >
              <Select allowClear options={operators.map((o) => ({ value: o.id, label: o.name }))} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal open={partModal} title={editingPart ? '编辑配件' : '新增配件'} onCancel={() => setPartModal(false)} onOk={savePart} destroyOnClose>
        <Form form={partForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="part_id" label="从库存选择（可选）">
            <Select
              allowClear
              showSearch
              optionFilterProp="label"
              placeholder="选择配件自动带出名称/单价"
              onChange={(val) => val && pickPart(val as number)}
              options={partsAll.map((p) => ({ value: p.id, label: `${p.name} (库存${p.stock})` }))}
            />
          </Form.Item>
          {pickedPart && (
            <div style={{ marginBottom: 12, padding: '6px 10px', background: pickedPart.stock <= 0 || stockOver > 0 ? '#fff1f0' : '#f6f8e8', borderRadius: 6, color: pickedPart.stock <= 0 || stockOver > 0 ? '#cf1322' : '#8a7b2a', fontSize: 13 }}>
              当前库存：{pickedPart.stock} {pickedPart.unit ?? ''}
              {pickedPart.stock <= 0 && <span> · 已无库存</span>}
              {pickedPart.stock > 0 && stockOver > 0 && <span> · 超出库存 {stockOver}</span>}
            </div>
          )}
          <Form.Item name="part_name" label="* 配件名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Space size="large">
            <Form.Item name="qty" label="数量" style={{ minWidth: 140 }}>
              <InputNumber min={1} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="unit_price" label="单价" style={{ minWidth: 130 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="discount" label="优惠" style={{ minWidth: 120 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      <Modal open={payModal} title="记录收款" onCancel={() => setPayModal(false)} onOk={savePay} destroyOnClose>
        <Form form={payForm} layout="vertical" style={{ marginTop: 12 }} initialValues={{ method: '现金' }}>
          <Form.Item name="amount" label="* 实收金额" rules={[{ required: true }]}>
            <InputNumber min={0} precision={2} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="method" label="付款方式">
            <Select options={['现金', '微信', '支付宝', '银行卡', '转账', '挂账'].map((m) => ({ value: m }))} />
          </Form.Item>
          <Form.Item name="paid_at" label="收款时间">
            <DatePicker showTime style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal open={empModal} title="添加店内员工" onCancel={() => setEmpModal(false)} onOk={saveEmployee} destroyOnClose>
        <Form form={empForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="* 姓名" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色">
            <Select allowClear options={['店主', '技师', '前台'].map((r) => ({ value: r }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={!!preview}
        title="打印预览"
        width={760}
        onCancel={() => setPreview(null)}
        footer={[
          <Button key="close" onClick={() => setPreview(null)}>
            关闭
          </Button>,
          <Button key="print" icon={<PrinterOutlined />} onClick={previewPrint}>
            打印
          </Button>,
          <Button key="pdf" type="primary" icon={<FilePdfOutlined />} onClick={previewPdf}>
            导出 PDF
          </Button>
        ]}
      >
        {preview && (
          <iframe
            srcDoc={preview.html}
            title="打印预览"
            style={{ width: '100%', height: 620, border: '1px solid #f0f0f0' }}
          />
        )}
      </Modal>
    </div>
  )
}
