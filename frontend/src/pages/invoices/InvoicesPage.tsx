import { useState } from 'react';
import { Table, Button, Select, Modal, Form, Input, message, Typography, Space, Tag } from 'antd';
import { FileAddOutlined, DownloadOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { invoiceApi, contractApi, calculationApi, InvoiceResponse } from '../../api/endpoints';

export default function InvoicesPage() {
  const [contractId, setContractId] = useState<string | null>(null);
  const [genModalOpen, setGenModalOpen] = useState(false);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: contractsData } = useQuery({
    queryKey: ['contracts-all'],
    queryFn: () => contractApi.list('', 1, 1000).then(r => r.data),
  });

  const { data: calcsData } = useQuery({
    queryKey: ['calculations', contractId],
    queryFn: () => contractId ? calculationApi.list(contractId).then(r => r.data) : Promise.resolve({ items: [], total: 0 }),
    enabled: !!contractId,
  });

  const { data: invoicesData, isLoading } = useQuery({
    queryKey: ['invoices', contractId],
    queryFn: () => contractId ? invoiceApi.list(contractId).then(r => r.data) : Promise.resolve([]),
    enabled: !!contractId,
  });

  const genMutation = useMutation({
    mutationFn: (values: { calculationId: string; number: string; type: string }) =>
      invoiceApi.generate(contractId!, values.calculationId, values.number, values.type),
    onSuccess: () => { message.success('Счёт создан'); setGenModalOpen(false); queryClient.invalidateQueries({ queryKey: ['invoices'] }); },
  });

  const columns = [
    { title: 'Номер', dataIndex: 'number', width: 150 },
    { title: 'Дата', dataIndex: 'date', width: 110 },
    { title: 'Тип', dataIndex: 'type', width: 130, render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Сумма без НДС', dataIndex: 'totalAmount', width: 140, render: (v: number) => v?.toFixed(2) },
    { title: 'НДС', dataIndex: 'totalVat', width: 100, render: (v: number) => v?.toFixed(2) },
    { title: 'Итого', dataIndex: 'totalWithVat', width: 130, render: (v: number) => v?.toFixed(2) },
    { title: 'Статус', dataIndex: 'status', width: 100, render: (v: string) => <Tag color={v === 'ISSUED' ? 'green' : 'default'}>{v}</Tag> },
    { title: '', width: 80, render: (_: any, r: InvoiceResponse) => (
      <Button type="link" size="small" icon={<DownloadOutlined />} href={`/api/v1/reports/bill/${r.id}`} target="_blank">XLSX</Button>
    )},
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: '0 0 16px' }}>Счета на оплату</Typography.Title>
        <Space>
          <Select placeholder="Выберите договор" showSearch optionFilterProp="label" style={{ width: 320 }}
            value={contractId} onChange={setContractId} allowClear
            options={contractsData?.items?.map((c: any) => ({ label: `${c.number} — ${c.counterpartyName}`, value: c.id })) || []} />
          <Button type="primary" icon={<FileAddOutlined />} disabled={!contractId} onClick={() => { form.resetFields(); setGenModalOpen(true); }}>
            Создать счёт
          </Button>
        </Space>
      </div>

      <Table columns={columns} dataSource={invoicesData} loading={isLoading} rowKey="id" pagination={false} />

      <Modal title="Создать счёт из расчёта" open={genModalOpen}
        onCancel={() => setGenModalOpen(false)} onOk={() => form.submit()} confirmLoading={genMutation.isPending}>
        <Form form={form} layout="vertical" onFinish={(v) => genMutation.mutate(v)}>
          <Form.Item name="calculationId" label="Расчёт" rules={[{ required: true }]}>
            <Select options={calcsData?.items?.filter((c: any) => c.status === 'COMPLETED').map((c: any) => ({
              label: `${c.periodFrom} — ${c.periodTo} | ${c.totalCost.toFixed(2)} руб.`, value: c.id
            })) || []} />
          </Form.Item>
          <Form.Item name="number" label="Номер счёта" rules={[{ required: true }]}><Input /></Form.Item>
          <Form.Item name="type" label="Тип" initialValue="REALIZATION">
            <Select options={['REALIZATION', 'ADVANCE_1', 'ADVANCE_2'].map(v => ({ label: v, value: v }))} />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
