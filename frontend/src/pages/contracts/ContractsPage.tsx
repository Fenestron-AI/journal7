import { useState } from 'react';
import { Table, Button, Input, Space, Modal, Form, message, Popconfirm, Typography, Tree, Tag, Select, Descriptions } from 'antd';
import { PlusOutlined, ApartmentOutlined, ReloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { contractApi, counterpartyApi, SaleContractResponse } from '../../api/endpoints';
import ObjectPage from '../../components/ObjectPage';

export default function ContractsPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<SaleContractResponse | null>(null);
  const [selected, setSelected] = useState<SaleContractResponse | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [treeData, setTreeData] = useState<any>(null);
  const [treeLoading, setTreeLoading] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ['contracts', search, page],
    queryFn: () => contractApi.list(search, page).then(r => r.data),
  });

  const { data: cps } = useQuery({
    queryKey: ['counterparties-all'],
    queryFn: () => counterpartyApi.list('', 1, 1000).then(r => r.data),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => contractApi.delete(id),
    onSuccess: () => { message.success('Удалено'); queryClient.invalidateQueries({ queryKey: ['contracts'] }); },
  });

  const saveMut = useMutation({
    mutationFn: (v: any) => editing ? contractApi.update(editing.id, v) : contractApi.create(v),
    onSuccess: () => { message.success(editing ? 'Обновлено' : 'Создано'); setModalOpen(false); queryClient.invalidateQueries({ queryKey: ['contracts'] }); },
  });

  const loadTree = async (id: string) => {
    setTreeLoading(true);
    try {
      const { data } = await contractApi.tree(id);
      const tree = [{
        title: <span>Договор №{data.contract.number}</span>, key: 'c',
        children: data.objects?.map((obj: any, oi: number) => ({
          title: <span>{obj.object_.name}</span>, key: `o${oi}`,
          children: obj.deliveryPoints?.map((dp: any, di: number) => ({
            title: <span>{dp.deliveryPoint.name}</span>, key: `d${oi}-${di}`,
            children: dp.meteringPoints?.map((mp: any, mi: number) => ({
              title: <span>{mp.name} <Tag style={{ fontSize: 10 }}>{mp.voltageLevel}</Tag> ({mp.devices?.length || 0} ПУ)</span>,
              key: `m${oi}-${di}-${mi}`,
            })),
          })),
        })),
      }];
      setTreeData(tree);
    } finally { setTreeLoading(false); }
  };

  const openRow = (r: SaleContractResponse) => { setSelected(r); setDrawerOpen(true); loadTree(r.id); };
  const openCreate = () => { setEditing(null); form.resetFields(); setModalOpen(true); };
  const openEdit = (r: SaleContractResponse) => { setEditing(r); form.setFieldsValue(r); setModalOpen(true); };

  const columns = [
    { title: 'Номер', dataIndex: 'number', width: 140, render: (v: string, r: SaleContractResponse) => <a onClick={() => openRow(r)}>{v}</a> },
    { title: 'Контрагент', dataIndex: 'counterpartyName', ellipsis: true },
    { title: 'ЦК', dataIndex: 'priceCategory', width: 60, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'Период', width: 180, render: (_: any, r: SaleContractResponse) => `${r.dateFrom} — ${r.dateTo || '...'}` },
    { title: '', width: 80, render: (_: any, r: SaleContractResponse) => (
      <Popconfirm title="Удалить?" onConfirm={() => deleteMut.mutate(r.id)}>
        <Button type="link" size="small" danger>Уд.</Button>
      </Popconfirm>
    )},
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <Typography.Title level={4} style={{ margin: '0 0 16px' }}>Договоры продажи</Typography.Title>
        <Space>
          <Input placeholder="Номер договора..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            style={{ width: 200 }} allowClear prefix={<ApartmentOutlined />} />
          <Button icon={<ReloadOutlined />} onClick={() => queryClient.invalidateQueries({ queryKey: ['contracts'] })} />
          <Button type="primary" icon={<PlusOutlined />} onClick={openCreate}>Добавить</Button>
        </Space>
      </div>

      <Table columns={columns} dataSource={data?.items} loading={isLoading} rowKey="id" size="middle"
        pagination={{ current: page, total: data?.total, pageSize: 20, onChange: setPage, showSizeChanger: false, showTotal: (t) => `Всего: ${t}` }} />

      {/* Object Page */}
      {selected && (
        <ObjectPage title={`Договор №${selected.number}`}
          subtitle={selected.counterpartyName}
          dataPoints={[
            { label: 'Ценовая категория', value: <Tag color="blue">{selected.priceCategory}</Tag> },
            { label: 'Тип', value: selected.type },
            { label: 'Статус', value: selected.confirmed ? <Tag color="green">Подтверждён</Tag> : <Tag>Черновик</Tag> },
            { label: 'Период', value: `${selected.dateFrom} — ${selected.dateTo || '...'}` },
          ]}
          sections={[
            { title: 'Иерархия объектов', content: treeLoading ? 'Загрузка...' : <Tree treeData={treeData} defaultExpandAll showLine /> },
          ]}
          open={drawerOpen} onClose={() => { setDrawerOpen(false); setTreeData(null); }}
          onEdit={() => openEdit(selected)} />
      )}

      <Modal title={editing ? 'Редактировать договор' : 'Новый договор'} open={modalOpen}
        onCancel={() => setModalOpen(false)} onOk={() => form.submit()} width={520}>
        <Form form={form} layout="vertical" onFinish={(v) => saveMut.mutate(v)}>
          <Form.Item name="number" label="Номер" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="counterpartyId" label="Контрагент" rules={[{ required: true }]}>
            <Select showSearch optionFilterProp="label" options={cps?.items?.map((c: any) => ({ label: `${c.code} — ${c.name}`, value: c.id })) || []} />
          </Form.Item>
          <Form.Item name="dateFrom" label="Дата начала"><Input placeholder="YYYY-MM-DD" /></Form.Item>
          <Form.Item name="dateTo" label="Дата окончания"><Input placeholder="YYYY-MM-DD" /></Form.Item>
          <Form.Item name="priceCategory" label="Ценовая категория" initialValue="CK1">
            <Select options={['CK1', 'CK3', 'CK4', 'FCK'].map(v => ({ label: v, value: v }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
