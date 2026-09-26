import { useEffect, useState } from 'react'
import {
  Card,
  Descriptions,
  Tag,
  Timeline,
  Button,
  Space,
  Row,
  Col,
  Spin,
  Image,
  Empty,
  Modal,
  message,
  Statistic
} from 'antd'
import { PlusOutlined, DeleteOutlined, CarOutlined } from '@ant-design/icons'
import { useParams, useNavigate } from 'react-router-dom'
import type { VehicleArchive as VehicleArchiveData } from '../../../shared/types'
import { imageUrl } from '../lib/image'

export default function VehicleArchive(): JSX.Element {
  const { id } = useParams()
  const navigate = useNavigate()
  const [data, setData] = useState<VehicleArchiveData | null>(null)
  const [preview, setPreview] = useState<string | null>(null)
  const [images, setImages] = useState<Array<{ id: number; rel_path: string; thumb_path: string | null; note: string | null }>>([])

  const load = async () => {
    const v = await window.api.vehicles.archive(Number(id))
    setData(v)
    if (v) {
      const imgs = await window.api.images.byVehicle(v.vehicle.id)
      setImages(imgs.map((i) => ({ id: i.id, rel_path: i.rel_path, thumb_path: i.thumb_path, note: i.note })))
    }
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const pickImages = async () => {
    if (!data) return
    await window.api.images.pickImport({ vehicleId: data.vehicle.id, folder: 'other' })
    message.success('已导入')
    load()
  }

  const removeImage = async (imageId: number) => {
    await window.api.images.delete(imageId)
    message.success('已删除')
    load()
  }

  if (!data) return <Spin style={{ display: 'block', marginTop: 100 }} />

  const v = data.vehicle

  return (
    <div className="page">
      <div className="page-header" style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Space size="large">
          <h2 style={{ margin: 0 }}>
            <CarOutlined /> {v.plate_number ?? '未上牌'}
          </h2>
          <Tag color="blue">{`${v.brand ?? ''} ${v.model ?? ''}`.trim() || '未知车型'}</Tag>
        </Space>
        <Space>
          <Button
            icon={<PlusOutlined />}
            type="primary"
            onClick={() => navigate(`/orders/new?vehicle=${v.id}&customer=${v.customer_id ?? ''}`)}
          >
            新建工单
          </Button>
          <Button onClick={pickImages}>上传照片</Button>
        </Space>
      </div>

      <Row gutter={16}>
        <Col span={9}>
          <Card title="车辆信息" size="small">
            <Descriptions column={2} size="small">
              <Descriptions.Item label="车牌">{v.plate_number ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="品牌">{v.brand ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="车型">{v.model ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="年份">{v.year ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="颜色">{v.color ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="VIN">{v.vin ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="发动机">{v.engine ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="变速箱">{v.transmission ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="排量">{v.displacement ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="驱动">{v.drive_type ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="当前里程">
                {v.current_mileage != null ? v.current_mileage.toLocaleString() + ' km' : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="车主">
                {data.customer ? data.customer.name : '-'}
              </Descriptions.Item>
              <Descriptions.Item label="上次保养">{v.last_maintenance_date ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="保险到期">{v.insurance_expire ?? '-'}</Descriptions.Item>
              <Descriptions.Item label="年检到期">{v.inspection_expire ?? '-'}</Descriptions.Item>
            </Descriptions>
          </Card>

          <Card title="消费统计" size="small" style={{ marginTop: 16 }}>
            <Row gutter={16}>
              <Col span={8}>
                <Statistic title="工单数" value={data.stats.order_count} />
              </Col>
              <Col span={8}>
                <Statistic title="累计消费" value={data.stats.total_spent} precision={2} prefix="¥" />
              </Col>
              <Col span={8}>
                <Statistic title="最近到店" value={data.stats.last_visit ? data.stats.last_visit.slice(0, 10) : '-'} />
              </Col>
            </Row>
          </Card>
        </Col>

        <Col span={15}>
          <Card title="车辆时间轴" size="small">
            {data.timeline.length === 0 ? (
              <Empty description="暂无记录" />
            ) : (
              <Timeline
                items={data.timeline.map((t) => ({
                  key: `${t.type}-${t.at}-${t.order_id ?? ''}`,
                  color: t.type === 'work_order' ? (t.status === '已完成' ? 'green' : 'blue') : 'orange',
                  children: (
                    <div>
                      <Space>
                        {t.type === 'work_order' ? (
                          <a onClick={() => navigate(`/orders/${t.order_id}`)}>{t.title}</a>
                        ) : (
                          <span>{t.title}</span>
                        )}
                      </Space>
                      <div style={{ fontSize: 12, color: '#999' }}>
                        {t.at.slice(0, 10)} · {t.status ?? ''} {t.subtitle ?? ''}
                      </div>
                      {t.type === 'image' && t.image_thumb_path && (
                        <img
                          src={imageUrl(t.image_thumb_path)}
                          className="timeline-image"
                          onClick={() => setPreview(imageUrl(t.image_rel_path || t.image_thumb_path))}
                        />
                      )}
                    </div>
                  )
                }))}
              />
            )}
          </Card>

          <Card title="图片库" size="small" style={{ marginTop: 16 }}>
            {images.length === 0 ? (
              <Empty description="暂无图片" />
            ) : (
              <div className="photo-grid">
                {images.map((im) => (
                  <div className="photo-item" key={im.id}>
                    <Image src={imageUrl(im.thumb_path)} preview={{ src: imageUrl(im.rel_path) }} />
                    <Button
                      danger
                      size="small"
                      className="remove"
                      icon={<DeleteOutlined />}
                      onClick={() => removeImage(im.id)}
                    />
                  </div>
                ))}
              </div>
            )}
          </Card>
        </Col>
      </Row>

      <Modal open={!!preview} footer={null} onCancel={() => setPreview(null)} width={720}>
        {preview && <img src={preview} style={{ width: '100%' }} />}
      </Modal>
    </div>
  )
}
