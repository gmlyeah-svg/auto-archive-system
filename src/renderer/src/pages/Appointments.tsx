import { useEffect, useState } from 'react'
import { Table, Button, Input, Modal, Form, Select, DatePicker, Space, Tag, Popconfirm, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Appointment, Customer, Vehicle } from '../../../shared/types'

const statuses = ['待接待', '已到店', '已完成', '已取消', '已爽约']
const statusColor: Record<string, string> = {
  待接待: 'processing',
  已到店: 'blue',
  已完成: 'green',
  已取消: 'default',
  已爽约: 'volcano'
}

export default function Appointments(): JSX.Element {
  const [rows, setRows] = useState<Appointment[]>([])
  const [loading, setLoading] = useState(false)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Appointment | null>(null)
  const [form] = Form.useForm()

  const load = async () => {
    setLoading(true)
    try {
      setRows(await window.api.appointments.list())
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => {
    load()
    window.api.customers.list().then((c) => setCustomers((c as Customer[]) ?? []))
    window.api.vehicles.list().then(setVehicles)
  }, [])

  const openCreate = () => {
    setEditing(null)
    form.resetFields()
    form.setFieldsValue({ status: '待接待' })
    setModalOpen(true)
  }
  const openEdit = (r: Appointment) => {
    setEditing(r)
    form.setFieldsValue({ ...r, date: r.date ? dayjs(r.date) : null })
    setModalOpen(true)
  }
  const submit = async () => {
    const v = await form.validateFields()
    const payload = { ...v, date: v.date ? dayjs(v.date).format('YYYY-MM-DD') : null }
    if (editing) {
      await window.api.appointments.update(editing.id, payload)
      message.success('已保存')
    } else {
      await window.api.appointments.create(payload)
      message.success('已创建')
    }
    setModalOpen(false)
    load()
  }
  const remove = async (id: number) => {
    await window.api.appointments.delete(id)
    message.success('已删除')
    load()
  }

  const columns = [
    {
      title: '日期',
      dataIndex: 'date',
      render: (v: string | null) => v ?? '-'
    },
    { title: '时间', dataIndex: 'time', render: (v: string | null) => v ?? '-' },
    {
      title: '客户',
      dataIndex: 'customer_id',
      render: (id: number | null) => (id != null ? customers.find((c) => c.id === id)?.name ?? '-' : '-')
    },
    {
      title: '车辆',
      dataIndex: 'vehicle_id',
      render: (id: number | null) =>
        id != null ? vehicles.find((v) => v.id === id)?.plate_number ?? '-' : '-'
    },
    { title: '服务类型', dataIndex: 'service_type', render: (v: string | null) => v ?? '-' },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: string | null) => <Tag color={statusColor[v ?? '']}>{v ?? '-'}</Tag>
    },
    {
      title: '操作',
      render: (_: unknown, r: Appointment) => (
        <Space>
          <a onClick={() => openEdit(r)}>编辑</a>
          <Popconfirm title="确认删除该预约？" onConfirm={() => remove(r.id)}>
            <a style={{ color: '#cf1322' }}>删除</a>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'flex-end' }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增预约
        </Button>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 15 }} />

      <Modal
        open={modalOpen}
        title={editing ? '编辑预约' : '新增预约'}
        onCancel={() => setModalOpen(false)}
        onOk={submit}
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="date" label="* 预约日期" rules={[{ required: true }]} style={{ minWidth: 180 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="time" label="时间" style={{ minWidth: 120 }}>
              <Input placeholder="如 14:00" />
            </Form.Item>
            <Form.Item name="duration" label="预计时长" style={{ minWidth: 120 }}>
              <Input />
            </Form.Item>
          </Space>
          <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="customer_id" label="客户" style={{ minWidth: 220 }}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={customers.map((c) => ({ value: c.id, label: `${c.name}${c.phone ? ` (${c.phone})` : ''}` }))}
              />
            </Form.Item>
            <Form.Item name="vehicle_id" label="车辆" style={{ minWidth: 200 }}>
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={vehicles.map((v) => ({ value: v.id, label: `${v.plate_number ?? '未上牌'} ${v.brand ?? ''}` }))}
              />
            </Form.Item>
            <Form.Item name="status" label="状态" style={{ minWidth: 140 }}>
              <Select options={statuses.map((s) => ({ value: s }))} />
            </Form.Item>
          </Space>
          <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="service_type" label="服务类型" style={{ minWidth: 180 }}>
              <Select allowClear options={['保养', '维修', '改装', '检查'].map((s) => ({ value: s }))} />
            </Form.Item>
            <Form.Item name="note" label="备注" style={{ minWidth: 260 }}>
              <Input />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}
