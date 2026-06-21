const express = require('express');
const pool = require('../db/pool');
const { resolveSessionUser } = require('./auth');

const router = express.Router();
const REVIEW_COOLDOWN_SECONDS = 5 * 60;

function reviewAuthorName(user) {
  const firstName = String(user?.first_name || '').trim();
  if (firstName) return firstName;
  const fullName = String(user?.full_name || '').trim();
  if (fullName) return fullName;
  return 'Клиент';
}

function parseOrderItems(itemsJson) {
  try {
    const items = JSON.parse(itemsJson || '[]');
    return Array.isArray(items) ? items : [];
  } catch {
    return [];
  }
}

async function userPurchasedProduct(userId, productId) {
  const [rows] = await pool.execute(
    `
      SELECT items_json
      FROM orders
      WHERE user_id = ?
        AND status != 'cancelled'
    `,
    [userId]
  );

  return rows.some((row) =>
    parseOrderItems(row.items_json).some((item) => Number(item?.id || 0) === Number(productId))
  );
}

async function userReviewCooldownSeconds(userId) {
  const [rows] = await pool.execute(
    `
      SELECT created_at
      FROM reviews
      WHERE user_id = ?
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [userId]
  );
  if (!rows[0]) return 0;

  const lastReviewAt = new Date(rows[0].created_at).getTime();
  if (Number.isNaN(lastReviewAt)) return 0;

  const elapsedSeconds = Math.floor((Date.now() - lastReviewAt) / 1000);
  if (elapsedSeconds >= REVIEW_COOLDOWN_SECONDS) return 0;
  return REVIEW_COOLDOWN_SECONDS - elapsedSeconds;
}

async function userHasReviewForProduct(userId, productId) {
  const [rows] = await pool.execute(
    `
      SELECT id
      FROM reviews
      WHERE user_id = ?
        AND product_id = ?
      LIMIT 1
    `,
    [userId, productId]
  );
  return Boolean(rows[0]);
}

async function buildReviewEligibility(user, productId) {
  if (String(user?.role || 'user') === 'admin') {
    return {
      canReview: false,
      reason: 'not_client',
      message: 'Оставлять отзывы могут только клиенты.',
      cooldown_seconds: 0,
    };
  }

  const purchased = await userPurchasedProduct(user.id, productId);
  if (!purchased) {
    return {
      canReview: false,
      reason: 'not_purchased',
      message: 'Отзыв можно оставить только после покупки этого товара.',
      cooldown_seconds: 0,
    };
  }

  const alreadyReviewed = await userHasReviewForProduct(user.id, productId);
  if (alreadyReviewed) {
    return {
      canReview: false,
      reason: 'already_reviewed',
      message: 'Вы уже оставляли отзыв на этот товар.',
      cooldown_seconds: 0,
    };
  }

  const cooldownSeconds = await userReviewCooldownSeconds(user.id);
  if (cooldownSeconds > 0) {
    return {
      canReview: false,
      reason: 'cooldown',
      message: 'Следующий отзыв можно оставить позже.',
      cooldown_seconds: cooldownSeconds,
    };
  }

  return {
    canReview: true,
    reason: null,
    message: '',
    cooldown_seconds: 0,
  };
}

router.get('/eligibility', async (req, res) => {
  const productId = Number(req.query.productId);
  if (!Number.isInteger(productId) || productId <= 0) {
    return res.status(400).json({ message: 'Некорректный товар для отзыва.' });
  }

  return resolveSessionUser(req, res, async () => {
    try {
      const eligibility = await buildReviewEligibility(req.authUser, productId);
      return res.json(eligibility);
    } catch (error) {
      console.error('GET /api/reviews/eligibility failed:', error);
      return res.status(500).json({ message: 'Не удалось проверить возможность оставить отзыв.' });
    }
  });
});

router.get('/', async (req, res) => {
  try {
    const productIdRaw = Number(req.query.productId);
    const hasProductId = Number.isInteger(productIdRaw) && productIdRaw >= 0;
    const limitRaw = Number(req.query.limit || 20);
    const limit = Number.isNaN(limitRaw) ? 20 : Math.min(Math.max(limitRaw, 1), 100);

    const [rows] = hasProductId
      ? await pool.execute(
          `
          SELECT id, product_id, author_name, rating, review_text, created_at
          FROM reviews
          WHERE product_id = ?
          ORDER BY created_at DESC
          LIMIT ${limit}
          `,
          [productIdRaw]
        )
      : await pool.query(`
          SELECT id, product_id, author_name, rating, review_text, created_at
          FROM reviews
          ORDER BY created_at DESC
          LIMIT ${limit}
        `);

    res.json({ reviews: rows });
  } catch (error) {
    console.error('GET /api/reviews failed:', error);
    res.status(500).json({ message: 'Не удалось получить отзывы.' });
  }
});

router.post('/', async (req, res) => {
  return resolveSessionUser(req, res, async () => {
    try {
      const product_id = Number(req.body?.product_id);
      const review_text = String(req.body?.review_text || '').trim();
      const rating = Number(req.body?.rating);

      if (!Number.isInteger(product_id) || product_id <= 0) {
        return res.status(400).json({ message: 'Некорректный товар для отзыва.' });
      }

      if (!review_text) {
        return res.status(400).json({ message: 'Текст отзыва обязателен.' });
      }

      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).json({ message: 'Оценка должна быть от 1 до 5.' });
      }

      const eligibility = await buildReviewEligibility(req.authUser, product_id);
      if (!eligibility.canReview) {
        return res.status(403).json({
          message: eligibility.message,
          reason: eligibility.reason,
          cooldown_seconds: eligibility.cooldown_seconds,
        });
      }

      const author_name = reviewAuthorName(req.authUser);

      const [result] = await pool.execute(
        `
        INSERT INTO reviews (product_id, user_id, author_name, rating, review_text)
        VALUES (?, ?, ?, ?, ?)
        `,
        [product_id, req.authUser.id, author_name, rating, review_text]
      );

      const [rows] = await pool.execute(
        `
        SELECT id, product_id, author_name, rating, review_text, created_at
        FROM reviews
        WHERE id = ?
        LIMIT 1
        `,
        [result.insertId]
      );

      return res.status(201).json({ review: rows[0] || null });
    } catch (error) {
      if (error?.code === 'ER_DUP_ENTRY') {
        return res.status(409).json({ message: 'Вы уже оставляли отзыв на этот товар.' });
      }
      console.error('POST /api/reviews failed:', error);
      return res.status(500).json({ message: 'Не удалось сохранить отзыв.' });
    }
  });
});

module.exports = router;
