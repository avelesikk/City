const API_URL = process.env.REACT_APP_REVIEWS_API_URL || 'http://localhost:4000/api/reviews';

function withAuthHeaders(auth) {
  const token = typeof auth === 'string' ? auth : auth?.token || '';
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function parseResponse(res, fallbackMessage) {
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const error = new Error(data?.message || fallbackMessage);
    error.reason = data?.reason || '';
    error.cooldownSeconds = Number(data?.cooldown_seconds || 0);
    throw error;
  }
  return data;
}

export async function getReviews(productId) {
  const query = Number.isInteger(Number(productId)) ? `?productId=${Number(productId)}` : '';
  const res = await fetch(`${API_URL}${query}`, { method: 'GET' });
  if (!res.ok) throw new Error('reviews_fetch_failed');
  const data = await res.json();
  return Array.isArray(data?.reviews) ? data.reviews : [];
}

export async function getReviewEligibility(productId, auth) {
  const res = await fetch(`${API_URL}/eligibility?productId=${Number(productId)}`, {
    headers: withAuthHeaders(auth),
  });
  return parseResponse(res, 'Не удалось проверить возможность оставить отзыв.');
}

export async function createReview(auth, payload) {
  const res = await fetch(API_URL, {
    method: 'POST',
    headers: withAuthHeaders(auth),
    body: JSON.stringify(payload),
  });
  const data = await parseResponse(res, 'Не удалось отправить отзыв.');
  return data?.review;
}
