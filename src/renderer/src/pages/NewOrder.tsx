import { useEffect, useState } from 'react'
import { Card, Form, Select, Input, DatePicker, InputNumber, Button, Space, Modal, message } from 'antd'
import { PlusOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import { useNavigate, useSearchParams } from 'react-router-dom'
import type { Customer, Vehicle } from '../../../shared/types'

const orderTypes = ['保养', '维修', '改装', '检查']

export default function NewOrder(): JSX.Element {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [form] = Form.useForm()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [operators, setOperators] = useState<Array<{ id: number; name: string; role: string | null }>>([])
  // 员工快速建档
  const [empModal, setEmpModal] = useState(false)
  const [empForm] = Form.useForm()

  const openEmployee = () => {
    empForm.resetFields()
    setEmpModal(true)
  }
  const saveEmployee = async () => {
    const v = await empForm.validateFields()
    const id = await window.api.operators.create(v)
    const list = await window.api.operators.list()
    setOperators((list as Array<{ id: number; name: string; role: string | null }>) ?? [])
    const name = (list.find((o) => o.id === id) as { name: string } | undefined)?.name ?? v.name
    form.setFieldsValue({ receptionist: name })
    setEmpModal(false)
    message.success('已添加员工')
  }

  // 客户快速建档
  const [customerModal, setCustomerModal] = useState(false)
  const [customerTarget, setCustomerTarget] = useState<'order' | 'vehicle'>('order')
  const [customerForm] = Form.useForm()
  // 车辆快速建档
  const [vehicleModal, setVehicleModal] = useState(false)
  const [vehicleForm] = Form.useForm()

  const reloadCustomers = async () => {
    const list = await window.api.customers.list()
    setCustomers((list as Customer[]) ?? [])
  }
  const reloadVehicles = async () => {
    setVehicles(await window.api.vehicles.list())
  }

  useEffect(() => {
    window.api.vehicles.list().then(setVehicles)
    window.api.customers.list().then((c) => setCustomers((c as Customer[]) ?? []))
    window.api.operators.list().then((o) => setOperators((o as Array<{ id: number; name: string; role: string | null }>) ?? []))
    const vid = params.get('vehicle')
    const cid = params.get('customer')
    if (vid) form.setFieldsValue({ vehicle_id: Number(vid) })
    if (cid && cid !== '') form.setFieldsValue({ customer_id: Number(cid) })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCustomer = (target: 'order' | 'vehicle') => {
    setCustomerTarget(target)
    customerForm.resetFields()
    setCustomerModal(true)
  }
  const saveCustomer = async () => {
    const v = await customerForm.validateFields()
    const id = await window.api.customers.create(v)
    await reloadCustomers()
    const theForm = customerTarget === 'vehicle' ? vehicleForm : form
    theForm.setFieldsValue({ customer_id: id })
    setCustomerModal(false)
    message.success('客户已创建')
  }

  const openVehicle = () => {
    vehicleForm.resetFields()
    setVehicleModal(true)
  }
  const saveVehicle = async () => {
    const v = await vehicleForm.validateFields()
    const id = await window.api.vehicles.create(v)
    await reloadVehicles()
    form.setFieldsValue({ vehicle_id: id })
    setVehicleModal(false)
    message.success('车辆已创建')
  }

  const submit = async () => {
    const v = await form.validateFields()
    const id = await window.api.orders.create({
      type: v.type,
      customer_id: v.customer_id ?? null,
      vehicle_id: v.vehicle_id ?? null,
      shop_time: v.shop_time ? dayjs(v.shop_time).format('YYYY-MM-DD HH:mm') : undefined,
      due_time: v.due_time ? dayjs(v.due_time).format('YYYY-MM-DD HH:mm') : null,
      to_shop_mileage: v.to_shop_mileage ?? null,
      fault_desc: v.fault_desc ?? null,
      note: v.note ?? null,
      priority: v.priority ?? null,
      receptionist: v.receptionist ?? null,
      status: '草稿'
    })
    navigate(`/orders/${id}`)
  }

  return (
    <div className="page">
      <Card title="新建工单">
        <Form form={form} layout="vertical" style={{ maxWidth: 760 }}>
          <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="type" label="* 工单类型" rules={[{ required: true }]} style={{ minWidth: 160 }}>
              <Select options={orderTypes.map((t) => ({ value: t }))} placeholder="选择类型" />
            </Form.Item>
            <Form.Item
              name="customer_id"
              label={
                <Space size={4}>
                  客户
                  <a onClick={() => openCustomer('order')}>
                    <PlusOutlined /> 新建客户
                  </a>
                </Space>
              }
              style={{ minWidth: 260 }}
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="选择或新建客户"
                options={customers.map((c) => ({ value: c.id, label: `${c.name}${c.phone ? ` (${c.phone})` : ''}` }))}
              />
            </Form.Item>
            <Form.Item
              name="vehicle_id"
              label={
                <Space size={4}>
                  车辆
                  <a onClick={openVehicle}>
                    <PlusOutlined /> 新建车辆
                  </a>
                </Space>
              }
              style={{ minWidth: 260 }}
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                placeholder="选择或新建车辆"
                options={vehicles.map((vc) => ({
                  value: vc.id,
                  label: `${vc.plate_number ?? '未上牌'} ${vc.brand ?? ''} ${vc.model ?? ''}`
                }))}
              />
            </Form.Item>
          </Space>
          <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="shop_time" label="进厂时间" style={{ minWidth: 220 }}>
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="due_time" label="预计交车" style={{ minWidth: 220 }}>
              <DatePicker showTime style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item name="to_shop_mileage" label="进厂里程(km)" style={{ minWidth: 160 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="receptionist"
              label={
                <Space size={4}>
                  接待
                  <a onClick={openEmployee}>＋新建</a>
                </Space>
              }
              style={{ minWidth: 180 }}
            >
              <Select allowClear options={operators.map((o) => ({ value: o.name }))} placeholder="选择" />
            </Form.Item>
          </Space>
          <Form.Item name="fault_desc" label="故障描述">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} />
          </Form.Item>
          <Form.Item>
            <Button type="primary" onClick={submit}>
              创建并进入编辑
            </Button>
          </Form.Item>
        </Form>
      </Card>

      {/* 快速新建客户 */}
      <Modal open={customerModal} title="快速新建客户" onCancel={() => setCustomerModal(false)} onOk={saveCustomer} destroyOnClose>
        <Form form={customerForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="name" label="* 姓名" rules={[{ required: true, message: '请输入客户姓名' }]}>
            <Input />
          </Form.Item>
          <Form.Item name="phone" label="手机号">
            <Input />
          </Form.Item>
          <Space size="large">
            <Form.Item name="gender" label="性别" style={{ minWidth: 150 }}>
              <Select allowClear options={[{ value: '男' }, { value: '女' }]} />
            </Form.Item>
            <Form.Item name="wechat" label="微信" style={{ minWidth: 180 }}>
              <Input />
            </Form.Item>
          </Space>
        </Form>
      </Modal>

      {/* 快速新建车辆 */}
      <Modal open={vehicleModal} title="快速新建车辆" onCancel={() => setVehicleModal(false)} onOk={saveVehicle} destroyOnClose>
        <Form form={vehicleForm} layout="vertical" style={{ marginTop: 12 }}>
          <Form.Item name="plate_number" label="* 车牌号" rules={[{ required: true, message: '请输入车牌号' }]}>
            <Input />
          </Form.Item>
          <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="brand" label="品牌" style={{ minWidth: 150 }}>
              <Input />
            </Form.Item>
            <Form.Item name="model" label="车型" style={{ minWidth: 160 }}>
              <Input />
            </Form.Item>
            <Form.Item name="color" label="颜色" style={{ minWidth: 120 }}>
              <Input />
            </Form.Item>
          </Space>
          <Space size="large" style={{ display: 'flex', flexWrap: 'wrap' }}>
            <Form.Item name="current_mileage" label="当前里程(km)" style={{ minWidth: 170 }}>
              <InputNumber min={0} style={{ width: '100%' }} />
            </Form.Item>
            <Form.Item
              name="customer_id"
              label={
                <Space size={4}>
                  车主
                  <a onClick={() => openCustomer('vehicle')}>
                    <PlusOutlined /> 新建客户
                  </a>
                </Space>
              }
              style={{ minWidth: 260 }}
            >
              <Select
                allowClear
                showSearch
                optionFilterProp="label"
                options={customers.map((c) => ({ value: c.id, label: `${c.name}${c.phone ? ` (${c.phone})` : ''}` }))}
              />
            </Form.Item>
          </Space>
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
    </div>
  )
}
