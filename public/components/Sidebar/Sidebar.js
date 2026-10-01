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
        <button class="sidebar__item sidebar__logout" type="button">Выйти</button>
      </nav>
      <p class="sidebar__error" role="alert"></p>
    </aside>
  `;
}

export class Sidebar {
  #parent;
  #onLogout;
  #logout;
  #error;

  constructor(parent, { onLogout }) {
    this.#parent = parent;
    this.#onLogout = onLogout;
  }

  render() {
    this.#parent.insertAdjacentHTML("afterbegin", template());
    const element = this.#parent.firstElementChild;
    this.#logout = element.querySelector(".sidebar__logout");
    this.#error = element.querySelector(".sidebar__error");

    this.#logout.addEventListener("click", () => this.#onLogout());
  }

  setLoggingOut(isLoggingOut) {
    this.#logout.disabled = isLoggingOut;
  }

  setError(message) {
    this.#error.textContent = message;
  }
}
