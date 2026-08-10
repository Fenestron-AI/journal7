const styles: Record<string, React.CSSProperties> = {
  container: {
    maxWidth: 1400,
    width: '100%',
    background: 'white',
    borderRadius: 24,
    padding: '40px 30px 50px',
    overflowX: 'auto',
  },
  title: {
    textAlign: 'center',
    fontWeight: 600,
    fontSize: '2.2rem',
    color: '#0b2b4a',
    letterSpacing: '-0.5px',
    marginBottom: 6,
  },
  subtitle: {
    textAlign: 'center',
    color: '#3a5a7a',
    fontSize: '1.1rem',
    borderBottom: '2px solid #e6edf5',
    paddingBottom: 20,
    marginBottom: 30,
  },
  schemeGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '40px 50px',
    alignItems: 'start',
  } as React.CSSProperties,
  col: {
    display: 'flex',
    flexDirection: 'column',
  } as React.CSSProperties,
  colTitle: {
    fontWeight: 600,
    fontSize: '1.5rem',
    color: '#1a3a5e',
    paddingBottom: 12,
    borderBottom: '4px solid #cbdbe9',
    marginBottom: 25,
    display: 'flex',
    alignItems: 'center',
    gap: 12,
  } as React.CSSProperties,
  colTitleBadge: {
    background: '#1a3a5e',
    color: 'white',
    fontSize: '0.9rem',
    fontWeight: 700,
    padding: '2px 14px',
    borderRadius: 40,
  },
  node: {
    background: 'white',
    borderRadius: 18,
    padding: '18px 22px',
    marginBottom: 14,
    boxShadow: '0 4px 14px rgba(0,20,40,0.06)',
    border: '1.5px solid #dce6f0',
  },
  nodeStrong: {
    display: 'block',
    fontSize: '1.1rem',
    color: '#0f2b44',
    marginBottom: 4,
  },
  nodeDesc: {
    fontSize: '0.92rem',
    color: '#2a4a6a',
    opacity: 0.85,
    lineHeight: 1.4,
  },
  badge: {
    display: 'inline-block',
    padding: '2px 14px',
    borderRadius: 30,
    fontSize: '0.75rem',
    fontWeight: 600,
    marginTop: 8,
  },
  badgeBlue: { background: '#eaf1f9', color: '#1f4970' },
  badgeGreen: { background: '#e2f0e5', color: '#1a5c3a' },
  badgeOrange: { background: '#fef0e0', color: '#a8681a' },
  badgePurple: { background: '#ede7f6', color: '#5e3c8a' },
  connector: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#7f9bb9',
    fontSize: '1.5rem',
    letterSpacing: 6,
    margin: '-4px 0 4px 0',
    opacity: 0.6,
  },
  subgroup: {
    background: '#f7faff',
    borderRadius: 18,
    padding: '16px 18px 10px 18px',
    margin: '6px 0 10px 0',
    border: '1px dashed #b8cee2',
  },
  subgroupNode: {
    background: '#ffffff',
    border: '1px solid #d6e2ef',
    borderRadius: 18,
    padding: '14px 18px',
    marginBottom: 8,
  },
  verticalFlow: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    margin: '6px 0 8px 0',
    color: '#7f9bb9',
    fontSize: '1.6rem',
    lineHeight: 0.6,
  } as React.CSSProperties,
  flexRow: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '6px 12px',
    alignItems: 'center',
  } as React.CSSProperties,
};

export default function MarketScheme() {
  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Полная структура электроэнергетики России</h1>
      <div style={styles.subtitle}>ОРЭМ, РРЭ, инфраструктура, регуляторы и управление</div>

      <div style={styles.schemeGrid}>
        {/* === ЛЕВАЯ КОЛОНКА: ОРЭМ и инфраструктура === */}
        <div style={styles.col}>
          <div style={styles.colTitle}>
            <span style={styles.colTitleBadge}>ОРЭМ</span> Оптовый рынок
          </div>

          <div style={{ ...styles.node, borderColor: '#1f4a74', background: '#f3f8ff' }}>
            <strong style={styles.nodeStrong}>Правительство РФ / ФАС России</strong>
            <div style={styles.nodeDesc}>Государственное регулирование. Утверждение законов, правил, тарифов и порядка ценообразования.</div>
            <span style={{ ...styles.badge, ...styles.badgeBlue }}>Верховный регулятор</span>
          </div>

          <div style={styles.connector}>⬇</div>

          <div style={{ ...styles.node, borderColor: '#1f5a7a', background: '#f0f7fe' }}>
            <strong style={styles.nodeStrong}>Ассоциация «НП Совет рынка»</strong>
            <div style={styles.nodeDesc}>Главный регулятор ОРЭМ. Разрабатывает и утверждает <strong>Регламенты ОРЭМ</strong> и <strong>Договор о присоединении (ДОП)</strong>.</div>
            <span style={{ ...styles.badge, ...styles.badgeBlue }}>np-sr.ru</span>
          </div>

          <div style={{ ...styles.verticalFlow, marginTop: 4 }}>
            <span>⬇</span>
            <span style={{ fontSize: '1rem', opacity: 0.5 }}>100% дочка</span>
            <span style={{ fontSize: '0.9rem', opacity: 0.5 }}>учредитель</span>
            <span>⬇</span>
          </div>

          <div style={styles.subgroup}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '4px 10px', marginBottom: 6 }}>
              <span style={{ fontWeight: 600, color: '#1a3a5e' }}>Операторы инфраструктуры</span>
              <span style={{ fontSize: '0.75rem', color: '#4a6a8a' }}>(дочерние компании Совета рынка)</span>
            </div>
            <div style={{ ...styles.subgroupNode, borderLeft: '4px solid #2a7a9a' }}>
              <strong style={styles.nodeStrong}>АО «АТС»</strong>
              <div style={styles.nodeDesc}>Администратор торговой системы. Проводит <strong>конкурентные отборы</strong> (РСВ, КОМ), определяет цены и объемы.</div>
              <span style={{ ...styles.badge, ...styles.badgeBlue }}>atsenergo.ru</span>
            </div>
            <div style={{ ...styles.subgroupNode, borderLeft: '4px solid #2a7a9a', marginTop: 6 }}>
              <strong style={styles.nodeStrong}>АО «ЦФР»</strong>
              <div style={styles.nodeDesc}>Центр финансовых расчетов. Проводит все <strong>денежные расчеты</strong> между участниками по итогам торгов.</div>
              <span style={{ ...styles.badge, ...styles.badgeBlue }}>cfrenergo.ru</span>
            </div>
          </div>

          <div style={styles.connector}>⬇</div>

          <div style={{ ...styles.node, borderColor: '#3d7a5a', background: '#f4fbf7' }}>
            <strong style={styles.nodeStrong}>Участники ОРЭМ</strong>
            <div style={styles.nodeDesc}>
              <strong>Генерирующие компании</strong> (продавцы), <strong>крупные потребители</strong> и <strong>энергосбытовые компании</strong> (покупатели).
            </div>
            <div style={{ ...styles.flexRow, marginTop: 6 }}>
              <span style={{ ...styles.badge, ...styles.badgeGreen }}>&gt; 25 МВт</span>
              <span style={{ ...styles.badge, ...styles.badgeGreen }}>Торги</span>
            </div>
          </div>

          <div style={{ marginTop: 30, borderTop: '2px dashed #c0d4e6', paddingTop: 20 }}>
            <div style={{ ...styles.colTitle, fontSize: '1.2rem', borderBottomColor: '#a0bcd6', marginBottom: 18 }}>
              <span style={{ background: '#2a5a7a', color: 'white', fontSize: '0.9rem', fontWeight: 700, padding: '2px 14px', borderRadius: 40 }}>⚙</span> Системный оператор
            </div>
            <div style={{ ...styles.node, borderColor: '#2a5a7a', background: '#f2f7fd' }}>
              <strong style={styles.nodeStrong}>АО «СО ЕЭС»</strong>
              <div style={styles.nodeDesc}>Оперативно-диспетчерское управление. Обеспечивает <strong>физическую надежность</strong> энергосистемы, баланс генерации и потребления.</div>
              <span style={{ ...styles.badge, ...styles.badgeBlue }}>so-ups.ru</span>
            </div>
            <div style={{ paddingLeft: 14, marginTop: 8, borderLeft: '2px solid #b8cee2' }}>
              <div style={{ fontSize: '0.85rem', color: '#2a4a6a', padding: '4px 0' }}><span style={{ opacity: 0.7 }}>→</span> ЦДУ (Центральное)</div>
              <div style={{ fontSize: '0.85rem', color: '#2a4a6a', padding: '2px 0' }}><span style={{ opacity: 0.7 }}>→</span> 7 ОДУ (объединенные)</div>
              <div style={{ fontSize: '0.85rem', color: '#2a4a6a', padding: '2px 0' }}><span style={{ opacity: 0.7 }}>→</span> Региональные ДУ</div>
              <div style={{ fontSize: '0.85rem', color: '#2a4a6a', padding: '2px 0' }}><span style={{ opacity: 0.7 }}>→</span> Диспетчерские пункты на станциях</div>
            </div>
          </div>
        </div>

        {/* === ПРАВАЯ КОЛОНКА: РРЭ и потребители === */}
        <div style={styles.col}>
          <div style={styles.colTitle}>
            <span style={styles.colTitleBadge}>РРЭ</span> Розничный рынок
          </div>

          <div style={{ background: '#eef4fa', borderRadius: 20, padding: '12px 18px', marginBottom: 12, border: '1px solid #d0dfee' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ fontWeight: 500, color: '#1a3a5e' }}>← Поставка от ОРЭМ</span>
              <span style={{ fontSize: '0.8rem', color: '#3a5a7a' }}>(энергосбытовые компании и ГП)</span>
            </div>
            <div style={{ fontSize: '0.85rem', color: '#2a4a6a', marginTop: 4 }}>
              <span style={{ ...styles.badge, background: '#d4e2f2', color: '#1a3a5e' }}>Гарантирующие поставщики</span>
              <span style={{ ...styles.badge, background: '#d4e2f2', color: '#1a3a5e', marginLeft: 8 }}>Независимые сбытовые компании</span>
            </div>
          </div>

          <div style={{ ...styles.node, borderColor: '#b47a3a', background: '#fefaf2' }}>
            <strong style={styles.nodeStrong}>Гарантирующие поставщики (ГП)</strong>
            <div style={styles.nodeDesc}>Обязаны заключить договор с любым потребителем в своей зоне. Продают энергию <strong>населению</strong> по регулируемым тарифам, а бизнесу — по свободным ценам.</div>
            <span style={{ ...styles.badge, ...styles.badgeOrange }}>Обязательная услуга</span>
          </div>

          <div style={{ ...styles.node, borderColor: '#b47a3a', background: '#fefaf2' }}>
            <strong style={styles.nodeStrong}>Независимые сбытовые компании (НЭСО)</strong>
            <div style={styles.nodeDesc}>Работают на свободном рынке, предлагая различные условия и тарифы для бизнеса и промышленности.</div>
            <span style={{ ...styles.badge, ...styles.badgeOrange }}>Конкурентный сектор</span>
          </div>

          <div style={{ ...styles.node, borderColor: '#5a7a4a', background: '#f4faf5' }}>
            <strong style={styles.nodeStrong}>Малая генерация</strong>
            <div style={styles.nodeDesc}>Производители мощностью <strong>менее 25 МВт</strong>. Не участвуют в ОРЭМ, поставляют энергию напрямую на РРЭ.</div>
            <span style={{ ...styles.badge, ...styles.badgeGreen }}>Локальные поставщики</span>
          </div>

          <div style={{ ...styles.node, borderColor: '#4a6a8a', background: '#f3f8fe' }}>
            <strong style={styles.nodeStrong}>Территориальные сетевые организации (ТСО)</strong>
            <div style={styles.nodeDesc}>Обеспечивают передачу электроэнергии по распределительным сетям до конечного потребителя. Тариф на передачу — часть цены РРЭ.</div>
            <span style={{ ...styles.badge, ...styles.badgeBlue }}>Инфраструктура</span>
          </div>

          <div style={{ ...styles.verticalFlow }}>
            <span>⬇</span>
            <span style={{ fontSize: '0.8rem', opacity: 0.6 }}>поставка + передача</span>
            <span>⬇</span>
          </div>

          <div style={{ ...styles.subgroup, background: '#f2f6fc' }}>
            <div style={{ fontWeight: 600, color: '#1a3a5e', marginBottom: 8 }}>Конечные потребители</div>
            <div style={{ ...styles.subgroupNode, borderLeft: '4px solid #b07a3a' }}>
              <strong style={styles.nodeStrong}>Население</strong>
              <div style={styles.nodeDesc}>Покупают по <strong>регулируемым тарифам</strong>, установленным государством. Гарантированный поставщик.</div>
              <span style={{ ...styles.badge, ...styles.badgeOrange }}>Тарифы</span>
            </div>
            <div style={{ ...styles.subgroupNode, borderLeft: '4px solid #3a7a5a' }}>
              <strong style={styles.nodeStrong}>Малый и средний бизнес</strong>
              <div style={styles.nodeDesc}>Покупают по <strong>свободным ценам</strong>, которые формируются на основе ОРЭМ + сбытовая надбавка + тариф ТСО.</div>
              <span style={{ ...styles.badge, ...styles.badgeGreen }}>Свободные цены</span>
            </div>
            <div style={{ ...styles.subgroupNode, borderLeft: '4px solid #3a5a8a' }}>
              <strong style={styles.nodeStrong}>Крупные заводы и предприятия</strong>
              <div style={styles.nodeDesc}>Могут покупать энергию как на РРЭ (у сбытовых компаний), так и напрямую на <strong>ОРЭМ</strong> (в зависимости от мощности).</div>
              <span style={{ ...styles.badge, ...styles.badgePurple }}>Гибкий выбор</span>
            </div>
          </div>

          <div style={{ marginTop: 20, background: '#e9f0f7', borderRadius: 18, padding: '16px 20px', border: '1px solid #c8d9e9' }}>
            <div style={{ fontWeight: 600, color: '#1a3a5e', fontSize: '0.95rem' }}>Цена для потребителя на РРЭ</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px 20px', marginTop: 8, fontSize: '0.9rem' }}>
              <span><span style={{ opacity: 0.7 }}>1.</span> Нерегулируемая цена на ЭЭ <span style={{ opacity: 0.5 }}>(зависит от ОРЭМ)</span></span>
              <span><span style={{ opacity: 0.7 }}>+</span> Тариф на передачу <span style={{ opacity: 0.5 }}>(ТСО)</span></span>
              <span><span style={{ opacity: 0.7 }}>+</span> Сбытовая надбавка <span style={{ opacity: 0.5 }}>(ГП / НЭСО)</span></span>
            </div>
            <div style={{ marginTop: 6, fontSize: '0.8rem', color: '#3a5a7a' }}>Для населения — регулируемый тариф (устанавливает государство).</div>
          </div>
        </div>

      </div>
    </div>
  );
}
