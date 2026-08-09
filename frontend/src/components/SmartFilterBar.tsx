import { Input, Select, Button, Space } from 'antd';
import { SearchOutlined, ClearOutlined, SaveOutlined, StarOutlined } from '@ant-design/icons';
import { useState } from 'react';

export interface FilterField {
  key: string;
  label: string;
  type: 'text' | 'select';
  options?: { label: string; value: string }[];
}

interface SmartFilterBarProps {
  fields: FilterField[];
  onSearch: (values: Record<string, string>) => void;
  onReset: () => void;
  loading?: boolean;
}

export default function SmartFilterBar({ fields, onSearch, onReset, loading }: SmartFilterBarProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [savedFilters, setSavedFilters] = useState<Record<string, Record<string, string>>>(() => {
    try { return JSON.parse(localStorage.getItem('j7-filters') || '{}'); } catch { return {}; }
  });

  const updateValue = (key: string, value: string) => {
    const next = { ...values, [key]: value };
    if (!value) delete next[key];
    setValues(next);
  };

  const saveFilter = () => {
    const name = prompt('Название фильтра:');
    if (name) {
      const next = { ...savedFilters, [name]: { ...values } };
      setSavedFilters(next);
      localStorage.setItem('j7-filters', JSON.stringify(next));
    }
  };

  const applyFilter = (name: string) => {
    const fv = savedFilters[name];
    if (fv) { setValues(fv); onSearch(fv); }
  };

  return (
    <div style={{ marginBottom: 12, padding: '12px 16px', background: '#fafafa', borderRadius: 6, border: '1px solid #f0f0f0' }}>
      <Space wrap>
        {fields.map((f) => (
          f.type === 'select' ? (
            <Select key={f.key} placeholder={f.label} allowClear style={{ width: 160 }}
              value={values[f.key] || undefined}
              onChange={(v) => updateValue(f.key, v || '')}
              options={f.options} />
          ) : (
            <Input key={f.key} placeholder={f.label} allowClear style={{ width: 160 }}
              value={values[f.key] || ''}
              onChange={(e) => updateValue(f.key, e.target.value)}
              onPressEnter={() => onSearch(values)} />
          )
        ))}
        <Button type="primary" icon={<SearchOutlined />} onClick={() => onSearch(values)} loading={loading}>Найти</Button>
        <Button icon={<ClearOutlined />} onClick={() => { setValues({}); onReset(); }}>Сброс</Button>
        <Button icon={<SaveOutlined />} onClick={saveFilter} disabled={!Object.keys(values).length}>Сохранить</Button>
        {Object.keys(savedFilters).map((name) => (
          <Button key={name} size="small" type="text" icon={<StarOutlined />} onClick={() => applyFilter(name)}>{name}</Button>
        ))}
      </Space>
    </div>
  );
}
