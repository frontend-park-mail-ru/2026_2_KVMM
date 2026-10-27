import { logoTemplate } from "../Logo/Logo.js";

function template() {
  return `
    <header class="header">
      ${logoTemplate("header__logo", "header")}
      <p class="header__error" role="alert"></p>
      <button class="header__logout" type="button" aria-label="Выйти">
        <img class="header__logout-icon" src="/components/Header/icons/logout.svg" width="24" height="24" alt="">
      </button>
    </header>
  `;
}

/**
 * Шапка страниц после входа: логотип со ссылкой на ленту и кнопка выхода.
 */
export class Header {
  #parent;
  #onLogout;
  #logout;
  #error;

  /**
   * @param {HTMLElement} parent Контейнер, в который вставляется шапка.
   * @param {object} handlers Обработчики действий шапки.
   * @param {function(): void} handlers.onLogout Вызывается по нажатию «Выйти».
   */
  constructor(parent, { onLogout }) {
    this.#parent = parent;
    this.#onLogout = onLogout;
  }

  /**
   * Вставляет шапку и подписывается на нажатие «Выйти».
   */
  render() {
    this.#parent.insertAdjacentHTML("beforeend", template());
    const element = this.#parent.lastElementChild;
    this.#logout = element.querySelector(".header__logout");
    this.#error = element.querySelector(".header__error");

    this.#logout.addEventListener("click", () => this.#onLogout());
  }

  /**
   * Блокирует кнопку выхода на время запроса.
   * @param {boolean} isLoggingOut Идёт ли запрос выхода.
   */
  setLoggingOut(isLoggingOut) {
    this.#logout.disabled = isLoggingOut;
  }

  /**
   * Показывает ошибку выхода рядом с кнопкой.
   * @param {string} message Текст ошибки или пустая строка, чтобы скрыть.
   */
  setError(message) {
    this.#error.textContent = message;
  }
}
