import './Footer.css';
import { Link } from 'react-router-dom';

export default function Footer() {
  return (
    <footer>
      <div className="container">
        <div className="footer-content">
          <div className="footer-logo">
            <Link to="/" state={{ fromLogo: true }}>
              <img src="/img/logo1.webp" alt="City-K" className="footer-logo-img" />
            </Link>
            <p>Создаем комфортный климат в вашем доме и офисе с 2012 года</p>
            <Link to="/privacy-policy" className="footer-privacy-link">
              Политика конфиденциальности
            </Link>
            <div className="footer-sitemap-wrapper">
    <a href="/sitemap.xml" target="_blank" rel="noreferrer">Карта сайта</a>
  </div>
          </div>
          

          <div className="footer-contacts">
            <h3>Контакты</h3>
            <div className="contact-item">
              <i className="fas fa-phone-alt" />
              <span>+7 (4912) 12-34-56</span>
            </div>
            <div className="contact-item">
              <i className="fas fa-map-marker-alt" />
              <span>г. Рязань, ул. Промышленная, 15</span>
            </div>
            <div className="contact-item">
              <i className="fas fa-envelope" />
              <span>info@aira.ru</span>
            </div>
          </div>

          <div className="footer-nav">
            <h3>Навигация</h3>
            <ul>
              <li>
                <Link to="/katalog">Каталог</Link>
              </li>
              <li>
                <Link to="/about">О компании</Link>
              </li>
              <li>
                <Link to="/contact">Связаться с нами</Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </footer>
  );
}

