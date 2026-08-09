import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, Form, Input, Button, Typography, message, Alert } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useAuthStore } from '../../stores/authStore';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const login = useAuthStore((s) => s.login);
  const navigate = useNavigate();

  const onFinish = async (values: { username: string; password: string }) => {
    setLoading(true);
    setError(null);
    try {
      await login(values.username, values.password);
      message.success('Вход выполнен');
      navigate('/');
    } catch (e: any) {
      const msg = e.response?.data?.message || e.message || 'Ошибка входа';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '100vh', background: '#f5f5f5' }}>
      <Card style={{ width: 400 }}>
        <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 24 }}>journal7</Typography.Title>
        {error && <Alert type="error" message={error} style={{ marginBottom: 16 }} showIcon />}
        <Form onFinish={onFinish} size="large">
          <Form.Item name="username" rules={[{ required: true, message: 'Введите логин' }]}>
            <Input prefix={<UserOutlined />} placeholder="Логин" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: 'Введите пароль' }]}>
            <Input.Password prefix={<LockOutlined />} placeholder="Пароль" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" loading={loading} block>Войти</Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}
