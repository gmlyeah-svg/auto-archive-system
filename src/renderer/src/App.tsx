import { useEffect, useState } from 'react'
import { Layout, Menu, Typography, Button, Space, message } from 'antd'
import {
  DashboardOutlined,
  TeamOutlined,
  CarOutlined,
  FileTextOutlined,
  InboxOutlined,
  SettingOutlined,
  FolderOpenOutlined,
  CloudUploadOutlined,
  BarChartOutlined,
  CalendarOutlined,
  ShopOutlined,
  PlusCircleOutlined,
  FolderOutlined,
  AppstoreOutlined
} from '@ant-design/icons'
import { Routes, Route, useNavigate, useLocation } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import Customers from './pages/Customers'
import Vehicles from './pages/Vehicles'
import VehicleArchive from './pages/VehicleArchive'
import Orders from './pages/Orders'
import OrderDetail from './pages/OrderDetail'
import NewOrder from './pages/NewOrder'
import Parts from './pages/Parts'
import Reports from './pages/Reports'
import Appointments from './pages/Appointments'
import Suppliers from './pages/Suppliers'
import Settings from './pages/Settings'
import ErrorBoundary from './components/ErrorBoundary'

const { Sider, Content, Header } = Layout

const navItems = [
  { key: '/', icon: <DashboardOutlined />, label: '仪表盘' },
  { key: '/orders', icon: <FileTextOutlined />, label: '工单列表' },
  {
    key: 'archive',
    icon: <FolderOutlined />,
    label: '档案',
    children: [
      { key: '/customers', icon: <TeamOutlined />, label: '客户管理' },
      { key: '/vehicles', icon: <CarOutlined />, label: '车辆管理' }
    ]
  },
  {
    key: 'business',
    icon: <AppstoreOutlined />,
    label: '经营',
    children: [
      { key: '/parts', icon: <InboxOutlined />, label: '配件库存' },
      { key: '/reports', icon: <BarChartOutlined />, label: '报表' },
      { key: '/appointments', icon: <CalendarOutlined />, label: '预约' },
      { key: '/suppliers', icon: <ShopOutlined />, label: '供应商' }
    ]
  },
  { key: '/settings', icon: <SettingOutlined />, label: '设置' }
]

function selectedKey(pathname: string): string[] {
  if (pathname.startsWith('/orders')) return ['/orders']
  if (pathname.startsWith('/customers')) return ['/customers']
  if (pathname.startsWith('/vehicles')) return ['/vehicles']
  if (pathname.startsWith('/parts')) return ['/parts']
  if (pathname.startsWith('/reports')) return ['/reports']
  if (pathname.startsWith('/appointments')) return ['/appointments']
  if (pathname.startsWith('/suppliers')) return ['/suppliers']
  if (pathname.startsWith('/settings')) return ['/settings']
  return ['/']
}

export default function App(): JSX.Element {
  const navigate = useNavigate()
  const location = useLocation()
  const [dataDir, setDataDir] = useState('')

  const loadDir = () => window.api.app.getDataDir().then(setDataDir)

  useEffect(() => {
    loadDir()
  }, [])

  const onBackup = async () => {
    const res = await window.api.backup.create()
    if (res.ok) message.success(`备份成功：${res.path}`)
    else if (res.error !== '已取消') message.error(res.error || '备份失败')
  }

  return (
    <Layout style={{ height: '100%' }}>
      <Header
        style={{
          height: 56,
          lineHeight: '56px',
          padding: '0 16px',
          background: '#ffffff',
          borderBottom: '1px solid #f0f0f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}
      >
        <Space size="large">
          <Button type="primary" icon={<PlusCircleOutlined />} onClick={() => navigate('/orders/new')}>
            开单
          </Button>
        </Space>
        <Space>
          <Typography.Text style={{ fontSize: 12, color: '#8c8c8c' }}>数据目录：{dataDir}</Typography.Text>
          <Button size="small" icon={<CloudUploadOutlined />} onClick={onBackup}>
            备份
          </Button>
          <Button
            size="small"
            icon={<FolderOpenOutlined />}
            onClick={async () => {
              const r = await window.api.app.chooseDataDir()
              if (r.ok) {
                message.success(`已切换到数据目录：${r.dir}`)
                setDataDir(r.dir)
              }
            }}
          >
            切换数据目录
          </Button>
        </Space>
      </Header>

      <Layout>
        <Sider
          width={210}
          theme="light"
          style={{ borderRight: '1px solid #f0f0f0' }}
        >
          <Menu
            className="side-menu"
            mode="inline"
            style={{ height: '100%', borderRight: 0 }}
            selectedKeys={selectedKey(location.pathname)}
            onClick={(e) => {
              if (e.key.startsWith('/')) navigate(e.key)
            }}
            items={navItems}
          />
        </Sider>
        <Layout>
          <Content style={{ overflow: 'auto' }}>
            <ErrorBoundary key={location.pathname}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/customers" element={<Customers />} />
                <Route path="/vehicles" element={<Vehicles />} />
                <Route path="/vehicles/:id" element={<VehicleArchive />} />
                <Route path="/orders" element={<Orders />} />
                <Route path="/orders/new" element={<NewOrder />} />
                <Route path="/orders/:id" element={<OrderDetail />} />
                <Route path="/parts" element={<Parts />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/appointments" element={<Appointments />} />
                <Route path="/suppliers" element={<Suppliers />} />
                <Route path="/settings" element={<Settings />} />
              </Routes>
            </ErrorBoundary>
          </Content>
        </Layout>
      </Layout>
    </Layout>
  )
}
