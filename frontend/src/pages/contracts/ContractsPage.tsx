import { useState } from 'react';
import { Table, Button, Input, Space, Modal, Form, message, Popconfirm, Typography, Tree, Tag, Drawer, Select } from 'antd';
import { PlusOutlined, SearchOutlined, ApartmentOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractApi, counterpartyApi, SaleContractResponse } from '../../api/endpoints';

export default function ContractsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SaleContractResponse | null>(null);
  const [treeOpen, setTreeOpen] = useState(false);
  const [treeData, setTreeData] = useState<any>(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['contracts', search, page],
    queryFn: () => contractApi.list(search, page).then(r => r.data),
  });

  const { data: counterpartiesData } = useQuery({
    queryKey: ['counterparties-all'],
    queryFn: () => counterpartyApi.list('', 1, 1000).then(r => r.data),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => contractApi.delete(id),
    onSuccess: () => { message.success('Удалено'); queryClient.invalidateQueries({ queryKey: ['contracts'] }); },
  });

  const saveMutation = useMutation({
    mutationFn: (values: any) => editing ? contractApi.update(editing.id, values) : contractApi.create(values),
    onSuccess: () => { message.success(editing ? 'Обновлено' : 'Создано'); setModalOpen(false); queryClient.invalidateQueries({ queryKey: ['contracts'] }); },
  });

  const loadTree = async (id: string) => {
    setTreeLoading(true); setTreeOpen(true);
    try {
      const { data } = await contractApi.tree(id);
      const tree = [{
        title: <span>Договор №{data.contract.number}</span>, key: 'contract',
        children: data.objects?.map((obj: any, oi: number) => ({
          title: <span>{obj.object_.name}</span>, key: `obj-${oi}`,
          children: obj.deliveryPoints?.map((dp: any, di: number) => ({
            title: <span>{dp.deliveryPoint.name}</span>, key: `dp-${oi}-${di}`,
            children: dp.meteringPoints?.map((mp: any, mi: number) => ({
              title: <span>{mp.name} ({mp.devices?.length || 0} ПУ)</span>, key: `mp-${oi}-${di}-${mi}`,
            })),
          })),
        })),
      }];
      setTreeData(tree);
    } finally { setTreeLoading(false); }
  };

  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (record: SaleContractResponse) => { setEditing(record); form.setFieldsValue({ ...record, counterpartyId: record.counterpartyId }); setModalOpen(true); };

  const columns = [
    { title: 'Номер', dataIndex: 'number', width: 150 },
    { title: 'Контрагент', dataIndex: 'counterpartyName', ellipsis: true },
    { title: 'Период', width: 200, render: (_: any, r: SaleContractResponse) => `${r.dateFrom} — ${r.dateTo || '...'}` },
    { title: 'ЦК', dataIndex: 'priceCategory', width: 70, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'Подтв.', dataIndex: 'confirmed', width: 80, render: (v: boolean) => v ? <Tag color="green">Да</Tag> : <Tag>Нет</Tag> },
    { title: '', width: 180, render: (_: any, record: SaleContractResponse) => (
      <Space>
        <Button type="link" size="small" icon={<ApartmentOutlined />} onClick={() => loadTree(record.id)} loading={treeLoading}>Дерево</Button>
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
        <Typography.Title level={4} style={{ margin: 0 }}>Договоры продажи</Typography.Title>
        <Space>
          <Input prefix={<SearchOutlined />} placeholder="Номер договора..." value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }} style={{ width: 240 }} allowClear />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Добавить</Button>
        </Space>
      </div>

      <Table columns={columns} dataSource={data?.items} loading={isLoading} rowKey="id"
        pagination={{ current: page, total: data?.total, pageSize: 20, onChange: setPage }} />

      <Modal title={editing ? 'Редактировать договор' : 'Новый договор'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={() => form.submit()} width={600}>
        <Form form={form} layout="vertical" onFinish={(v) => saveMutation.mutate(v)}>
          <Form.Item name="number" label="Номер" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="counterpartyId" label="Контрагент" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={counterpartiesData?.items?.map((c: any) => ({ label: `${c.code} — ${c.name}`, value: c.id })) || []} />
          </Form.Item>
          <Form.Item name="dateFrom" label="Дата начала" rules={[{ required: true }]}><Input placeholder="YYYY-MM-DD" /></Form.Item>
          <Form.Item name="dateTo" label="Дата окончания"><Input placeholder="YYYY-MM-DD" /></Form.Item>
          <Form.Item name="priceCategory" label="Ценовая категория" initialValue="CK1">
            <Select options={['CK1', 'CK3', 'CK4', 'FCK'].map(v => ({ label: v, value: v }))} />
          </Form.Item>
          <Form.Item name="type" label="Тип" initialValue="ENERGY_SALE">
            <Select options={['ENERGY_SALE', 'POWER_SALE'].map(v => ({ label: v, value: v }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Drawer title="Дерево договора" open={treeOpen} onClose={() => setTreeOpen(false)} width={500} loading={treeLoading}>
        {treeData && <Tree treeData={treeData} defaultExpandAll showLine />}
      </Drawer>
    </div>
  );
}
