import { api } from "../../modules/api";
import type { Router } from "../../modules/router";
import { user } from "../../modules/user";
import { NETWORK_ERROR } from "../../modules/errors";
import { Header } from "../Header/Header";
import { Sidebar } from "../Sidebar/Sidebar";
import type { SidebarSection } from "../Sidebar/Sidebar";

function template(): string {
  return `
    <div class="app-layout">
      <div class="app-layout__header"></div>
      <div class="app-layout__body">
        <div class="app-layout__aside"></div>
        <main class="app-layout__main"></main>
      </div>
    </div>
  `;
}

/**
 * Каркас страниц после входа: шапка с выходом, меню разделов и колонка содержимого.
 */
export class AppLayout {
  #parent: HTMLElement;
  #router: Router;
  #section: SidebarSection | null;
  #header!: Header;

  /**
   * @param parent Контейнер страницы.
   * @param router Роутер для перехода на /login после выхода.
   * @param section Активный раздел меню или null, если страница вне меню (чужой профиль).
   */
  constructor(
    parent: HTMLElement,
    router: Router,
    section: SidebarSection | null,
  ) {
    this.#parent = parent;
    this.#router = router;
    this.#section = section;
  }

  /**
   * Рисует каркас.
   * @returns Колонка, в которую страница выводит своё содержимое.
   */
  render(): HTMLElement {
    this.#parent.insertAdjacentHTML("beforeend", template());
    const layout = this.#parent.lastElementChild as HTMLElement;
    this.#header = new Header(
      layout.querySelector(".app-layout__header") as HTMLElement,
      { onLogout: () => this.#logout() },
    );
    this.#header.render();
    new Sidebar(
      layout.querySelector(".app-layout__aside") as HTMLElement,
      this.#section,
    ).render();
    return layout.querySelector(".app-layout__main") as HTMLElement;
  }

  async #logout(): Promise<void> {
    this.#header.setError("");
    this.#header.setLoggingOut(true);
    const { status } = await api.logout();

    if (status === 204 || status === 401) {
      user.clear();
      this.#router.navigate("/login");
      return;
    }

    this.#header.setLoggingOut(false);
    this.#header.setError(NETWORK_ERROR);
  }
}
