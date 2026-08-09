import { useState } from 'react';
import { Table, Button, Input, Space, Modal, Form, message, Typography, Tag, Card, Upload, Select, Spin, Empty } from 'antd';
import { PlusOutlined, SearchOutlined, UploadOutlined, HeatMapOutlined, CheckCircleOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { powerProfileApi, PowerProfileResponse, HeatmapItem } from '../../api/endpoints';
import dayjs from 'dayjs';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function HeatmapCell({ value, max }: { value: number; max: number }) {
  const intensity = max > 0 ? value / max : 0;
  const r = Math.round(255 * intensity);
  const b = Math.round(255 * (1 - intensity));
  return (
    <div style={{
      width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      backgroundColor: `rgb(${r}, 100, ${b})`, color: intensity > 0.5 ? '#fff' : '#333',
      fontSize: 10, borderRadius: 2, cursor: 'pointer',
    }} title={`${value.toFixed(2)}`}>
      {value > 0 ? value.toFixed(0) : ''}
    </div>
  );
}

export default function PowerProfilesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [heatmapOpen, setHeatmapOpen] = useState(false);
  const [selectedProfile, setSelectedProfile] = useState<PowerProfileResponse | null>(null);
  const [hmData, setHmData] = useState<HeatmapItem[]>([]);
  const [hmLoading, setHmLoading] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['power-profiles', search, page],
    queryFn: () => powerProfileApi.list(search, page).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => powerProfileApi.delete(id),
    onSuccess: () => { message.success('Удалено'); queryClient.invalidateQueries({ queryKey: ['power-profiles'] }); },
  });

  const createMutation = useMutation({
    mutationFn: (values: any) => powerProfileApi.create(values),
    onSuccess: () => { message.success('Создано'); setModalOpen(false); queryClient.invalidateQueries({ queryKey: ['power-profiles'] }); },
  });

  const loadHeatmap = async (profile: PowerProfileResponse) => {
    setSelectedProfile(profile); setHeatmapOpen(true); setHmLoading(true);
    try {
      const from = dayjs().startOf('month').format('YYYY-MM-DD');
      const to = dayjs().endOf('month').format('YYYY-MM-DD');
      const { data: hd } = await powerProfileApi.heatmap(profile.id, from, to);
      setHmData(hd.data || []);
    } finally { setHmLoading(false); }
  };

  const renderHeatmap = () => {
    if (hmLoading) return <Spin />;
    if (!hmData.length) return <Empty description="Нет данных за текущий месяц" />;

    const dates = [...new Set(hmData.map(d => d.date))].sort();
    const maxVal = Math.max(...hmData.map(d => d.value), 1);
    const byDateHour: Record<string, Record<number, number>> = {};
    hmData.forEach(d => {
      if (!byDateHour[d.date]) byDateHour[d.date] = {};
      byDateHour[d.date][d.hour] = d.value;
    });

    return (
      <div style={{ overflow: 'auto' }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 10 }}>
          <thead>
            <tr>
              <th style={{ padding: 2, position: 'sticky', left: 0, background: '#fff' }}>Дата</th>
              {HOURS.map(h => <th key={h} style={{ padding: 2, width: 30 }}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {dates.map(date => (
              <tr key={date}>
                <td style={{ padding: '2px 4px', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: '#fff' }}>{date.slice(5)}</td>
                {HOURS.map(h => {
                  const val = byDateHour[date]?.[h] || 0;
                  return <td key={h} style={{ padding: 0 }}><HeatmapCell value={val} max={maxVal} /></td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  const columns = [
    { title: 'Код', dataIndex: 'code', width: 100 },
    { title: 'Наименование', dataIndex: 'name', ellipsis: true },
    { title: 'Тип', dataIndex: 'type', width: 130, render: (t: string) => <Tag>{t === 'CONSUMPTION' ? 'Потребление' : t === 'GENERATION' ? 'Генерация' : 'Потери'}</Tag> },
    { title: 'Ед.', dataIndex: 'unit', width: 60 },
    { title: 'Значений', dataIndex: 'valueCount', width: 80 },
    { title: 'Min', dataIndex: 'minValue', width: 90, render: (v: number) => v?.toFixed(2) },
    { title: 'Max', dataIndex: 'maxValue', width: 90, render: (v: number) => v?.toFixed(2) },
    { title: 'Avg', dataIndex: 'avgValue', width: 90, render: (v: number) => v?.toFixed(2) },
    { title: '', width: 180, render: (_: any, record: PowerProfileResponse) => (
      <Space>
        <Button type="link" size="small" icon={<HeatMapOutlined />} onClick={() => loadHeatmap(record)}>Heatmap</Button>
        <Button type="link" size="small" icon={<UploadOutlined />}>Загрузить</Button>
        <Button type="link" size="small" danger onClick={() => deleteMutation.mutate(record.id)}>Уд.</Button>
      </Space>
    )},
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Профили мощности</Typography.Title>
        <Space>
          <Input prefix={<SearchOutlined />} placeholder="Поиск..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ width: 240 }} allowClear />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>Добавить</Button>
        </Space>
      </div>

      <Table columns={columns} dataSource={data?.items} loading={isLoading} rowKey="id"
        pagination={{ current: page, total: data?.total, pageSize: 20, onChange: setPage }} />

      <Modal title="Новый профиль" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={(v) => createMutation.mutate(v)}>
          <Form.Item name="code" label="Код" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="name" label="Наименование" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="Тип" initialValue="CONSUMPTION">
            <Select options={['CONSUMPTION', 'GENERATION', 'LOSS'].map(v => ({ label: v, value: v }))} />
          </Form.Item>
          <Form.Item name="unit" label="Ед. изм." initialValue="MW"><Input /></Form.Item>
        </Form>
      </Modal>

      <Modal title={`Тепловая карта: ${selectedProfile?.name || ''}`} open={heatmapOpen}
        onCancel={() => setHeatmapOpen(false)} footer={null} width={1100}>
        {renderHeatmap()}
      </Modal>
    </div>
  );
}
