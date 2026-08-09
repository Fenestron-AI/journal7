import { useState } from 'react';
import { Table, Button, Select, Modal, Form, InputNumber, message, Typography, Space, Tag, Collapse, Card } from 'antd';
import { PlayCircleOutlined, CalculatorOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { calculationApi, contractApi, powerProfileApi, CalculationResultResponse } from '../../api/endpoints';

export default function CalculationsPage() {
  const [contractId, setContractId] = useState<string | null>(null);
  const [calcModalOpen, setCalcModalOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [selectedCalc, setSelectedCalc] = useState<CalculationResultResponse | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: contractsData } = useQuery({
    queryKey: ['contracts-all'],
    queryFn: () => contractApi.list('', 1, 1000).then(r => r.data),
  });

  const { data: profilesData } = useQuery({
    queryKey: ['profiles-all'],
    queryFn: () => powerProfileApi.list('', 1).then(r => r.data),
  });

  const { data: calcsData, isLoading } = useQuery({
    queryKey: ['calculations', contractId],
    queryFn: () => contractId ? calculationApi.list(contractId).then(r => r.data) : Promise.resolve({ items: [], total: 0 }),
    enabled: !!contractId,
  });

  const runMutation = useMutation({
    mutationFn: (values: any) => calculationApi.run(contractId!, values),
    onSuccess: (res) => { message.success('Расчёт выполнен'); setCalcModalOpen(false); setSelectedCalc(res.data); setDetailOpen(true); queryClient.invalidateQueries({ queryKey: ['calculations'] }); },
    onError: (e: any) => message.error(e.response?.data?.message || 'Ошибка расчёта'),
  });

  const columns = [
    { title: 'Период', width: 200, render: (_: any, r: CalculationResultResponse) => `${r.periodFrom} — ${r.periodTo}` },
    { title: 'ЦК', dataIndex: 'priceCategory', width: 70, render: (v: string) => <Tag color="blue">{v}</Tag> },
    { title: 'Объём, МВт⋅ч', dataIndex: 'totalVolume', width: 120, render: (v: number) => v.toFixed(3) },
    { title: 'Стоимость, руб.', dataIndex: 'totalCost', width: 150, render: (v: number) => v.toFixed(2) },
    { title: 'Цена, руб/МВт⋅ч', dataIndex: 'costPerMwh', width: 130, render: (v: number) => v.toFixed(2) },
    { title: 'Статус', dataIndex: 'status', width: 100, render: (v: string) => <Tag color={v === 'COMPLETED' ? 'green' : 'red'}>{v}</Tag> },
    { title: '', width: 120, render: (_: any, r: CalculationResultResponse) => (
      <Button type="link" size="small" onClick={() => { setSelectedCalc(r); setDetailOpen(true); }}>Детали</Button>
    )},
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Расчёты</Typography.Title>
        <Space>
          <Select placeholder="Выберите договор" showSearch optionFilterProp="label" style={{ width: 320 }}
            value={contractId} onChange={setContractId} allowClear
            options={contractsData?.items?.map((c: any) => ({ label: `${c.number} — ${c.counterpartyName}`, value: c.id })) || []} />
          <Button type="primary" icon={<PlayCircleOutlined />} disabled={!contractId} onClick={() => { form.resetFields(); setCalcModalOpen(true); }}>
            Запустить расчёт
          </Button>
        </Space>
      </div>

      <Table columns={columns} dataSource={calcsData?.items} loading={isLoading} rowKey="id" pagination={false} />

      <Modal title="Параметры расчёта" open={calcModalOpen} onCancel={() => setCalcModalOpen(false)}
        onOk={() => form.submit()} confirmLoading={runMutation.isPending}>
        <Form form={form} layout="vertical" onFinish={(v) => runMutation.mutate(v)}>
          <Form.Item name="profileId" label="Профиль мощности" rules={[{ required: true }]}>
            <Select options={profilesData?.items?.map((p: any) => ({ label: `${p.code} — ${p.name}`, value: p.id })) || []} />
          </Form.Item>
          <Form.Item name={['tariffRates', 'singleRate']} label="Единый тариф, руб/МВт⋅ч"><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name={['tariffRates', 'peakRate']} label="Пиковый тариф"><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name={['tariffRates', 'halfPeakRate']} label="Полупиковый тариф"><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name={['tariffRates', 'offPeakRate']} label="Ночной тариф"><InputNumber style={{ width: '100%' }} /></Form.Item>
          <Form.Item name="salesMarkup" label="Сбытовая надбавка"><InputNumber style={{ width: '100%' }} /></Form.Item>
        </Form>
      </Modal>

      <Modal title="Детали расчёта" open={detailOpen} onCancel={() => setDetailOpen(false)} footer={null} width={800}>
        {selectedCalc && (
          <div>
            <Card size="small" style={{ marginBottom: 16 }}>
              <Space direction="vertical">
                <span><strong>Период:</strong> {selectedCalc.periodFrom} — {selectedCalc.periodTo}</span>
                <span><strong>ЦК:</strong> {selectedCalc.priceCategory}</span>
                <span><strong>Объём:</strong> {selectedCalc.totalVolume.toFixed(3)} МВт⋅ч</span>
                <span><strong>Стоимость:</strong> {selectedCalc.totalCost.toFixed(2)} руб.</span>
                <span><strong>Цена:</strong> {selectedCalc.costPerMwh.toFixed(2)} руб/МВт⋅ч</span>
              </Space>
            </Card>
            {selectedCalc.zoneResults && Object.keys(selectedCalc.zoneResults).length > 1 && (
              <Card size="small" title="По зонам" style={{ marginBottom: 16 }}>
                {Object.entries(selectedCalc.zoneResults).map(([key, z]) => (
                  <Tag key={key} style={{ margin: 4 }}>{z.zone}: {z.volume.toFixed(3)} МВт⋅ч × {z.rate.toFixed(2)} = {z.cost.toFixed(2)} руб.</Tag>
                ))}
              </Card>
            )}
            <Typography.Text type="secondary">Почасовых значений: {selectedCalc.hourlyResults?.length || 0}</Typography.Text>
          </div>
        )}
      </Modal>
    </div>
  );
}
