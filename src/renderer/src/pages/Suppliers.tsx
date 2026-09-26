import { useEffect, useState } from 'react'
import { Table, Button, Input, Modal, Form, Space, Popconfirm, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import type { Supplier } from '../../../shared/types'

export default function Suppliers(): JSX.Element {
  const [rows, setRows] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editing, setEditing] = useState<Supplier | null>(null)
  const [form] = Form.useForm()

  const load = async (kw?: string) => {
    setLoading(true)
    try {
      setRows(await window.api.suppliers.list(kw))
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
  const openEdit = (r: Supplier) => {
    setEditing(r)
    form.setFieldsValue(r)
    setModalOpen(true)
  }
  const submit = async () => {
    const v = await form.validateFields()
    if (editing) {
      await window.api.suppliers.update(editing.id, v)
      message.success('已保存')
    } else {
      await window.api.suppliers.create(v)
      message.success('已创建')
    }
    setModalOpen(false)
    load(search)
  }
  const remove = async (id: number) => {
    await window.api.suppliers.delete(id)
    message.success('已删除')
    load(search)
  }

  const columns = [
    { title: '名称', dataIndex: 'name' },
    { title: '联系人', dataIndex: 'contact', render: (v: string | null) => v ?? '-' },
    { title: '电话', dataIndex: 'phone', render: (v: string | null) => v ?? '-' },
    { title: '地址', dataIndex: 'address', render: (v: string | null) => v ?? '-' },
    { title: '结账期限', dataIndex: 'last_term', render: (v: string | null) => v ?? '-' },
    {
      title: '操作',
      render: (_: unknown, r: Supplier) => (
        <Space>
          <a onClick={() => openEdit(r)}>编辑</a>
          <Popconfirm title="确认删除该供应商？" onConfirm={() => remove(r.id)}>
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
          placeholder="搜索 名称/联系人/电话"
          allowClear
          style={{ width: 300 }}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onSearch={(v) => load(v)}
          enterButton
        />
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>
          新增供应商
        </Button>
      </div>
      <Table rowKey="id" loading={loading} columns={columns} dataSource={rows} pagination={{ pageSize: 15 }} />

      <Modal
        open={modalOpen}
        title={editing ? '编辑供应商' : '新增供应商'}
        onCancel={() => setModalOpen(false)}
        onOk={submit}
        destroyOnClose
        width={520}
      >
        <Form form={form} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="* 名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="contact" label="联系人" style={{ minWidth: 180 }}>
              <Input />
            </Form.Item>
            <Form.Item name="phone" label="电话" style={{ minWidth: 180 }}>
              <Input />
            </Form.Item>
          </Space>
          <Form.Item name="address" label="地址">
            <Input />
          </Form.Item>
          <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="last_term" label="结账期限" style={{ minWidth: 180 }}>
              <Input />
            </Form.Item>
            <Form.Item name="note" label="备注" style={{ minWidth: 240 }}>
              <Input />
            </Form.Item>
          </Space>
        </Form>
      </Modal>
    </div>
  )
}
