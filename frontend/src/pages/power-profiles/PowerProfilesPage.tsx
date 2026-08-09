import { useState } from 'react';
import { Table, Button, Space, Modal, Form, Input, message, Typography, Tag, Select } from 'antd';
import { PlusOutlined, ReloadOutlined, HeatMapOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { powerProfileApi, PowerProfileResponse, HeatmapItem } from '../../api/endpoints';
import dayjs from 'dayjs';

const HOURS = Array.from({ length: 24 }, (_, i) => i);

function HeatmapCell({ value, max }: { value: number; max: number }) {
  const intensity = max > 0 ? value / max : 0;
  const r = Math.round(255 * intensity);
  const b = Math.round(255 * (1 - intensity));
  return <div style={{ width: 28, height: 28, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', backgroundColor: `rgb(${r}, 100, ${b})`, color: intensity > 0.5 ? '#fff' : '#333', fontSize: 10, borderRadius: 2 }} title={`${value.toFixed(2)}`}>{value > 0 ? value.toFixed(0) : ''}</div>;
}

export default function PowerProfilesPage() {
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [hmOpen, setHmOpen] = useState(false);
  const [selected, setSelected] = useState<PowerProfileResponse | null>(null);
  const [hmData, setHmData] = useState<HeatmapItem[]>([]);
  const [hmLoading, setHmLoading] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['power-profiles', page],
    queryFn: () => powerProfileApi.list('', page).then(r => r.data),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => powerProfileApi.delete(id),
    onSuccess: () => { message.success('Удалено'); queryClient.invalidateQueries({ queryKey: ['power-profiles'] }); },
  });

  const createMut = useMutation({
    mutationFn: (v: any) => powerProfileApi.create(v),
    onSuccess: () => { message.success('Создано'); setModalOpen(false); queryClient.invalidateQueries({ queryKey: ['power-profiles'] }); },
  });

  const loadHeatmap = async (p: PowerProfileResponse) => {
    setSelected(p); setHmOpen(true); setHmLoading(true);
    try {
      const from = dayjs().startOf('month').format('YYYY-MM-DD');
      const to = dayjs().endOf('month').format('YYYY-MM-DD');
      const { data: hd } = await powerProfileApi.heatmap(p.id, from, to);
      setHmData(hd.data || []);
    } finally { setHmLoading(false); }
  };

  const renderHeatmap = () => {
    if (!hmData.length) return <Typography.Text type="secondary">Нет данных за текущий месяц</Typography.Text>;
    const dates = [...new Set(hmData.map(d => d.date))].sort();
    const maxVal = Math.max(...hmData.map(d => d.value), 1);
    const map: Record<string, Record<number, number>> = {};
    hmData.forEach(d => { if (!map[d.date]) map[d.date] = {}; map[d.date][d.hour] = d.value; });
    return (
      <div style={{ overflow: 'auto', maxHeight: 600 }}>
        <table style={{ borderCollapse: 'collapse', fontSize: 10 }}>
          <thead><tr><th style={{ padding: 2, position: 'sticky', left: 0, background: '#fff' }}>Дата</th>{HOURS.map(h => <th key={h} style={{ padding: 2, width: 30 }}>{h}</th>)}</tr></thead>
          <tbody>{dates.map(date => <tr key={date}><td style={{ padding: '2px 4px', whiteSpace: 'nowrap', position: 'sticky', left: 0, background: '#fff' }}>{date.slice(5)}</td>{HOURS.map(h => { const v = map[date]?.[h] || 0; return <td key={h} style={{ padding: 0 }}><HeatmapCell value={v} max={maxVal} /></td>; })}</tr>)}</tbody>
        </table>
      </div>
    );
  };

  const columns = [
    { title: 'Код', dataIndex: 'code', width: 100 },
    { title: 'Наименование', dataIndex: 'name', ellipsis: true },
    { title: 'Тип', dataIndex: 'type', width: 110, render: (t: string) => <Tag color={t === 'CONSUMPTION' ? 'green' : 'orange'}>{t}</Tag> },
    { title: 'Знач.', dataIndex: 'valueCount', width: 70 },
    { title: 'Min', dataIndex: 'minValue', width: 80, render: (v: number) => v?.toFixed(2) },
    { title: 'Avg', dataIndex: 'avgValue', width: 80, render: (v: number) => v?.toFixed(2) },
    { title: 'Max', dataIndex: 'maxValue', width: 80, render: (v: number) => v?.toFixed(2) },
    { title: '', width: 150, render: (_: any, r: PowerProfileResponse) => (
      <Space>
        <Button type="link" size="small" icon={<HeatMapOutlined />} onClick={() => loadHeatmap(r)}>Тепловая карта</Button>
        <Button type="link" size="small" danger onClick={() => deleteMut.mutate(r.id)}>Уд.</Button>
      </Space>
    )},
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <Typography.Title level={4} style={{ margin: '0 0 16px' }}>Профили мощности</Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['power-profiles'] })} />
          <Button type="primary" icon={<PlusOutlined />} onClick={() => { form.resetFields(); setModalOpen(true); }}>Добавить</Button>
        </Space>
      </div>

      <Table columns={columns} dataSource={data?.items} loading={isLoading} rowKey="id" size="middle"
        pagination={{ current: page, total: data?.total, pageSize: 20, onChange: setPage, showSizeChanger: false, showTotal: (t) => `Всего: ${t}` }} />

      <Modal title="Новый профиль" open={modalOpen} onCancel={() => setModalOpen(false)} onOk={() => form.submit()}>
        <Form form={form} layout="vertical" onFinish={(v) => createMut.mutate(v)}>
          <Form.Item name="code" label="Код" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="name" label="Наименование" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="Тип" initialValue="CONSUMPTION">
            <Select options={['CONSUMPTION', 'GENERATION', 'LOSS'].map(v => ({ label: v, value: v }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal title={`Тепловая карта: ${selected?.name || ''}`} open={hmOpen} onCancel={() => setHmOpen(false)} footer={null} width={1050} loading={hmLoading}>
        {renderHeatmap()}
      </Modal>
    </div>
  );
}
