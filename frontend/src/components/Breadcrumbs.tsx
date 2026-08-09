import { Typography } from 'antd';
import { HomeOutlined } from '@ant-design/icons';

interface BreadcrumbItem {
  title: string;
  href?: string;
}

export default function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  return (
    <div style={{ marginBottom: 8, fontSize: 13, color: '#888' }}>
      <HomeOutlined style={{ marginRight: 4 }} />
      {items.map((item, i) => (
        <span key={i}>
          {i > 0 && ' / '}
          {item.href ? <a href={item.href}>{item.title}</a> : <Typography.Text type="secondary">{item.title}</Typography.Text>}
        </span>
      ))}
    </div>
  );
}
