import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createReview, getReviewEligibility, getReviews } from '../api/reviewsApi';
import './ReviewsSection.css';

const RATING_OPTIONS = [5, 4, 3, 2, 1];

function renderStars(count) {
  return '★'.repeat(count) + '☆'.repeat(5 - count);
}

export default function ReviewsSection({ productId, title = 'Отзывы наших клиентов', userSession = null }) {
  const navigate = useNavigate();
  const [reviews, setReviews] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [eligibility, setEligibility] = useState({
    canReview: false,
    message: 'Войдите в аккаунт, чтобы оставить отзыв.',
  });
  const [form, setForm] = useState({
    author_name: '',
    rating: 5,
    review_text: '',
  });

  const isLoggedIn = Boolean(userSession?.token);

  // Загрузка отзывов
  useEffect(() => {
    let active = true;
    getReviews(productId)
      .then((items) => {
        if (!active) return;
        setReviews(items);
      })
      .catch(() => {
        if (!active) return;
        setErrorMessage('Не удалось загрузить отзывы.');
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });
    return () => { active = false; };
  }, [productId]);

  // Проверка возможности оставить отзыв
  useEffect(() => {
    let active = true;

    if (!isLoggedIn) {
      setEligibility({
        canReview: false,
        message: 'Войдите в аккаунт, чтобы оставить отзыв.',
      });
      return;
    }

    getReviewEligibility(productId, userSession)
      .then((data) => {
        if (!active) return;
        setEligibility(data);
      })
      .catch((err) => {
        if (!active) return;
        setEligibility({
          canReview: false,
          message: err.message || 'Не удалось проверить возможность оставить отзыв.',
        });
      });

    return () => { active = false; };
  }, [productId, userSession, isLoggedIn]);

  // Установка имени автора
  useEffect(() => {
    const authorName = String(userSession?.user?.first_name || userSession?.user?.full_name || '').trim();
    setForm((prev) => ({ ...prev, author_name: authorName }));
  }, [userSession]);

  const averageRating = useMemo(() => {
    if (!reviews.length) return 5;
    const sum = reviews.reduce((acc, item) => acc + Number(item.rating || 0), 0);
    return (sum / reviews.length).toFixed(1);
  }, [reviews]);

  const canSubmitReview = Boolean(eligibility?.canReview) && !isSending;

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!canSubmitReview || !form.review_text.trim()) return;

    setIsSending(true);
    setErrorMessage('');
    try {
      await createReview(userSession, {
        product_id: Number(productId),
        rating: Number(form.rating),
        review_text: form.review_text.trim(),
      });
      const freshList = await getReviews(productId);
      setReviews(freshList);
      setForm((prev) => ({ ...prev, rating: 5, review_text: '' }));
      // После успешной отправки обновляем статус
      const nextEligibility = await getReviewEligibility(productId, userSession);
      setEligibility(nextEligibility);
    } catch (err) {
      setErrorMessage(err.message || 'Не удалось отправить отзыв.');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="reviews-section">
      <div className="container reviews-section__container">
        <h2 className="reviews-section__title">{title}</h2>
        
        <form className="review-form" onSubmit={handleSubmit}>
          <h2>Оставить отзыв</h2>
          
          <label htmlFor="review-name">Имя</label>
          <input
            id="review-name"
            value={form.author_name}
            onChange={(e) => setForm((prev) => ({ ...prev, author_name: e.target.value }))}
            placeholder="Ваше имя"
            readOnly={isLoggedIn}
            required
          />

          <label htmlFor="review-rating">Оценка</label>
          <select
            id="review-rating"
            value={form.rating}
            onChange={(e) => setForm((prev) => ({ ...prev, rating: Number(e.target.value) }))}
            disabled={!isLoggedIn || !canSubmitReview}
          >
            {RATING_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {renderStars(option)} {option}
              </option>
            ))}
          </select>

          <label htmlFor="review-text">Отзыв</label>
          <textarea
            id="review-text"
            value={form.review_text}
            onChange={(e) => setForm((prev) => ({ ...prev, review_text: e.target.value }))}
            placeholder="Поделитесь вашим опытом..."
            rows={5}
            required
            disabled={!isLoggedIn || !canSubmitReview}
          />

          {/* КРАСНОЕ ПРЕДУПРЕЖДЕНИЕ */}
          {isLoggedIn && !canSubmitReview && eligibility?.message && (
            <div className="review-form__error review-form__error--warning">
            {eligibility.message}
            </div>
          )}

          {!isLoggedIn && (
            <button type="button" onClick={() => navigate('/auth')}>
              Войти в аккаунт
            </button>
          )}
          
          {isLoggedIn && (
            <button type="submit" disabled={!canSubmitReview}>
              {isSending ? 'Отправка...' : 'Отправить отзыв'}
            </button>
          )}
          
          {errorMessage && <div className="review-form__error">{errorMessage}</div>}
          <p>Ваш отзыв поможет другим сделать правильный выбор.</p>
        </form>

        {/* Список отзывов */}
        <div className="reviews-list">
          <div className={`reviews-summary${reviews.length === 0 ? ' reviews-summary--empty' : ''}`}>
            <strong>{averageRating}</strong>
            <div>
              <h3>{reviews.length} отзывов</h3>
              <p>Спасибо за обратную связь!</p>
            </div>
          </div>

          {isLoading ? (
            <p className="reviews-empty">Загружаем отзывы...</p>
          ) : reviews.length === 0 ? (
            <p className="reviews-empty">Пока нет отзывов. Станьте первым!</p>
          ) : (
            <div className="reviews-items">
              {reviews.map((item) => (
                <article className="review-item" key={`${item.id}-${item.created_at}`}>
                  <div className="review-item__header">
                    <div className="review-item__author">
                      <span className="review-item__avatar">👤</span>
                      <div>
                        <h4>{item.author_name}</h4>
                        <time dateTime={item.created_at}>
                          {new Date(item.created_at).toLocaleDateString('ru-RU')}
                        </time>
                      </div>
                    </div>
                    <span className="review-item__stars">{renderStars(Number(item.rating || 5))}</span>
                  </div>
                  <p>{item.review_text}</p>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}