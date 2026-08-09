import { useState, useRef, useEffect } from 'react';
import { Typography, Input, Button, Card, Tag, Collapse, Space, Empty, Spin, Alert } from 'antd';
import { SendOutlined, RobotOutlined, UserOutlined, ClearOutlined } from '@ant-design/icons';
import { useMutation, useQuery } from '@tanstack/react-query';
import { aiApi, SourceRefDto } from '../../api/ai';

interface Msg {
  role: 'user' | 'assistant';
  content: string;
  sources?: SourceRefDto[];
}

export default function AiChatPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);

  const { data: health } = useQuery({ queryKey: ['ai-health'], queryFn: aiApi.health, refetchInterval: 30000 });

  const askMut = useMutation({
    mutationFn: (q: string) => aiApi.ask(q, messages.filter(m => m.role === 'user').map(m => ({ role: 'user', content: m.content }))),
    onSuccess: (resp) => {
      setMessages(prev => [...prev, { role: 'assistant', content: resp.answer, sources: resp.sources }]);
    },
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, askMut.isPending]);

  const send = () => {
    const q = input.trim();
    if (!q) return;
    setMessages(prev => [...prev, { role: 'user', content: q }]);
    setInput('');
    askMut.mutate(q);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 140px)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>AI-агент нормативной базы</Typography.Title>
        <Space>
          {health && !health.worker && <Alert type="warning" message="ai-worker не запущен" showIcon style={{ padding: '0 12px' }} />}
          <Button icon={<ClearOutlined />} onClick={() => setMessages([])}>Очистить</Button>
        </Space>
      </div>

      <Card style={{ flex: 1, overflow: 'auto', background: '#fafafa' }}>
        {messages.length === 0 && !askMut.isPending ? (
          <Empty description="Задайте вопрос по нормативной базе, например: «Какие поля обязательны в акте приёма-передачи электроэнергии по 442-ПП?»" />
        ) : (
          <Space direction="vertical" style={{ width: '100%' }} size={12}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: 'flex', justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
                <div style={{
                  maxWidth: '80%',
                  background: m.role === 'user' ? '#1677ff' : '#fff',
                  color: m.role === 'user' ? '#fff' : 'inherit',
                  padding: '10px 14px',
                  borderRadius: 12,
                  border: m.role === 'user' ? 'none' : '1px solid #f0f0f0',
                  whiteSpace: 'pre-wrap',
                }}>
                  <Space size={6} style={{ marginBottom: 4 }}>
                    {m.role === 'user' ? <UserOutlined /> : <RobotOutlined style={{ color: '#1677ff' }} />}
                    <Typography.Text strong style={{ fontSize: 12, color: m.role === 'user' ? 'rgba(255,255,255,0.85)' : '#999' }}>
                      {m.role === 'user' ? 'Вы' : 'AI-агент'}
                    </Typography.Text>
                  </Space>
                  <div>{m.content}</div>
                  {m.sources && m.sources.length > 0 && (
                    <Collapse size="small" ghost style={{ marginTop: 8 }} items={[{
                      key: 's',
                      label: <Typography.Text style={{ fontSize: 12, color: m.role === 'user' ? '#fff' : '#1677ff' }}>Источники ({m.sources.length})</Typography.Text>,
                      children: (
                        <Space direction="vertical" size={4} style={{ width: '100%' }}>
                          {m.sources.map((s, si) => (
                            <div key={si} style={{ background: '#fafafa', padding: 6, borderRadius: 6 }}>
                              <Tag color="blue">{s.docNumber || 'НПА'}</Tag>
                              <Typography.Text strong style={{ fontSize: 12 }}>{s.title}</Typography.Text>
                              <div style={{ fontSize: 12, color: '#666', marginTop: 4 }}>{s.text}</div>
                            </div>
                          ))}
                        </Space>
                      ),
                    }]} />
                  )}
                </div>
              </div>
            ))}
            {askMut.isPending && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <Card size="small" style={{ background: '#fff' }}>
                  <Spin size="small" /> <Typography.Text style={{ marginLeft: 8 }}>Агент думает...</Typography.Text>
                </Card>
              </div>
            )}
            <div ref={bottomRef} />
          </Space>
        )}
      </Card>

      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Input.TextArea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onPressEnter={(e) => { if (!e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Введите вопрос по нормативной базе..."
          autoSize={{ minRows: 1, maxRows: 4 }}
          disabled={askMut.isPending}
        />
        <Button type="primary" icon={<SendOutlined />} onClick={send} loading={askMut.isPending}
          style={{ height: 'auto' }}>Отправить</Button>
      </div>
    </div>
  );
}
