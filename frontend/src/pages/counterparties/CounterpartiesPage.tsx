import { useState } from 'react';
import { Table, Button, Input, Space, Modal, Form, message, Popconfirm, Typography, Tag } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { counterpartyApi, CounterpartyResponse } from '../../api/endpoints';

export default function CounterpartiesPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CounterpartyResponse | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['counterparties', search, page],
    queryFn: () => counterpartyApi.list(search, page).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => counterpartyApi.delete(id),
    onSuccess: () => { message.success('Удалено'); queryClient.invalidateQueries({ queryKey: ['counterparties'] }); },
  });

  const saveMutation = useMutation({
    mutationFn: (values: any) => editing ? counterpartyApi.update(editing.id, values) : counterpartyApi.create(values),
    onSuccess: () => { message.success(editing ? 'Обновлено' : 'Создано'); setModalOpen(false); queryClient.invalidateQueries({ queryKey: ['counterparties'] }); },
  });

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (record: CounterpartyResponse) => { setEditing(record); form.setFieldsValue(record); setModalOpen(true); };

  const columns = [
    { title: 'Код', dataIndex: 'code', width: 100 },
    { title: 'Наименование', dataIndex: 'name', ellipsis: true },
    { title: 'ИНН', dataIndex: 'inn', width: 120 },
    { title: 'Тип', dataIndex: 'type', width: 100, render: (t: string) => <Tag>{t}</Tag> },
    { title: 'Телефон', dataIndex: 'phone', width: 130 },
    { title: 'Email', dataIndex: 'email', width: 180 },
    { title: '', width: 120, render: (_: any, record: CounterpartyResponse) => (
      <Space>
        <Button type="link" size="small" onClick={() => openEdit(record)}>Ред.</Button>
        <Popconfirm title="Удалить?" onConfirm={() => deleteMutation.mutate(record.id)}>
          <Button type="link" size="small" danger>Уд.</Button>
        </Popconfirm>
      </Space>
    )},
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Контрагенты</Typography.Title>
        <Space>
          <Input prefix={<SearchOutlined />} placeholder="Поиск..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ width: 240 }} allowClear />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Добавить</Button>
        </Space>
      </div>

      <Table columns={columns} dataSource={data?.items} loading={isLoading} rowKey="id"
        pagination={{ current: page, total: data?.total, pageSize: 20, onChange: setPage }}
        onRow={(record) => ({ onDoubleClick: () => openEdit(record) })} />

      <Modal title={editing ? 'Редактировать контрагента' : 'Новый контрагент'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={() => form.submit()} width={640}>
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)}>
          <Form.Item name="code" label="Код" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="name" label="Наименование" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="fullName" label="Полное наименование"><Input /></Form.Item>
          <Form.Item name="inn" label="ИНН"><Input /></Form.Item>
          <Form.Item name="kpp" label="КПП"><Input /></Form.Item>
          <Form.Item name="phone" label="Телефон"><Input /></Form.Item>
          <Form.Item name="email" label="Email"><Input /></Form.Item>
          <Form.Item name="type" label="Тип" initialValue="SALE"><Input /></Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
