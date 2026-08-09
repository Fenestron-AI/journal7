import { Card, Row, Col, Statistic, Typography } from 'antd';
import { TeamOutlined, FileTextOutlined, ThunderboltOutlined, CalculatorOutlined } from '@ant-design/icons';

export default function DashboardPage() {
  return (
    <div>
      <Typography.Title level={4}>Дашборд</Typography.Title>
      <Row gutter={16} style={{ marginTop: 16 }}>
        <Col span={6}><Card><Statistic title="Контрагенты" value={0} prefix={<TeamOutlined />} /></Card></Col>
        <Col span={6}><Card><Statistic title="Договоры" value={0} prefix={<FileTextOutlined />} /></Card></Col>
        <Col span={6}><Card><Statistic title="Профили мощности" value={0} prefix={<ThunderboltOutlined />} /></Card></Col>
        <Col span={6}><Card><Statistic title="Расчёты" value={0} prefix={<CalculatorOutlined />} /></Card></Col>
      </Row>
    </div>
  );
}
