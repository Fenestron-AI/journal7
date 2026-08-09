import { useQuery } from '@tanstack/react-query';
import { Card, Row, Col, Statistic, Typography, Spin } from 'antd';
import { TeamOutlined, FileTextOutlined, ThunderboltOutlined, CalculatorOutlined, FilePdfOutlined } from '@ant-design/icons';
import { counterpartyApi, contractApi, powerProfileApi } from '../../api/endpoints';
import api from '../../api/client';

async function fetchStats() {
  const [cpRes, ctRes, ppRes] = await Promise.all([
    counterpartyApi.list('', 1, 1),
    contractApi.list('', 1, 1),
    powerProfileApi.list('', 1, 1),
  ]);
  let calcTotal = 0, calcCost = 0;
  try {
    const { data } = await api.get('/calculations/sale?contractId=none');
  } catch {}
  return {
    counterparties: cpRes.data.total,
    contracts: ctRes.data.total,
    profiles: ppRes.data.total,
    calculations: calcTotal,
    totalCost: calcCost,
  };
}

export default function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard-stats'], queryFn: fetchStats });

  if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;

  return (
    <div>
      <Typography.Title level={4}>Дашборд</Typography.Title>
      <Row gutter={[16, 16]} style={{ marginTop: 8 }}>
        <Col xs={24} sm={12} md={6}><Card hoverable><Statistic title="Контрагенты" value={data?.counterparties || 0} prefix={<TeamOutlined />} valueStyle={{ color: '#1677ff' }} /></Card></Col>
        <Col xs={24} sm={12} md={6}><Card hoverable><Statistic title="Договоры" value={data?.contracts || 0} prefix={<FileTextOutlined />} valueStyle={{ color: '#52c41a' }} /></Card></Col>
        <Col xs={24} sm={12} md={6}><Card hoverable><Statistic title="Профили мощности" value={data?.profiles || 0} prefix={<ThunderboltOutlined />} valueStyle={{ color: '#fa8c16' }} /></Card></Col>
        <Col xs={24} sm={12} md={6}><Card hoverable><Statistic title="Счета" value={data?.calculations || 0} prefix={<FilePdfOutlined />} valueStyle={{ color: '#eb2f96' }} /></Card></Col>
      </Row>
    </div>
  );
}
