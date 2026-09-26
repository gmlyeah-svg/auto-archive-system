import { useEffect, useState } from 'react'
import { Table, Button, Space, Tag, Select, message, Popconfirm } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { WorkOrder } from '../../../shared/types'

const statuses = ['草稿', '待施工', '施工中', '待验收', '待收款', '已完成', '已取消', '已退款']
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

export default function Orders(): JSX.Element {
  const navigate = useNavigate()
  const [rows, setRows] = useState<WorkOrder[]>([])
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<string | undefined>()

  const load = async (s?: string) => {
    setLoading(true)
    try {
      const list = await window.api.orders.list(s ? { status: s } : undefined)
      setRows(list)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(status)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

  const columns = [
    { title: '工单号', dataIndex: 'order_no', render: (v: string) => <span style={{ fontWeight: 600 }}>{v}</span> },
    { title: '类型', dataIndex: 'type', render: (v: string) => <Tag>{v}</Tag> },
    {
      title: '状态',
      dataIndex: 'status',
      render: (v: string) => <Tag color={statusColor[v]}>{v}</Tag>
    },
    { title: '客户', dataIndex: 'customer_name', render: (v: string | null) => v ?? '-' },
    { title: '车牌', dataIndex: 'vehicle_plate', render: (v: string | null) => v ?? '-' },
    { title: '车辆信息', dataIndex: 'vehicle_info', render: (v: string | null) => v ?? '-' },
    { title: '进厂时间', dataIndex: 'shop_time', render: (v: string | null) => (v ? v.slice(0, 16) : '-') },
    {
      title: '操作',
      render: (_: unknown, r: WorkOrder) => (
        <Space>
          <a onClick={() => navigate(`/orders/${r.id}`)}>查看</a>
          <Popconfirm
            title="确认删除工单？"
            onConfirm={async () => {
              await window.api.orders.delete(r.id)
              message.success('已删除')
              load(status)
            }}
          >
            <a style={{ color: '#cf1322' }}>删除</a>
          </Popconfirm>
        </Space>
      )
    }
  ]

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Space>
          <span>状态：</span>
          <Select
            allowClear
            placeholder="全部"
            style={{ width: 140 }}
            value={status}
            onChange={(v) => setStatus(v)}
            options={statuses.map((s) => ({ value: s }))}
          />
        </Space>
        <Button type="primary" icon={<PlusOutlined />} onClick={() => navigate('/orders/new')}>
          新建工单
        </Button>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 15 }} />
    </div>
  )
}
