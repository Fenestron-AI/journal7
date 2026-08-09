import { ReactNode, useState } from 'react';
import { Drawer, Descriptions, Tag, Space, Button, Divider, Typography } from 'antd';
import { EditOutlined, CloseOutlined } from '@ant-design/icons';

interface DataPoint { label: string; value: ReactNode; color?: string; icon?: ReactNode }
interface Section { title: string; content: ReactNode }

export default function ObjectPage({
  title, subtitle, dataPoints, sections, children, open, onClose, onEdit, width = 640
}: {
  title: string;
  subtitle?: string;
  dataPoints?: DataPoint[];
  sections?: Section[];
  children?: ReactNode;
  open: boolean;
  onClose: () => void;
  onEdit?: () => void;
  width?: number;
}) {
  return (
    <Drawer title={null} placement="right" open={open} onClose={onClose} width={width} closable={false}
      styles={{ body: { padding: 0 } }}>
      {/* Header with data points */}
      <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <Typography.Title level={4} style={{ margin: 0 }}>{title}</Typography.Title>
            {subtitle && <Typography.Text type="secondary">{subtitle}</Typography.Text>}
          </div>
          <Space>
            {onEdit && <Button icon={<EditOutlined />} onClick={onEdit}>Ред.</Button>}
            <Button icon={<CloseOutlined />} onClick={onClose} type="text" />
          </Space>
        </div>
        {dataPoints && (
          <div style={{ display: 'flex', gap: 32, marginTop: 16, flexWrap: 'wrap' }}>
            {dataPoints.map((dp, i) => (
              <div key={i}>
                <Typography.Text type="secondary" style={{ fontSize: 12 }}>{dp.label}</Typography.Text>
                <div style={{ fontSize: 20, fontWeight: 600, color: dp.color }}>{dp.value}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {/* Content sections */}
      <div style={{ padding: '16px 24px' }}>
        {sections?.map((sec, i) => (
          <div key={i} style={{ marginBottom: 16 }}>
            <Typography.Text strong style={{ fontSize: 14 }}>{sec.title}</Typography.Text>
            <div style={{ marginTop: 8 }}>{sec.content}</div>
            {i < (sections.length - 1) && <Divider style={{ margin: '12px 0' }} />}
          </div>
        ))}
        {children}
      </div>
    </Drawer>
  );
}
