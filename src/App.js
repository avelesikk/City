import { useEffect, useMemo, useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import Header from './components/Header';
import Footer from './components/Footer';
import CookieBanner from './components/CookieBanner';
import AuthPage from './pages/AuthPage';
import CartPage from './pages/CartPage';
import KatalogPage from './pages/KatalogPage';
import AboutPage from './pages/AboutPage';
import ContactPage from './pages/ContactPage';
import HomePage from './pages/HomePage';
import FavoritesPage from './pages/FavoritesPage';
import AdminPanelPage from './pages/AdminPanelPage';
import AdminProductFormPage from './pages/AdminProductFormPage';
import ProductPage from './pages/ProductPage';
import PersonalCabinetPage from './pages/PersonalCabinetPage';
import PrivacyPolicyPage from './pages/PrivacyPolicyPage';
import NotFoundPage from './pages/NotFoundPage';
import { getProducts } from './api/productsApi';
import { PRODUCTS as HOME_PRODUCTS } from './data/products';
import { clearUserSession, readUserSession, saveUserSession } from './utils/userSession';
import './App.css';

const FAVORITES_STORAGE_KEY = 'favorites-models';
const CART_STORAGE_KEY = 'cart-models';

function readStorageArray(key) {
  try {
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function AppContent() {
  const location = useLocation();
  const [favoriteIds, setFavoriteIds] = useState(() => readStorageArray(FAVORITES_STORAGE_KEY));
  const [cartItems, setCartItems] = useState(() => readStorageArray(CART_STORAGE_KEY));
  const [catalogProducts, setCatalogProducts] = useState([]);
  const [userSession, setUserSession] = useState(() => readUserSession());
  const isLoggedIn = Boolean(userSession?.token);

  useEffect(() => {
    localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(favoriteIds));
  }, [favoriteIds]);

  useEffect(() => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartItems));
  }, [cartItems]);

  useEffect(() => {
    getProducts()
      .then((items) => setCatalogProducts(items))
      .catch(() => setCatalogProducts([]));
  }, []);

  useEffect(() => {
    const path = location.pathname;
    if (path === '/') document.title = 'Главная';
    else if (path === '/katalog') document.title = 'Каталог';
    else if (path.startsWith('/katalog/')) document.title = 'Карточка товара';
    else if (path === '/about') document.title = 'О компании';
    else if (path === '/contact') document.title = 'Контакты';
    else if (path === '/cart') document.title = 'Корзина';
    else if (path === '/favorites') document.title = 'Избранное';
    else if (path === '/auth') document.title = 'Вход и регистрация';
    else if (path === '/account') document.title = 'Личный кабинет';
    else if (path === '/privacy-policy') document.title = 'Политика конфиденциальности';
    else if (path === '/admin') document.title = 'Админ вход';
    else if (path === '/admin/panel') document.title = 'Админ панель';
    else if (path.startsWith('/admin/panel/add')) document.title = 'Добавление товара';
    else if (path.startsWith('/admin/panel/edit/')) document.title = 'Редактирование товара';
    else document.title = 'Страница не найдена';
  }, [location.pathname]);

  const availableIds = useMemo(() => {
    const ids = new Set();
    HOME_PRODUCTS.forEach((item) => ids.add(item.id));
    catalogProducts.forEach((item) => ids.add(item.id));
    return ids;
  }, [catalogProducts]);

  const favoritesCount = useMemo(
    () => favoriteIds.filter((id) => availableIds.has(id)).length,
    [favoriteIds, availableIds]
  );
  const cartCount = useMemo(() => {
    return cartItems.reduce((sum, item) => {
      const isValid = Boolean(item?.product) || availableIds.has(item.id);
      if (!isValid) return sum;
      return sum + (item.qty || 0);
    }, 0);
  }, [cartItems, availableIds]);

  const toggleFavorite = (id) => {
    setFavoriteIds((prev) => (prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]));
  };

  const resolveProduct = (value) => {
    if (typeof value === 'object' && value) return value;
    const id = value;
    const fromHome = HOME_PRODUCTS.find((item) => item.id === id);
    if (fromHome) {
      return {
        id: fromHome.id,
        name: fromHome.title,
        image_url: fromHome.image,
        price: fromHome.price,
      };
    }
    return catalogProducts.find((item) => item.id === id) || null;
  };

  const addToCart = (value) => {
    const product = resolveProduct(value);
    if (!product) return;
    const id = product.id;
    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === id);
      if (!existing) return [...prev, { id, qty: 1, product }];
      return prev.map((item) =>
        item.id === id ? { ...item, qty: item.qty + 1, product: item.product || product } : item
      );
    });
  };

  const setCartItemQty = (id, qty) => {
    setCartItems((prev) => {
      if (qty <= 0) return prev.filter((item) => item.id !== id);
      return prev.map((item) => (item.id === id ? { ...item, qty } : item));
    });
  };

  const removeFromCart = (id) => {
    setCartItems((prev) => prev.filter((item) => item.id !== id));
  };

  const clearCart = () => {
    setCartItems([]);
  };

  return (
    <div className="app-shell">
      <Header
        favoritesCount={favoritesCount}
        cartCount={cartCount}
        isLoggedIn={isLoggedIn}
        isAdmin={String(userSession?.user?.role || '') === 'admin'}
      />
      <main className="app-main">
        <Routes>
          <Route
            path="/"
            element={
              <HomePage
                favoriteIds={favoriteIds}
                onToggleFavorite={toggleFavorite}
                onAddToCart={addToCart}
                catalogProducts={catalogProducts}
              />
            }
          />
          <Route
            path="/auth"
            element={
              <AuthPage
                userSession={userSession}
                onLogin={(session) => {
                  saveUserSession(session);
                  setUserSession(session);
                }}
              />
            }
          />
          <Route
            path="/cart"
            element={
              <CartPage
                cartItems={cartItems}
                onAddToCart={addToCart}
                onSetCartItemQty={setCartItemQty}
                onRemoveFromCart={removeFromCart}
                isLoggedIn={isLoggedIn}
                favoriteIds={favoriteIds}
                onToggleFavorite={toggleFavorite}
                catalogProducts={catalogProducts}
                userSession={userSession}
                onClearCart={clearCart}
              />
            }
          />
          <Route
            path="/katalog"
            element={
              <KatalogPage
                favoriteIds={favoriteIds}
                onToggleFavorite={toggleFavorite}
                onAddToCart={addToCart}
              />
            }
          />
          <Route
            path="/katalog/:productId"
            element={
              <ProductPage
                onAddToCart={addToCart}
                favoriteIds={favoriteIds}
                onToggleFavorite={toggleFavorite}
                userSession={userSession}
              />
            }
          />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/contact" element={<ContactPage />} />
          <Route path="/privacy-policy" element={<PrivacyPolicyPage />} />
          <Route
            path="/account"
            element={
              <PersonalCabinetPage
                userSession={userSession}
                onUserLogout={() => {
                  clearUserSession();
                  setUserSession(null);
                }}
              />
            }
          />
          <Route path="/admin" element={<Navigate to="/auth" replace />} />
          <Route
            path="/admin/panel"
            element={
              <AdminPanelPage
                userSession={userSession}
                onUserLogout={() => {
                  clearUserSession();
                  setUserSession(null);
                }}
              />
            }
          />
          <Route path="/admin/panel/add" element={<AdminProductFormPage userSession={userSession} />} />
          <Route path="/admin/panel/edit/:productId" element={<AdminProductFormPage userSession={userSession} />} />
          <Route
            path="/favorites"
            element={
              <FavoritesPage
                favoriteIds={favoriteIds}
                cartItems={cartItems}
                catalogProducts={catalogProducts}
                onToggleFavorite={toggleFavorite}
                onAddToCart={addToCart}
              />
            }
          />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </main>
      <Footer />
      <CookieBanner />
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  );
}