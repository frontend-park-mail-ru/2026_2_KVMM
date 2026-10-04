const ITEMS = ["Профиль", "Лента", "Сообщества", "Мессенджер", "Друзья"];
const ACTIVE_ITEM = "Лента";

function itemTemplate(item) {
  if (item === ACTIVE_ITEM) {
    return `<span class="sidebar__item sidebar__item_active" aria-current="page">${item}</span>`;
  }
  return `<span class="sidebar__item">${item}</span>`;
}

function template() {
  return `
    <aside class="sidebar">
      <p class="logo sidebar__logo">KVMM</p>
      <nav class="sidebar__nav">
        ${ITEMS.map(itemTemplate).join("")}
      </nav>
      <button class="sidebar__item sidebar__logout" type="button">Выйти</button>
      <p class="sidebar__error" role="alert"></p>
    </aside>
  `;
}

/**
 * Боковое меню ленты с кнопкой «Выйти».
 */
export class Sidebar {
  #parent;
  #onLogout;
  #logout;
  #error;

  /**
   * @param {HTMLElement} parent Контейнер, в начало которого вставляется меню.
   * @param {object} handlers Обработчики действий меню.
   * @param {function(): void} handlers.onLogout Вызывается по нажатию «Выйти».
   */
  constructor(parent, { onLogout }) {
    this.#parent = parent;
    this.#onLogout = onLogout;
  }

  /**
   * Вставляет меню и подписывается на нажатие «Выйти».
   */
  render() {
    this.#parent.insertAdjacentHTML("afterbegin", template());
    const element = this.#parent.firstElementChild;
    this.#logout = element.querySelector(".sidebar__logout");
    this.#error = element.querySelector(".sidebar__error");

    this.#logout.addEventListener("click", () => this.#onLogout());
  }

  /**
   * Блокирует кнопку «Выйти» на время запроса.
   * @param {boolean} isLoggingOut Идёт ли запрос выхода.
   */
  setLoggingOut(isLoggingOut) {
    this.#logout.disabled = isLoggingOut;
  }

  /**
   * Показывает ошибку под меню.
   * @param {string} message Текст ошибки или пустая строка, чтобы скрыть.
   */
  setError(message) {
    this.#error.textContent = message;
  }
}
