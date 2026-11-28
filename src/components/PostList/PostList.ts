import type {
  ApiResult,
  FeedResponse,
  Post as PostData,
} from "../../modules/api";
import { nextCursor } from "@nexly/utils";
import { postRuntime } from "../../modules/postRuntime";
import { Post } from "../Post/Post";
import spinnerIcon from "./spinner.svg";

const PAGE_SIZE = 10;
const LOAD_THRESHOLD = 600;
const NEW_POSTS_INTERVAL = 60000;
const NEW_POSTS_LABEL = "Показать новые посты";

type ListStatus = "idle" | "loading" | "empty" | "end" | "error";

/**
 * Тексты состояний списка.
 */
export interface PostListMessages {
  loading: string;
  empty: string;
  end: string;
  error: string;
}

/**
 * Настройки списка: откуда грузить страницы, тексты состояний и что делать со своими постами. watchNew — раз в минуту проверять, не появились ли посты новее верхнего, и предлагать их показать.
 */
export interface PostListConfig {
  load: (cursor: string, limit: number) => Promise<ApiResult<FeedResponse>>;
  messages: PostListMessages;
  fill?: boolean;
  watchNew?: boolean;
  onEdit?: (post: PostData) => void;
  onUnauthorized: () => void;
}

const SPINNER = `<img class="post-list__spinner" draggable="false" src="${spinnerIcon}" width="20" height="20" alt="Загружаем ещё посты">`;
const RETRY = `<button class="button button_outline post-list__retry" type="button">Обновить</button>`;

/**
 * Список постов с подгрузкой при прокрутке и состояниями «загрузка», «пусто», «конец», «ошибка».
 */
export class PostList {
  #parent: HTMLElement;
  #config: PostListConfig;
  #list!: HTMLElement;
  #status!: HTMLElement;
  #newButton!: HTMLButtonElement;
  #posts = new Map<string, Post>();
  #fresh: PostData[] = [];
  #isFreshComplete = true;
  #isChecking = false;
  #timer = 0;
  #cursor = "";
  #seenCursors = new Set<string>();
  #newestTimestamp: number | null = null;
  #hasMore = true;
  #isLoading = false;
  #hasError = false;
  #isDestroyed = false;
  #stopRuntimeWatch?: () => void;

  /**
   * @param parent Контейнер списка.
   * @param config Загрузчик страниц, тексты состояний и обработчики.
   */
  constructor(parent: HTMLElement, config: PostListConfig) {
    this.#parent = parent;
    this.#config = config;
  }

  /**
   * Рисует список и загружает первую страницу.
   */
  render(): void {
    this.#parent.insertAdjacentHTML(
      "beforeend",
      `<div class="post-list"><button class="button button_pill button_filled post-list__new post-list__new_hidden" type="button"></button><div class="post-list__items"></div><div class="post-list__status" role="status"></div></div>`,
    );
    const element = this.#parent.lastElementChild as HTMLElement;
    this.#list = element.querySelector(".post-list__items") as HTMLElement;
    this.#status = element.querySelector(".post-list__status") as HTMLElement;
    this.#newButton = element.querySelector(
      ".post-list__new",
    ) as HTMLButtonElement;
    this.#newButton.addEventListener("click", () => this.#showFresh());
    if (this.#config.watchNew) {
      this.#timer = window.setInterval(
        () => this.#checkFresh(),
        NEW_POSTS_INTERVAL,
      );
      document.addEventListener("visibilitychange", this.#onVisible);
    }
    this.#status.addEventListener("click", (event) => {
      if ((event.target as Element).closest(".post-list__retry")) {
        this.#hasError = false;
        this.#loadPage();
      }
    });
    window.addEventListener("scroll", this.#onScroll, { passive: true });
    this.#stopRuntimeWatch = postRuntime.onChange(() => {
      this.#posts.forEach((post) => post.refreshLikeState());
    });
    this.#loadPage();
  }

  /**
   * Снимает обработчики прокрутки и проверки новых постов и игнорирует ответы, пришедшие после ухода со страницы.
   */
  destroy(): void {
    this.#isDestroyed = true;
    this.#stopRuntimeWatch?.();
    window.removeEventListener("scroll", this.#onScroll);
    clearInterval(this.#timer);
    document.removeEventListener("visibilitychange", this.#onVisible);
  }

  /**
   * Добавляет только что созданный пост в начало списка.
   * @param post Пост из ответа бэка.
   */
  prepend(post: PostData): void {
    if (this.#posts.has(post.uid)) {
      return;
    }
    const item = this.#createPost(post);
    item.render("afterbegin");
    this.#newestTimestamp = Date.parse(post.created_at);
    this.#setStatus(this.#hasMore ? "idle" : "end");
  }

  /**
   * Перерисовывает изменённый пост на его месте.
   * @param post Пост из ответа бэка.
   */
  replace(post: PostData): void {
    this.#posts.get(post.uid)?.update(post);
  }

  /**
   * Убирает удалённый пост из списка.
   * @param postUid UUID поста.
   */
  remove(postUid: string): void {
    this.#posts.get(postUid)?.remove();
    this.#posts.delete(postUid);
    if (!this.#list.children.length && !this.#hasMore) {
      this.#setStatus("empty");
    }
  }

  /**
   * Проверяет новые посты, когда вкладку снова показали. Стрелочная функция — чтобы снять её в destroy.
   */
  #onVisible = (): void => {
    if (document.visibilityState === "visible") {
      this.#checkFresh();
    }
  };

  /**
   * Тихо запрашивает первую страницу и ищет посты новее самого нового в списке. Не запускается, пока грузится первая страница, — иначе новыми показались бы все посты; подгрузке старых страниц не мешает. Если они есть, показывает кнопку с их числом. Если новыми оказалась вся страница, а дальше есть ещё, между ними и списком может быть разрыв, — тогда число с плюсом, а кнопка перезагрузит список.
   */
  async #checkFresh(): Promise<void> {
    const isFirstLoad = this.#isLoading && this.#posts.size === 0;
    if (this.#isChecking || isFirstLoad || this.#hasError) {
      return;
    }
    this.#isChecking = true;
    const { status, data } = await this.#config.load("", PAGE_SIZE);
    this.#isChecking = false;
    if (this.#isDestroyed || status !== 200 || !Array.isArray(data?.posts)) {
      return;
    }
    const firstKnown = data.posts.findIndex((post) => this.#posts.has(post.uid));
    const newest = this.#newestTimestamp;
    // Порядок первой страницы точнее времени, если в ней есть знакомый пост.
    this.#fresh =
      firstKnown >= 0
        ? data.posts.slice(0, firstKnown)
        : data.posts.filter(
            (post) => newest === null || Date.parse(post.created_at) > newest,
          );
    this.#isFreshComplete =
      this.#fresh.length < data.posts.length || !data.has_more;
    const count = `${this.#fresh.length}${this.#isFreshComplete ? "" : "+"}`;
    this.#newButton.textContent = `${NEW_POSTS_LABEL} (${count})`;
    this.#newButton.classList.toggle(
      "post-list__new_hidden",
      this.#fresh.length === 0,
    );
  }

  /**
   * Показывает новые посты сверху и прокручивает к ним. При возможном разрыве загружает список заново.
   */
  #showFresh(): void {
    this.#newButton.classList.add("post-list__new_hidden");
    if (this.#isFreshComplete) {
      [...this.#fresh].reverse().forEach((post) => this.prepend(post));
    } else {
      this.#posts.forEach((post) => post.remove());
      this.#posts.clear();
      this.#cursor = "";
      this.#seenCursors.clear();
      this.#newestTimestamp = null;
      this.#hasMore = true;
      this.#loadPage();
    }
    this.#fresh = [];
    window.scrollTo({ top: 0 });
  }

  /**
   * Создаёт компонент поста и запоминает его по UUID, чтобы потом обновлять, удалять и не показывать дважды.
   * @param post Пост.
   * @returns Компонент поста, ещё не отрисованный.
   */
  #createPost(post: PostData): Post {
    const item = new Post(this.#list, post, {
      onEdit: this.#config.onEdit,
      onUnauthorized: this.#config.onUnauthorized,
    });
    this.#posts.set(post.uid, item);
    return item;
  }

  /**
   * Подгружает следующую страницу, когда до конца ленты остаётся немного. Стрелочная функция — чтобы снять её в destroy.
   */
  #onScroll = (): void => {
    if (this.#isNearBottom()) {
      this.#loadPage();
    }
  };

  /**
   * Близко ли нижний край страницы.
   * @returns true, если до конца меньше LOAD_THRESHOLD пикселей.
   */
  #isNearBottom(): boolean {
    const scrolled = window.innerHeight + window.scrollY;
    return scrolled >= document.documentElement.scrollHeight - LOAD_THRESHOLD;
  }

  /**
   * Показывает под списком состояние: спиннер при подгрузке, текст загрузки, пустого списка, конца или ошибки с кнопкой повтора. Текст первой загрузки проявляется с задержкой: при быстром ответе он не успевает мелькнуть.
   * @param status Состояние списка.
   */
  #setStatus(status: ListStatus): void {
    const hasPosts = this.#list.children.length > 0;
    this.#status.classList.toggle(
      "post-list__status_fill",
      Boolean(this.#config.fill) && !hasPosts && status !== "idle",
    );
    if (status === "idle") {
      this.#status.innerHTML = "";
      return;
    }
    if (status === "loading" && hasPosts) {
      this.#status.innerHTML = SPINNER;
      return;
    }
    const modifier = status === "loading" ? " post-list__message_loading" : "";
    const message = `<p class="post-list__message${modifier}">${this.#config.messages[status]}</p>`;
    this.#status.innerHTML = status === "error" ? message + RETRY : message;
  }

  /**
   * Загружает следующую страницу постов. Дубли по UUID пропускаются. Отсутствующий или повторный курсор завершает подгрузку.
   */
  async #loadPage(): Promise<void> {
    if (this.#isLoading || !this.#hasMore || this.#hasError) {
      return;
    }

    this.#isLoading = true;
    this.#setStatus("loading");
    const { status, data } = await this.#config.load(this.#cursor, PAGE_SIZE);
    this.#isLoading = false;

    if (this.#isDestroyed) {
      return;
    }
    if (status === 401) {
      this.#config.onUnauthorized();
      return;
    }
    if (status !== 200 || !data || !Array.isArray(data.posts)) {
      this.#hasError = true;
      this.#setStatus("error");
      return;
    }

    for (const post of data.posts) {
      if (!this.#posts.has(post.uid)) {
        this.#createPost(post).render("beforeend");
        this.#newestTimestamp ??= Date.parse(post.created_at);
      }
    }
    this.#seenCursors.add(this.#cursor);
    ({ cursor: this.#cursor, hasMore: this.#hasMore } = nextCursor(
      this.#cursor,
      data,
      this.#seenCursors,
    ));

    if (!this.#list.children.length) {
      this.#setStatus("empty");
      return;
    }
    this.#setStatus(this.#hasMore ? "idle" : "end");

    if (this.#isNearBottom()) {
      this.#loadPage();
    }
  }
}
