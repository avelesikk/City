import './AboutPage.css';

export default function AboutPage() {
  return (
    <section className="about-page">
      <div className="container about-page__container">
        <article className="about-block">
          <div className="about-block__content">
            <h1>Более 12 лет создаем идеальный климат</h1>
            <p>
              Aira - это надежный партнер в вопросах кондиционирования воздуха. За годы работы мы
              помогли тысячам покупателей создать комфортные условия в их домах и офисах.
            </p>
            <p>
              Мы верим, что каждый человек заслуживает работать и жить в помещении с идеальной
              температурой. Поэтому мы предлагаем только качественное оборудование и профессиональный
              сервис.
            </p>
          </div>
          <div className="about-block__media">
            <img src="/img/a2.jpg" alt="Команда Aira" />
          </div>
        </article>

        <article className="about-block about-block--reverse">
          <div className="about-block__media about-block__media--natural">
            <img src="/img/a1.jpg" alt="Качество и надежность Aira" />
          </div>
          <div className="about-block__content">
            <h2>Качество, надежность, забота</h2>
            <p>
              Для нас каждый клиент - это не просто покупатель, а долгосрочный партнер. Мы
              ответственно подходим к выбору оборудования и гарантируем его качество.
            </p>
            <ul className="about-feature-list">
              <li>
                <h3>
                  <img className="about-feature-icon" src="/img/molnia.png" alt="" aria-hidden="true" />
                  Энергоэффективность
                </h3>
                <p>Экономия электроэнергии до 40% с инверторными технологиями</p>
              </li>
              <li>
                <h3>
                  <img className="about-feature-icon" src="/img/medal.png" alt="" aria-hidden="true" />
                  Сертификация
                </h3>
                <p>Все товары прошли сертификацию и соответствуют ГОСТ</p>
              </li>
              <li>
                <h3>
                  <img className="about-feature-icon" src="/img/gryppa.png" alt="" aria-hidden="true" />
                  Опыт команды
                </h3>
                <p>Наши специалисты имеют опыт более 15 лет</p>
              </li>
            </ul>
          </div>
        </article>

        <article className="about-block">
          <div className="about-block__content">
            <h2>Полный спектр услуг для вашего комфорта</h2>
            <p>
              Мы не просто продаем кондиционеры - мы создаем решения. От консультации до установки и
              обслуживания - мы с вами на каждом этапе.
            </p>

            <div className="about-services-accordion">
              <details>
                <summary>Доставка</summary>
                <p>Бесплатная доставка по Рязании области. При выборе доставки согласуем удобное время прибытия, бережно доставим оборудование и поднимем на этаж. Также вы можете забрать заказ самостоятельно со склада — наш менеджер уточнит удобный для вас способ получения при оформлении.</p>
              </details>
              <details>
                <summary>Установка</summary>
                <p>Монтаж выполняется сертифицированными инженерами со стажем работы в климатическом оборудовании не менее 5 лет. Работы проводятся с соблюдением технических регламентов производителя и строительных норм. Гарантия на установку — 12 месяцев.</p>
              </details>
              <details>
                <summary>Обслуживание</summary>
                <p>Техническое обслуживание и ремонт 24/7. Проведем диагностику, заправку фреоном, сезонную чистку и оперативно устраним любую неисправность с использованием оригинальных комплектующих.</p>
              </details>
            </div>
          </div>
          <div className="about-block__media about-block__media--natural">
            <img src="/img/po.jpg" alt="Услуги монтажа и обслуживания City-K" />
          </div>
        </article>
      </div>
    </section>
  );
}

