import { useState, useMemo, useEffect } from 'react';
import { Table, Button, Tag, Typography, Space, Popconfirm, message, Tooltip, Collapse, Badge } from 'antd';
import { CaretRightOutlined, PauseOutlined, DeleteOutlined, CheckCircleOutlined, ExclamationCircleOutlined, MinusCircleOutlined, ClockCircleOutlined, DownloadOutlined, CloudDownloadOutlined, LoadingOutlined, SyncOutlined, FilePdfOutlined, FileTextOutlined, HistoryOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi, LegalDocumentResponse } from '../../api/ai';

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  ACTIVE: { color: 'green', icon: <CheckCircleOutlined />, label: 'Готов' },
  MISSING: { color: 'default', icon: <MinusCircleOutlined />, label: 'Нет файла' },
  DOWNLOADING: { color: 'cyan', icon: <CloudDownloadOutlined />, label: 'Скачивание' },
  DOWNLOADED: { color: 'geekblue', icon: <DownloadOutlined />, label: 'Скачан' },
  PROCESSING: { color: 'blue', icon: <LoadingOutlined spin />, label: 'Обработка' },
  ERROR: { color: 'red', icon: <ExclamationCircleOutlined />, label: 'Ошибка' },
  OUTDATED: { color: 'orange', icon: <HistoryOutlined />, label: 'Устарела' },
  ARCHIVED: { color: 'default', icon: <HistoryOutlined />, label: 'Архив' },
};

function formatSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

export default function AiDocumentsPage() {
  const queryClient = useQueryClient();

  const { data: docs, isLoading } = useQuery({
    queryKey: ['ai-docs'],
    queryFn: () => aiApi.listDocuments(),
    refetchInterval: 5000,
  });

  const { data: activity } = useQuery({
    queryKey: ['ai-activity'],
    queryFn: () => aiApi.activity(),
    refetchInterval: 5000,
  } as any);

  const syncMut = useMutation({
    mutationFn: async () => {
      await aiApi.sync();
      message.success('Синхронизация запущена');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['ai-docs'] }),
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

  const grouped = useMemo(() => {
    const g: Record<string, LegalDocumentResponse[]> = {};
    (docs || []).forEach(d => {
      const grp = d.metadata?.group || 'Другие файлы';
      if (!g[grp]) g[grp] = [];
      g[grp].push(d);
    });
    const order = [
      'Федеральные законы Российской Федерации',
      'Постановления Правительства РФ',
      'Документы Минэнерго',
      'Документы ФАС и ФСТ',
      'Другие файлы',
      'Архив',
    ];
    const sorted: Record<string, LegalDocumentResponse[]> = {};
    order.forEach(k => { if (g[k]) sorted[k] = g[k]; });
    Object.keys(g).forEach(k => { if (!sorted[k]) sorted[k] = g[k]; });
    return sorted;
  }, [docs]);

  const stats = useMemo(() => {
    const s: Record<string, number> = {};
    (docs || []).filter(d => d.canonical || d.source === 'so-ups.ru').forEach(d => { s[d.status] = (s[d.status] || 0) + 1; });
    return s;
  }, [docs]);

  const columns = [
    {
      title: 'Документ', dataIndex: 'title', ellipsis: true,
      render: (v: string, r: LegalDocumentResponse) => {
        const isArchived = r.status === 'ARCHIVED' || r.status === 'OUTDATED';
        const el = (
          <span style={{ textDecoration: isArchived ? 'line-through' : 'none', color: isArchived ? '#999' : 'inherit' }}>
            {v || r.originalFilename || '—'}
            {r.docNumber && <Tag style={{ marginLeft: 6 }}>{r.docNumber}</Tag>}
          </span>
        );
        if (r.filePath && !isArchived) {
          const filename = r.originalFilename || r.filePath.split('/').pop();
          return <a onClick={() => window.open(`/api/v1/ai/files/${filename}`, '_blank')}>{el}</a>;
        }
        if (r.sourceUrl) return <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer">{el}</a>;
        return el;
      },
    },
    { title: 'Редакция', dataIndex: 'revision', width: 110, render: (v: string) => v || '—' },
    {
      title: 'Размер', dataIndex: 'fileSize', width: 80,
      render: (v: number) => v ? formatSize(v) : '',
    },
    {
      title: 'Статус', dataIndex: 'status', width: 120,
      render: (v: string) => {
        const cfg = statusConfig[v] || statusConfig.MISSING;
        return <Tag color={cfg.color} icon={cfg.icon}>{cfg.label}</Tag>;
      },
    },
    { title: 'Чанки', dataIndex: 'chunkCount', width: 60, align: 'center' as const },
    {
      title: '', width: 50,
      render: (_: any, r: LegalDocumentResponse) => (
        <Space size={0}>
          {r.status === 'DOWNLOADED' && (
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
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Нормативно-правовая база</Typography.Title>
        <Space>
          {Object.entries(stats).map(([k, v]) => {
            const cfg = statusConfig[k] || { color: 'default' as const, label: k };
            return <Tag key={k} color={cfg.color}>{cfg.label}: {v}</Tag>;
          })}
          <Button icon={<SyncOutlined />} loading={syncMut.isPending} onClick={() => syncMut.mutate()}>
            Синхронизировать
          </Button>
        </Space>
      </div>
      <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 12 }}>
        <a href="https://www.so-ups.ru/functioning/laws/" target="_blank" rel="noopener noreferrer">so-ups.ru</a>
        {' | Синхронизация раз в 24 часа. Файлы сохраняются с оригинальными именами.'}
      </Typography.Paragraph>

      <Collapse defaultActiveKey={Object.keys(grouped).filter(k => k !== 'Архив')} size="small" style={{ background: '#fff' }}
        items={Object.entries(grouped).map(([group, items]) => ({
          key: group,
          label: (
            <Space>
              <Typography.Text strong style={{ color: group === 'Архив' ? '#999' : 'inherit' }}>
                {group === 'Архив' ? <><HistoryOutlined /> Архив</> : group}
              </Typography.Text>
              <Typography.Text type="secondary">({items.length})</Typography.Text>
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
