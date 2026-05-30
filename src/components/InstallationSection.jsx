import './InstallationSection.css';

const INSTALLATION_BENEFITS = [
  'Бесплатная доставка по Рязани и области',
  'Профессиональный монтаж и наладка',
  'Обучение управлению устройством',
  'Гарантийное обслуживание 24/7',
];

export default function InstallationSection() {
  return (
    <section className="installation-section">
      <div className="container installation-section__container">
        <div className="installation-section__text">
          <h2>Профессиональная установка включена</h2>
          <p>
            Наши квалифицированные специалисты установят и протестируют кондиционер прямо у вас
            дома. Гарантируем качество работы и долгий срок службы.
          </p>
          <ul>
            {INSTALLATION_BENEFITS.map((item) => (
              <li key={item}>
                <span>✓</span>
                {item}
              </li>
            ))}
          </ul>
        </div>

        <div className="installation-section__image-wrap">
          <img src="/img/111.jpg" alt="Профессиональная установка кондиционера" />
        </div>
      </div>
    </section>
  );
}
