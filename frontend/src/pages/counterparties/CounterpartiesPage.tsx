import { useState, useCallback } from 'react';
import { Table, Button, Space, message, Popconfirm, Typography, Tag, Descriptions, Modal, Form, Input, Select } from 'antd';
import { PlusOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { counterpartyApi, CounterpartyResponse } from '../../api/endpoints';
import SmartFilterBar, { FilterField } from '../../components/SmartFilterBar';
import ObjectPage from '../../components/ObjectPage';

const FILTER_FIELDS: FilterField[] = [
  { key: 'q', label: 'Поиск', type: 'text' },
  { key: 'type', label: 'Тип', type: 'select', options: [{ label: 'Продажа', value: 'SALE' }, { label: 'Покупка', value: 'PURCHASE' }] },
];

export default function CounterpartiesPage() {
  const [page, setPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [selected, setSelected] = useState<CounterpartyResponse | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CounterpartyResponse | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['counterparties', page, filters],
    queryFn: () => counterpartyApi.list(filters.q || '', page, 20).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => counterpartyApi.delete(id),
    onSuccess: () => { message.success('Удалено'); queryClient.invalidateQueries({ queryKey: ['counterparties'] }); },
  });

  const saveMutation = useMutation({
    mutationFn: (values: any) => editing ? counterpartyApi.update(editing.id, values) : counterpartyApi.create(values),
    onSuccess: () => { message.success(editing ? 'Обновлено' : 'Создано'); setModalOpen(false); queryClient.invalidateQueries({ queryKey: ['counterparties'] }); },
  });

  const openRow = useCallback((record: CounterpartyResponse) => {
    setSelected(record); setDrawerOpen(true);
  }, []);

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (record: CounterpartyResponse) => { setEditing(record); form.setFieldsValue(record); setModalOpen(true); };

  const columns = [
    { title: 'Код', dataIndex: 'code', width: 90 },
    { title: 'Наименование', dataIndex: 'name', ellipsis: true, render: (v: string, r: CounterpartyResponse) => <a onClick={() => openRow(r)}>{v}</a> },
    { title: 'ИНН', dataIndex: 'inn', width: 110 },
    { title: 'Тип', dataIndex: 'type', width: 80, render: (t: string) => <Tag color={t === 'SALE' ? 'blue' : 'green'}>{t}</Tag> },
    { title: 'Телефон', dataIndex: 'phone', width: 120, responsive: ['md' as const] },
    { title: '', width: 80, render: (_: any, r: CounterpartyResponse) => (
      <Popconfirm title="Удалить?" onConfirm={() => deleteMutation.mutate(r.id)}>
        <Button type="link" size="small" danger>Уд.</Button>
      </Popconfirm>
    )},
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Контрагенты</Typography.Title>
        <Space>
          <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['counterparties'] })} />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Добавить</Button>
        </Space>
      </div>

      <SmartFilterBar fields={FILTER_FIELDS}
        onSearch={(v) => { setFilters(v); setPage(1); }}
        onReset={() => { setFilters({}); setPage(1); }}
        loading={isLoading} />

      <Table columns={columns} dataSource={data?.items} loading={isLoading} rowKey="id" size="middle"
        pagination={{ current: page, total: data?.total, pageSize: 20, onChange: setPage, showSizeChanger: false, showTotal: (t) => `Всего: ${t}` }} />

      {/* Object Page Drawer */}
      {selected && (
        <ObjectPage title={selected.name}
          subtitle={`Код: ${selected.code}`}
          dataPoints={[
            { label: 'ИНН', value: selected.inn || '—' },
            { label: 'КПП', value: selected.kpp || '—' },
            { label: 'Тип', value: <Tag color="blue">{selected.type}</Tag> },
          ]}
          sections={[
            { title: 'Контакты', content: (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Телефон">{selected.phone || '—'}</Descriptions.Item>
                <Descriptions.Item label="Email">{selected.email || '—'}</Descriptions.Item>
              </Descriptions>
            )},
            { title: 'Реквизиты', content: (
              <Descriptions column={1} size="small">
                <Descriptions.Item label="Полное наименование">{selected.fullName || selected.name}</Descriptions.Item>
                <Descriptions.Item label="ОГРН">{selected.ogrn || '—'}</Descriptions.Item>
              </Descriptions>
            )},
          ]}
          open={drawerOpen} onClose={() => setDrawerOpen(false)}
          onEdit={() => openEdit(selected)} />
      )}

      <Modal title={editing ? 'Редактировать' : 'Новый контрагент'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={() => form.submit()} width={560}>
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)}>
          <Form.Item name="code" label="Код" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="name" label="Наименование" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="fullName" label="Полное наименование"><Input /></Form.Item>
          <Form.Item name="inn" label="ИНН"><Input /></Form.Item>
          <Form.Item name="kpp" label="КПП"><Input /></Form.Item>
          <Form.Item name="phone" label="Телефон"><Input /></Form.Item>
          <Form.Item name="email" label="Email"><Input /></Form.Item>
          <Form.Item name="type" label="Тип" initialValue="SALE">
            <Select options={[{ label: 'Продажа', value: 'SALE' }, { label: 'Покупка', value: 'PURCHASE' }]} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
