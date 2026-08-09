import { useState, useMemo } from 'react';
import { Table, Button, Tag, Typography, Space, Popconfirm, message, Tooltip, Collapse, Progress } from 'antd';
import { CaretRightOutlined, PauseOutlined, DeleteOutlined, CheckCircleOutlined, ExclamationCircleOutlined, MinusCircleOutlined, ClockCircleOutlined, DownloadOutlined, CloudDownloadOutlined, LoadingOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi, LegalDocumentResponse } from '../../api/ai';

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  ACTIVE: { color: 'green', icon: <CheckCircleOutlined />, label: 'Готов' },
  MISSING: { color: 'default', icon: <MinusCircleOutlined />, label: 'Нет файла' },
  DOWNLOADING: { color: 'cyan', icon: <CloudDownloadOutlined />, label: 'Скачивание' },
  DOWNLOADED: { color: 'geekblue', icon: <DownloadOutlined />, label: 'Скачан' },
  PROCESSING: { color: 'blue', icon: <LoadingOutlined spin />, label: 'Обработка' },
  ERROR: { color: 'red', icon: <ExclamationCircleOutlined />, label: 'Ошибка' },
  SUPERSEDED: { color: 'orange', icon: <CheckCircleOutlined />, label: 'Старая ред.' },
};

export default function AiDocumentsPage() {
  const queryClient = useQueryClient();

  const { data: docs, isLoading } = useQuery({
    queryKey: ['ai-docs'],
    queryFn: () => aiApi.listDocuments(),
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

  const downloadAllMut = useMutation({
    mutationFn: async () => {
      await aiApi.downloadAll();
      message.success('Загрузка запущена');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['ai-docs'] }),
  });

  const grouped = useMemo(() => {
    const g: Record<string, LegalDocumentResponse[]> = {};
    (docs || []).forEach(d => {
      const grp = d.metadata?.group || 'Прочее';
      if (!g[grp]) g[grp] = [];
      g[grp].push(d);
    });
    const order = ['Федеральные законы Российской Федерации', 'Постановления Правительства РФ', 'Документы Минэнерго', 'Документы ФАС и ФСТ', 'Архив', 'Прочее'];
    const sorted: Record<string, LegalDocumentResponse[]> = {};
    order.forEach(k => { if (g[k]) sorted[k] = g[k]; });
    Object.keys(g).forEach(k => { if (!sorted[k]) sorted[k] = g[k]; });
    return sorted;
  }, [docs]);

  const stats = useMemo(() => {
    const s: Record<string, number> = {};
    (docs || []).filter(d => d.canonical).forEach(d => { s[d.status] = (s[d.status] || 0) + 1; });
    return s;
  }, [docs]);

  const progress = useMemo(() => {
    const done = (stats.ACTIVE || 0) + (stats.DOWNLOADED || 0);
    const inProgress = (stats.DOWNLOADING || 0) + (stats.PROCESSING || 0);
    const total = (docs || []).filter(d => d.canonical).length;
    return total > 0 ? Math.round(((done + inProgress * 0.5) / total) * 100) : 0;
  }, [stats, docs]);

  const columns = [
    {
      title: 'Документ', dataIndex: 'title', ellipsis: true,
      render: (v: string, r: LegalDocumentResponse) => (
        <a onClick={() => {
          const url = r.metadata?.url;
          if (url) window.open(url, '_blank');
        }} style={{ fontWeight: r.canonical ? 500 : 400 }}>
          {v}
          {r.docNumber && <Tag style={{ marginLeft: 6 }}>{r.docNumber}</Tag>}
        </a>
      ),
    },
    { title: 'Редакция', dataIndex: 'revision', width: 110, render: (v: string) => v || '—' },
    {
      title: 'Статус', dataIndex: 'status', width: 130,
      render: (v: string) => {
        const cfg = statusConfig[v] || statusConfig.MISSING;
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    { title: 'Чанки', dataIndex: 'chunkCount', width: 70, align: 'center' as const },
    {
      title: '', width: 60,
      render: (_: any, r: LegalDocumentResponse) => (
        <Space size={0}>
          {r.status === 'DOWNLOADED' && (
            <Tooltip title="Обработать">
              <Button type="text" size="small" icon={<CaretRightOutlined />} onClick={() => startMut.mutate(r.id)} />
            </Tooltip>
          )}
          {r.status === 'DOWNLOADING' && (
            <Tag color="cyan" style={{ margin: 0 }}>...</Tag>
          )}
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Нормативно-правовая база</Typography.Title>
        <Space>
          <Button type="primary" icon={<CloudDownloadOutlined />} loading={downloadAllMut.isPending}
            onClick={() => downloadAllMut.mutate()}>
            Скачать все ({stats.MISSING || 0})
          </Button>
        </Space>
      </div>
      <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 12 }}>
        <a href="https://www.so-ups.ru/functioning/laws/" target="_blank" rel="noopener noreferrer">so-ups.ru/functioning/laws/</a>
        {' | '}
        {Object.entries(stats).map(([k, v]) => {
          const cfg = statusConfig[k] || { color: 'default', label: k };
          return <Tag key={k} color={cfg.color as any} style={{ cursor: 'pointer' }}>{cfg.label}: {v}</Tag>;
        })}
      </Typography.Paragraph>
      <Progress percent={progress} size="small" style={{ marginBottom: 16 }}
        format={() => `${progress}%`} />

      <Collapse defaultActiveKey={Object.keys(grouped)} size="small" style={{ background: '#fff' }}
        items={Object.entries(grouped).map(([group, items]) => ({
          key: group,
          label: (
            <Space>
              <Typography.Text strong>{group}</Typography.Text>
              <Typography.Text type="secondary">({items.length})</Typography.Text>
              {items.filter(d => d.status === 'ACTIVE').length > 0 && <Tag color="green">✓ {items.filter(d => d.status === 'ACTIVE').length}</Tag>}
              {items.filter(d => d.status === 'DOWNLOADING').length > 0 && <Tag color="cyan">↓ {items.filter(d => d.status === 'DOWNLOADING').length}</Tag>}
            </Space>
          ),
          children: (
            <Table columns={columns} dataSource={items} rowKey="id" size="small" pagination={false}
              loading={isLoading} showHeader={false} />
          ),
        }))} />
    </div>
  );
}
