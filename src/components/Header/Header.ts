import { logoTemplate } from "../Logo/Logo";
import logoutIcon from "./icons/logout.svg";

function template(): string {
  return `
    <header class="header">
      ${logoTemplate("header__logo", "header")}
      <p class="header__error" role="alert"></p>
      <button class="header__logout" type="button" aria-label="Выйти">
        <img class="header__logout-icon" draggable="false" src="${logoutIcon}" width="24" height="24" alt="">
      </button>
    </header>
  `;
}

/**
 * Шапка страниц после входа: логотип со ссылкой на ленту и кнопка выхода.
 */
export class Header {
  #parent: HTMLElement;
  #onLogout: () => void;
  #logout!: HTMLButtonElement;
  #error!: HTMLElement;

  /**
   * @param parent Контейнер, в который вставляется шапка.
   * @param handlers Обработчики действий шапки.
   * @param handlers.onLogout Вызывается по нажатию «Выйти».
   */
  constructor(parent: HTMLElement, { onLogout }: { onLogout: () => void }) {
    this.#parent = parent;
    this.#onLogout = onLogout;
  }

  /**
   * Вставляет шапку и подписывается на нажатие «Выйти».
   */
  render(): void {
    this.#parent.insertAdjacentHTML("beforeend", template());
    const element = this.#parent.lastElementChild as HTMLElement;
    this.#logout = element.querySelector(
      ".header__logout",
    ) as HTMLButtonElement;
    this.#error = element.querySelector(".header__error") as HTMLElement;

    this.#logout.addEventListener("click", () => this.#onLogout());
  }

  /**
   * Блокирует кнопку выхода на время запроса.
   * @param isLoggingOut Идёт ли запрос выхода.
   */
  setLoggingOut(isLoggingOut: boolean): void {
    this.#logout.disabled = isLoggingOut;
  }

  /**
   * Показывает ошибку выхода рядом с кнопкой.
   * @param message Текст ошибки или пустая строка, чтобы скрыть.
   */
  setError(message: string): void {
    this.#error.textContent = message;
  }
}
