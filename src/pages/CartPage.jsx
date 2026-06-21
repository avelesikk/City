import { useMemo, useRef, useState } from 'react';
import './CartPage.css';
import { formatPrice, PRODUCTS as HOME_PRODUCTS, productsById } from '../data/products';
import { Link } from 'react-router-dom';
import { createUserOrder } from '../api/authApi';
const CITY_GROUPS = [
  {
    label: 'Рязань и Рязанская область',
    cities: ['Рязань', 'Касимов', 'Скопин', 'Сасово'],
  },
];

const PICKUP_POINTS = {
  Рязань: ['ТЦ Премьер', 'Московское шоссе, склад'],
  Касимов: ['ул. Советская, 8'],
  Скопин: ['ул. Карла Маркса, 16'],
  Сасово: ['пр. Молодцова, 3'],
};

export default function CartPage({
  cartItems = [],
  onAddToCart,
  onSetCartItemQty,
  onRemoveFromCart,
  isLoggedIn = false,
  favoriteIds = [],
  onToggleFavorite,
  catalogProducts = [],
  userSession = null,
  onClearCart,
}) {
  const user = userSession?.user || {};
  const isAdmin = String(user?.role || 'user') === 'admin';
  const [isBookingOpen, setIsBookingOpen] = useState(false);
  const [isOrderSuccessOpen, setIsOrderSuccessOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPolicyChecked, setIsPolicyChecked] = useState(false);
  const [bookingForm, setBookingForm] = useState({
    deliveryType: 'delivery',
    city: 'Рязань',
    address: '',
    pickupPoint: 'ТЦ Премьер, павильон 12',
    comment: '',
  });
  const normalizedItems = cartItems
    .map((item) => {
      if (item.product) {
        return {
          id: item.id,
          title: item.product.name || item.product.title,
          image: item.product.image_url || item.product.image,
          price: Number(item.product.price || 0),
          brand: item.product.brand || String(item.product.name || item.product.title || '').split(' ')[0] || '',
          qty: item.qty,
        };
      }
      const product = productsById[item.id];
      if (!product) return null;
      return {
        ...product,
        title: product.title,
        image: product.image,
        brand: String(product.title || '').split(' ')[0] || '',
        qty: item.qty,
      };
    })
    .filter(Boolean);

  const totalPrice = normalizedItems.reduce((sum, item) => sum + item.price * item.qty, 0);
  const bookingFullName = [user.last_name, user.first_name, user.name].filter(Boolean).join(' ') || user.full_name || '-';
  const bookingEmail = user.email || '-';
  const bookingPhone = user.phone_number || '-';
  const relatedTrackRef = useRef(null);
  const favoriteSet = useMemo(() => new Set(favoriteIds), [favoriteIds]);
  const cartIds = useMemo(() => new Set(normalizedItems.map((item) => item.id)), [normalizedItems]);

  const recommendationProducts = useMemo(() => {
    const homeMapped = HOME_PRODUCTS.map((item) => ({
      id: item.id,
      name: item.title,
      image_url: item.image,
      price: item.price,
      power: item.power,
      cooling: item.cooling,
    }));
    const merged = [...catalogProducts, ...homeMapped];
    const cartBrandSet = new Set(
      normalizedItems
        .map((item) => String(item.brand || item.title || '').trim())
        .filter(Boolean)
        .map((value) => value.toUpperCase())
    );
    const ranked = [...merged].sort((a, b) => {
      const aBrand = String(a.brand || a.name || a.title || '').toUpperCase();
      const bBrand = String(b.brand || b.name || b.title || '').toUpperCase();
      const aScore = cartBrandSet.has(aBrand) ? 0 : 1;
      const bScore = cartBrandSet.has(bBrand) ? 0 : 1;
      return aScore - bScore;
    });
    const unique = [];
    const seen = new Set();
    for (const item of ranked) {
      if (!item?.id || seen.has(item.id) || cartIds.has(item.id)) continue;
      seen.add(item.id);
      unique.push(item);
      if (unique.length >= 6) break;
    }
    return unique;
  }, [catalogProducts, cartIds, normalizedItems]);

  const scrollRecommendations = (direction) => {
    const node = relatedTrackRef.current;
    if (!node) return;
    const card = node.querySelector('.cart-reco-card');
    const step = card ? card.clientWidth + 12 : 260;
    node.scrollBy({ left: direction * step * 2, behavior: 'smooth' });
  };

  const cityPickupPoints = PICKUP_POINTS[bookingForm.city] || ['Пункт выдачи уточняется после подтверждения'];

  const placeOrder = async () => {
    if (!userSession?.token) return;
    const deliveryAddress = bookingForm.address.trim();
    if (bookingForm.deliveryType === 'delivery' && !deliveryAddress) {
      window.alert('Укажите адрес доставки.');
      return;
    }
    if (bookingForm.deliveryType === 'delivery' && !/[A-Za-zА-Яа-яЁё]/.test(deliveryAddress)) {
      window.alert('Адрес должен содержать улицу/дом');
      return;
    }
    if (bookingForm.deliveryType === 'pickup' && !bookingForm.pickupPoint.trim()) {
      window.alert('Выберите пункт самовывоза.');
      return;
    }
    if (!isPolicyChecked) {
      window.alert('Подтвердите согласие с политикой конфиденциальности.');
      return;
    }
    try {
      setIsSubmitting(true);
      await createUserOrder(userSession, {
        items: normalizedItems.map((item) => ({
          id: item.id,
          title: item.title,
          qty: item.qty,
          price: item.price,
        })),
        total_price: totalPrice,
        customer: {
          full_name: bookingFullName,
          email: bookingEmail,
          phone_number: bookingPhone,
        },
        booking: {
          delivery_type: bookingForm.deliveryType,
          city: bookingForm.city,
          address: bookingForm.deliveryType === 'delivery' ? deliveryAddress : '',
          pickup_point: bookingForm.deliveryType === 'pickup' ? bookingForm.pickupPoint.trim() : '',
          comment: bookingForm.comment.trim(),
        },
      });
      onClearCart?.();
      setIsBookingOpen(false);
      setIsOrderSuccessOpen(true);
    } catch (e) {
      window.alert(e.message || 'Не удалось оформить заказ.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <section className="cart-page">
      <div className="cart-page__container">
        <h1 className="cart-card__title">Корзина</h1>
        {normalizedItems.length === 0 ? (
          <div className="cart-empty">
            <p className="cart-card__text">Товаров пока нет. Добавьте что-нибудь в каталоге.</p>
            <Link to="/katalog" className="cart-empty__link">
              Перейти в каталог
            </Link>
          </div>
        ) : (
          <div className="cart-layout">
            <div className="cart-list">
              {normalizedItems.map((item) => (
                <article key={item.id} className="cart-row">
                  <img src={item.image} alt={item.title} className="cart-row__image" />
                  <div className="cart-row__main">
                    <h2>{item.title}</h2>
                    <p className="cart-row__price">{formatPrice(item.price)}</p>
                    <div className="cart-row__actionsline">
                      <div className="cart-row__qty">
                        <button type="button" onClick={() => onSetCartItemQty?.(item.id, item.qty - 1)}>
                          -
                        </button>
                        <span>{item.qty}</span>
                        <button type="button" onClick={() => onAddToCart?.(item.id)}>
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="cart-row__side">
                    <p className="cart-row__sum">{formatPrice(item.price * item.qty)}</p>
                    <button type="button" className="cart-row__remove" onClick={() => onRemoveFromCart?.(item.id)}>
                      Удалить
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <aside className="cart-summary">
              <div className="cart-total">
                <span>Товаров</span>
                <strong>{normalizedItems.reduce((sum, item) => sum + item.qty, 0)}</strong>
              </div>
              <div className="cart-total">
                <span>Итого</span>
                <strong>{formatPrice(totalPrice)}</strong>
              </div>
              <div className="cart-checkout">
  {isLoggedIn ? (
    isAdmin ? (
      <div className="cart-checkout__admin-warning">
        Бронирование товаров доступно только клиентам.
      </div>
    ) : (
      <button type="button" className="cart-checkout__btn" onClick={() => setIsBookingOpen(true)}>
        Оформить заказ
      </button>
    )
  ) : (
    <div className="cart-checkout__login">
      <p>Для покупки товара войдите в аккаунт.</p>
      <Link to="/auth" className="cart-checkout__link">
        Войти в аккаунт
      </Link>
    </div>
  )}
</div>
            </aside>
          </div>
        )}

        {recommendationProducts.length ? (
          <section className="cart-recommendations">
            <div className="cart-recommendations__head">
              <h2>Вам также может понравится</h2>
              <div className="cart-recommendations__controls">
                <button type="button" aria-label="Предыдущие товары" onClick={() => scrollRecommendations(-1)}>
                  ‹
                </button>
                <button type="button" aria-label="Следующие товары" onClick={() => scrollRecommendations(1)}>
                  ›
                </button>
              </div>
            </div>
            <div className="cart-reco-track" ref={relatedTrackRef}>
              {recommendationProducts.map((item) => (
                <article key={item.id} className="cart-reco-card">
                  <div className="cart-reco-card__image-wrap">
                    <Link to={`/katalog/${item.id}`} className="cart-reco-card__image-link">
                      <img src={item.image_url || item.image} alt={item.name || item.title} />
                    </Link>
                    <button
                      type="button"
                      className={`cart-reco-favorite-btn${favoriteSet.has(item.id) ? ' cart-reco-favorite-btn--active' : ''}`}
                      aria-label={favoriteSet.has(item.id) ? 'Убрать из избранного' : 'Добавить в избранное'}
                      onClick={() => onToggleFavorite?.(item.id)}
                    >
                      <img className="favorite-icon-outline" src="/img/icon-heart.png" alt="" aria-hidden="true" />
                      <img className="favorite-icon-fill" src="/img/icon-heart-filled.png" alt="" aria-hidden="true" />
                    </button>
                  </div>
                  <div className="cart-reco-card__content">
                    <Link to={`/katalog/${item.id}`} className="cart-reco-card__name">
                      {item.name || item.title}
                    </Link>
                    <div className="cart-reco-specs-grid">
                      <div className="cart-reco-spec-col">
                        <span className="cart-reco-spec-col__label">Мощность</span>
                        <span className="cart-reco-spec-col__value">{item.power || '2.6 кВт'}</span>
                      </div>
                      <div className="cart-reco-spec-col">
                        <span className="cart-reco-spec-col__label">Охлаждение</span>
                        <span className="cart-reco-spec-col__value">{item.cooling || '2.6 кВт'}</span>
                      </div>
                    </div>
                    <div className="cart-reco-card__bottom">
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

      {isBookingOpen ? (
        <div className="booking-modal" role="dialog" aria-modal="true" aria-label="Бронирование заказа">
          <div className="booking-modal__overlay" />
          <div className="booking-modal__card">
            <button
              type="button"
              className="booking-modal__close"
              aria-label="Закрыть"
              onClick={() => (isSubmitting ? null : setIsBookingOpen(false))}
            >
              ✕
            </button>
            <h2>Форма бронирования заказа</h2>
            <div className="booking-modal__fields">
              <label>
                ФИО
                <input type="text" value={bookingFullName} readOnly />
              </label>
              <label>
                Email
                <input type="text" value={bookingEmail} readOnly />
              </label>
              <label>
                Телефон
                <input type="text" value={bookingPhone} readOnly />
              </label>
            </div>
            <div className="booking-modal__section">
              <h3>Способ получения</h3>
              <div className="booking-modal__delivery-switch">
                <label className="booking-modal__radio">
                  <input
                    type="radio"
                    name="deliveryType"
                    checked={bookingForm.deliveryType === 'delivery'}
                    onChange={() => setBookingForm((prev) => ({ ...prev, deliveryType: 'delivery' }))}
                  />
                  <span className="booking-modal__radio-dot" />
                  <span className="booking-modal__radio-label">Доставка</span>
                </label>
                <label className="booking-modal__radio">
                  <input
                    type="radio"
                    name="deliveryType"
                    checked={bookingForm.deliveryType === 'pickup'}
                    onChange={() =>
                      setBookingForm((prev) => ({
                        ...prev,
                        deliveryType: 'pickup',
                        pickupPoint: (PICKUP_POINTS[prev.city] || [''])[0],
                      }))
                    }
                  />
                  <span className="booking-modal__radio-dot" />
                  <span className="booking-modal__radio-label">Самовывоз</span>
                </label>
              </div>
              <label className="booking-modal__field">
                Город
                <select
                  value={bookingForm.city}
                  onChange={(e) =>
                    setBookingForm((prev) => {
                      const nextCity = e.target.value;
                      const nextPickup = (PICKUP_POINTS[nextCity] || [''])[0];
                      return {
                        ...prev,
                        city: nextCity,
                        pickupPoint: prev.deliveryType === 'pickup' ? nextPickup : prev.pickupPoint,
                      };
                    })
                  }
                >
                  {CITY_GROUPS.map((group) => (
                    <optgroup key={group.label} label={group.label}>
                      {group.cities.map((city) => (
                        <option key={city} value={city}>
                          {city}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </label>
              {bookingForm.deliveryType === 'delivery' ? (
                <label className="booking-modal__field">
                  Адрес доставки
                  <input
                    type="text"
                    value={bookingForm.address}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, address: e.target.value }))}
                    placeholder="Введите адрес доставки"
                  />
                </label>
              ) : (
                <label className="booking-modal__field">
                  Пункт самовывоза
                  <select
                    value={bookingForm.pickupPoint}
                    onChange={(e) => setBookingForm((prev) => ({ ...prev, pickupPoint: e.target.value }))}
                  >
                    {cityPickupPoints.map((point) => (
                      <option key={point} value={point}>
                        {point}
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>
            <div className="booking-modal__section booking-modal__payment">
              <h3>Оплата при получении заказа</h3>
              <div className="booking-modal__payment-card">
                <p className="booking-modal__payment-text">Наличными или банковской картой при получении.</p>
              </div>
            </div>
            <button type="button" className="booking-modal__submit" onClick={placeOrder} disabled={isSubmitting}>
              {isSubmitting ? 'Отправляем...' : 'Забронировать'}
            </button>
            <label className="booking-modal__consent">
              <input
                type="checkbox"
                checked={isPolicyChecked}
                onChange={(e) => setIsPolicyChecked(e.target.checked)}
              />
              <span>
                Нажимая на кнопку, вы соглашаетесь с{' '}
                <Link to="/privacy-policy" className="booking-modal__policy-link" rel="noreferrer">
                  политикой конфиденциальности
                </Link>
              </span>
            </label>
          </div>
        </div>
      ) : null}

      {isOrderSuccessOpen ? (
        <div className="booking-success-modal" role="dialog" aria-modal="true" aria-label="Заказ оформлен">
          <div className="booking-success-modal__overlay" />
          <div className="booking-success-modal__card">
            <h2>Заявка принята</h2>
            <p>В течение 15 минут с вами свяжется оператор для подтверждения заказа.</p>
            <button type="button" className="booking-success-modal__close-btn" onClick={() => setIsOrderSuccessOpen(false)}>
              Закрыть
            </button>
          </div>
        </div>
      ) : null}
    </section>
  );
}

