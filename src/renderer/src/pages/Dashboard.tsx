import { useEffect, useState } from 'react'
import { Row, Col, Card, Statistic, List, Tag, Empty, Spin, Space, message, Popconfirm } from 'antd'
import { CarOutlined, FileTextOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import type { DashboardSummary, ReminderItem } from '../../../shared/types'

function reminderTag(m: { status: ReminderItem['status']; days_left: number }): JSX.Element {
  if (m.status === 'overdue') {
    return <Tag color="red">已过期 {Math.abs(m.days_left)} 天</Tag>
  }
  if (m.days_left <= 0) return <Tag color="red">今天到期</Tag>
  return <Tag color="orange">{m.days_left} 天内到期</Tag>
}

export default function Dashboard(): JSX.Element {
  const navigate = useNavigate()
  const [data, setData] = useState<DashboardSummary | null>(null)

  const load = () => window.api.dashboard.summary().then(setData)
  useEffect(() => {
    load()
  }, [])

  const ignore = async (ref: string) => {
    await window.api.reminders.ignore(ref)
    message.success('已忽略该提醒')
    load()
  }
  const restore = async () => {
    await window.api.reminders.restore()
    message.success('已恢复被忽略的提醒')
    load()
  }

  if (!data) return <Spin style={{ display: 'block', marginTop: 100 }} />

  const renderRow = (m: ReminderItem & { kind?: string }, actions: React.ReactNode[]) => (
    <List.Item
      onClick={() => navigate(`/vehicles/${m.vehicle_id}`)}
      style={{ cursor: 'pointer' }}
      actions={actions}
    >
      <Space>
        <span>
          <CarOutlined /> {m.plate_number ?? '未上牌'} - {m.customer_name ?? ''}
          <span style={{ color: '#999', marginLeft: 8 }}>{m.at}</span>
        </span>
        {m.kind && <Tag color={m.kind === '保险' ? 'red' : 'magenta'}>{m.kind}</Tag>}
        {reminderTag(m)}
      </Space>
    </List.Item>
  )

  const ignoreAction = (ref: string) => [
    <PopconfirmLink key={ref} onConfirm={() => ignore(ref)} />
  ]

  return (
    <div className="page">
      <Row gutter={16}>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic title="本月工单数" value={data.monthOrders} suffix="单" prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic title="今日工单数" value={data.todayOrders} suffix="单" prefix={<FileTextOutlined />} />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic title="本月营收" value={data.monthRevenue} precision={2} prefix="¥" />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic title="今日收款" value={data.todayRevenue} precision={2} prefix="¥" />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={12}>
          <Card title="库存预警" size="small">
            {data.lowStock.length === 0 ? (
              <Empty description="暂无库存预警" />
            ) : (
              <List
                size="small"
                dataSource={data.lowStock}
                renderItem={(p) => (
                  <List.Item>
                    <span>{p.name}</span>
                    <Tag color="red">
                      剩余 {p.stock} {p.unit ?? ''}
                    </Tag>
                  </List.Item>
                )}
              />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card
            title="保养提醒（提前 N 天）"
            size="small"
            extra={<a onClick={restore}>恢复已忽略</a>}
          >
            {data.upcomingMaintenance.length === 0 ? (
              <Empty description="暂无待处理保养" />
            ) : (
              <List
                size="small"
                dataSource={data.upcomingMaintenance}
                renderItem={(m) => renderRow(m, ignoreAction(m.ref))}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={24}>
          <Card title="保险 / 年检到期提醒" size="small" extra={<a onClick={restore}>恢复已忽略</a>}>
            {data.upcomingExpiries.length === 0 ? (
              <Empty description="暂无待处理到期" />
            ) : (
              <List size="small" dataSource={data.upcomingExpiries} renderItem={(m) => renderRow(m, ignoreAction(m.ref))} />
            )}
          </Card>
        </Col>
      </Row>
    </div>
  )
}

function PopconfirmLink({ onConfirm }: { onConfirm: () => void }): JSX.Element {
  return (
    <Popconfirm title="忽略该提醒？" onConfirm={onConfirm}>
      <a onClick={(e) => e.stopPropagation()}>忽略</a>
    </Popconfirm>
  )
}
