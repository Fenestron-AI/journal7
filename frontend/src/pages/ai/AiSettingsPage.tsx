import { useState } from 'react';
import { Tabs, Table, Button, Tag, Typography, message, Tooltip, Modal, Form, Input, Select, InputNumber, Switch, Popconfirm, Alert } from 'antd';
import { PlusOutlined, DeleteOutlined, SyncOutlined, EditOutlined, LinkOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi, SourceResponse, CatalogRuleResponse, FileSourceResponse, CATEGORIES, INTERVALS, DOC_TYPES } from '../../api/ai';

const { Text } = Typography;

function fmtDate(ts: number): string {
  if (!ts) return '—';
  return new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' });
}

function parseFilter(f: string[] | string | undefined): string[] {
  if (!f) return [];
  if (Array.isArray(f)) return f;
  try { const p = JSON.parse(f); return Array.isArray(p) ? p : []; } catch { return []; }
}

const statusColor: Record<string, string> = {
  IDLE: 'default', SYNCING: 'blue', ERROR: 'red',
};

const statusLabel: Record<string, string> = {
  IDLE: 'Ожидает', SYNCING: 'Синхронизируется', ERROR: 'Ошибка',
};

// ============================================================
// Вкладка «Источники»
// ============================================================

function SourcesTab() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SourceResponse | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['ai-sources'],
    queryFn: () => aiApi.listSources(),
    refetchInterval: 15000,
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ai-sources'] });

  const saveMut = useMutation({
    mutationFn: (v: any) => editing
      ? aiApi.updateSource(editing.id, v)
      : aiApi.createSource(v),
    onSuccess: () => {
      message.success(editing ? 'Источник обновлён' : 'Источник добавлен');
      setModalOpen(false);
      invalidate();
    },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Ошибка сохранения'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => aiApi.deleteSource(id),
    onSuccess: () => { message.success('Источник удалён'); invalidate(); },
    onError: () => message.error('Не удалось удалить источник'),
  });

  const syncOneMut = useMutation({
    mutationFn: (id: string) => aiApi.syncSource(id),
    onSuccess: () => { message.success('Синхронизация источника запущена'); invalidate(); },
    onError: () => message.error('Не удалось запустить синхронизацию'),
  });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ doc_group: 'laws', sync_interval: 'weekly', crawl_depth: 1, url_filter: [] });
    setModalOpen(true);
  };

  const openEdit = (r: SourceResponse) => {
    setEditing(r);
    form.setFieldsValue({ ...r, url_filter: parseFilter(r.url_filter) });
    setModalOpen(true);
  };

  const columns = [
    {
      title: 'Название', dataIndex: 'name', width: 200,
      render: (v: string, r: SourceResponse) => (
        <div>
          <Text strong>{v}</Text>
          <div>
            <a href={r.url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 12, color: '#8c8c8c' }}>
              <LinkOutlined /> {r.url.replace(/^https?:\/\//, '')}
            </a>
          </div>
        </div>
      ),
    },
    {
      title: 'Категория', dataIndex: 'doc_group', width: 150,
      render: (v: string) => <Tag color={v === 'laws' ? 'blue' : v === 'regulations' ? 'geekblue' : 'default'}>{CATEGORIES[v] || v}</Tag>,
    },
    {
      title: 'Период', dataIndex: 'sync_interval', width: 110,
      render: (v: string) => INTERVALS[v] || v,
    },
    {
      title: 'Глубина', dataIndex: 'crawl_depth', width: 80, align: 'center' as const,
      render: (v: number) => v > 1 ? `${v} ур.` : '—',
    },
    {
      title: 'Фильтр URL', dataIndex: 'url_filter', width: 180,
      render: (v: string[] | string) => {
        const arr = parseFilter(v);
        if (!arr.length) return <Text type="secondary">весь раздел</Text>;
        return <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>{arr.map((u, i) => <Tag key={i} style={{ marginInlineEnd: 0 }}>{u}</Tag>)}</div>;
      },
    },
    {
      title: 'Статус', dataIndex: 'status', width: 140,
      render: (v: string, r: SourceResponse) => (
        <div>
          <Tag color={statusColor[v] || 'default'}>{statusLabel[v] || v}</Tag>
          <div style={{ fontSize: 12, color: '#8c8c8c' }}>{v === 'SYNCING' ? '' : fmtDate(r.last_synced_at)}</div>
        </div>
      ),
    },
    {
      title: 'Активен', dataIndex: 'active', width: 80, align: 'center' as const,
      render: (v: boolean, r: SourceResponse) => (
        <Switch size="small" checked={v} loading={false} onChange={(val) => {
          aiApi.updateSource(r.id, { active: val }).then(() => { message.success(val ? 'Источник включён' : 'Источник отключён'); invalidate(); });
        }} />
      ),
    },
    {
      title: '', width: 120,
      render: (_: any, r: SourceResponse) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <Tooltip title="Синхронизировать сейчас"><Button size="small" type="text" icon={<SyncOutlined />} onClick={() => syncOneMut.mutate(r.id)} /></Tooltip>
          <Tooltip title="Редактировать"><Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} /></Tooltip>
          <Popconfirm title="Удалить источник?" onConfirm={() => deleteMut.mutate(r.id)}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text type="secondary">Официальные источники, из которых автоматика собирает каталог документов. Домен должен быть в доверенных хранилищах, чтобы файлы скачивались с него.</Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Добавить источник</Button>
      </div>
      <Table columns={columns as any} dataSource={data} loading={isLoading} rowKey="id" size="small" pagination={false} />

      <Modal title={editing ? 'Редактировать источник' : 'Новый источник'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={() => form.submit()} width={560} confirmLoading={saveMut.isPending}>
        <Form form={form} layout="vertical" onFinish={(v) => saveMut.mutate(v)}>
          <Form.Item name="name" label="Название" rules={[{ required: true, message: 'Укажите название' }]}><Input placeholder="Например: pravo.gov.ru — законы" /></Form.Item>
          <Form.Item name="url" label="URL" rules={[{ required: true, message: 'Укажите адрес' }, { pattern: /^https?:\/\//, message: 'Адрес должен начинаться с http(s)://' }]}>
            <Input placeholder="https://..." />
          </Form.Item>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="doc_group" label="Категория" style={{ flex: 1 }}>
              <Select options={Object.entries(CATEGORIES).map(([value, label]) => ({ value, label }))} />
            </Form.Item>
            <Form.Item name="sync_interval" label="Период синка" style={{ flex: 1 }}>
              <Select options={Object.entries(INTERVALS).map(([value, label]) => ({ value, label }))} />
            </Form.Item>
            <Form.Item name="crawl_depth" label="Глубина краулинга" style={{ flex: 1 }}>
              <InputNumber min={1} max={5} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <Form.Item name="url_filter" label="Фильтр URL (подстроки — только ссылки, содержащие любую из них)">
            <Select mode="tags" placeholder="Например: /document/ или /documents/" open={false} suffixIcon={null} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ============================================================
// Вкладка «Правила состава»
// ============================================================

function RulesTab() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CatalogRuleResponse | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['ai-catalog-rules'],
    queryFn: () => aiApi.listCatalogRules(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ai-catalog-rules'] });

  const saveMut = useMutation({
    mutationFn: (v: any) => editing
      ? aiApi.updateCatalogRule(editing.id, v)
      : aiApi.createCatalogRule(v),
    onSuccess: () => {
      message.success(editing ? 'Правило обновлено' : 'Правило добавлено');
      setModalOpen(false);
      invalidate();
    },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Ошибка сохранения'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => aiApi.deleteCatalogRule(id),
    onSuccess: () => { message.success('Правило удалено'); invalidate(); },
    onError: () => message.error('Не удалось удалить правило'),
  });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ action: 'exclude', priority: 0, active: true });
    setModalOpen(true);
  };

  const openEdit = (r: CatalogRuleResponse) => {
    setEditing(r);
    form.setFieldsValue(r);
    setModalOpen(true);
  };

  const columns = [
    {
      title: 'Действие', dataIndex: 'action', width: 110,
      render: (v: string) => v === 'include'
        ? <Tag style={{ background: '#e6f9f0', border: 'none', color: '#009f4d' }}>ВКЛЮЧИТЬ</Tag>
        : <Tag style={{ background: '#fff2f0', border: 'none', color: '#cf1322' }}>ИСКЛЮЧИТЬ</Tag>,
    },
    {
      title: 'Приоритет', dataIndex: 'priority', width: 90, align: 'center' as const,
      render: (v: number) => <Text strong>{v}</Text>,
    },
    { title: 'Источник', dataIndex: 'source', width: 160, render: (v: string | null) => v || <Text type="secondary">любой</Text> },
    {
      title: 'Категория', dataIndex: 'category', width: 140,
      render: (v: string | null) => v ? (CATEGORIES[v] || v) : <Text type="secondary">любая</Text>,
    },
    {
      title: 'Тип', dataIndex: 'doc_type', width: 120,
      render: (v: string | null) => v ? (DOC_TYPES[v] || v) : <Text type="secondary">любой</Text>,
    },
    { title: 'Номер', dataIndex: 'doc_number', width: 110, render: (v: string | null) => v ? <Text code>{v}</Text> : <Text type="secondary">—</Text> },
    {
      title: 'Маска названия', dataIndex: 'title_mask', width: 200,
      render: (v: string | null) => v ? <Text code style={{ fontSize: 12 }}>{v}</Text> : <Text type="secondary">—</Text>,
    },
    { title: 'Комментарий', dataIndex: 'comment', render: (v: string | null) => v || <Text type="secondary">—</Text> },
    {
      title: 'Активно', dataIndex: 'active', width: 80, align: 'center' as const,
      render: (v: boolean, r: CatalogRuleResponse) => (
        <Switch size="small" checked={v} onChange={(val) => {
          aiApi.updateCatalogRule(r.id, { active: val }).then(() => { message.success(val ? 'Правило включено' : 'Правило отключено'); invalidate(); });
        }} />
      ),
    },
    {
      title: '', width: 80,
      render: (_: any, r: CatalogRuleResponse) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Удалить правило?" onConfirm={() => deleteMut.mutate(r.id)}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div>
      <Alert type="info" showIcon style={{ marginBottom: 12 }}
        message="Правила определяют состав базы: exclude приоритетнее include, при равном приоритете применяется последнее созданное. Изменения применяются при следующей синхронизации."
      />
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Добавить правило</Button>
      </div>
      <Table columns={columns as any} dataSource={data} loading={isLoading} rowKey="id" size="small" pagination={false} />

      <Modal title={editing ? 'Редактировать правило' : 'Новое правило'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={() => form.submit()} width={560} confirmLoading={saveMut.isPending}>
        <Form form={form} layout="vertical" onFinish={(v) => saveMut.mutate(v)}>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="action" label="Действие" rules={[{ required: true }]} style={{ flex: 1 }}>
              <Select options={[
                { value: 'include', label: 'ВКЛЮЧИТЬ' },
                { value: 'exclude', label: 'ИСКЛЮЧИТЬ' },
              ]} />
            </Form.Item>
            <Form.Item name="priority" label="Приоритет (больше = важнее)" style={{ flex: 1 }}>
              <InputNumber min={-100} max={100} style={{ width: '100%' }} />
            </Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="source" label="Источник (домен или название)" style={{ flex: 1 }}><Input placeholder="например: pravo.gov.ru" /></Form.Item>
            <Form.Item name="doc_number" label="Номер документа" style={{ flex: 1 }}><Input placeholder="например: 442" /></Form.Item>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <Form.Item name="category" label="Категория" style={{ flex: 1 }}>
              <Select allowClear options={Object.entries(CATEGORIES).map(([value, label]) => ({ value, label }))} />
            </Form.Item>
            <Form.Item name="doc_type" label="Тип документа" style={{ flex: 1 }}>
              <Select allowClear options={Object.entries(DOC_TYPES).map(([value, label]) => ({ value, label }))} />
            </Form.Item>
          </div>
          <Form.Item name="title_mask" label="Маска названия (подстрока)"><Input placeholder="например: об электроэнергетике" /></Form.Item>
          <Form.Item name="comment" label="Комментарий"><Input.TextArea rows={2} placeholder="Зачем это правило" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ============================================================
// Вкладка «Хранилища файлов»
// ============================================================

function FileSourcesTab() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<FileSourceResponse | null>(null);
  const [form] = Form.useForm();

  const { data, isLoading } = useQuery({
    queryKey: ['ai-file-sources'],
    queryFn: () => aiApi.listFileSources(),
  });

  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['ai-file-sources'] });

  const saveMut = useMutation({
    mutationFn: (v: any) => editing
      ? aiApi.updateFileSource(editing.id, v)
      : aiApi.createFileSource(v),
    onSuccess: () => {
      message.success(editing ? 'Хранилище обновлено' : 'Хранилище добавлено');
      setModalOpen(false);
      invalidate();
    },
    onError: (e: any) => message.error(e.response?.data?.detail || 'Ошибка сохранения'),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => aiApi.deleteFileSource(id),
    onSuccess: () => { message.success('Хранилище удалено'); invalidate(); },
    onError: () => message.error('Не удалось удалить хранилище'),
  });

  const openCreate = () => {
    setEditing(null);
    form.resetFields();
    form.setFieldsValue({ priority: 100, active: true });
    setModalOpen(true);
  };

  const openEdit = (r: FileSourceResponse) => {
    setEditing(r);
    form.setFieldsValue(r);
    setModalOpen(true);
  };

  const columns = [
    {
      title: 'Домен', dataIndex: 'domain', width: 240,
      render: (v: string) => <a href={`https://${v}`} target="_blank" rel="noopener noreferrer"><LinkOutlined /> {v}</a>,
    },
    {
      title: 'Приоритет доверия', dataIndex: 'priority', width: 150, align: 'center' as const,
      render: (v: number) => <Text strong>{v}</Text>,
      sorter: (a: FileSourceResponse, b: FileSourceResponse) => a.priority - b.priority,
    },
    {
      title: 'Активно', dataIndex: 'active', width: 90, align: 'center' as const,
      render: (v: boolean, r: FileSourceResponse) => (
        <Switch size="small" checked={v} onChange={(val) => {
          aiApi.updateFileSource(r.id, { active: val }).then(() => { message.success(val ? 'Хранилище включено' : 'Хранилище отключено'); invalidate(); });
        }} />
      ),
    },
    { title: 'Комментарий', dataIndex: 'comment', render: (v: string | null) => v || <Text type="secondary">—</Text> },
    {
      title: '', width: 80,
      render: (_: any, r: FileSourceResponse) => (
        <div style={{ display: 'flex', gap: 4, justifyContent: 'flex-end' }}>
          <Button size="small" type="text" icon={<EditOutlined />} onClick={() => openEdit(r)} />
          <Popconfirm title="Удалить хранилище?" onConfirm={() => deleteMut.mutate(r.id)}>
            <Button size="small" type="text" danger icon={<DeleteOutlined />} />
          </Popconfirm>
        </div>
      ),
    },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Text type="secondary">Доверенные домены, откуда разрешено скачивать файлы. При выборе файла приоритет формата (docx › odt › rtf › doc › pdf), затем доверие домена (меньше priority = довереннее).</Text>
        <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Добавить домен</Button>
      </div>
      <Table columns={columns as any} dataSource={data} loading={isLoading} rowKey="id" size="small" pagination={false} />

      <Modal title={editing ? 'Редактировать хранилище' : 'Новое хранилище'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={() => form.submit()} width={480} confirmLoading={saveMut.isPending}>
        <Form form={form} layout="vertical" onFinish={(v) => saveMut.mutate(v)}>
          <Form.Item name="domain" label="Домен" rules={[{ required: true, message: 'Укажите домен' }, { pattern: /^[a-z0-9.-]+\.[a-z]{2,}$/i, message: 'Некорректный домен' }]}>
            <Input placeholder="например: pravo.gov.ru" />
          </Form.Item>
          <Form.Item name="priority" label="Приоритет доверия (меньше = довереннее)">
            <InputNumber min={1} max={9999} style={{ width: '100%' }} />
          </Form.Item>
          <Form.Item name="comment" label="Комментарий"><Input placeholder="Чей это источник" /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}

// ============================================================
// Страница настроек НПБ
// ============================================================

export default function AiSettingsPage() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Состав базы и источники</Typography.Title>
      </div>
      <Tabs
        items={[
          { key: 'sources', label: 'Источники', children: <SourcesTab /> },
          { key: 'rules', label: 'Правила состава', children: <RulesTab /> },
          { key: 'files', label: 'Хранилища файлов', children: <FileSourcesTab /> },
        ]}
      />
    </div>
  );
}
