import sendIcon from "./icons/send.svg";
import { api } from "../../modules/api";
import type { Chat, ChatMessage } from "../../modules/api";
import type { Router, RouteParams } from "@nexly/router";
import { user } from "../../modules/user";
import { chatSocket } from "../../modules/chatSocket";
import type { ChatEvent, SendResult } from "../../modules/chatSocket";
import {
  chatActivity,
  chatPartner,
  loadAllChats,
  partnerView,
} from "../../modules/chats";
import { avatarTemplate } from "../../modules/avatar";
import { escapeHtml, formatDate, nextCursor } from "@nexly/utils";
import { AppLayout } from "../../components/AppLayout/AppLayout";

const MESSAGES = {
  loading: "Загружаем вашу переписку",
  empty: "Ваша история общения начинается сейчас!",
  error: "Произошла ошибка, обновите страницу",
};

const ERRORS = {
  empty: "Напишите что-то в этот чат",
  offline: "Нет соединения с сервером, попробуйте еще раз",
  failed: "Не удалось отправить сообщение",
};

const OFFLINE_CODES = new Set(["timeout", "connection_lost", "stopped"]);
const DELETED = "Сообщение удалено";
const MAX_LENGTH = 256;
const LOAD_OLDER_OFFSET = 80;
const STICK_TO_BOTTOM = 120;

/**
 * Пузырь сообщения: свои справа, чужие слева, удалённые — серым курсивом. Текст экранируется.
 * @param message Сообщение.
 * @param myId id текущего пользователя.
 * @returns Разметка сообщения.
 */
function messageTemplate(message: ChatMessage, myId: number): string {
  const mine = message.author_id === myId ? " conversation__message_mine" : "";
  const text =
    message.message_text === null
      ? `<p class="conversation__text conversation__text_deleted">${DELETED}</p>`
      : `<p class="conversation__text">${escapeHtml(message.message_text)}</p>`;
  return `
    <li class="conversation__message${mine}" data-id="${message.id}">
      ${text}
      <time class="conversation__date" datetime="${escapeHtml(message.created_at)}">${formatDate(message.created_at)}</time>
    </li>
  `;
}

/**
 * Аватарка чата в левой колонке. Текущий чат обведён и помечен aria-current.
 * @param chat Чат.
 * @param myId id текущего пользователя.
 * @param currentId Открытый чат.
 * @returns Разметка пункта.
 */
function railTemplate(chat: Chat, myId: number, currentId: number): string {
  const { name, avatarPath } = partnerView(chatPartner(chat, myId));
  const isCurrent = chat.id === currentId;
  const current = isCurrent ? ' aria-current="page"' : "";
  const modifier = isCurrent ? " conversation__chat_current" : "";
  return `
    <li class="conversation__rail-item">
      <a class="conversation__chat${modifier}" href="/chats/${chat.id}" data-link draggable="false" title="${escapeHtml(name)}" aria-label="${escapeHtml(name)}"${current}>
        ${avatarTemplate("conversation", name, avatarPath)}
      </a>
    </li>
  `;
}

const TEMPLATE = `
  <section class="conversation">
    <nav class="conversation__rail" aria-label="Чаты">
      <ul class="conversation__chats"></ul>
    </nav>
    <div class="conversation__panel">
      <header class="conversation__header conversation__header_hidden"></header>
      <div class="conversation__messages" role="log" aria-live="polite">
        <ol class="conversation__list"></ol>
        <p class="conversation__notice">${MESSAGES.loading}</p>
      </div>
      <form class="conversation__form" novalidate>
        <textarea class="conversation__input" name="message" rows="1" maxlength="${MAX_LENGTH}" placeholder="Введите текст сообщения" aria-label="Сообщение"></textarea>
        <button class="conversation__send" type="submit" aria-label="Отправить">
          <img class="conversation__send-icon" src="${sendIcon}" width="21" height="21" alt="" draggable="false">
        </button>
      </form>
      <p class="conversation__error" role="alert"></p>
    </div>
  </section>
`;

/**
 * Страница диалога /chats/:id: чаты слева, переписка, поле ввода. История подгружается при прокрутке вверх, новые сообщения приходят и отправляются через сокет.
 */
export class ConversationPage {
  #parent: HTMLElement;
  #router: Router;
  #chatId: number;
  #root!: HTMLElement;
  #rail!: HTMLElement;
  #header!: HTMLElement;
  #scroller!: HTMLElement;
  #list!: HTMLElement;
  #notice!: HTMLElement;
  #form!: HTMLFormElement;
  #input!: HTMLTextAreaElement;
  #send!: HTMLButtonElement;
  #error!: HTMLElement;
  #chats: Chat[] = [];
  #messages = new Map<number, ChatMessage>();
  #cursor = 0;
  #hasMore = false;
  #isLoading = false;
  #isStarted = false;
  #isFailed = false;
  #unsubscribe: (() => void) | null = null;
  #isDestroyed = false;

  /**
   * @param parent Контейнер страницы.
   * @param router Роутер для перехода на /login.
   * @param params Параметры пути, id — чат.
   */
  constructor(parent: HTMLElement, router: Router, params: RouteParams) {
    this.#parent = parent;
    this.#router = router;
    this.#chatId = Number(params.id);
  }

  /**
   * Рисует диалог, загружает чаты и последние сообщения, подписывается на сокет.
   */
  render(): void {
    const main = new AppLayout(this.#parent, this.#router, "messages").render();
    main.insertAdjacentHTML("beforeend", TEMPLATE);
    const root = main.lastElementChild as HTMLElement;
    const find = <T extends Element>(selector: string) =>
      root.querySelector(selector) as T;
    this.#root = root;
    this.#rail = find(".conversation__chats");
    this.#header = find(".conversation__header");
    this.#scroller = find(".conversation__messages");
    this.#list = find(".conversation__list");
    this.#notice = find(".conversation__notice");
    this.#form = find(".conversation__form");
    this.#input = find(".conversation__input");
    this.#send = find(".conversation__send");
    this.#error = find(".conversation__error");

    root.addEventListener(
      "error",
      (event) => {
        const target = event.target as Element;
        if (target.classList.contains("conversation__avatar-image")) {
          target.remove();
        }
      },
      true,
    );
    this.#form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.#submit();
    });
    this.#input.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
        event.preventDefault();
        this.#form.requestSubmit();
      }
    });
    this.#input.addEventListener("input", () => {
      this.#setError("");
      this.#fitInput();
    });
    this.#scroller.addEventListener("scroll", () => {
      if (this.#scroller.scrollTop < LOAD_OLDER_OFFSET) {
        this.#loadOlder();
      }
    });

    this.#unsubscribe = chatSocket.onEvent((event) => this.#onEvent(event));
    chatSocket.refresh([this.#chatId]);
    this.#loadChats();
    this.#loadOlder();
  }

  /**
   * Отписывается от сокета и игнорирует ответы после ухода со страницы.
   */
  destroy(): void {
    this.#isDestroyed = true;
    this.#unsubscribe?.();
  }

  /**
   * Забывает пользователя и ведёт на вход: сессия кончилась.
   */
  #goToLogin(): void {
    user.clear();
    this.#router.navigate("/login");
  }

  /**
   * id текущего пользователя.
   * @returns id или 0, если сессии уже нет.
   */
  get #myId(): number {
    return user.profile?.id ?? 0;
  }

  /**
   * Загружает все чаты для левой колонки и шапки собеседника.
   */
  async #loadChats(): Promise<void> {
    const { status, data } = await loadAllChats();
    if (this.#isDestroyed) {
      return;
    }
    if (status === 401) {
      this.#goToLogin();
      return;
    }
    this.#chats = data ?? [];
    this.#renderRail();
    this.#renderHeader();
  }

  /**
   * Перерисовывает левую колонку, свежие чаты сверху.
   */
  #renderRail(): void {
    this.#chats.sort((a, b) => chatActivity(b) - chatActivity(a));
    this.#rail.innerHTML = this.#chats
      .map((chat) => railTemplate(chat, this.#myId, this.#chatId))
      .join("");
  }

  /**
   * Показывает в шапке собеседника со ссылкой на его страницу. В чате с собой ссылка ведёт в свой профиль.
   */
  #renderHeader(): void {
    const chat = this.#chats.find((item) => item.id === this.#chatId);
    if (!chat) {
      return;
    }
    const partner = chatPartner(chat, this.#myId);
    const { name, avatarPath } = partnerView(partner);
    const href =
      !partner || partner.id === this.#myId
        ? "/profile"
        : `/profile/${partner.id}`;
    this.#header.innerHTML = `
      <a class="conversation__person" href="${href}" data-link draggable="false">
        ${avatarTemplate("conversation", name, avatarPath)}
        <span class="conversation__name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
      </a>
    `;
    this.#header.classList.remove("conversation__header_hidden");
  }

  /**
   * Загружает очередную страницу истории. Первая страница прокручивает в самый низ, следующие сохраняют позицию, чтобы текст не прыгал. Если окно ещё не заполнено, подгружает дальше.
   */
  async #loadOlder(): Promise<void> {
    const isFirst = !this.#isStarted;
    if (this.#isLoading || this.#isFailed || (!isFirst && !this.#hasMore)) {
      return;
    }
    this.#isLoading = true;
    const response = await api.chatMessages(this.#chatId, this.#cursor);
    if (this.#isDestroyed) {
      return;
    }
    this.#isLoading = false;
    if (response.status === 401) {
      this.#goToLogin();
      return;
    }
    if (response.status !== 200 || !response.data?.messages) {
      this.#isFailed = true;
      this.#showNotice(MESSAGES.error);
      this.#setFormDisabled(true);
      return;
    }
    this.#isStarted = true;
    const next = nextCursor(this.#cursor, response.data);
    this.#cursor = next.cursor;
    this.#hasMore = next.hasMore;
    const oldHeight = this.#scroller.scrollHeight;
    const oldTop = this.#scroller.scrollTop;
    response.data.messages.forEach((message) =>
      this.#messages.set(message.id, message),
    );
    this.#renderMessages();
    if (isFirst) {
      this.#scrollToBottom();
    } else {
      this.#scroller.scrollTop =
        oldTop + this.#scroller.scrollHeight - oldHeight;
    }
    if (this.#hasMore && this.#scroller.scrollTop < LOAD_OLDER_OFFSET) {
      this.#loadOlder();
    }
  }

  /**
   * Перерисовывает переписку по порядку id и показывает «Ваша история общения начинается сейчас!», если сообщений нет.
   */
  #renderMessages(): void {
    const messages = [...this.#messages.values()].sort((a, b) => a.id - b.id);
    this.#list.innerHTML = messages
      .map((message) => messageTemplate(message, this.#myId))
      .join("");
    this.#showNotice(messages.length ? "" : MESSAGES.empty);
  }

  /**
   * Показывает или прячет сообщение посреди переписки: загрузка, пусто, ошибка.
   * @param text Текст или пустая строка.
   */
  #showNotice(text: string): void {
    this.#notice.textContent = text;
    this.#root.classList.toggle("conversation_noticed", Boolean(text));
  }

  /**
   * Прокручивает переписку к последнему сообщению.
   */
  #scrollToBottom(): void {
    this.#scroller.scrollTop = this.#scroller.scrollHeight;
  }

  /**
   * Добавляет сообщение без дублей. Прокручивает вниз, если это своё сообщение или пользователь и так был внизу, — иначе не мешает читать историю.
   * @param message Сообщение.
   */
  #addMessage(message: ChatMessage): void {
    if (this.#messages.has(message.id) || this.#isFailed) {
      return;
    }
    const distance =
      this.#scroller.scrollHeight -
      this.#scroller.scrollTop -
      this.#scroller.clientHeight;
    this.#messages.set(message.id, message);
    this.#renderMessages();
    if (distance < STICK_TO_BOTTOM || message.author_id === this.#myId) {
      this.#scrollToBottom();
    }
  }

  /**
   * Новое сообщение: в открытый чат — добавляется в переписку, в любой — поднимает чат в левой колонке. Неизвестный чат перезагружает колонку.
   * @param event Событие сокета.
   */
  #onEvent(event: ChatEvent): void {
    if (event.type !== "message") {
      return;
    }
    if (event.chat_id === this.#chatId) {
      this.#addMessage(event.message);
    }
    const chat = this.#chats.find((item) => item.id === event.chat_id);
    if (chat) {
      chat.last_message = event.message;
      this.#renderRail();
    } else {
      this.#loadChats();
    }
  }

  /**
   * Отправляет сообщение через сокет. Пустое не отправляется, пока идёт отправка, поле и кнопка заблокированы.
   */
  async #submit(): Promise<void> {
    const text = this.#input.value.trim();
    if (!text) {
      this.#setError(ERRORS.empty);
      this.#input.focus();
      return;
    }
    this.#setError("");
    this.#setFormDisabled(true);
    const result = await chatSocket.send(this.#chatId, text);
    if (this.#isDestroyed) {
      return;
    }
    this.#setFormDisabled(false);
    this.#onSent(result);
  }

  /**
   * Итог отправки: успех очищает поле и показывает сообщение, ошибка остаётся под полем, текст не теряется.
   * @param result Сохранённое сообщение или код ошибки.
   */
  #onSent(result: SendResult): void {
    if (result.ok) {
      this.#input.value = "";
      this.#fitInput();
      this.#addMessage(result.message);
      this.#input.focus();
      return;
    }
    this.#setError(
      OFFLINE_CODES.has(result.code) ? ERRORS.offline : ERRORS.failed,
    );
  }

  /**
   * Показывает ошибку под полем ввода и красную рамку или убирает их.
   * @param message Текст ошибки или пустая строка.
   */
  #setError(message: string): void {
    this.#error.textContent = message;
    this.#form.classList.toggle("conversation__form_error", Boolean(message));
  }

  /**
   * Блокирует поле и кнопку на время отправки или насовсем, если переписку не загрузить.
   * @param isDisabled Заблокировать ли.
   */
  #setFormDisabled(isDisabled: boolean): void {
    this.#input.readOnly = isDisabled;
    this.#send.disabled = isDisabled;
  }

  /**
   * Растягивает поле под текст, до max-height из стилей.
   */
  #fitInput(): void {
    this.#input.style.height = "auto";
    this.#input.style.height = `${this.#input.scrollHeight}px`;
  }
}
