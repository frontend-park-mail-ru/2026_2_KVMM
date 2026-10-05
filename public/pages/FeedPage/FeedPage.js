import { api } from "../../modules/api.js";
import { user } from "../../modules/user.js";
import { NETWORK_ERROR } from "../../modules/errors.js";
import { Sidebar } from "../../components/Sidebar/Sidebar.js";
import { Post } from "../../components/Post/Post.js";

const PAGE_SIZE = 10;
const LOAD_THRESHOLD = 600;

const STATUSES = {
  idle: "",
  loading: `<p>Загрузка...</p>`,
  empty: `<p>Здесь пока нет постов</p>`,
  error: `
    <p>${NETWORK_ERROR}</p>
    <button class="button button_secondary feed__retry" type="button">Повторить</button>
  `,
};

function template() {
  return `
    <div class="feed-page">
      <main class="feed">
        <div class="feed__list"></div>
        <div class="feed__status" role="status"></div>
      </main>
    </div>
  `;
}

/**
 * Страница ленты: сайдбар, посты с бэкенда, подгрузка при прокрутке, выход.
 */
export class FeedPage {
  #parent;
  #router;
  #sidebar;
  #list;
  #status;
  #cursor = 0;
  #hasMore = true;
  #isLoading = false;
  #hasError = false;
  #isDestroyed = false;

  /**
   * @param {HTMLElement} parent Контейнер страницы.
   * @param {import("../../modules/router.js").Router} router Роутер для перехода на /login.
   */
  constructor(parent, router) {
    this.#parent = parent;
    this.#router = router;
  }

  /**
   * Рисует страницу и загружает первую порцию постов.
   */
  render() {
    this.#parent.insertAdjacentHTML("beforeend", template());
    const page = this.#parent.querySelector(".feed-page");
    this.#list = page.querySelector(".feed__list");
    this.#status = page.querySelector(".feed__status");

    this.#sidebar = new Sidebar(page, { onLogout: () => this.#logout() });
    this.#sidebar.render();

    this.#status.addEventListener("click", (event) => {
      if (event.target.closest(".feed__retry")) {
        this.#hasError = false;
        this.#loadPage();
      }
    });
    window.addEventListener("scroll", this.#onScroll, { passive: true });

    this.#loadPage();
  }

  /**
   * Снимает обработчик прокрутки и игнорирует ответы, пришедшие после ухода со страницы.
   */
  destroy() {
    this.#isDestroyed = true;
    window.removeEventListener("scroll", this.#onScroll);
  }

  #onScroll = () => {
    if (this.#isNearBottom()) {
      this.#loadPage();
    }
  };

  #isNearBottom() {
    const scrolled = window.innerHeight + window.scrollY;
    return scrolled >= document.documentElement.scrollHeight - LOAD_THRESHOLD;
  }

  #setStatus(status) {
    this.#status.innerHTML = STATUSES[status];
  }

  #goToLogin() {
    user.clear();
    this.#router.navigate("/login");
  }

  async #loadPage() {
    if (this.#isLoading || !this.#hasMore || this.#hasError) {
      return;
    }

    this.#isLoading = true;
    this.#setStatus("loading");
    const { status, data } = await api.posts(this.#cursor, PAGE_SIZE);
    this.#isLoading = false;

    if (this.#isDestroyed) {
      return;
    }
    if (status === 401) {
      this.#goToLogin();
      return;
    }
    if (status !== 200) {
      this.#hasError = true;
      this.#setStatus("error");
      return;
    }

    data.posts.forEach((post) => new Post(this.#list, post).render());
    this.#hasMore = data.has_more;
    this.#cursor = data.next_cursor ?? this.#cursor + data.posts.length;
    this.#setStatus(this.#list.children.length ? "idle" : "empty");

    if (this.#isNearBottom()) {
      this.#loadPage();
    }
  }

  async #logout() {
    this.#sidebar.setError("");
    this.#sidebar.setLoggingOut(true);
    const { status } = await api.logout(user.csrfToken);

    if (status === 204 || status === 401) {
      this.#goToLogin();
      return;
    }

    this.#sidebar.setLoggingOut(false);
    this.#sidebar.setError(NETWORK_ERROR);
  }
}
