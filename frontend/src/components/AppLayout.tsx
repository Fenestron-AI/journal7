import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Layout, Menu, Button, Typography, Tooltip } from 'antd';
import { TeamOutlined, FileTextOutlined, ThunderboltOutlined, CalculatorOutlined, FilePdfOutlined, DashboardOutlined, LogoutOutlined, DoubleLeftOutlined, DoubleRightOutlined } from '@ant-design/icons';
import { useAuthStore } from '../stores/authStore';
import { useEffect, useState } from 'react';

const { Sider, Content, Header } = Layout;

function usePersistedState<T>(key: string, defaultValue: T): [T, (v: T) => void] {
  const [state, setState] = useState<T>(() => {
    try { const stored = localStorage.getItem(key); return stored ? JSON.parse(stored) : defaultValue; }
    catch { return defaultValue; }
  });
  const setAndPersist = (value: T) => { setState(value); localStorage.setItem(key, JSON.stringify(value)); };
  return [state, setAndPersist];
}

const menuItems = [
  { key: '/', icon: <DashboardOutlined />, label: 'Дашборд' },
  { key: '/counterparties', icon: <TeamOutlined />, label: 'Контрагенты' },
  { key: '/contracts', icon: <FileTextOutlined />, label: 'Договоры' },
  { key: '/power-profiles', icon: <ThunderboltOutlined />, label: 'Профили мощности' },
  { key: '/calculations', icon: <CalculatorOutlined />, label: 'Расчёты' },
  { key: '/invoices', icon: <FilePdfOutlined />, label: 'Счета' },
];

export default function AppLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, fetchUser, logout } = useAuthStore();
  const [collapsed, setCollapsed] = usePersistedState('j7-sider-collapsed', false);

  useEffect(() => { if (!user) fetchUser(); }, []);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider collapsible collapsed={collapsed} onCollapse={setCollapsed} theme="light"
        trigger={null} width={220}
        style={{ borderRight: '1px solid #f0f0f0', overflow: 'auto', height: '100vh', position: 'sticky', top: 0, left: 0 }}>
        <div onClick={() => setCollapsed(!collapsed)} style={{ padding: collapsed ? '12px 8px' : '16px', fontWeight: 700, fontSize: 18, color: '#1677ff', textAlign: 'center', cursor: 'pointer' }}>
          {collapsed ? 'j7' : 'journal7'}
        </div>

        {collapsed ? (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '8px 0' }}>
            {menuItems.map(item => (
              <Tooltip key={item.key} title={item.label} placement="right" mouseEnterDelay={1} trigger={["hover"]}>
                <Button type="text" icon={item.icon}
                  onClick={() => navigate(item.key)}
                  style={{
                    width: 48, height: 48, fontSize: 18,
                    color: location.pathname === item.key ? '#1677ff' : '#666',
                    background: location.pathname === item.key ? '#e6f4ff' : 'transparent',
                  }} />
              </Tooltip>
            ))}
          </div>
        ) : (
          <Menu mode="inline" selectedKeys={[location.pathname]} items={menuItems} onClick={({ key }) => navigate(key)} />
        )}
      </Sider>
      <Layout>
        <Header style={{ background: '#fff', padding: '0 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #f0f0f0', height: 48, lineHeight: '48px' }}>
          <Tooltip title={collapsed ? 'Развернуть меню' : 'Свернуть меню'} mouseEnterDelay={1.0} trigger="hover">
            <Button type="text" icon={collapsed ? <DoubleRightOutlined /> : <DoubleLeftOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              style={{ fontSize: 14, width: 40, height: 40 }} />
          </Tooltip>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Typography.Text>{user?.fullName}</Typography.Text>
            <Button size="small" icon={<LogoutOutlined />} onClick={() => { logout(); navigate('/login'); }}>Выход</Button>
          </div>
        </Header>
        <Content style={{ padding: 24, background: '#fff' }}>
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
}
