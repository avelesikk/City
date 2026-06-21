import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { formatPrice } from '../data/products';
import { getProductById, getProducts } from '../api/productsApi';
import ReviewsSection from '../components/ReviewsSection';
import './ProductPage.css';

const TAB_KEYS = ['info', 'specs', 'reviews'];

function parseKw(value, fallback = 2.6) {
  const parsed = Number.parseFloat(String(value || '').replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : fallback;
}

function estimateArea(powerValue) {
  const kw = parseKw(powerValue, 2.6);
  return Math.max(20, Math.round(kw * 9));
}

function normalizeCoolingToKw(value, fallback = 2.6) {
  const raw = String(value || '').trim();
  if (!raw) return `${fallback.toFixed(1)} кВт`;
  if (raw.toLowerCase().includes('btu')) {
    const btu = Number.parseInt(raw.replace(/[^\d]/g, ''), 10);
    if (Number.isFinite(btu) && btu > 0) {
      const kw = btu / 3412;
      return `${kw.toFixed(1)} кВт`;
    }
  }
  if (raw.toLowerCase().includes('квт')) return raw;
  const parsed = parseKw(raw, fallback);
  return `${parsed.toFixed(1)} кВт`;
}

export default function ProductPage({ onAddToCart, favoriteIds = [], onToggleFavorite, userSession = null }) {
  const { productId } = useParams();
  const [product, setProduct] = useState(null);
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [activeTab, setActiveTab] = useState('info');
  const [error, setError] = useState('');
  const relatedTrackRef = useRef(null);

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (TAB_KEYS.includes(hash)) setActiveTab(hash);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [productId]);

  useEffect(() => {
    if (!productId) return;
    getProductById(productId)
      .then((item) => setProduct(item))
      .catch(() => setError('Товар не найден или недоступен.'));
  }, [productId]);

  useEffect(() => {
    getProducts()
      .then((items) => setCatalogProducts(items))
      .catch(() => setCatalogProducts([]));
  }, []);

  const tabs = useMemo(
    () => [
      { key: 'info', label: 'Общая информация' },
      { key: 'specs', label: 'Характеристики' },
      { key: 'reviews', label: 'Отзывы' },
    ],
    []
  );
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);

  const relatedProducts = useMemo(() => {
    if (!product) return [];
    const currentId = Number(product.id);
    const sameBrand = catalogProducts.filter((item) => item.id !== currentId && item.brand === product.brand);
    const fallback = catalogProducts.filter((item) => item.id !== currentId);
    const merged = [...sameBrand, ...fallback];
    const unique = [];
    const seen = new Set();
    for (const item of merged) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      unique.push(item);
      if (unique.length >= 10) break;
    }
    return unique;
  }, [catalogProducts, product]);

  if (error) {
    return (
      <section className="product-page">
        <div className="product-page__container">
          <p className="product-page__error">{error}</p>
        </div>
      </section>
    );
  }

  if (!product) {
    return (
      <section className="product-page">
        <div className="product-page__container">
          <p className="product-page__loading">Загрузка...</p>
        </div>
      </section>
    );
  }

  const area = estimateArea(product.power);
  const coolingKw = normalizeCoolingToKw(product.cooling, parseKw(product.power, 2.6));
  const infoText = `Сплит-система ${product.name} предназначена для работы в помещении площадью до ${area} м².
Серия выполнена в универсальном минималистичном дизайне и сочетает малошумную работу с широким набором режимов для ежедневного комфорта.
Модель работает на современном хладагенте R32, который отличается энергоэффективностью, безопасностью и более экологичным профилем.`;

  const advantages = [
    'Функция I SENSE. Кондиционер ориентируется на температуру рядом с пультом управления, чтобы поддерживать комфорт именно в той зоне, где находится пользователь.',
    'Теплообменник наружного блока с защитным покрытием Golden Fin. Антикоррозионное покрытие устойчиво к влажному воздуху и агрессивной среде, снижает риск коррозии и улучшает теплоотдачу.',
    'Огнестойкий электрический блок управления. Используется ABS-материал с пределом огнестойкости 5VA и дополнительная металлическая защита.',
    'Обнаружение утечки хладагента. При утечке система автоматически останавливает работу внутреннего блока для повышения безопасности.',
    'Высокоэффективный теплообменник. Оптимизированная геометрия каналов повышает эффективность теплопередачи и стабильность работы в пиковых режимах.',
  ];

  const specs = [
    ['Тип', 'Настенная сплит-система (инвертор)'],
    ['Площадь помещения', `до ${area} м²`],
    ['Мощность охлаждения', coolingKw],
    ['Мощность обогрева', `${(parseKw(product.power, 2.6) + 0.3).toFixed(1)} кВт`],
    ['Потребляемая мощность (охлаждение)', `${Math.max(0.65, parseKw(product.power, 2.6) * 0.33).toFixed(2)} кВт`],
    ['Потребляемая мощность (обогрев)', `${Math.max(0.70, parseKw(product.power, 2.6) * 0.35).toFixed(2)} кВт`],
    ['Класс энергоэффективности', 'A++'],
    ['Уровень шума внутреннего блока', '22-38 дБ'],
    ['Уровень шума наружного блока', '50 дБ'],
    ['Расход воздуха', '560 м³/ч'],
    ['Хладагент', 'R32'],
    ['Диапазон работы (охлаждение)', '-15...+30 °C'],
    ['Диапазон работы (обогрев)', '-20...+24 °C'],
    ['Макс. длина трассы', '20 м'],
    ['Макс. перепад высот', '10 м'],
    ['Питание', '220-240 В, 50 Гц'],
    ['Гарантия', '3 года'],
    ['Срок службы', '10 лет'],
  ];

  const scrollRelated = (direction) => {
    const node = relatedTrackRef.current;
    if (!node) return;
    const card = node.querySelector('.related-card');
    const step = card ? card.clientWidth + 12 : 260;
    node.scrollBy({ left: direction * step * 2, behavior: 'smooth' });
  };

  return (
    <section className="product-page">
      <div className="product-page__container">
        <article className="product-main">
          <div className="product-main__left">
            <img src={product.image_url} alt={product.name} />
          </div>
          <div className="product-main__right">
            <h1>{product.name}</h1>
            <ul className="product-main__meta">
              <li>
                <span>Наличие товара</span>
                <strong>В наличии</strong>
              </li>
              <li>
                <span>Гарантия на кондиционер</span>
                <strong>3 года</strong>
              </li>
              <li>
                <span>Обслуживаемая площадь</span>
                <strong>до {area} м²</strong>
              </li>
              <li>
                <span>Срок эксплуатации, лет</span>
                <strong>10</strong>
              </li>
            </ul>
            <div className="product-main__actions">
              <div className="product-main__price">{formatPrice(product.price)}</div>
              <button type="button" className="product-main__cart-btn" onClick={() => onAddToCart?.(product)}>
                <img src="/img/icon-cart.png" alt="" aria-hidden="true" />
                В корзину
              </button>
            </div>
          </div>
        </article>

        <div className="product-tabs">
          {tabs.map((tab) => (
            <a
              key={tab.key}
              href={`#${tab.key}`}
              className={activeTab === tab.key ? 'active' : ''}
              onClick={(e) => {
                e.preventDefault();
                setActiveTab(tab.key);
                window.history.replaceState(null, '', `#${tab.key}`);
              }}
            >
              {tab.label}
            </a>
          ))}
        </div>

        <div className="product-tab-content">
          {activeTab === 'info' ? (
            <div className="product-info-content">
              <p>{infoText}</p>
              <h3>Преимущества</h3>
              <ul>
                {advantages.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          ) : null}
          {activeTab === 'specs' ? (
            <div className="product-specs-table-wrap">
              <table className="product-specs-table">
                <tbody>
                  {specs.map(([label, value]) => (
                    <tr key={label}>
                      <th scope="row">{label}</th>
                      <td>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
          {activeTab === 'reviews' ? (
            <ReviewsSection
              productId={Number(product.id)}
              title={`Отзывы о ${product.name}`}
              userSession={userSession}
            />
          ) : null}
        </div>

        {relatedProducts.length ? (
          <section className="related-products">
            <div className="related-products__head">
              <h2>Похожие товары</h2>
              <div className="related-products__controls">
                <button type="button" aria-label="Предыдущие товары" onClick={() => scrollRelated(-1)}>
                  ‹
                </button>
                <button type="button" aria-label="Следующие товары" onClick={() => scrollRelated(1)}>
                  ›
                </button>
              </div>
            </div>
            <div className="related-products__track" ref={relatedTrackRef}>
              {relatedProducts.map((item) => (
                <article key={item.id} className="related-card">
                  <div className="related-card__image-wrap">
                    <Link to={`/katalog/${item.id}`} className="related-card__image-link">
                      <img src={item.image_url} alt={item.name} />
                    </Link>
                    <button
                      type="button"
                      className={`related-favorite-btn${favoriteSet.has(item.id) ? ' related-favorite-btn--active' : ''}`}
                      aria-label={favoriteSet.has(item.id) ? 'Убрать из избранного' : 'Добавить в избранное'}
                      onClick={() => onToggleFavorite?.(item.id)}
                    >
                      <img className="favorite-icon-outline" src="/img/icon-heart.png" alt="" aria-hidden="true" />
                      <img className="favorite-icon-fill" src="/img/icon-heart-filled.png" alt="" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="related-card__content">
                    <Link to={`/katalog/${item.id}`} className="related-card__name">
                      {item.name}
                    </Link>
                    <div className="related-specs-grid">
                      <div className="related-spec-col">
                        <span className="related-spec-col__label">Мощность</span>
                        <span className="related-spec-col__value">{item.power || '2.6 кВт'}</span>
                      </div>
                      <div className="related-spec-col">
                        <span className="related-spec-col__label">Охлаждение</span>
                        <span className="related-spec-col__value">{item.cooling || '2.6 кВт'}</span>
                      </div>
                    </div>
                    <div className="related-card__bottom">
                      <strong>{formatPrice(item.price)}</strong>
                      <button type="button" onClick={() => onAddToCart?.(item)}>
                        <img src="/img/icon-cart.png" alt="" aria-hidden="true" />
                        В корзину
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </section>
  );
}
