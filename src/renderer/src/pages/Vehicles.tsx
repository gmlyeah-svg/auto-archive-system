import { useEffect, useState } from 'react'
import { Table, Button, Input, Modal, Form, Space, Popconfirm, message, InputNumber, Select } from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { Customer, Vehicle } from '../../../shared/types'

export default function Vehicles(): JSX.Element {
  const navigate = useNavigate()
  const [rows, setRows] = useState<Vehicle[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [customers, setCustomers] = useState<Customer[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Vehicle | null>(null)
  const [form] = Form.useForm()

  const load = async (kw?: string) => {
    setLoading(true)
    try {
      const list = await window.api.vehicles.list(kw)
      setRows(list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
    window.api.customers.list().then((c) => setCustomers((c as Customer[]) ?? []))
  }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    setModalOpen(true)
  }

  const openEdit = (row: Vehicle) => {
    setEditing(row)
    form.setFieldsValue(row)
    setModalOpen(true)
  }

  const submit = async () => {
    const v = await form.validateFields()
    if (editing) {
      await window.api.vehicles.update(editing.id, v)
      message.success('已保存')
    } else {
      await window.api.vehicles.create(v)
      message.success('已创建')
    }
    setModalOpen(false)
    load(search)
  }

  const remove = async (id: number) => {
    await window.api.vehicles.delete(id)
    message.success('已删除')
    load(search)
  }

  const columns = [
    {
      title: '车牌',
      dataIndex: 'plate_number',
      render: (v: string | null) => (v ? <span style={{ fontWeight: 600 }}>{v}</span> : '-')
    },
    {
      title: '品牌/车型',
      render: (_: unknown, r: Vehicle) => `${r.brand ?? ''} ${r.model ?? ''}`.trim() || '-'
    },
    { title: '年份', dataIndex: 'year', render: (v: string | null) => v ?? '-' },
    { title: '颜色', dataIndex: 'color', render: (v: string | null) => v ?? '-' },
    {
      title: '里程(km)',
      dataIndex: 'current_mileage',
      render: (v: number | null) => (v != null ? v.toLocaleString() : '-')
    },
    {
      title: '车主',
      dataIndex: 'customer_id',
      render: (id: number | null) => (id != null ? (customers.find((c) => c.id === id)?.name ?? '-') : '-')
    },
    {
      title: '操作',
      render: (_: unknown, r: Vehicle) => (
        <Space>
          <a onClick={() => navigate(`/vehicles/${r.id}`)}>档案</a>
          <a onClick={() => openEdit(r)}>编辑</a>
          <Popconfirm title="确认删除该车辆？" onConfirm={() => remove(r.id)}>
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
          placeholder="搜索 车牌/品牌/车型/VIN"
          allowClear
          style={{ width: 320 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={(v) => load(v)}
          enterButton={<SearchOutlined />}
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增车辆
        </Button>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 15 }} />

      <Modal
        open={modalOpen}
        title={editing ? '编辑车辆' : '新增车辆'}
        onCancel={() => setModalOpen(false)}
        onOk={submit}
        destroyOnClose
        width={640}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="plate_number" label="车牌号" style={{ minWidth: 180 }}>
              <Input />
            </Form.Item>
            <Form.Item name="brand" label="品牌" style={{ minWidth: 150 }}>
              <Input />
            </Form.Item>
            <Form.Item name="model" label="车型" style={{ minWidth: 160 }}>
              <Input />
            </Form.Item>
          </Space>
          <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="year" label="年份" style={{ minWidth: 120 }}>
              <Input />
            </Form.Item>
            <Form.Item name="color" label="颜色" style={{ minWidth: 120 }}>
              <Input />
            </Form.Item>
            <Form.Item name="vin" label="VIN" style={{ minWidth: 200 }}>
              <Input />
            </Form.Item>
          </Space>
          <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="engine" label="发动机" style={{ minWidth: 140 }}>
              <Input />
            </Form.Item>
            <Form.Item name="transmission" label="变速箱" style={{ minWidth: 140 }}>
              <Input />
            </Form.Item>
            <Form.Item name="displacement" label="排量" style={{ minWidth: 120 }}>
              <Input />
            </Form.Item>
            <Form.Item name="drive_type" label="驱动" style={{ minWidth: 120 }}>
              <Input />
            </Form.Item>
          </Space>
          <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="current_mileage" label="当前里程(km)" style={{ minWidth: 170 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="customer_id" label="车主" style={{ minWidth: 180 }}>
              <SelectCustomer options={customers} />
            </Form.Item>
          </Space>
          <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="insurance_expire" label="保险到期" style={{ minWidth: 170 }}>
              <Input />
            </Form.Item>
            <Form.Item name="inspection_expire" label="年检到期" style={{ minWidth: 170 }}>
              <Input />
            </Form.Item>
            <Form.Item name="last_maintenance_date" label="上次保养" style={{ minWidth: 170 }}>
              <Input />
            </Form.Item>
            <Form.Item name="last_maintenance_km" label="保养里程" style={{ minWidth: 150 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}

function SelectCustomer({ options }: { options: Customer[] }): JSX.Element {
  return (
    <Select
      allowClear
      showSearch
      optionFilterProp="label"
      options={options.map((o) => ({ value: o.id, label: `${o.name}${o.phone ? ` (${o.phone})` : ''}` }))}
    />
  )
}
