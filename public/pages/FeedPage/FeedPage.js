import { api } from "../../modules/api.js";
import { user } from "../../modules/user.js";
import { NETWORK_ERROR } from "../../modules/errors.js";
import { Header } from "../../components/Header/Header.js";
import { Sidebar } from "../../components/Sidebar/Sidebar.js";
import { Post } from "../../components/Post/Post.js";

const PAGE_SIZE = 10;
const LOAD_THRESHOLD = 600;

const MESSAGES = {
  loading: "Загружаем ленту",
  empty: "Здесь пока нет постов",
  end: "Нет более старых постов",
  error: "Произошла ошибка, обновите страницу",
};

const SPINNER = `<img class="feed__spinner" src="/pages/FeedPage/spinner.svg" width="20" height="20" alt="Загружаем ещё посты">`;
const RETRY = `<button class="button button_outline feed__retry" type="button">Обновить</button>`;

function statusTemplate(status, hasPosts) {
  if (status === "idle") {
    return "";
  }
  if (status === "loading" && hasPosts) {
    return SPINNER;
  }
  const message = `<p class="feed__message">${MESSAGES[status]}</p>`;
  return status === "error" ? message + RETRY : message;
}

function template() {
  return `
    <div class="feed-page">
      <div class="feed-page__header"></div>
      <div class="feed-page__body">
        <div class="feed-page__aside"></div>
        <main class="feed">
          <div class="feed__list"></div>
          <div class="feed__status" role="status"></div>
        </main>
      </div>
    </div>
  `;
}

/**
 * Страница ленты: шапка с выходом, меню разделов, посты с бэкенда и подгрузка при прокрутке.
 */
export class FeedPage {
  #parent;
  #router;
  #header;
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

    this.#header = new Header(page.querySelector(".feed-page__header"), {
      onLogout: () => this.#logout(),
    });
    this.#header.render();
    new Sidebar(page.querySelector(".feed-page__aside")).render();

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
    const hasPosts = this.#list.children.length > 0;
    this.#status.classList.toggle(
      "feed__status_fill",
      !hasPosts && status !== "idle",
    );
    this.#status.innerHTML = statusTemplate(status, hasPosts);
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
    if (status !== 200 || !Array.isArray(data?.posts)) {
      this.#hasError = true;
      this.#setStatus("error");
      return;
    }

    data.posts.forEach((post) => new Post(this.#list, post).render());
    this.#moveCursor(data);

    if (!this.#list.children.length) {
      this.#setStatus("empty");
      return;
    }
    this.#setStatus(this.#hasMore ? "idle" : "end");

    if (this.#isNearBottom()) {
      this.#loadPage();
    }
  }

  #moveCursor({ has_more: hasMore, next_cursor: nextCursor }) {
    const isForward =
      Number.isInteger(nextCursor) &&
      nextCursor > 0 &&
      (this.#cursor === 0 || nextCursor < this.#cursor);

    this.#hasMore = hasMore === true && isForward;
    if (this.#hasMore) {
      this.#cursor = nextCursor;
    }
  }

  async #logout() {
    this.#header.setError("");
    this.#header.setLoggingOut(true);
    const { status } = await api.logout(user.csrfToken);

    if (status === 204 || status === 401) {
      this.#goToLogin();
      return;
    }

    this.#header.setLoggingOut(false);
    this.#header.setError(NETWORK_ERROR);
  }
}
