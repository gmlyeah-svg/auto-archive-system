import { useEffect, useState } from 'react'
import {
  Table,
  Button,
  Input,
  Modal,
  Form,
  Select,
  DatePicker,
  Space,
  Tag,
  Popconfirm,
  message
} from 'antd'
import { PlusOutlined, SearchOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { Customer, CustomerStats } from '../../../shared/types'

type Row = Customer & { stats: CustomerStats }

const levelColor: Record<string, string> = {
  普通: 'default',
  银卡: 'blue',
  金卡: 'gold',
  钻石: 'red'
}

export default function Customers(): JSX.Element {
  const [rows, setRows] = useState<Row[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Row | null>(null)
  const [form] = Form.useForm()

  const load = async (kw?: string) => {
    setLoading(true)
    try {
      const list = await window.api.customers.list(kw)
      setRows(list as Row[])
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

  const openEdit = (row: Row) => {
    setEditing(row)
    form.setFieldsValue({
      ...row,
      birthday: row.birthday ? dayjs(row.birthday) : null
    })
    setModalOpen(true)
  }

  const submit = async () => {
    const v = await form.validateFields()
    const payload = {
      ...v,
      birthday: v.birthday ? dayjs(v.birthday).format('YYYY-MM-DD') : null
    }
    if (editing) {
      await window.api.customers.update(editing.id, payload)
      message.success('已保存')
    } else {
      await window.api.customers.create(payload)
      message.success('已创建')
    }
    setModalOpen(false)
    load(search)
  }

  const remove = async (id: number) => {
    await window.api.customers.delete(id)
    message.success('已删除')
    load(search)
  }

  const columns = [
    { title: '姓名', dataIndex: 'name' },
    { title: '手机号', dataIndex: 'phone', render: (v: string | null) => v ?? '-' },
    {
      title: '等级',
      dataIndex: 'stats',
      render: (_: unknown, r: Row) => <Tag color={levelColor[r.stats.level]}>{r.stats.level}</Tag>
    },
    { title: '车辆', dataIndex: 'stats', render: (_: unknown, r: Row) => r.stats.vehicle_count + ' 辆' },
    {
      title: '累计消费',
      dataIndex: 'stats',
      render: (_: unknown, r: Row) => <span className="money">¥{r.stats.total_spent.toFixed(2)}</span>
    },
    { title: '到店次数', dataIndex: 'stats', render: (_: unknown, r: Row) => r.stats.visit_count },
    { title: '最近到店', dataIndex: 'stats', render: (_: unknown, r: Row) => r.stats.last_visit ?? '-' },
    {
      title: '操作',
      render: (_: unknown, r: Row) => (
        <Space>
          <a onClick={() => openEdit(r)}>编辑</a>
          <Popconfirm title="确认删除该客户？" onConfirm={() => remove(r.id)}>
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
          placeholder="搜索 姓名/手机号/车牌"
          allowClear
          style={{ width: 320 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={(v) => load(v)}
          enterButton={<SearchOutlined />}
        />
        <Space>
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
            新增客户
          </Button>
        </Space>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 15 }} />

      <Modal
        open={modalOpen}
        title={editing ? '编辑客户' : '新增客户'}
        onCancel={() => setModalOpen(false)}
        onOk={submit}
        destroyOnClose
        width={560}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="* 姓名" rules={[{ required: true, message: '请输入姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input />
          </Form.Item>
          <Form.Item name="wechat" label="微信">
            <Input />
          </Form.Item>
          <Space size="large">
            <Form.Item name="gender" label="性别" style={{ minWidth: 140 }}>
              <Select allowClear options={[{ value: '男' }, { value: '女' }]} />
            </Form.Item>
            <Form.Item name="birthday" label="生日" style={{ minWidth: 160 }}>
              <DatePicker style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="source" label="来源" style={{ minWidth: 140 }}>
              <Input />
            </Form.Item>
          </Space>
          <Form.Item name="address" label="地址">
            <Input />
          </Form.Item>
          <Form.Item name="tags" label="标签">
            <Input placeholder="如：老客户  vvip" />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
