import { useEffect, useState } from 'react'
import { Table, Button, Input, Modal, Form, Space, Tag, Popconfirm, message, InputNumber } from 'antd'
import { PlusOutlined, ImportOutlined, ExportOutlined } from '@ant-design/icons'
import type { Part, StockTransaction } from '../../../shared/types'

export default function Parts(): JSX.Element {
  const [rows, setRows] = useState<Part[]>([])
  const [loading, setLoading] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Part | null>(null)
  const [form] = Form.useForm()
  const [stockModal, setStockModal] = useState(false)
  const [stockPart, setStockPart] = useState<Part | null>(null)
  const [stockAction, setStockAction] = useState<'in' | 'out' | 'adjust'>('in')
  const [stockForm] = Form.useForm()
  const [txns, setTxns] = useState<StockTransaction[]>([])

  const load = async (kw?: string) => {
    setLoading(true)
    try {
      setRows(await window.api.parts.list(kw))
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }
  const openEdit = (r: Part) => {
    setEditing(r)
    form.setFieldsValue(r)
    setModalOpen(true)
  }
  const submit = async () => {
    const v = await form.validateFields()
    if (editing) {
      await window.api.parts.update(editing.id, v)
      message.success('已保存')
    } else {
      await window.api.parts.create(v)
      message.success('已创建')
    }
    setModalOpen(false)
    load()
  }
  const remove = async (id: number) => {
    await window.api.parts.delete(id)
    message.success('已删除')
    load()
  }

  const openStock = (r: Part, action: 'in' | 'out' | 'adjust') => {
    setStockPart(r)
    setStockAction(action)
    stockForm.resetFields()
    stockForm.setFieldsValue({ qty: action === 'adjust' ? r.stock : 1 })
    setStockModal(true)
  }
  const loadTxns = async (partId: number) => {
    setTxns(await window.api.stock.transactions(partId))
  }
  const submitStock = async () => {
    const v = await stockForm.validateFields()
    if (!stockPart) return
    if (stockAction === 'in') await window.api.stock.inbound(stockPart.id, v.qty, v.refNo, v.note)
    else if (stockAction === 'out') await window.api.stock.outbound(stockPart.id, v.qty, v.refNo, v.note)
    else await window.api.stock.adjust(stockPart.id, v.qty, v.note)
    setStockModal(false)
    message.success('已完成')
    load()
  }

  const columns = [
    { title: '编号', dataIndex: 'part_no', render: (v: string | null) => v ?? '-' },
    { title: '名称', dataIndex: 'name' },
    { title: '分类', dataIndex: 'category', render: (v: string | null) => v ?? '-' },
    { title: '品牌', dataIndex: 'brand', render: (v: string | null) => v ?? '-' },
    { title: '规格', dataIndex: 'spec', render: (v: string | null) => v ?? '-' },
    { title: '单位', dataIndex: 'unit', render: (v: string | null) => v ?? '-' },
    { title: '进价', dataIndex: 'purchase_price', render: (v: number) => `¥${Number(v).toFixed(2)}` },
    { title: '售价', dataIndex: 'sale_price', render: (v: number) => `¥${Number(v).toFixed(2)}` },
    {
      title: '库存',
      dataIndex: 'stock',
      render: (v: number, r: Part) => (
        <Space>
          <span style={{ color: v <= r.min_stock ? '#cf1322' : undefined, fontWeight: 600 }}>{v}</span>
          {v <= r.min_stock && <Tag color="red">低</Tag>}
        </Space>
      )
    },
    { title: '最低', dataIndex: 'min_stock' },
    {
      title: '操作',
      render: (_: unknown, r: Part) => (
        <Space>
          <Button size="small" icon={<ImportOutlined />} onClick={() => openStock(r, 'in')}>
            入库
          </Button>
          <Button size="small" icon={<ExportOutlined />} onClick={() => openStock(r, 'out')}>
            出库
          </Button>
          <a onClick={() => openStock(r, 'adjust')}>盘点</a>
          <a
            onClick={() => {
              loadTxns(r.id)
            }}
          >
            流水
          </a>
          <a onClick={() => openEdit(r)}>编辑</a>
          <Popconfirm title="确认删除？" onConfirm={() => remove(r.id)}>
            <a style={{ color: '#cf1322' }}>删除</a>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Input.Search
          placeholder="搜索 名称/编号/分类/品牌"
          allowClear
          style={{ width: 300 }}
          onSearch={(v) => load(v)}
          enterButton
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增配件
        </Button>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 15 }} scroll={{ x: 1200 }} />

      <Modal
        open={modalOpen}
        title={editing ? '编辑配件' : '新增配件'}
        onCancel={() => setModalOpen(false)}
        onOk={submit}
        destroyOnClose
        width={720}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="part_no" label="编号" style={{ minWidth: 160 }}>
              <Input />
            </Form.Item>
            <Form.Item name="name" label="* 名称" rules={[{ required: true }]} style={{ minWidth: 200 }}>
              <Input />
            </Form.Item>
            <Form.Item name="category" label="分类" style={{ minWidth: 150 }}>
              <Input />
            </Form.Item>
          </Space>
          <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="brand" label="品牌" style={{ minWidth: 140 }}>
              <Input />
            </Form.Item>
            <Form.Item name="model" label="型号" style={{ minWidth: 140 }}>
              <Input />
            </Form.Item>
            <Form.Item name="spec" label="规格" style={{ minWidth: 140 }}>
              <Input />
            </Form.Item>
            <Form.Item name="unit" label="单位" style={{ minWidth: 100 }}>
              <Input />
            </Form.Item>
          </Space>
          <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="purchase_price" label="进货价" style={{ minWidth: 140 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="sale_price" label="销售价" style={{ minWidth: 140 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="stock" label="当前库存" style={{ minWidth: 140 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="min_stock" label="最低库存" style={{ minWidth: 140 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
          <Form.Item name="location" label="存放位置">
            <Input />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        open={stockModal}
        title={`${stockAction === 'in' ? '入库' : stockAction === 'out' ? '出库' : '盘点调整'} - ${stockPart?.name ?? ''}`}
        onCancel={() => setStockModal(false)}
        onOk={submitStock}
        destroyOnClose
      >
        <Form form={stockForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="qty" label={stockAction === 'adjust' ? '目标库存' : '数量'} rules={[{ required: true }]}>
            <InputNumber min={0} style={{ width: '100%' }} />
          </Form.Item>
          {stockAction !== 'adjust' && (
            <Form.Item name="refNo" label="单据号">
              <Input />
            </Form.Item>
          )}
          <Form.Item name="note" label="备注">
            <Input />
          </Form.Item>
        </Form>
        {stockAction !== 'adjust' && (
          <div>
            <div style={{ marginBottom: 8 }}>
              <b>库存流水</b>
            </div>
            <Table
              rowKey="id"
              size="small"
              columns={[
                { title: '时间', dataIndex: 'created_at', render: (v: string) => v?.slice(0, 16) ?? '-' },
                { title: '类型', dataIndex: 'type', render: (v: string) => <Tag>{v}</Tag> },
                { title: '数量', dataIndex: 'qty', render: (v: number) => (v > 0 ? `+${v}` : String(v)) },
                { title: '变动', dataIndex: 'after_stock' }
              ]}
              dataSource={txns}
              pagination={false}
            />
          </div>
        )}
      </Modal>
    </div>
  )
}
