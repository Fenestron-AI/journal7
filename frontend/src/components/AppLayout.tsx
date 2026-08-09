import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Typography } from 'antd';
import { TeamOutlined, FileTextOutlined, ThunderboltOutlined, CalculatorOutlined, FilePdfOutlined, DashboardOutlined, LogoutOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { useEffect } from 'react';

const { Sider, Content, Header } = Layout;

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, fetchUser, logout } = useAuthStore();

  useEffect(() => { if (!user) fetchUser(); }, []);

  const menuItems = [
    { key: '/', icon: <DashboardOutlined />, label: 'Дашборд' },
    { key: '/counterparties', icon: <TeamOutlined />, label: 'Контрагенты' },
    { key: '/contracts', icon: <FileTextOutlined />, label: 'Договоры' },
    { key: '/power-profiles', icon: <ThunderboltOutlined />, label: 'Профили мощности' },
    { key: '/calculations', icon: <CalculatorOutlined />, label: 'Расчёты' },
    { key: '/invoices', icon: <FilePdfOutlined />, label: 'Счета' },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider width={220} theme="light" style={{ borderRight: '1px solid #f0f0f0' }}>
        <div style={{ padding: '16px', fontWeight: 700, fontSize: 18, color: '#1677ff' }}>journal7</div>
        <Menu mode="inline" selectedKeys={[location.pathname]} items={menuItems} onClick={({ key }) => navigate(key)} />
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', borderBottom: '1px solid #f0f0f0' }}>
          <Typography.Text style={{ marginRight: 16 }}>{user?.fullName}</Typography.Text>
          <Button icon={<LogoutOutlined />} onClick={() => { logout(); navigate('/login'); }}>Выход</Button>
        </Header>
        <Content style={{ margin: 24, padding: 24, background: '#fff', borderRadius: 8 }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
