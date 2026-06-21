const express = require('express');
const crypto = require('crypto');
const pool = require('../db/pool');

const router = express.Router();
const AUTH_TOKEN_SECRET = process.env.AUTH_TOKEN_SECRET || 'change-me-dev-auth-secret';
const PASSWORD_LENGTH = 6;

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function isLettersOnly(value) {
  return /^[A-Za-zА-Яа-яЁё]+$/.test(String(value || ''));
}

function normalizePhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  let rest = digits;
  if (rest.startsWith('8')) rest = `7${rest.slice(1)}`;
  if (rest.length === 10) rest = `7${rest}`;
  if (rest.length !== 11 || !rest.startsWith('7')) return '';
  return `+7 (${rest.slice(1, 4)}) ${rest.slice(4, 7)}-${rest.slice(7, 9)}-${rest.slice(9, 11)}`;
}

function hasDigitsOnly(value) {
  return /^\d+$/.test(String(value || ''));
}

function yearsFromBirthDate(value) {
  const birth = new Date(value);
  if (Number.isNaN(birth.getTime())) return -1;
  const now = new Date();
  let years = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) years -= 1;
  return years;
}

function toBase64Url(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

function fromBase64Url(value) {
  return Buffer.from(String(value || ''), 'base64url').toString('utf8');
}

function signTokenPayload(payload) {
  return crypto.createHmac('sha256', AUTH_TOKEN_SECRET).update(payload).digest('hex');
}

function createAuthToken(userId) {
  const payload = toBase64Url(JSON.stringify({ uid: Number(userId), iat: Date.now() }));
  const signature = signTokenPayload(payload);
  return `${payload}.${signature}`;
}

function readUserIdFromToken(token) {
  const [payload, signature] = String(token || '').split('.');
  if (!payload || !signature) return null;
  const expected = signTokenPayload(payload);
  if (expected.length !== signature.length) return null;
  if (!crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature))) return null;
  try {
    const parsed = JSON.parse(fromBase64Url(payload));
    const userId = Number(parsed?.uid || 0);
    return Number.isInteger(userId) && userId > 0 ? userId : null;
  } catch {
    return null;
  }
}

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(password, storedValue) {
  if (!storedValue || !storedValue.includes(':')) return false;
  const [salt, hash] = storedValue.split(':');
  if (!salt || !hash) return false;
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  const left = Buffer.from(hash, 'hex');
  const right = Buffer.from(derived, 'hex');
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function fullName(user) {
  return `${user.first_name} ${user.last_name}`.trim();
}

function sanitizeUser(row) {
  return {
    id: row.id,
    first_name: row.first_name,
    name: row.name || '',
    last_name: row.last_name,
    age: row.age,
    phone_number: row.phone_number,
    email: row.email,
    role: row.role || 'user',
    full_name: fullName(row),
  };
}

function readBearerToken(req) {
  const header = String(req.headers.authorization || '');
  if (!header.startsWith('Bearer ')) return '';
  return header.slice(7).trim();
}

async function resolveSessionUser(req, res, next) {
  const token = readBearerToken(req);
  const userIdFromToken = token ? readUserIdFromToken(token) : null;
  const fallbackUserId = Number(req.headers['x-user-id'] || 0);
  const fallbackUserEmail = normalizeEmail(req.headers['x-user-email'] || '');

  let rows = [];
  if (userIdFromToken) {
    [rows] = await pool.execute(
      `
        SELECT id, first_name, name, last_name, age, phone_number, email
        , role
        FROM klient
        WHERE id = ?
        LIMIT 1
      `,
      [userIdFromToken]
    );
  }

  if (!rows[0] && (fallbackUserId > 0 || fallbackUserEmail)) {
    if (fallbackUserId > 0 && fallbackUserEmail) {
      [rows] = await pool.execute(
        `
          SELECT id, first_name, name, last_name, age, phone_number, email
          , role
          FROM klient
          WHERE id = ? OR email = ?
          LIMIT 1
        `,
        [fallbackUserId, fallbackUserEmail]
      );
    } else if (fallbackUserId > 0) {
      [rows] = await pool.execute(
        `
          SELECT id, first_name, name, last_name, age, phone_number, email
          , role
          FROM klient
          WHERE id = ?
          LIMIT 1
        `,
        [fallbackUserId]
      );
    } else {
      [rows] = await pool.execute(
        `
          SELECT id, first_name, name, last_name, age, phone_number, email
          , role
          FROM klient
          WHERE email = ?
          LIMIT 1
        `,
        [fallbackUserEmail]
      );
    }
  }

  if (!rows[0]) return res.status(401).json({ message: 'Требуется авторизация.' });
  req.authToken = token || '';
  req.authUser = sanitizeUser(rows[0]);
  return next();
}

router.post('/register', async (req, res) => {
  try {
    const firstName = String(req.body?.first_name || '').trim();
    const lastName = String(req.body?.last_name || '').trim();
    const middleName = String(req.body?.name || '').trim();
    const age = String(req.body?.age || '').trim();
    const phone = normalizePhone(req.body?.phone_number);
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    const passwordConfirm = String(req.body?.password_confirm || '');

    const errors = [];
    if (!firstName || !lastName || !age || !phone || !email || !password) {
      errors.push('Все обязательные поля должны быть заполнены.');
    }
    if (email && !isValidEmail(email)) {
      errors.push('Некорректный email адрес.');
    }
    if (firstName && !isLettersOnly(firstName)) {
      errors.push('Имя должно содержать только буквы.');
    }
    if (lastName && !isLettersOnly(lastName)) {
      errors.push('Фамилия должна содержать только буквы.');
    }
    if (middleName && !isLettersOnly(middleName)) {
      errors.push('Отчество должно содержать только буквы.');
    }
    if (!phone) {
      errors.push('Телефон должен быть в формате +7 (999) 999-99-99.');
    }
    if (password && !hasDigitsOnly(password)) {
      errors.push('Пароль должен состоять только из цифр.');
    }
    if (passwordConfirm && !hasDigitsOnly(passwordConfirm)) {
      errors.push('Подтверждение пароля должно состоять только из цифр.');
    }
    if (password && password.length !== PASSWORD_LENGTH) {
      errors.push(`Пароль должен содержать ровно ${PASSWORD_LENGTH} цифр.`);
    }
    if (passwordConfirm && passwordConfirm.length !== PASSWORD_LENGTH) {
      errors.push(`Подтверждение пароля должно содержать ровно ${PASSWORD_LENGTH} цифр.`);
    }
    if (password && passwordConfirm && password !== passwordConfirm) {
      errors.push('Пароли не совпадают.');
    }
    if (age && yearsFromBirthDate(age) < 14) {
      errors.push('Для регистрации вам должно быть не менее 14 лет.');
    }
    if (errors.length) return res.status(400).json({ message: errors.join(' ') });

    const [existing] = await pool.execute(`SELECT id FROM klient WHERE email = ? LIMIT 1`, [email]);
    if (existing[0]) {
      return res.status(409).json({ message: 'Пользователь с таким email уже зарегистрирован.' });
    }
    const [existingPhone] = await pool.execute(`SELECT id FROM klient WHERE phone_number = ? LIMIT 1`, [phone]);
    if (existingPhone[0]) {
      return res.status(409).json({ message: 'Пользователь с таким номером телефона уже зарегистрирован.' });
    }

    const passwordHash = hashPassword(password);
    await pool.execute(
      `
        INSERT INTO klient (first_name, name, last_name, age, phone_number, email, password, role)
        VALUES (?, ?, ?, ?, ?, ?, ?, 'user')
      `,
      [firstName, middleName || '', lastName, age, phone, email, passwordHash]
    );

    return res.status(201).json({ ok: true, message: 'Регистрация прошла успешно. Выполните вход.' });
  } catch (error) {
    if (error?.code === 'ER_DUP_ENTRY') {
      const message = String(error?.sqlMessage || '');
      if (message.includes('uq_klient_phone_number')) {
        return res.status(409).json({ message: 'Пользователь с таким номером телефона уже зарегистрирован.' });
      }
      if (message.includes('uq_klient_email')) {
        return res.status(409).json({ message: 'Пользователь с таким email уже зарегистрирован.' });
      }
    }
    console.error('POST /api/auth/register failed:', error);
    return res.status(500).json({ message: 'Не удалось зарегистрировать пользователя.' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = String(req.body?.password || '');
    if (!email || !password) {
      return res.status(400).json({ message: 'Введите email и пароль.' });
    }

    const [rows] = await pool.execute(
      `
        SELECT id, first_name, name, last_name, age, phone_number, email, password, role
        FROM klient
        WHERE email = ?
        LIMIT 1
      `,
      [email]
    );

    const userRow = rows[0];
    if (!userRow) {
      return res.status(404).json({ message: 'Пользователь не найден.' });
    }
    if (!verifyPassword(password, userRow.password)) {
      return res.status(401).json({ message: 'Неверный пароль.' });
    }

    const token = createAuthToken(userRow.id);

    return res.json({
      token,
      expires_at: null,
      user: sanitizeUser(userRow),
    });
  } catch (error) {
    console.error('POST /api/auth/login failed:', error);
    return res.status(500).json({ message: 'Не удалось выполнить вход.' });
  }
});

router.get('/me', resolveSessionUser, async (req, res) => {
  return res.json({ user: req.authUser });
});

router.post('/logout', resolveSessionUser, async (req, res) => {
  return res.json({ ok: true });
});

router.post('/orders', resolveSessionUser, async (req, res) => {
  try {
    const items = Array.isArray(req.body?.items) ? req.body.items : [];
    const totalPrice = Number(req.body?.total_price || 0);
    if (!items.length) return res.status(400).json({ message: 'Корзина пуста.' });
    if (!Number.isFinite(totalPrice) || totalPrice <= 0) {
      return res.status(400).json({ message: 'Некорректная сумма заказа.' });
    }
    const booking = req.body?.booking || {};
    const deliveryType = String(booking?.delivery_type || '').trim().toLowerCase();
    const address = String(booking?.address || '').trim();
    const pickupPoint = String(booking?.pickup_point || '').trim();
    const deliveryCity = String(booking?.city || '').trim();
    if (!['delivery', 'pickup'].includes(deliveryType)) {
      return res.status(400).json({ message: 'Некорректный способ получения заказа.' });
    }
    if (deliveryType === 'delivery') {
      if (!address) return res.status(400).json({ message: 'Укажите адрес доставки.' });
      if (!/[A-Za-zА-Яа-яЁё]/.test(address)) {
        return res.status(400).json({ message: 'Адрес должен содержать буквы и номер дома.' });
      }
    }
    if (deliveryType === 'pickup' && !pickupPoint) {
      return res.status(400).json({ message: 'Укажите пункт самовывоза.' });
    }

    const normalized = items
      .map((item) => ({
        id: Number(item?.id || 0),
        title: String(item?.title || ''),
        qty: Number(item?.qty || 0),
        price: Number(item?.price || 0),
      }))
      .filter((item) => item.id > 0 && item.qty > 0 && item.price >= 0 && item.title);

    if (!normalized.length) return res.status(400).json({ message: 'В заказе нет валидных товаров.' });

    const [result] = await pool.execute(
      `
        INSERT INTO orders (
          user_id,
          items_json,
          total_price,
          status,
          delivery_type,
          delivery_address,
          pickup_point,
          delivery_city
        )
        VALUES (?, ?, ?, 'new', ?, ?, ?, ?)
      `,
      [
        req.authUser.id,
        JSON.stringify(normalized),
        Math.round(totalPrice),
        deliveryType,
        deliveryType === 'delivery' ? address : '',
        deliveryType === 'pickup' ? pickupPoint : '',
        deliveryCity,
      ]
    );

    return res.status(201).json({
      ok: true,
      order: {
        id: result.insertId,
        status: 'new',
        total_price: Math.round(totalPrice),
      },
    });
  } catch (error) {
    console.error('POST /api/auth/orders failed:', error);
    return res.status(500).json({ message: 'Не удалось оформить заказ.' });
  }
});

router.get('/orders', resolveSessionUser, async (req, res) => {
  try {
    const [rows] = await pool.execute(
      `
        SELECT id, items_json, total_price, status, created_at
        FROM orders
        WHERE user_id = ?
        ORDER BY id DESC
      `,
      [req.authUser.id]
    );

    const orders = rows.map((row) => {
      let items = [];
      try {
        items = JSON.parse(row.items_json || '[]');
      } catch {
        items = [];
      }
      return {
        id: row.id,
        items,
        total_price: Number(row.total_price || 0),
        status: row.status,
        created_at: row.created_at,
      };
    });

    return res.json({ orders });
  } catch (error) {
    console.error('GET /api/auth/orders failed:', error);
    return res.status(500).json({ message: 'Не удалось получить заказы.' });
  }
});

router.patch('/orders/:orderId/cancel', resolveSessionUser, async (req, res) => {
  try {
    const orderId = Number(req.params.orderId || 0);
    if (!orderId) return res.status(400).json({ message: 'Некорректный ID заказа.' });

    const [rows] = await pool.execute(`SELECT id, user_id, status FROM orders WHERE id = ? LIMIT 1`, [orderId]);
    const order = rows[0];
    if (!order || Number(order.user_id) !== Number(req.authUser.id)) {
      return res.status(404).json({ message: 'Заказ не найден.' });
    }
    if (String(order.status) !== 'new') {
      return res.status(409).json({ message: 'Отменить можно только новый заказ до обработки администратором.' });
    }

    await pool.execute(`UPDATE orders SET status = 'cancelled' WHERE id = ? LIMIT 1`, [orderId]);
    return res.json({ ok: true, status: 'cancelled' });
  } catch (error) {
    console.error('PATCH /api/auth/orders/:orderId/cancel failed:', error);
    return res.status(500).json({ message: 'Не удалось отменить заказ.' });
  }
});

module.exports = router;
module.exports.resolveSessionUser = resolveSessionUser;
