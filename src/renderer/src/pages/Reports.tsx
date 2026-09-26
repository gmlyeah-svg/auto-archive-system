import { useEffect, useState } from 'react'
import { Card, Table, DatePicker, Button, Space, Tabs, message } from 'antd'
import { DownloadOutlined, FileExcelOutlined } from '@ant-design/icons'
import dayjs from 'dayjs'
import type { ReportResult } from '../../../shared/types'
import { csvFromReport, xlsFromReport } from '../lib/printTemplate'

type ReportKey = 'revenue' | 'customer' | 'models' | 'maintenance' | 'inventory'

interface TabDef {
  key: ReportKey
  label: string
  title: string
  needsRange?: boolean
}

const tabs: TabDef[] = [
  { key: 'revenue', label: '营业报表', title: '营业报表（收款）', needsRange: true },
  { key: 'customer', label: '客户分析', title: '客户分析' },
  { key: 'models', label: '车型统计', title: '车型统计' },
  { key: 'maintenance', label: '保养统计', title: '保养项目统计' },
  { key: 'inventory', label: '库存', title: '库存报表' }
]

export default function Reports(): JSX.Element {
  const [active, setActive] = useState<ReportKey>('revenue')
  const [range, setRange] = useState<[dayjs.Dayjs, dayjs.Dayjs]>([dayjs().startOf('month'), dayjs().endOf('month')])
  const [result, setResult] = useState<ReportResult | null>(null)
  const [loading, setLoading] = useState(false)

  const load = async (key: ReportKey, r?: [dayjs.Dayjs, dayjs.Dayjs]) => {
    setLoading(true)
    try {
      let data: ReportResult
      if (key === 'revenue') {
        const rr = r ?? range
        data = await window.api.reports.revenue(rr[0].format('YYYY-MM-DD'), rr[1].format('YYYY-MM-DD'))
      } else if (key === 'customer') data = await window.api.reports.customer()
      else if (key === 'models') data = await window.api.reports.models()
      else if (key === 'maintenance') data = await window.api.reports.maintenance()
      else data = await window.api.reports.inventory()
      setResult(data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load(active)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  const onRange = (v: [dayjs.Dayjs, dayjs.Dayjs] | null) => {
    if (!v) return
    setRange(v)
    load('revenue', v)
  }

  const currentTab = tabs.find((t) => t.key === active)!

  const exportCsv = async () => {
    if (!result) return
    const content = csvFromReport(result, currentTab.title)
    const r = await window.api.export.save(`${currentTab.title}_${dayjs().format('YYYYMMDD')}.csv`, content, [
      { name: 'CSV', extensions: ['csv'] }
    ])
    if (r.ok) message.success(`已导出：${r.path}`)
    else if (r.error !== '已取消') message.error(r.error || '导出失败')
  }
  const exportXls = async () => {
    if (!result) return
    const content = xlsFromReport(result, currentTab.title)
    const r = await window.api.export.save(`${currentTab.title}_${dayjs().format('YYYYMMDD')}.xls`, content, [
      { name: 'Excel', extensions: ['xls'] }
    ])
    if (r.ok) message.success(`已导出：${r.path}`)
    else if (r.error !== '已取消') message.error(r.error || '导出失败')
  }

  return (
    <div className="page">
      <Card
        title="报表中心"
        extra={
          <Space>
            {currentTab.needsRange && result && (
              <DatePicker.RangePicker value={range} allowClear={false} onChange={onRange as never} />
            )}
            <Button icon={<DownloadOutlined />} onClick={exportCsv} disabled={!result}>
              导出 CSV
            </Button>
            <Button icon={<FileExcelOutlined />} onClick={exportXls} disabled={!result}>
              导出 Excel
            </Button>
          </Space>
        }
      >
        <Tabs
          activeKey={active}
          onChange={(k) => setActive(k as ReportKey)}
          items={tabs.map((t) => ({ key: t.key, label: t.label }))}
        />
        <Table
          rowKey={(_r, i) => String(i)}
          loading={loading}
          size="small"
          scroll={{ x: true }}
          pagination={{ pageSize: 20, showTotal: (t) => `共 ${t} 条` }}
          columns={
            result
              ? result.columns.map((c) => ({
                  title: c,
                  dataIndex: c,
                  key: c,
                  render: (v: unknown) => (v == null ? '' : String(v))
                }))
              : []
          }
          dataSource={result?.rows ?? []}
        />
      </Card>
    </div>
  )
}
