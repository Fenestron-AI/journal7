import { useState, useMemo } from 'react';
import { Table, Button, Tag, Typography, Space, Popconfirm, message, Tooltip, Select } from 'antd';
import { CaretRightOutlined, PauseOutlined, DeleteOutlined, CheckCircleOutlined, ExclamationCircleOutlined, MinusCircleOutlined, ClockCircleOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi, LegalDocumentResponse } from '../../api/ai';

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  ACTIVE: { color: 'green', icon: <CheckCircleOutlined />, label: 'Готов' },
  MISSING: { color: 'default', icon: <MinusCircleOutlined />, label: 'Нет файла' },
  PROCESSING: { color: 'blue', icon: <ClockCircleOutlined />, label: 'Обработка' },
  ERROR: { color: 'red', icon: <ExclamationCircleOutlined />, label: 'Ошибка' },
  SUPERSEDED: { color: 'orange', icon: <CheckCircleOutlined />, label: 'Старая ред.' },
};

export default function AiDocumentsPage() {
  const [statusFilter, setStatusFilter] = useState<string | undefined>();
  const [groupFilter, setGroupFilter] = useState<string | undefined>();
  const queryClient = useQueryClient();

  const { data: docs, isLoading } = useQuery({
    queryKey: ['ai-docs', statusFilter],
    queryFn: () => aiApi.listDocuments(statusFilter || undefined),
    refetchInterval: 5000,
  });

  const startMut = useMutation({
    mutationFn: (id: string) => aiApi.startIngest(id),
    onSuccess: () => { message.success('Обработка запущена'); queryClient.invalidateQueries({ queryKey: ['ai-docs'] }); },
    onError: (e: any) => message.error(e.response?.data?.message || 'Ошибка'),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => aiApi.cancelIngest(id),
    onSuccess: () => { message.success('Остановлено'); queryClient.invalidateQueries({ queryKey: ['ai-docs'] }); },
  });

  const deleteMut = useMutation({
    mutationFn: aiApi.deleteDocument,
    onSuccess: () => { message.success('Удалено'); queryClient.invalidateQueries({ queryKey: ['ai-docs'] }); },
  });

  const groups = useMemo(() => {
    const g = new Set<string>();
    docs?.forEach(d => { if (d.metadata?.group) g.add(d.metadata.group); });
    return Array.from(g);
  }, [docs]);

  const filtered = useMemo(() => {
    let result = docs || [];
    if (groupFilter) result = result.filter(d => d.metadata?.group === groupFilter);
    return result;
  }, [docs, groupFilter]);

  const stats = useMemo(() => {
    const s: Record<string, number> = {};
    filtered.forEach(d => { s[d.status] = (s[d.status] || 0) + 1; });
    return s;
  }, [filtered]);

  const columns = [
    {
      title: 'Документ', dataIndex: 'title', ellipsis: true,
      render: (v: string, r: LegalDocumentResponse) => (
        <span>
          <span style={{ color: r.canonical ? '#1677ff' : '#999', fontWeight: r.canonical ? 500 : 400 }}>{v}</span>
          {r.docNumber && <Tag style={{ marginLeft: 6 }}>{r.docNumber}</Tag>}
        </span>
      ),
    },
    { title: 'Редакция', dataIndex: 'revision', width: 110, render: (v: string) => v || '—' },
    {
      title: 'Статус', dataIndex: 'status', width: 120,
      render: (v: string) => {
        const cfg = statusConfig[v] || statusConfig.MISSING;
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    { title: 'Чанки', dataIndex: 'chunkCount', width: 70, align: 'center' as const },
    {
      title: '', width: 100,
      render: (_: any, r: LegalDocumentResponse) => (
        <Space size={0}>
          {r.filePath && r.status !== 'PROCESSING' && (
            <Tooltip title="Обработать">
              <Button type="text" size="small" icon={<CaretRightOutlined />} onClick={() => startMut.mutate(r.id)} />
            </Tooltip>
          )}
          {r.status === 'PROCESSING' && (
            <Tooltip title="Остановить">
              <Button type="text" size="small" icon={<PauseOutlined />} onClick={() => cancelMut.mutate(r.id)} danger />
            </Tooltip>
          )}
          {!r.canonical && (
            <Popconfirm title="Удалить?" onConfirm={() => deleteMut.mutate(r.id)}>
              <Tooltip title="Удалить"><Button type="text" size="small" icon={<DeleteOutlined />} danger /></Tooltip>
            </Popconfirm>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Нормативно-правовая база</Typography.Title>
        <Space>
          <Select placeholder="Группа" allowClear style={{ width: 220 }} value={groupFilter} onChange={setGroupFilter}
            options={groups.map(g => ({ label: g, value: g }))} />
          <Select placeholder="Статус" allowClear style={{ width: 150 }} value={statusFilter} onChange={setStatusFilter}
            options={Object.entries(statusConfig).map(([k, v]) => ({ label: v.label, value: k }))} />
        </Space>
      </div>

      <div style={{ marginBottom: 12, display: 'flex', gap: 16 }}>
        {Object.entries(statusConfig).map(([k, v]) => (
          <Typography.Text key={k} style={{ fontSize: 13, cursor: 'pointer', opacity: statusFilter && statusFilter !== k ? 0.5 : 1 }}
            onClick={() => setStatusFilter(statusFilter === k ? undefined : k)}>
            <Tag color={v.color} icon={v.icon}>{v.label}: {(stats as any)[k] || 0}</Tag>
          </Typography.Text>
        ))}
      </div>

      <Table columns={columns} dataSource={filtered} loading={isLoading} rowKey="id" size="middle"
        pagination={false} scroll={{ y: 'calc(100vh - 300px)' }} />
    </div>
  );
}
