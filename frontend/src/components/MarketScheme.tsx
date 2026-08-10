import { useState } from 'react';

const s: Record<string, React.CSSProperties> = {
  container: {
    padding: '20px 24px 20px',
  },
  header: {
    marginBottom: 16,
  },
  title: {
    fontSize: '1.2rem',
    fontWeight: 700,
    color: '#10304f',
  },
  tag: {
    display: 'inline-block',
    marginTop: 4,
    padding: '2px 10px',
    borderRadius: 999,
    background: '#e8f2ff',
    border: '1px solid #c9ddf7',
    color: '#1a6bd6',
    fontSize: '0.68rem',
    fontWeight: 600,
    textTransform: 'uppercase',
  },
  columns: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 12,
    alignItems: 'start',
  } as React.CSSProperties,
  col: {
    border: '1px solid #dce7f3',
    borderRadius: 14,
    padding: '12px 12px 14px',
    background: '#f7fafd',
    display: 'flex',
    flexDirection: 'column',
    gap: 8,
  } as React.CSSProperties,
  colL1: { borderTop: '3px solid #1a6bd6' },
  colL2: { borderTop: '3px solid #d98c1f' },
  colL3: { borderTop: '3px solid #2c9e63' },
  colL4: { borderTop: '3px solid #7a8aa0' },
  colHead: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    paddingBottom: 10,
    borderBottom: '1px solid #e3ecf5',
  },
  colNum: {
    width: 24,
    height: 24,
    borderRadius: 7,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '0.75rem',
    fontWeight: 700,
    flex: '0 0 auto',
    color: '#ffffff',
  },
  colNum1: { background: '#1a6bd6' },
  colNum2: { background: '#d98c1f' },
  colNum3: { background: '#2c9e63' },
  colNum4: { background: '#7a8aa0' },
  colTitle: {
    fontSize: '0.88rem',
    fontWeight: 700,
    color: '#10304f',
    lineHeight: 1.2,
  },
  colSubtitle: {
    display: 'block',
    fontSize: '0.65rem',
    fontWeight: 400,
    color: '#7c90a8',
  },
  card: {
    background: '#ffffff',
    border: '1px solid #e3ecf5',
    borderRadius: 10,
    padding: '10px 12px',
  },
  cardB: {
    display: 'block',
    fontSize: '0.82rem',
    color: '#10304f',
    marginBottom: 2,
  },
  cardSpan: {
    fontSize: '0.73rem',
    color: '#5a7188',
    lineHeight: 1.35,
    display: 'block',
  },
  pill: {
    display: 'inline-block',
    marginTop: 6,
    padding: '1px 8px',
    borderRadius: 999,
    fontSize: '0.63rem',
    fontWeight: 600,
    cursor: 'default',
  },
  pillBlue: { background: '#e8f2ff', color: '#1a6bd6' },
  pillAmber: { background: '#fdf2e0', color: '#b37012' },
  pillGreen: { background: '#e6f6ee', color: '#1f7d4c' },
  pillGray: { background: '#eef2f7', color: '#5a7188' },
  cardLink: {
    display: 'block',
    textDecoration: 'none',
    cursor: 'pointer',
    transition: 'border-color 0.15s, box-shadow 0.15s',
    outline: 'none',
  } as React.CSSProperties,
  cardLinkHover: {
    borderColor: '#1a6bd6',
    boxShadow: '0 4px 16px rgba(26, 107, 214, 0.12)',
  } as React.CSSProperties,
  srcLine: {
    marginTop: 8,
    paddingTop: 6,
    borderTop: '1px solid #eef2f7',
    fontSize: '0.68rem',
    lineHeight: 1,
    color: '#7c90a8',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 4,
    transition: 'color 0.15s',
  } as React.CSSProperties,
};

function Pill({ text, color }: { text: string; color: 'blue' | 'amber' | 'green' | 'gray' }) {
  const map = { blue: s.pillBlue, amber: s.pillAmber, green: s.pillGreen, gray: s.pillGray };
  return <span style={{ ...s.pill, ...map[color] }}>{text}</span>;
}

function CardLink({ title, desc, pill, pillColor, href }: {
  title: string; desc: string; pill: string; pillColor: 'blue' | 'amber' | 'green' | 'gray'; href: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <a
      href={href} tabIndex={-1} onClick={(e) => { e.preventDefault(); window.open(href, '_blank', 'noopener,noreferrer'); }}
      onBlur={() => setHovered(false)}
      style={{
        ...s.card,
        ...s.cardLink,
        outline: 'none',
        borderColor: hovered ? '#1a6bd6' : s.card.borderColor || '#e3ecf5',
        boxShadow: hovered ? '0 4px 16px rgba(26, 107, 214, 0.12)' : 'none',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      title={`Первоисточник: ${new URL(href).hostname}`}
    >
      <b style={s.cardB}>{title}</b>
      <span style={s.cardSpan}>{desc}</span>
      <Pill text={pill} color={pillColor} />
      <span style={{
        ...s.srcLine,
        ...(hovered ? { color: '#1a6bd6' } : {}),
      }}>
        {new URL(href).hostname}
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>
          <polyline points="15 3 21 3 21 9"/>
          <line x1="10" y1="14" x2="21" y2="3"/>
        </svg>
      </span>
    </a>
  );
}

function ColHead({ num, color, title, subtitle }: {
  num: number; color: '1' | '2' | '3' | '4'; title: string; subtitle: string;
}) {
  const numColors = { 1: s.colNum1, 2: s.colNum2, 3: s.colNum3, 4: s.colNum4 };
  return (
    <div style={s.colHead}>
      <div style={{ ...s.colNum, ...numColors[color] }}>{num}</div>
      <h3 style={s.colTitle}>{title}<small style={s.colSubtitle}>{subtitle}</small></h3>
    </div>
  );
}

export default function MarketScheme() {
  return (
    <div style={s.container}>
      <div style={s.header}>
        <div>
          <h2 style={s.title}>Структура электроэнергетики России</h2>
          <span style={s.tag}>Справочная схема</span>
        </div>
      </div>

      <div style={s.columns}>

        {/* ОРЭМ */}
        <section style={{ ...s.col, ...s.colL1 }}>
          <ColHead num={1} color="1" title="Оптовый рынок" subtitle="ОРЭМ · > 25 МВт" />
          <div style={s.card}>
            <b style={s.cardB}>Генерирующие компании</b>
            <span style={s.cardSpan}>Продают энергию и мощность</span>
            <Pill text="продавцы" color="blue" />
          </div>
          <CardLink
            title="АО «АТС»"
            desc="Организует торги (РСВ, КОМ), определяет цены и объёмы"
            pill="инфраструктура"
            pillColor="gray"
            href="https://atsenergo.ru"
          />
          <CardLink
            title="АО «ЦФР»"
            desc="Денежные расчёты по итогам торгов"
            pill="финансы"
            pillColor="gray"
            href="https://cfrenergo.ru"
          />
          <div style={s.card}>
            <b style={s.cardB}>Покупатели</b>
            <span style={s.cardSpan}>Крупные потребители и энергосбытовые компании</span>
            <Pill text="покупатели" color="blue" />
          </div>
        </section>

        {/* РРЭ */}
        <section style={{ ...s.col, ...s.colL2 }}>
          <ColHead num={2} color="2" title="Розничный рынок" subtitle="РРЭ" />
          <div style={s.card}>
            <b style={s.cardB}>Гарантирующие поставщики</b>
            <span style={s.cardSpan}>Обязаны заключить договор с любым потребителем в зоне</span>
            <Pill text="обязательная услуга" color="amber" />
          </div>
          <div style={s.card}>
            <b style={s.cardB}>Независимые сбыты</b>
            <span style={s.cardSpan}>Работают на свободных ценах</span>
            <Pill text="конкуренция" color="amber" />
          </div>
          <div style={s.card}>
            <b style={s.cardB}>Малая генерация</b>
            <span style={s.cardSpan}>Поставляет энергию напрямую на РРЭ</span>
            <Pill text="< 25 МВт" color="amber" />
          </div>
        </section>

        {/* Потребители */}
        <section style={{ ...s.col, ...s.colL3 }}>
          <ColHead num={3} color="3" title="Конечные потребители" subtitle="цена = энергия + передача + сбыт" />
          <div style={s.card}>
            <b style={s.cardB}>Население</b>
            <span style={s.cardSpan}>Регулируемые тарифы, установленные государством</span>
            <Pill text="тарифы" color="green" />
          </div>
          <div style={s.card}>
            <b style={s.cardB}>Малый и средний бизнес</b>
            <span style={s.cardSpan}>Свободные цены, выбор ценовой категории</span>
            <Pill text="свободные цены" color="green" />
          </div>
          <div style={s.card}>
            <b style={s.cardB}>Крупные заводы</b>
            <span style={s.cardSpan}>Могут покупать на РРЭ или напрямую на ОРЭМ</span>
            <Pill text="гибкий выбор" color="green" />
          </div>
        </section>

        {/* Инфраструктура */}
        <section style={{ ...s.col, ...s.colL4 }}>
          <ColHead num={4} color="4" title="Инфраструктура" subtitle="обеспечивает работу рынков" />
          <CardLink
            title="НП «Совет рынка»"
            desc="Регламенты ОРЭМ и договор присоединения (ДОП)"
            pill="регулятор"
            pillColor="gray"
            href="https://np-sr.ru"
          />
          <CardLink
            title="АО «СО ЕЭС»"
            desc="Оперативно-диспетчерское управление"
            pill="диспетчер"
            pillColor="gray"
            href="https://so-ups.ru"
          />
          <CardLink
            title="ПАО «Россети»"
            desc="Магистральные и распределительные сети"
            pill="сети"
            pillColor="gray"
            href="https://rosseti.ru"
          />
        </section>

      </div>
    </div>
  );
}
