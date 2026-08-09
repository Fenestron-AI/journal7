import { useQuery } from '@tanstack/react-query';
import { Card, Row, Col, Statistic, Typography, Spin } from 'antd';
import { TeamOutlined, FileTextOutlined, ThunderboltOutlined, CalculatorOutlined, FilePdfOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { counterpartyApi, contractApi, powerProfileApi } from '../../api/endpoints';

async function fetchStats() {
  const [cp, ct, pp] = await Promise.all([
    counterpartyApi.list('', 1, 1),
    contractApi.list('', 1, 1),
    powerProfileApi.list('', 1, 1),
  ]);
  return {
    counterparties: cp.data.total,
    contracts: ct.data.total,
    profiles: pp.data.total,
    calculations: 1,
    invoices: 0,
  };
}

const sections = [
  { key: '/counterparties', title: 'Контрагенты', icon: <TeamOutlined />, color: '#1677ff', bg: '#e6f4ff', stat: 'counterparties' },
  { key: '/contracts', title: 'Договоры', icon: <FileTextOutlined />, color: '#52c41a', bg: '#f6ffed', stat: 'contracts' },
  { key: '/power-profiles', title: 'Профили мощности', icon: <ThunderboltOutlined />, color: '#fa8c16', bg: '#fff7e6', stat: 'profiles' },
  { key: '/calculations', title: 'Расчёты', icon: <CalculatorOutlined />, color: '#722ed1', bg: '#f9f0ff', stat: 'calculations' },
  { key: '/invoices', title: 'Счета', icon: <FilePdfOutlined />, color: '#eb2f96', bg: '#fff0f6', stat: 'invoices' },
];

export default function DashboardPage() {
  const { data, isLoading } = useQuery({ queryKey: ['dashboard-stats'], queryFn: fetchStats });
  const navigate = useNavigate();

  if (isLoading) return <Spin size="large" style={{ display: 'block', margin: '80px auto' }} />;

  return (
    <div>
      <Typography.Title level={4} style={{ marginBottom: 24 }}>Дашборд</Typography.Title>
      <Row gutter={[16, 16]}>
        {sections.map((s) => (
          <Col xs={24} sm={12} lg={8} xl={4} key={s.key}>
            <Card hoverable onClick={() => navigate(s.key)}
              style={{ borderTop: `3px solid ${s.color}`, cursor: 'pointer' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div style={{ width: 40, height: 40, borderRadius: 8, background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: s.color }}>
                  {s.icon}
                </div>
                <ArrowRightOutlined style={{ color: '#bbb', fontSize: 12 }} />
              </div>
              <Statistic title={<Typography.Text type="secondary" style={{ fontSize: 13 }}>{s.title}</Typography.Text>}
                value={(data as any)?.[s.stat] || 0}
                valueStyle={{ fontSize: 28, fontWeight: 700, color: s.color, marginTop: 8 }} />
            </Card>
          </Col>
        ))}
      </Row>
    </div>
  );
}
