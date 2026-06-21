import { useRef, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { loginUser, registerUser } from '../api/authApi';
import { Link } from 'react-router-dom';
import './AuthPage.css';

const PASSWORD_LENGTH = 6;

const MSG_NAME_LETTERS_ONLY =
  'Укажите только буквы — цифры и специальные символы в этом поле не используются.';
const MSG_PASSWORD_DIGITS_ONLY =
  'Пароль задаётся только цифрами.';

export default function AuthPage({ userSession, onLogin }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('login');
  const [loginForm, setLoginForm] = useState({
    email: '',
    password: '',
  });
  const [registerForm, setRegisterForm] = useState({
    last_name: '',
    first_name: '',
    name: '',
    age: '',
    phone_number: '',
    email: '',
    password: '',
    password_confirm: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [registerErrors, setRegisterErrors] = useState({});
  const [hasRegisterAttemptedSubmit, setHasRegisterAttemptedSubmit] = useState(false);
  const nameInvalidRef = useRef({ last_name: false, first_name: false, name: false });
  const passwordNonDigitRef = useRef({ password: false, password_confirm: false });
  const [isPolicyChecked, setIsPolicyChecked] = useState(false);

  const switchTab = (tab) => {
    setActiveTab(tab);
    setError('');
    setSuccess('');
  };

  if (userSession?.token) {
    const adminTarget = String(userSession?.user?.role || '') === 'admin' ? '/admin/panel' : '/account';
    return <Navigate to={adminTarget} replace />;
  }

  const formatPhone = (rawValue) => {
    const digits = String(rawValue || '').replace(/\D/g, '');
    let rest = digits;
    if (rest.startsWith('7')) rest = rest.slice(1);
    if (rest.startsWith('8')) rest = rest.slice(1);
    rest = rest.slice(0, 10);

    const p1 = rest.slice(0, 3);
    const p2 = rest.slice(3, 6);
    const p3 = rest.slice(6, 8);
    const p4 = rest.slice(8, 10);

    let out = '+7';
    if (rest.length > 0) out += ` (${p1}`;
    if (rest.length >= 3) out += ')';
    if (rest.length > 3) out += ` ${p2}`;
    if (rest.length > 6) out += `-${p3}`;
    if (rest.length > 8) out += `-${p4}`;
    return out;
  };

  const normalizeNameInput = (rawValue) => String(rawValue || '').replace(/[^A-Za-zА-Яа-яЁё]/g, '');
  const onlyDigits = (rawValue) => String(rawValue || '').replace(/\D/g, '');
  const loginPasswordDigits = (rawValue) =>
    String(rawValue || '')
      .replace(/\D/g, '')
      .slice(0, PASSWORD_LENGTH);

  const nameFieldErrorKey = (field) =>
    field === 'last_name' ? 'last_name' : field === 'first_name' ? 'first_name' : 'name';

  const validateRegisterForm = (form) => {
    const errors = {};
    const phoneDigits = onlyDigits(form.phone_number);
    const password = String(form.password || '');
    const passwordConfirm = String(form.password_confirm || '');

    if (phoneDigits.length !== 11 || !phoneDigits.startsWith('7')) {
      errors.phone_number = 'Введите телефон в формате +7 (999) 999-99-99.';
    }

    if (!password) {
      errors.password = 'Введите пароль.';
    } else {
      if (!/^\d+$/.test(password)) {
        errors.password = MSG_PASSWORD_DIGITS_ONLY;
      } else if (password.length !== PASSWORD_LENGTH) {
        errors.password = `Пароль должен содержать ровно ${PASSWORD_LENGTH} цифр.`;
      }
    }

    if (!passwordConfirm) {
      errors.password_confirm = 'Повторите пароль.';
    } else {
      if (!/^\d+$/.test(passwordConfirm)) {
        errors.password_confirm = MSG_PASSWORD_DIGITS_ONLY;
      } else if (passwordConfirm.length !== PASSWORD_LENGTH) {
        errors.password_confirm = `Подтверждение пароля должно содержать ровно ${PASSWORD_LENGTH} цифр.`;
      } else if (password && password !== passwordConfirm) {
        errors.password_confirm = 'Пароли не совпадают.';
      }
    }

    return errors;
  };

  const mergeRegisterErrors = (form) => {
    const e = { ...validateRegisterForm(form) };
    const n = nameInvalidRef.current;
    const p = passwordNonDigitRef.current;
    if (n.last_name) e.last_name = MSG_NAME_LETTERS_ONLY;
    if (n.first_name) e.first_name = MSG_NAME_LETTERS_ONLY;
    if (n.name) e.name = MSG_NAME_LETTERS_ONLY;
    if (p.password) e.password = MSG_PASSWORD_DIGITS_ONLY;
    if (p.password_confirm) e.password_confirm = MSG_PASSWORD_DIGITS_ONLY;
    return e;
  };

  const updateRegisterField = (field, value) => {
    setRegisterForm((prev) => {
      const next = { ...prev, [field]: value };
      if (hasRegisterAttemptedSubmit) {
        setRegisterErrors(mergeRegisterErrors(next));
      }
      return next;
    });
  };

  const updateRegisterNameField = (field, rawValue) => {
    const key = nameFieldErrorKey(field);
    const cleaned = normalizeNameInput(rawValue);
    const hasInvalid = /[^A-Za-zА-Яа-яЁё]/.test(String(rawValue || ''));
    nameInvalidRef.current[key] = hasInvalid;

    setRegisterForm((prev) => {
      const next = { ...prev, [field]: cleaned };
      if (hasRegisterAttemptedSubmit) {
        setRegisterErrors(mergeRegisterErrors(next));
      } else {
        setRegisterErrors((prevErr) => {
          const m = { ...prevErr };
          if (hasInvalid) m[key] = MSG_NAME_LETTERS_ONLY;
          else delete m[key];
          return m;
        });
      }
      return next;
    });
  };

  const updateRegisterPasswordField = (field, rawValue) => {
    const digits = onlyDigits(rawValue).slice(0, PASSWORD_LENGTH);
    const raw = String(rawValue || '');
    const hasNonDigit = raw.length > 0 && /[^\d]/.test(raw);
    passwordNonDigitRef.current[field] = hasNonDigit;

    setRegisterForm((prev) => {
      const next = { ...prev, [field]: digits };
      if (hasRegisterAttemptedSubmit) {
        setRegisterErrors(mergeRegisterErrors(next));
      } else {
        setRegisterErrors((prevErr) => {
          const m = { ...prevErr };
          if (hasNonDigit) m[field] = MSG_PASSWORD_DIGITS_ONLY;
          else delete m[field];
          return m;
        });
      }
      return next;
    });
  };

  const onLoginSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setIsLoading(true);
    try {
      const data = await loginUser({
        email: loginForm.email,
        password: loginForm.password,
      });
      onLogin?.({ token: data.token, user: data.user, expires_at: data.expires_at });
      const adminTarget = String(data?.user?.role || '') === 'admin' ? '/admin/panel' : '/account';
      navigate(adminTarget);
    } catch (err) {
      setError(err.message || 'Не удалось выполнить вход.');
    } finally {
      setIsLoading(false);
    }
  };

  const onRegisterSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setHasRegisterAttemptedSubmit(true);
    const frontErrors = mergeRegisterErrors(registerForm);
    setRegisterErrors(frontErrors);
    if (Object.keys(frontErrors).length) return;
    setIsLoading(true);
    try {
      const data = await registerUser(registerForm);
      setSuccess(data.message || 'Регистрация прошла успешно.');
      setActiveTab('login');
      navigate('/auth', { replace: true });
      setLoginForm((prev) => ({ ...prev, email: registerForm.email }));
      setRegisterForm({
        last_name: '',
        first_name: '',
        name: '',
        age: '',
        phone_number: '',
        email: '',
        password: '',
        password_confirm: '',
      });
      setRegisterErrors({});
      setHasRegisterAttemptedSubmit(false);
      nameInvalidRef.current = { last_name: false, first_name: false, name: false };
      passwordNonDigitRef.current = { password: false, password_confirm: false };
    } catch (err) {
      setError(err.message || 'Не удалось зарегистрироваться.');
      setActiveTab('register');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <section className="auth-page">
      <div className="auth-box">
        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab${activeTab === 'login' ? ' active' : ''}`}
            onClick={() => switchTab('login')}
          >
            Вход
          </button>
          <button
            type="button"
            className={`auth-tab${activeTab === 'register' ? ' active' : ''}`}
            onClick={() => switchTab('register')}
          >
            Регистрация
          </button>
        </div>
{activeTab === 'login' && error && <div className="auth-error">{error}</div>}
{activeTab === 'login' && success && <div className="auth-success">{success}</div>}

{activeTab === 'register' && error && <div className="auth-error">{error}</div>}
{activeTab === 'register' && success && <div className="auth-success">{success}</div>}

        {activeTab === 'login' ? (
          <form className="auth-card" onSubmit={onLoginSubmit} autoComplete="off">
            <h1 className="auth-card__title">Вход в личный кабинет</h1>
            <div className="auth-field">
              <label htmlFor="login-email">Email </label>
              <input
                id="login-email"
                value={loginForm.email}
                onChange={(e) => setLoginForm((prev) => ({ ...prev, email: e.target.value }))}
                type="email"
                autoComplete="off"
                placeholder="Ваш email"
                required
              />
            </div>
            <div className="auth-field">
              <label htmlFor="login-password">Пароль</label>
              <input
                id="login-password"
                value={loginForm.password}
                onChange={(e) =>
                  setLoginForm((prev) => ({
                    ...prev,
                    password: loginPasswordDigits(e.target.value),
                  }))
                }
                type="password"
                autoComplete="new-password"
                placeholder="Ваш пароль"
                inputMode="numeric"
                maxLength={PASSWORD_LENGTH}
                required
              />
            </div>
            <button className="auth-submit auth-btn" type="submit" disabled={isLoading}>
              {isLoading ? 'Выполняем вход...' : 'Войти'}
            </button>
            <div className="form-footer">
              Нет аккаунта?{' '}
              <button type="button" className="form-footer__link" onClick={() => switchTab('register')}>
                Зарегистрируйтесь
              </button>
            </div>
          </form>
        ) : (
          <form className="auth-card auth-card--register" onSubmit={onRegisterSubmit} autoComplete="off">
            <h1 className="auth-card__title">Регистрация</h1>
            <div className="auth-grid">
              <div className="auth-field">
                <label htmlFor="reg-last">Фамилия</label>
              <input
                id="reg-last"
                value={registerForm.last_name}
                onChange={(e) => updateRegisterNameField('last_name', e.target.value)}
                type="text"
                placeholder="Введите фамилию"
                pattern="^[A-Za-zА-Яа-яЁё]+$"
                title="Только буквы"
                required
              />
                {registerErrors.last_name ? <small className="auth-field-error">{registerErrors.last_name}</small> : null}
            </div>
              <div className="auth-field">
                <label htmlFor="reg-first">Имя</label>
              <input
                id="reg-first"
                value={registerForm.first_name}
                onChange={(e) => updateRegisterNameField('first_name', e.target.value)}
                type="text"
                placeholder="Введите имя"
                pattern="^[A-Za-zА-Яа-яЁё]+$"
                title="Только буквы"
                required
              />
                {registerErrors.first_name ? <small className="auth-field-error">{registerErrors.first_name}</small> : null}
            </div>
              <div className="auth-field">
                <label htmlFor="reg-middle">Отчество</label>
              <input
                id="reg-middle"
                value={registerForm.name}
                onChange={(e) => updateRegisterNameField('name', e.target.value)}
                type="text"
                placeholder="Введите отчество"
                pattern="^[A-Za-zА-Яа-яЁё]*$"
                title="Только буквы"
              />
                {registerErrors.name ? <small className="auth-field-error">{registerErrors.name}</small> : null}
            </div>
              <div className="auth-field">
                <label htmlFor="reg-age">Дата рождения</label>
                <input
                  id="reg-age"
                  value={registerForm.age}
                  onChange={(e) => updateRegisterField('age', e.target.value)}
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  required
                />
              </div>
              <div className="auth-field">
                <label htmlFor="reg-phone">Телефон</label>
                <input
                  id="reg-phone"
                  value={registerForm.phone_number}
                  onChange={(e) => updateRegisterField('phone_number', formatPhone(e.target.value))}
                  onFocus={() =>
                    updateRegisterField('phone_number', registerForm.phone_number || '+7 (')
                  }
                  type="tel"
                  placeholder="+7 (999) 999-99-99"
                  required
                />
                {registerErrors.phone_number ? <small className="auth-field-error">{registerErrors.phone_number}</small> : null}
              </div>
              <div className="auth-field">
                <label htmlFor="reg-email">Email</label>
                <input
                  id="reg-email"
                  value={registerForm.email}
                  onChange={(e) => updateRegisterField('email', e.target.value)}
                  type="email"
                  placeholder="Введите email"
                  required
                />
              </div>
              <div className="auth-field">
                <label htmlFor="reg-pass">Пароль</label>
                <input
                  id="reg-pass"
                  value={registerForm.password}
                  onChange={(e) => updateRegisterPasswordField('password', e.target.value)}
                  autoComplete="new-password"
                  placeholder="Введите пароль"
                  inputMode="numeric"
                  pattern="^[0-9]+$"
                  minLength={PASSWORD_LENGTH}
                  maxLength={PASSWORD_LENGTH}
                  required
                />
                {registerErrors.password ? <small className="auth-field-error">{registerErrors.password}</small> : null}
              </div>
              <div className="auth-field">
                <label htmlFor="reg-pass2">Подтверждение пароля</label>
                <input
                  id="reg-pass2"
                  value={registerForm.password_confirm}
                  onChange={(e) => updateRegisterPasswordField('password_confirm', e.target.value)}
                  type="password"
                  placeholder="Повторите пароль"
                  inputMode="numeric"
                  pattern="^[0-9]+$"
                  minLength={PASSWORD_LENGTH}
                  maxLength={PASSWORD_LENGTH}
                  required
                />
                {registerErrors.password_confirm ? (
                  <small className="auth-field-error">{registerErrors.password_confirm}</small>
                ) : null}
              </div>  
            </div>
            <label className="booking-modal__consent">
  <input
    type="checkbox"
    checked={isPolicyChecked}
    onChange={(e) => setIsPolicyChecked(e.target.checked)}
    required
  />
  <span>
    Нажимая на кнопку, вы соглашаетесь с{' '}
    <Link to="/privacy-policy" className="booking-modal__policy-link"  rel="noreferrer">
      политикой конфиденциальности
    </Link>
  </span>
</label>
            <button className="auth-submit auth-btn" type="submit" disabled={isLoading}>
              {isLoading ? 'Регистрируем...' : 'Зарегистрироваться'}
            </button>
            <div className="form-footer">
              Уже есть аккаунт?{' '}
              <button type="button" className="form-footer__link" onClick={() => switchTab('login')}>
                Войдите
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}

