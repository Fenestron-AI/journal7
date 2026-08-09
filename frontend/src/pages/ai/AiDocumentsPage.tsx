import { useState } from 'react';
import { Table, Button, Tag, Typography, Space, Popconfirm, message, Badge } from 'antd';
import { ReloadOutlined, BellOutlined } from '@ant-design/icons';
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

  const deleteMut = useMutation({
    mutationFn: aiApi.deleteDocument,
    onSuccess: () => {
      message.success('Удалено');
      queryClient.invalidateQueries({ queryKey: ['ai-docs'] });
    },
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
    { title: '', width: 60, render: (_: any, r: LegalDocumentResponse) => (
      <Popconfirm title="Удалить документ?" onConfirm={() => deleteMut.mutate(r.id)}>
        <Button type="link" size="small" danger>Уд.</Button>
      </Popconfirm>
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
