import { useState, useMemo, useEffect } from 'react';
import { Table, Button, Tag, Typography, Space, Popconfirm, message, Tooltip, Collapse, Badge, Modal } from 'antd';
import { RobotOutlined, PauseOutlined, PauseCircleOutlined, DeleteOutlined, CheckCircleOutlined, ExclamationCircleOutlined, MinusCircleOutlined, ClockCircleOutlined, DownloadOutlined, CloudDownloadOutlined, LoadingOutlined, SyncOutlined, FilePdfOutlined, FileTextOutlined, HistoryOutlined, ApartmentOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi, LegalDocumentResponse } from '../../api/ai';
import MarketScheme from '../../components/MarketScheme';

const statusConfig: Record<string, { color: string; icon: React.ReactNode; label: string }> = {
  ACTIVE: { color: 'green', icon: <CheckCircleOutlined />, label: 'Готов' },
  MISSING: { color: 'default', icon: <MinusCircleOutlined />, label: 'Нет файла' },
  DOWNLOADING: { color: 'cyan', icon: <CloudDownloadOutlined />, label: 'Загрузка' },
  DOWNLOADED: { color: 'geekblue', icon: <DownloadOutlined />, label: 'Завершено' },
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
  const [schemeOpen, setSchemeOpen] = useState(false);
  const [autoResumed, setAutoResumed] = useState(false);
  const [optimisticPaused, setOptimisticPaused] = useState<boolean | null>(null);
  const [syncJustClicked, setSyncJustClicked] = useState(false);

  const { data: docs, isLoading } = useQuery({
    queryKey: ['ai-docs'],
    queryFn: () => aiApi.listDocuments(),
    refetchInterval: (query) => query.state.data?.some((d: any) => d.status === 'DOWNLOADING') ? 3000 : 10000,
  });

  const { data: activity } = useQuery({
    queryKey: ['ai-activity'],
    queryFn: () => aiApi.activity(),
    refetchInterval: 5000,
  } as any);

  const { data: syncStatus } = useQuery({
    queryKey: ['ai-sync-status'],
    queryFn: () => aiApi.getSyncStatus(),
    refetchInterval: 3000,
  });

  const syncActive = (docs || []).some(d => d.status === 'DOWNLOADING');
  const serverPaused = syncStatus?.paused ?? false;
  const isPaused = optimisticPaused !== null ? optimisticPaused : serverPaused;
  const isSyncing = syncActive || syncJustClicked;
  const syncIdle = !(docs || []).some(d => d.status === 'MISSING' || d.status === 'DOWNLOADING') && !isPaused;

  useEffect(() => {
    if (syncActive) setSyncJustClicked(false);
  }, [syncActive]);

  useEffect(() => {
    if (optimisticPaused !== null && syncStatus && syncStatus.paused === optimisticPaused) {
      setOptimisticPaused(null);
    }
  }, [syncStatus, optimisticPaused]);

  useEffect(() => {
    if (syncStatus && !autoResumed) {
      if (syncStatus.paused) resumeSyncMut.mutate();
      setAutoResumed(true);
    }
  }, [syncStatus]);

  const syncMut = useMutation({
    mutationFn: () => aiApi.sync(),
    onMutate: () => setSyncJustClicked(true),
    onSettled: () => {
      setSyncJustClicked(false);
      queryClient.invalidateQueries({ queryKey: ['ai-docs'] });
    },
    onError: () => message.error('Не удалось запустить синхронизацию'),
  });

  const pauseSyncMut = useMutation({
    mutationFn: () => aiApi.pauseSync(),
    onMutate: () => setOptimisticPaused(true),
    onError: () => {
      setOptimisticPaused(null);
      message.error('Не удалось остановить');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['ai-sync-status'] }),
  });

  const resumeSyncMut = useMutation({
    mutationFn: () => aiApi.resumeSync(),
    onMutate: () => setOptimisticPaused(false),
    onError: () => {
      setOptimisticPaused(null);
      message.error('Не удалось продолжить');
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['ai-sync-status'] }),
  });

  const onSyncClick = () => {
    if (syncMut.isPending || pauseSyncMut.isPending || resumeSyncMut.isPending) return;
    if (isPaused) {
      resumeSyncMut.mutate();
    } else if (syncActive) {
      pauseSyncMut.mutate();
    } else {
      syncMut.mutate();
    }
  };

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
      title: 'Обучение', width: 130,
      render: (_: any, r: LegalDocumentResponse) => (
        <Space size={6}>
          {r.status === 'DOWNLOADED' && (
            <Tooltip title="Обучить AI-агента">
              <Button type="text" size="small"
                icon={<span style={{ display: 'inline-flex' }}>
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="#595959" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 10L12 5 2 10l10 5 10-5z"/>
                    <path d="M6 12v5c0 2 3 3.5 6 2 3 1.5 6 0 6-2v-5"/>
                    <line x1="12" y1="15" x2="12" y2="18"/>
                  </svg>
                </span>}
                onClick={() => startMut.mutate(r.id)}>
                Обучить
              </Button>
            </Tooltip>
          )}
          {r.status === 'PROCESSING' && (
            <span style={{ fontSize: 13, color: '#595959' }}>
              <LoadingOutlined spin /> Изучаю
              <Tooltip title="Остановить">
                <Button type="text" size="small" icon={<PauseOutlined />} onClick={() => cancelMut.mutate(r.id)} danger />
              </Tooltip>
            </span>
          )}
          {r.status === 'ACTIVE' && r.chunkCount > 0 && (
            <span style={{ fontSize: 13, color: '#1677ff' }}>
              <RobotOutlined /> Обучен
            </span>
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>Нормативно-правовая база</Typography.Title>
          <Tooltip title="Схема рынка электроэнергии">
            <Button
              type="text"
              size="small"
              icon={<ApartmentOutlined />}
              onClick={() => setSchemeOpen(true)}
              style={{
                color: '#0d7377',
                background: '#e0f7fa',
                border: '1px solid #80deea',
                borderRadius: 20,
                width: 30,
                height: 30,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: 0,
              }}
            />
          </Tooltip>
        </div>
        <Space>
          {Object.entries(stats).map(([k, v]) => {
            const cfg = statusConfig[k] || { color: 'default' as const, label: k };
            return <Tag key={k} color={cfg.color}>{cfg.label}: {v}</Tag>;
          })}
          <Button
            icon={isPaused
              ? <PauseCircleOutlined />
              : syncIdle
                ? <CheckCircleOutlined style={{ color: '#52c41a' }} />
                : <SyncOutlined spin={isSyncing && !isPaused} />}
            onClick={syncIdle ? undefined : onSyncClick}
            disabled={syncIdle}
            style={{ width: 190 }}>
            {syncIdle ? 'Синхронизировано' : 'Синхронизировать'}
          </Button>
        </Space>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12, flexWrap: 'wrap' }}>
        <Typography.Text type="secondary" style={{ fontSize: 13 }}>
        <a href="https://www.np-sr.ru/ru/regulation/joining/reglaments/" target="_blank" rel="noopener noreferrer">np-sr.ru</a>
        {' (Регламенты ОРЭМ, ДОП)  |  '}
        <a href="https://www.so-ups.ru/functioning/laws/" target="_blank" rel="noopener noreferrer">so-ups.ru</a>
        {' (Технические требования, стандарты СО ЕЭС)  |  '}
        <a href="https://www.atsenergo.ru/" target="_blank" rel="noopener noreferrer">atsenergo.ru</a>
        {' (Торги, ЭП)  |  '}
        <a href="https://cfrenergo.ru/" target="_blank" rel="noopener noreferrer">cfrenergo.ru</a>
        {' (Формы отчетности, инструкции)'}
        </Typography.Text>
      </div>

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

      <Modal title={null} open={schemeOpen} onCancel={() => setSchemeOpen(false)} footer={null} width="95vw"
        style={{ top: 20 }} styles={{ body: { padding: 0, maxHeight: '85vh', overflow: 'auto' } }}>
        <MarketScheme />
      </Modal>
    </div>
  );
}
