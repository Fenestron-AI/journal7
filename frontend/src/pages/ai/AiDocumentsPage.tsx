import { useState } from 'react';
import { Table, Button, Tag, Typography, Space, Popconfirm, message, Badge } from 'antd';
import { ReloadOutlined, BellOutlined, PlayCircleOutlined, StopOutlined, DeleteOutlined } from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { aiApi, LegalDocumentResponse, NotificationDto } from '../../api/ai';

const statusColors: Record<string, string> = {
  ACTIVE: 'green',
  SUPERSEDED: 'orange',
  PROCESSING: 'blue',
  ERROR: 'red',
};

export default function AiDocumentsPage() {
  const [status, setStatus] = useState<string | undefined>();
  const queryClient = useQueryClient();

  const { data: docs, isLoading } = useQuery({
    queryKey: ['ai-docs', status],
    queryFn: () => aiApi.listDocuments(status),
    refetchInterval: 5000,
  });

  const { data: notifications } = useQuery({
    queryKey: ['ai-notifications'],
    queryFn: () => aiApi.notifications(false),
    refetchInterval: 60000,
  });

  const refreshMut = useMutation({
    mutationFn: aiApi.refresh,
    onSuccess: () => {
      message.success('Сканирование watch-директории запущено');
      setTimeout(() => queryClient.invalidateQueries({ queryKey: ['ai-docs'] }), 3000);
    },
  });

  const startMut = useMutation({
    mutationFn: (id: string) => aiApi.startIngest(id),
    onSuccess: () => { message.success('Обработка запущена'); queryClient.invalidateQueries({ queryKey: ['ai-docs'] }); },
    onError: (e: any) => message.error(e.response?.data?.message || 'Ошибка'),
  });

  const cancelMut = useMutation({
    mutationFn: (id: string) => aiApi.cancelIngest(id),
    onSuccess: () => { message.success('Остановлено'); queryClient.invalidateQueries({ queryKey: ['ai-docs'] }); },
  });

  const deleteMut = useMutation({
    mutationFn: aiApi.deleteDocument,
    onSuccess: () => { message.success('Удалено'); queryClient.invalidateQueries({ queryKey: ['ai-docs'] }); },
  });

  const markReadMut = useMutation({
    mutationFn: aiApi.markRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['ai-notifications'] }),
  });

  const columns = [
    { title: 'Наименование', dataIndex: 'title', ellipsis: true },
    { title: '№', dataIndex: 'docNumber', width: 70, render: (v: string) => v && <Tag>{v}</Tag> },
    { title: 'Редакция', dataIndex: 'revision', width: 110 },
    { title: 'Тип', dataIndex: 'docType', width: 90, render: (v: string) => <Tag>{v}</Tag> },
    { title: 'Чанки', dataIndex: 'chunkCount', width: 70 },
    { title: 'Статус', dataIndex: 'status', width: 110, render: (v: string) => <Tag color={statusColors[v] || 'default'}>{v}</Tag> },
    { title: '', width: 150, render: (_: any, r: LegalDocumentResponse) => (
      <Space size={0}>
        {r.status !== 'PROCESSING' ? (
          <Button type="link" size="small" icon={<PlayCircleOutlined />} onClick={() => startMut.mutate(r.id)}
            disabled={!r.filePath}>Запустить</Button>
        ) : (
          <Button type="link" size="small" icon={<StopOutlined />} onClick={() => cancelMut.mutate(r.id)} danger>Стоп</Button>
        )}
        <Popconfirm title="Удалить документ?" onConfirm={() => deleteMut.mutate(r.id)}>
          <Button type="link" size="small" icon={<DeleteOutlined />} danger />
        </Popconfirm>
      </Space>
    )},
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <Typography.Title level={4} style={{ margin: 0 }}>Нормативная база</Typography.Title>
        <Space>
          {notifications && notifications.length > 0 && (
            <PopoverList notifications={notifications} onRead={(id) => markReadMut.mutate(id)} />
          )}
          <Button icon={<ReloadOutlined />} onClick={() => refreshMut.mutate()} loading={refreshMut.isPending}>
            Сканировать директорию
          </Button>
        </Space>
      </div>
      <Typography.Paragraph type="secondary" style={{ fontSize: 13, marginBottom: 12 }}>
        Документы сканируются из <code>data/legal-docs/current/</code>. Положите новый файл туда и нажмите «Сканировать директорию».
        Для обработки с эмбеддингами нажмите «Запустить».
      </Typography.Paragraph>

      <Table columns={columns} dataSource={docs} loading={isLoading} rowKey="id" size="middle" pagination={false} />
    </div>
  );
}

function PopoverList({ notifications, onRead }: { notifications: NotificationDto[]; onRead: (id: string) => void }) {
  return (
    <Badge count={notifications.length}>
      <Button icon={<BellOutlined />}>Уведомления</Button>
    </Badge>
  );
}
