import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { Table, Button, Tag, Typography, message, Tooltip, Modal, Input, Upload, Progress, Switch, Badge, Dropdown, List, Empty } from 'antd';
import { RobotOutlined, PauseOutlined, PauseCircleOutlined, DeleteOutlined, CheckCircleOutlined, ExclamationCircleOutlined, MinusCircleOutlined, CloudDownloadOutlined, DownloadOutlined, LoadingOutlined, HistoryOutlined, InfoCircleOutlined, SearchOutlined, ReloadOutlined, UploadOutlined, InboxOutlined, LinkOutlined, StopOutlined, SwapOutlined, EyeInvisibleOutlined, UndoOutlined, TagOutlined } from '@ant-design/icons';
import type { UploadProps } from 'antd';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi, LegalDocumentResponse, SyncStateResponse, SyncDiff, CATEGORIES } from '../../api/ai';
import MarketScheme from '../../components/MarketScheme';

const { Text, Title } = Typography;
const { Dragger } = Upload;

const formatInfo: Record<string, { color: string; label: string; tooltip: string }> = {
  docx: { color: '#009f4d', label: 'DOCX', tooltip: 'Лучшее качество чанков. Структура глав/статей/таблиц сохраняется.' },
  odt:  { color: '#009f4d', label: 'ODT',  tooltip: 'Открытый формат. Качество как у DOCX.' },
  rtf:  { color: '#d48806', label: 'RTF',  tooltip: 'Среднее качество. Текст чистый, но структура может теряться.' },
  pdf:  { color: '#d48806', label: 'PDF',  tooltip: 'Базовое качество. Колонтитулы, нумерация попадают в чанки.' },
};

function formatSize(bytes: number): string {
  if (!bytes) return '';
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function getFormat(doc: LegalDocumentResponse): string {
  const filename = doc.originalFilename || doc.filePath || '';
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const meta = doc.metadata || {};
  if (meta.preferred_url) {
    const u = meta.preferred_url as string;
    const ue = u.split('.').pop()?.toLowerCase() || '';
    if (ue && formatInfo[ue]) return ue;
  }
  if (ext && formatInfo[ext]) return ext;
  return '';
}

export default function AiDocumentsPage() {
  const queryClient = useQueryClient();
  const [schemeOpen, setSchemeOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<string[]>([]);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadNumber, setUploadNumber] = useState('');
  const [diffsOpen, setDiffsOpen] = useState(false);
  const [urlDoc, setUrlDoc] = useState<LegalDocumentResponse | null>(null);
  const [urlValue, setUrlValue] = useState('');
  const fileRef = useRef<File | null>(null);

  const { data: docs, isLoading } = useQuery({
    queryKey: ['ai-docs'],
    queryFn: () => aiApi.listDocuments(),
    refetchInterval: (query) => query.state.data?.some((d: any) => d.downloadState === 'downloading' || d.processingState === 'processing') ? 3000 : 10000,
  });

  const { data: activity } = useQuery({
    queryKey: ['ai-activity-delta'],
    queryFn: () => aiApi.activity(),
    refetchInterval: 30000,
  });

  const { data: diffs } = useQuery({
    queryKey: ['ai-diffs'],
    queryFn: () => aiApi.getDiffs(),
    refetchInterval: 30000,
  });

  const ackMut = useMutation({
    mutationFn: (ids: string[]) => aiApi.acknowledgeDiffs(ids),
    onSuccess: (res: any) => {
      message.success(res?.acknowledged ? `Подтверждено изменений: ${res.acknowledged}` : 'Нет неподтверждённых изменений');
      queryClient.invalidateQueries({ queryKey: ['ai-diffs'] });
      queryClient.invalidateQueries({ queryKey: ['ai-activity-delta'] });
    },
    onError: () => message.error('Не удалось подтвердить изменения'),
  });

  const { data: syncState, refetch: refetchSyncState } = useQuery({
    queryKey: ['ai-sync-state'],
    queryFn: () => aiApi.getSyncState(),
    refetchInterval: (query) => query.state.data?.running ? 2000 : false,
  });

  const syncRunning = !!syncState?.running;

  const { data: schedulerState } = useQuery({
    queryKey: ['ai-scheduler'],
    queryFn: () => aiApi.getScheduler(),
  });

  const schedulerMut = useMutation({
    mutationFn: (enabled: boolean) => aiApi.setScheduler(enabled),
    onSuccess: (_, enabled) => {
      queryClient.setQueryData(['ai-scheduler'], { enabled });
      message.success(enabled ? 'Автосинк включён' : 'Автосинк выключен');
    },
    onError: () => message.error('Не удалось изменить настройку автосинка'),
  });

  const syncMut = useMutation({
    mutationFn: () => aiApi.sync() as Promise<any>,
    onSuccess: async (data: any) => {
      if (data?.already_running) {
        message.info('Синхронизация уже запущена');
      }
      await refetchSyncState();
    },
    onError: () => message.error('Не удалось обновить каталог'),
  });

  const cancelSyncMut = useMutation({
    mutationFn: () => aiApi.cancelSync(),
    onSuccess: async () => {
      message.info('Остановка синхронизации...');
      await refetchSyncState();
    },
    onError: () => message.error('Не удалось остановить синхронизацию'),
  });

  // Refresh docs when sync finishes
  const prevRunning = useRef<boolean>(false);
  useEffect(() => {
    if (prevRunning.current && !syncRunning) {
      queryClient.invalidateQueries({ queryKey: ['ai-docs'] });
      queryClient.invalidateQueries({ queryKey: ['ai-activity-delta'] });
      queryClient.invalidateQueries({ queryKey: ['ai-diffs'] });
      const res = syncState?.last_result;
      if (res) {
        const details = res.details || [];
        const totalNew = details.reduce((s: number, d: any) => s + (d.new || 0), 0);
        const totalArchived = details.reduce((s: number, d: any) => s + (d.archived || 0), 0);
        if (totalNew > 0 || totalArchived > 0) setDelta({ new: totalNew, archived: totalArchived });
        if (res.sources_synced != null) {
          message.success(res.sources_synced > 0
            ? `Каталог обновлён: ${res.sources_synced} источников`
            : 'Обновлений не найдено');
        }
      }
    }
    prevRunning.current = !!syncRunning;
  }, [syncRunning, syncState, queryClient]);

  const [delta, setDelta] = useState<{ new: number; archived: number } | null>(null);

  // Show delta from activity on first load
  useEffect(() => {
    if (activity && (activity.new > 0 || activity.archived > 0)) {
      setDelta({ new: activity.new, archived: activity.archived });
    }
  }, [activity]);

  const syncActive = (docs || []).some(d => d.downloadState === 'downloading');
  const needDownload = (docs || []).filter(d => d.status === 'TRACKED' && (d.downloadState == null || d.downloadState === 'error')).length;
  const canIngest = (docs || []).filter(d => d.downloadState === 'downloaded' && !d.processingState).length;
  const isDownloadSynced = needDownload === 0 && !syncActive;

  const stats = useMemo(() => {
    const s: Record<string, number> = {};
    (docs || []).forEach(d => {
      if (d.downloadState === 'downloading') s.downloading = (s.downloading || 0) + 1;
      else if (d.downloadState === 'error') s.error = (s.error || 0) + 1;
      else if (d.status === 'INGESTED') s.ingested = (s.ingested || 0) + 1;
      else if (d.status === 'ARCHIVED') s.archived = (s.archived || 0) + 1;
      else if (d.status === 'TRACKED') s.tracked = (s.tracked || 0) + 1;
    });
    return s;
  }, [docs]);

  const filterBySearch = (items: LegalDocumentResponse[]) => {
    if (!search) return items;
    const q = search.toLowerCase();
    return items.filter(d =>
      d.title.toLowerCase().includes(q) ||
      (d.docNumber || '').toLowerCase().includes(q)
    );
  };

  const downloadMut = useMutation({
    mutationFn: () => aiApi.downloadAll(),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['ai-docs'] }),
    onError: () => message.error('Не удалось запустить загрузку'),
  });

  const batchIngestMut = useMutation({
    mutationFn: async () => {
      const toIngest = (docs || []).filter(d => d.downloadState === 'downloaded');
      let done = 0;
      for (const doc of toIngest) {
        try { await aiApi.startIngest(doc.id); done++; } catch (_) { /* continue */ }
      }
      return done;
    },
    onSuccess: (done: number) => {
      if (done > 0) message.success(`Запущено обучение для ${done} документов`);
      queryClient.invalidateQueries({ queryKey: ['ai-docs'] });
    },
    onError: () => message.error('Ошибка при запуске обучения'),
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

  const softDelete = useCallback((id: string) => {
    const docs = queryClient.getQueryData<LegalDocumentResponse[]>(['ai-docs']);
    const doc = docs?.find(d => d.id === id) || null;

    queryClient.setQueryData(['ai-docs'], (old: LegalDocumentResponse[] | undefined) =>
      (old || []).filter(d => d.id !== id)
    );

    const key = `delete-${id}`;
    const timer = setTimeout(async () => {
      try { await aiApi.deleteDocument(id); } catch {
        if (doc) queryClient.setQueryData(['ai-docs'], (old: LegalDocumentResponse[] | undefined) => [doc, ...(old || [])]);
      }
      message.destroy(key);
    }, 5000);

    message.open({
      key,
      content: (
        <span>
          Документ удалён.{' '}
          <a onClick={() => {
            clearTimeout(timer);
            if (doc) queryClient.setQueryData(['ai-docs'], (old: LegalDocumentResponse[] | undefined) => [doc, ...(old || [])]);
            message.destroy(key);
          }} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Отменить</a>
        </span>
      ),
      duration: 5,
    });
  }, [queryClient]);

  const softDeleteBatch = useCallback((ids: string[]) => {
    const docs = queryClient.getQueryData<LegalDocumentResponse[]>(['ai-docs']);
    const removed = (docs || []).filter(d => ids.includes(d.id));

    queryClient.setQueryData(['ai-docs'], (old: LegalDocumentResponse[] | undefined) =>
      (old || []).filter(d => !ids.includes(d.id))
    );

    const key = `delete-batch-${ids.join(',')}`;
    const timer = setTimeout(async () => {
      try {
        await fetch('/api/v1/ai/documents/batch-delete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ids }),
        });
      } catch {
        queryClient.setQueryData(['ai-docs'], (old: LegalDocumentResponse[] | undefined) => [...removed, ...(old || [])]);
      }
      message.destroy(key);
    }, 5000);

    message.open({
      key,
      content: (
        <span>
          Удалено документов: {ids.length}.{' '}
          <a onClick={() => {
            clearTimeout(timer);
            queryClient.setQueryData(['ai-docs'], (old: LegalDocumentResponse[] | undefined) => [...removed, ...(old || [])]);
            message.destroy(key);
          }} style={{ cursor: 'pointer', textDecoration: 'underline' }}>Отменить</a>
        </span>
      ),
      duration: 5,
    });
  }, [queryClient]);

  const forgetBatchMut = useMutation({
    mutationFn: (ids: string[]) => aiApi.forgetDocuments(ids),
    onSuccess: (res: any) => {
      message.success(`Забыто документов: ${res?.forgotten || 0}`);
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ['ai-docs'] });
      queryClient.invalidateQueries({ queryKey: ['ai-activity-delta'] });
    },
    onError: () => message.error('Не удалось забыть документы'),
  });

  const unforgetBatchMut = useMutation({
    mutationFn: (ids: string[]) => aiApi.unforgetDocuments(ids),
    onSuccess: (res: any) => {
      message.success(`Восстановлено документов: ${res?.unforgotten || 0}`);
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ['ai-docs'] });
    },
    onError: () => message.error('Не удалось восстановить документы'),
  });

  const categoryMut = useMutation({
    mutationFn: ({ ids, category }: { ids: string[]; category: string }) => aiApi.setCategory(ids, category),
    onSuccess: (res: any) => {
      message.success(`Категория обновлена у ${res?.updated || 0} документов`);
      setSelected([]);
      queryClient.invalidateQueries({ queryKey: ['ai-docs'] });
    },
    onError: () => message.error('Не удалось обновить категорию'),
  });

  const setUrlMut = useMutation({
    mutationFn: ({ id, url }: { id: string; url: string }) => aiApi.setDocumentUrl(id, url),
    onSuccess: () => {
      message.success('URL указан, файл скачивается');
      setUrlDoc(null);
      setUrlValue('');
      queryClient.invalidateQueries({ queryKey: ['ai-docs'] });
    },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Некорректный URL'),
  });

  const uploadMut = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      if (uploadTitle) form.append('title', uploadTitle);
      if (uploadNumber) form.append('doc_number', uploadNumber);
      if (fileRef.current) form.append('file', fileRef.current);
      const resp = await fetch('/api/v1/ai/upload', { method: 'POST', body: form });
      return resp.json();
    },
    onSuccess: () => {
      message.success('Файл загружен');
      setUploadOpen(false);
      setUploadTitle('');
      setUploadNumber('');
      fileRef.current = null;
      queryClient.invalidateQueries({ queryKey: ['ai-docs'] });
    },
    onError: () => message.error('Ошибка загрузки'),
  });

  const statusFilters = useMemo(() => {
    const allFilters = [
      { text: 'Готов', value: 'ingested-online', test: (r: LegalDocumentResponse) => r.status === 'INGESTED' && r.downloadState === 'downloaded' },
      { text: 'Удалён', value: 'ingested-offline', test: (r: LegalDocumentResponse) => r.status === 'INGESTED' && !r.downloadState },
      { text: 'Архив', value: 'archived', test: (r: LegalDocumentResponse) => r.status === 'ARCHIVED' },
      { text: 'Доступен', value: 'tracked', test: (r: LegalDocumentResponse) => r.status === 'TRACKED' && !r.downloadState },
      { text: 'Скачан', value: 'downloaded', test: (r: LegalDocumentResponse) => r.downloadState === 'downloaded' && !r.processingState && r.status !== 'INGESTED' },
      { text: 'Загрузка', value: 'downloading', test: (r: LegalDocumentResponse) => r.downloadState === 'downloading' },
      { text: 'Инжест', value: 'processing', test: (r: LegalDocumentResponse) => r.processingState === 'processing' },
      { text: 'Ошибка', value: 'error', test: (r: LegalDocumentResponse) => r.downloadState === 'error' || r.processingState === 'error' },
    ];
    const items = docs || [];
    return allFilters.filter(f => items.some(f.test));
  }, [docs]);

  const trainingFilters = useMemo(() => {
    const allFilters = [
      { text: 'Обучить', value: 'train', test: (r: LegalDocumentResponse) => r.downloadState === 'downloaded' && (!r.processingState || r.processingState === 'error') },
      { text: 'Изучаю', value: 'studying', test: (r: LegalDocumentResponse) => r.processingState === 'processing' },
      { text: 'Найти', value: 'find', test: (r: LegalDocumentResponse) => r.downloadState === 'error' },
      { text: 'Обучен', value: 'trained', test: (r: LegalDocumentResponse) => r.status === 'INGESTED' && r.downloadState === 'downloaded' },
      { text: 'Забыть', value: 'forget', test: (r: LegalDocumentResponse) => r.status === 'INGESTED' && !r.downloadState },
      { text: 'Удалить', value: 'delete', test: (r: LegalDocumentResponse) => r.status === 'ARCHIVED' },
    ];
    const items = docs || [];
    return allFilters.filter(f => items.some(f.test));
  }, [docs]);

  const columns = [
    {
      title: 'Название документа', dataIndex: 'title', width: 420,
      ellipsis: { showTitle: false } as any,
      render: (v: string, r: LegalDocumentResponse) => {
        const isArchived = r.status === 'ARCHIVED';
        const isAccessible = r.status === 'TRACKED' && !r.downloadState;
        const fullTitle = (r.metadata && r.metadata.full_title) || v || r.originalFilename || '';
        const el = (
          <span style={{ display: 'flex', alignItems: 'center' }}>
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: isArchived ? 'line-through' : 'none', color: isArchived ? '#999' : isAccessible ? '#999' : 'inherit' }}>
              {v || r.originalFilename || '—'}
            </span>
            {r.docNumber && <Tag style={{ marginLeft: 6, flexShrink: 0 }}>{r.docNumber}</Tag>}
          </span>
        );
        const wrapped = fullTitle !== (v || r.originalFilename || '')
          ? <Tooltip title={fullTitle} mouseEnterDelay={0.3}>{el}</Tooltip>
          : el;
        if (r.filePath && r.downloadState === 'downloaded' && !isArchived) {
          const filename = r.originalFilename || r.filePath.split('/').pop();
          return <a onClick={() => window.open(`/api/v1/ai/files/${filename}`, '_blank')} style={{ cursor: 'pointer' }}>{wrapped}</a>;
        }
        return wrapped;
      },
    },
    {
      title: 'Статус', width: 130,
      filters: statusFilters.map(f => ({ text: f.text, value: f.value })),
      onFilter: (value: string, r: LegalDocumentResponse) => {
        const filter = statusFilters.find(f => f.value === value);
        return filter ? filter.test(r) : true;
      },
      render: (_: any, r: LegalDocumentResponse) => {
        if (r.status === 'INGESTED' && r.downloadState === 'downloaded')
          return <Tooltip title="Файл на диске, чанки и эмбеддинги в RAG" mouseEnterDelay={0.3}><Tag style={{ background: '#e6f9f0', border: 'none', color: '#009f4d' }} icon={<CheckCircleOutlined style={{ color: '#009f4d' }} />}>Готов</Tag></Tooltip>;
        if (r.status === 'INGESTED' && !r.downloadState)
          return <Tooltip title="Чанки в БД есть, но файл на диске удалён" mouseEnterDelay={0.3}><Tag style={{ background: '#fff2f0', border: 'none', color: '#cf1322' }} icon={<MinusCircleOutlined style={{ color: '#cf1322' }} />}>Удалён</Tag></Tooltip>;
        if (r.status === 'ARCHIVED')
          return <Tooltip title="Документ удалён с источника" mouseEnterDelay={0.3}><Tag color="default" icon={<HistoryOutlined />}>Архив</Tag></Tooltip>;
        if (r.downloadState === 'downloading')
          return <Tooltip title="Идёт загрузка файла с источника" mouseEnterDelay={0.3}><Tag color="cyan" icon={<CloudDownloadOutlined />}>Загрузка</Tag></Tooltip>;
        if (r.downloadState === 'downloaded' && r.processingState === 'processing')
          return <Tooltip title="Чанкинг и создание эмбеддингов" mouseEnterDelay={0.3}><Tag color="blue" icon={<LoadingOutlined spin />}>Инжест</Tag></Tooltip>;
        if (r.downloadState === 'downloaded' && r.processingState === 'error')
          return <Tooltip title="Ошибка при чанкинге или создании эмбеддингов" mouseEnterDelay={0.3}><Tag color="orange" icon={<ExclamationCircleOutlined />}>Инжест: ошибка</Tag></Tooltip>;
        if (r.downloadState === 'downloaded')
          return <Tooltip title="Файл скачан, готов к инжесту" mouseEnterDelay={0.3}><Tag color="geekblue" icon={<DownloadOutlined />}>Скачан</Tag></Tooltip>;
        if (r.downloadState === 'error')
          return <Tooltip title="Ошибка при скачивании файла" mouseEnterDelay={0.3}><Tag color="orange" icon={<ExclamationCircleOutlined />}>Ошибка</Tag></Tooltip>;
        return (
          <Tooltip title="Документ доступен на внешнем источнике" mouseEnterDelay={0.3}>
            {r.sourceUrl ? (
              <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, textDecoration: 'none' }}>
                <Tag color="blue" icon={<LinkOutlined />} style={{ cursor: 'pointer' }}>Доступен</Tag>
              </a>
            ) : (
              <Tag color="default" icon={<MinusCircleOutlined />}>Доступен</Tag>
            )}
          </Tooltip>
        );
      },
    },
    {
      title: 'Формат', width: 60, align: 'center' as const,
      render: (_: any, r: LegalDocumentResponse) => {
        const fmt = getFormat(r);
        if (!fmt) return <Text type="secondary">—</Text>;
        const info = formatInfo[fmt];
        return (
          <Tooltip title={info.tooltip} mouseEnterDelay={0.3}>
            <span style={{ color: info.color, fontSize: 12, background: fmt === 'docx' || fmt === 'odt' ? '#e6f9f0' : '#fffbe6', padding: '2px 8px', borderRadius: 4 }}>{info.label}</span>
          </Tooltip>
        );
      },
    },
    {
      title: 'Размер', dataIndex: 'fileSize', width: 60, align: 'center' as const,
      render: (v: number) => v ? <Text style={{ fontSize: 13 }}>{formatSize(v)}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Чанки', dataIndex: 'chunkCount', width: 60, align: 'center' as const,
      render: (v: number) => v > 0 ? <Text style={{ color: '#1677ff' }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    {
      title: 'Обучение', width: 120,
      filters: trainingFilters.map(f => ({ text: f.text, value: f.value })),
      onFilter: (value: string, r: LegalDocumentResponse) => {
        const filter = trainingFilters.find(f => f.value === value);
        return filter ? filter.test(r) : true;
      },
      render: (_: any, r: LegalDocumentResponse) => {
        if (r.downloadState === 'downloaded' && (!r.processingState || r.processingState === 'error'))
          return (
            <Tooltip title="Запустить чанкинг и эмбеддинги">
              <Button type="text" size="small" icon={<RobotOutlined style={{ color: '#009f4d' }} />} onClick={() => startMut.mutate(r.id)} style={{ color: '#1677ff', fontSize: 13 }}>Обучить</Button>
            </Tooltip>
          );
        if (r.processingState === 'processing')
          return (
            <span style={{ fontSize: 13, color: '#8c8c8c' }}>
              <LoadingOutlined spin /> Изучаю
              <Tooltip title="Остановить"><Button type="text" size="small" icon={<PauseOutlined />} onClick={() => cancelMut.mutate(r.id)} danger /></Tooltip>
            </span>
          );
        if (r.downloadState === 'error')
          return (
            <Tooltip title="Файл не найден на источнике. Пересинхронизировать.">
              <span style={{ fontSize: 13, color: '#fa8c16', cursor: 'pointer' }} onClick={() => syncMut.mutate()}><SearchOutlined /> Найти</span>
            </Tooltip>
          );
        if (r.status === 'TRACKED' && !r.downloadState)
          return (
            <Tooltip title="Файл не найден на источнике. Указать URL вручную (например, pravo.gov.ru)">
              <Button type="text" size="small" icon={<LinkOutlined />} onClick={() => { setUrlDoc(r); setUrlValue(r.sourceUrl || ''); }} style={{ color: '#1677ff', fontSize: 13 }}>URL</Button>
            </Tooltip>
          );
        if (r.status === 'INGESTED' && r.downloadState === 'downloaded')
          return <span style={{ fontSize: 13, color: '#009f4d' }}><RobotOutlined /> Обучен</span>;
        if (r.status === 'INGESTED' && !r.downloadState)
          return (
            <Tooltip title="Файла на диске нет, удалить из RAG">
              <span style={{ fontSize: 13, color: '#cf1322', cursor: 'pointer' }} onClick={() => softDelete(r.id)}><RobotOutlined /> Забыть</span>
            </Tooltip>
          );
        if (r.status === 'ARCHIVED')
          return (
            <Tooltip title="Удалить">
              <Button type="text" size="small" icon={<DeleteOutlined />} danger onClick={() => softDelete(r.id)} />
            </Tooltip>
          );
        return <Text type="secondary">—</Text>;
      },
    },
  ];

  const rowSelection = {
    selectedRowKeys: selected,
    onChange: (keys: React.Key[]) => setSelected(keys as string[]),
  };

  const displayedDocs = filterBySearch(docs || []);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Typography.Title level={4} style={{ margin: 0 }}>Нормативно-правовая база</Typography.Title>
          <Tooltip title="Структура электроэнергетики России" mouseEnterDelay={1}>
            <span
              onClick={() => setSchemeOpen(true)}
              style={{ cursor: 'pointer', display: 'inline-flex', alignItems: 'center', transition: 'opacity 0.15s' }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.7')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              <InfoCircleOutlined style={{ color: '#1677ff', fontSize: 18 }} />
            </span>
          </Tooltip>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Tooltip title="Доступны на внешних источниках" mouseEnterDelay={0.3}>
            <Tag color="blue" icon={<LinkOutlined />}>
              Доступно: {stats.tracked || 0}
              {delta && delta.new > 0 && <span style={{ color: '#009f4d', marginLeft: 2 }}> ↑{delta.new}</span>}
              {delta && delta.archived > 0 && <span style={{ color: '#cf1322', marginLeft: 2 }}> ↓{delta.archived}</span>}
            </Tag>
          </Tooltip>
          <Tooltip title="Загружен в RAG" mouseEnterDelay={0.3}>
            <Tag style={{ background: '#e6f9f0', border: 'none', color: '#009f4d' }} icon={<CheckCircleOutlined style={{ color: '#009f4d' }} />}>Готов: {stats.ingested || 0}</Tag>
          </Tooltip>
          <Tooltip title="Скачивается с источника" mouseEnterDelay={0.3}>
            <Tag color="cyan" icon={<CloudDownloadOutlined />}>Загрузка: {stats.downloading || 0}</Tag>
          </Tooltip>
          <Tooltip title="Ошибки" mouseEnterDelay={0.3}>
            <Tag color="red" icon={<ExclamationCircleOutlined />}>Ошибка: {stats.error || 0}</Tag>
          </Tooltip>
          <Tooltip title="Удалён с источника" mouseEnterDelay={0.3}>
            <Tag color="default" icon={<HistoryOutlined />}>Архив: {stats.archived || 0}</Tag>
          </Tooltip>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 12, marginBottom: 12 }}>
        <Input
          placeholder="Поиск по названию или номеру документа..."
          allowClear
          prefix={<SearchOutlined style={{ color: '#bfbfbf' }} />}
          value={search}
          onChange={e => setSearch(e.target.value)}
          style={{ maxWidth: 400 }}
        />
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {syncRunning && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ width: 90 }}>
                <Progress
                  percent={syncState && syncState.total_sources > 0
                    ? Math.round((syncState.done_sources / syncState.total_sources) * 100)
                    : 0}
                  size="small"
                  showInfo={false}
                />
              </div>
              <Tooltip title={`Источник: ${syncState?.current_source || '...'}`}>
                <span style={{ fontSize: 12, color: '#8c8c8c', whiteSpace: 'nowrap', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  <LoadingOutlined spin /> {syncState?.current_source || 'Синхронизация...'}
                </span>
              </Tooltip>
            </div>
          )}
          <Badge count={diffs?.length || 0} size="small" offset={[-4, 4]}>
            <Button icon={<SwapOutlined />} onClick={() => setDiffsOpen(true)}>Изменения</Button>
          </Badge>
          <Button icon={<UploadOutlined />} onClick={() => setUploadOpen(true)}>Загрузить файл</Button>
          <Tooltip title={schedulerState?.enabled ? 'Автосинк включён — планировщик проверяет источники по расписанию' : 'Автосинк выключен — синк только по кнопке «Обновить каталог»'}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}>
              <Switch
                size="small"
                checked={!!schedulerState?.enabled}
                loading={schedulerMut.isPending}
                onChange={(v) => schedulerMut.mutate(v)}
              />
              <span style={{ fontSize: 12, color: '#8c8c8c' }}>Автосинк</span>
            </span>
          </Tooltip>
          {syncRunning ? (
            <Button danger icon={<StopOutlined />} loading={cancelSyncMut.isPending} onClick={() => cancelSyncMut.mutate()} style={{ width: 170 }}>
              Остановить
            </Button>
          ) : (
            <Button icon={<ReloadOutlined />} onClick={() => syncMut.mutate()} style={{ width: 170 }}>
              Обновить каталог
            </Button>
          )}
          {isDownloadSynced ? (
            <Button icon={<CheckCircleOutlined style={{ color: '#009f4d' }} />} disabled style={{ width: 170 }}>Синхронизировано</Button>
          ) : syncActive ? (
            <Button icon={<PauseCircleOutlined />} onClick={() => aiApi.pauseSync()} style={{ width: 170 }}>Загрузка...</Button>
          ) : (
            <Button icon={<CloudDownloadOutlined />} onClick={() => downloadMut.mutate()} loading={downloadMut.isPending} style={{ width: 170 }}>Скачать {needDownload}</Button>
          )}
          <Button icon={<RobotOutlined style={{ color: '#009f4d' }} />} onClick={() => batchIngestMut.mutate()} disabled={canIngest === 0} loading={batchIngestMut.isPending} style={{ width: 140 }}>
            {batchIngestMut.isPending ? 'Обучение...' : `Обучить ${canIngest || ''}`}
          </Button>
        </div>
      </div>

      <div style={{
        maxHeight: selected.length > 0 ? 40 : 0,
        overflow: 'hidden',
        transition: 'max-height 0.15s',
        marginBottom: selected.length > 0 ? 8 : 0,
        display: 'flex', gap: 8, alignItems: 'center',
      }}>
        <Text type="secondary" style={{ whiteSpace: 'nowrap' }}>Выбрано: {selected.length}</Text>
        <Button size="small" icon={<EyeInvisibleOutlined />} disabled={forgetBatchMut.isPending}
          onClick={() => forgetBatchMut.mutate(selected)}>
          Забыть
        </Button>
        <Button size="small" icon={<UndoOutlined />} disabled={unforgetBatchMut.isPending}
          onClick={() => unforgetBatchMut.mutate(selected)}>
          Восстановить
        </Button>
        <Dropdown menu={{
          items: Object.entries(CATEGORIES).map(([value, label]) => ({ key: value, label })),
          onClick: ({ key }) => categoryMut.mutate({ ids: selected, category: key }),
        }} disabled={categoryMut.isPending}>
          <Button size="small" icon={<TagOutlined />}>Категория</Button>
        </Dropdown>
        <Button danger size="small" icon={<DeleteOutlined />}
          onClick={() => { softDeleteBatch(selected); setSelected([]); }}>
          Удалить
        </Button>
        <Button size="small" onClick={() => setSelected([])}>
          Снять выделение
        </Button>
      </div>

      <Table
        rowSelection={rowSelection}
        columns={columns}
        dataSource={displayedDocs}
        rowKey="id"
        size="small"
        pagination={false}
        loading={isLoading}
        scroll={{ x: 'max-content' }}
      />

      <Modal title={null} open={schemeOpen} onCancel={() => setSchemeOpen(false)} footer={null} width={1120}
        style={{ top: 20 }} styles={{ body: { padding: 0 } }}>
        <MarketScheme />
      </Modal>

      <Modal
        title="Изменения каталога"
        open={diffsOpen}
        onCancel={() => setDiffsOpen(false)}
        width={760}
        footer={[
          <Button key="close" onClick={() => setDiffsOpen(false)}>Закрыть</Button>,
          <Button key="all" type="primary" onClick={() => ackMut.mutate([])} loading={ackMut.isPending} disabled={!diffs?.length}>
            Подтвердить все
          </Button>,
        ]}
      >
        {!diffs?.length ? (
          <Empty description="Неподтверждённых изменений нет. Они появятся после синхронизации каталога." />
        ) : (
          <List
            dataSource={diffs}
            size="small"
            renderItem={(d: SyncDiff) => (
              <List.Item
                actions={[
                  <Button key="ack" type="link" size="small" loading={ackMut.isPending} onClick={() => ackMut.mutate([d.id])}>
                    Подтвердить
                  </Button>,
                ]}
              >
                <List.Item.Meta
                  title={<span>{d.sourceName} <Text type="secondary" style={{ fontSize: 12 }}>{new Date(d.createdAt).toLocaleString('ru-RU')}</Text></span>}
                  description={
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxWidth: 560 }}>
                      {(d.newDocs || []).map((doc, i) => (
                        <span key={`n${i}`} style={{ color: '#009f4d' }}>
                          + {doc.title}{doc.doc_number ? ` (${doc.doc_number})` : ''}
                        </span>
                      ))}
                      {(d.archivedDocs || []).map((doc, i) => (
                        <span key={`a${i}`} style={{ color: '#cf1322', textDecoration: 'line-through' }}>
                          − {doc.title}{doc.doc_number ? ` (${doc.doc_number})` : ''}
                        </span>
                      ))}
                    </div>
                  }
                />
              </List.Item>
            )}
          />
        )}
      </Modal>

      <Modal
        title={urlDoc ? `Указать URL файла — ${urlDoc.title}` : 'Указать URL файла'}
        open={!!urlDoc}
        onCancel={() => setUrlDoc(null)}
        onOk={() => urlDoc && setUrlMut.mutate({ id: urlDoc.id, url: urlValue.trim() })}
        confirmLoading={setUrlMut.isPending}
        okText="Скачать"
        width={520}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <Text type="secondary">Для документов, которых нет на официальных источниках (например, 354-ПП — pravo.gov.ru). Файл скачается сразу.</Text>
          <Input
            placeholder="https://..."
            value={urlValue}
            onChange={e => setUrlValue(e.target.value)}
            onPressEnter={() => urlDoc && setUrlMut.mutate({ id: urlDoc.id, url: urlValue.trim() })}
          />
        </div>
      </Modal>

      <Modal
        title="Загрузить свой файл"
        open={uploadOpen}
        onCancel={() => setUploadOpen(false)}
        onOk={() => uploadMut.mutate()}
        confirmLoading={uploadMut.isPending}
        okText="Загрузить"
        width={480}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Input placeholder="Название документа" value={uploadTitle} onChange={e => setUploadTitle(e.target.value)} />
          <Input placeholder="Номер документа (будет тегом в списке)" value={uploadNumber} onChange={e => setUploadNumber(e.target.value)} />
          <Dragger
            maxCount={1}
            beforeUpload={file => { fileRef.current = file; return false; }}
            onRemove={() => { fileRef.current = null; }}
            accept=".docx,.odt,.rtf,.pdf,.doc"
          >
            <p className="ant-upload-drag-icon"><InboxOutlined /></p>
            <p className="ant-upload-text">Выберите или перетащите файл</p>
            <p className="ant-upload-hint">DOCX, ODT, RTF, PDF, DOC</p>
          </Dragger>
        </div>
      </Modal>
    </div>
  );
}
