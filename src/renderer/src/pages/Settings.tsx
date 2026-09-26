import { useEffect, useState } from 'react'
import { Card, Form, Input, InputNumber, Button, message, Typography, Table, Space, Modal, Select, Popconfirm } from 'antd'
import { PlusOutlined } from '@ant-design/icons'

interface OperatorRow {
  id: number
  name: string
  role: string | null
}

const roles = ['店主', '技师', '前台']

export default function Settings(): JSX.Element {
  const [form] = Form.useForm()
  const [dataDir, setDataDir] = useState('')
  const [operators, setOperators] = useState<OperatorRow[]>([])
  const [opModal, setOpModal] = useState(false)
  const [editingOp, setEditingOp] = useState<OperatorRow | null>(null)
  const [opForm] = Form.useForm()

  const loadOperators = () => window.api.operators.list().then((list) => setOperators((list as OperatorRow[]) ?? []))

  useEffect(() => {
    window.api.app.getDataDir().then(setDataDir)
    window.api.settings.get().then((s) => {
      form.setFieldsValue({
        shop_name: s.shop_name ?? '',
        remind_advance_days: s.remind_advance_days ? Number(s.remind_advance_days) : 3
      })
    })
    loadOperators()
  }, [form])

  const save = async () => {
    const v = await form.validateFields()
    await window.api.settings.set('shop_name', v.shop_name ?? '')
    await window.api.settings.set('remind_advance_days', String(v.remind_advance_days ?? 3))
    message.success('已保存')
  }

  const openOpCreate = () => {
    setEditingOp(null)
    opForm.resetFields()
    setOpModal(true)
  }
  const openOpEdit = (r: OperatorRow) => {
    setEditingOp(r)
    opForm.setFieldsValue(r)
    setOpModal(true)
  }
  const saveOp = async () => {
    const v = await opForm.validateFields()
    if (editingOp) {
      await window.api.operators.update(editingOp.id, v)
      message.success('已保存')
    } else {
      await window.api.operators.create(v)
      message.success('已创建')
    }
    setOpModal(false)
    loadOperators()
  }
  const removeOp = async (id: number) => {
    await window.api.operators.delete(id)
    message.success('已删除')
    loadOperators()
  }

  return (
    <div className="page">
      <Card title="系统设置" style={{ maxWidth: 520 }}>
        <Form form={form} layout="vertical">
          <Form.Item name="shop_name" label="店铺名称">
            <Input />
          </Form.Item>
          <Form.Item name="remind_advance_days" label="到期提前提醒天数" extra="保养/保险/年检到期前 N 天开始提醒（默认 3 天）">
            <InputNumber min={0} max={90} style={{ width: 160 }} />
          </Form.Item>
        </Form>
        <Button type="primary" onClick={save}>
          保存设置
        </Button>
      </Card>

      <Card
        title="技师 / 操作人"
        style={{ maxWidth: 520, marginTop: 16 }}
        extra={
          <Button size="small" icon={<PlusOutlined />} onClick={openOpCreate}>
            新增
          </Button>
        }
      >
        <Table
          rowKey="id"
          size="small"
          pagination={false}
          columns={[
            { title: '名称', dataIndex: 'name' },
            { title: '角色', dataIndex: 'role', render: (v: string | null) => v ?? '-' },
            {
              title: '操作',
              render: (_: unknown, r: OperatorRow) => (
                <Space>
                  <a onClick={() => openOpEdit(r)}>编辑</a>
                  <Popconfirm title="确认删除？" onConfirm={() => removeOp(r.id)}>
                    <a style={{ color: '#cf1322' }}>删除</a>
                  </Popconfirm>
                </Space>
              )
            }
          ]}
          dataSource={operators}
        />
      </Card>

      <Card title="数据目录" style={{ maxWidth: 520, marginTop: 16 }}>
        <Typography.Text type="secondary">当前数据目录</Typography.Text>
        <div style={{ margin: '8px 0 16px', fontWeight: 600 }}>{dataDir}</div>
        <Typography.Text type="secondary">
          说明：整个数据目录（archive.db + images + attachments）即为全部数据，拷贝或备份该文件夹即可带走整套数据。
        </Typography.Text>
      </Card>

      <Modal open={opModal} title={editingOp ? '编辑操作人' : '新增操作人'} onCancel={() => setOpModal(false)} onOk={saveOp} destroyOnClose>
        <Form form={opForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="* 名称" rules={[{ required: true }]}>
            <Input />
          </Form.Item>
          <Form.Item name="role" label="角色">
            <Select allowClear options={roles.map((r) => ({ value: r }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  )
}
