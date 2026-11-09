import { api } from "../../modules/api";
import type { Chat, ShortProfile } from "../../modules/api";
import type { Router } from "@nexly/router";
import { user } from "../../modules/user";
import { chatSocket } from "../../modules/chatSocket";
import type { ChatEvent } from "../../modules/chatSocket";
import {
  chatActivity,
  chatPartner,
  loadAllChats,
  openChat,
  partnerView,
} from "../../modules/chats";
import { avatarTemplate } from "../../modules/avatar";
import { serverErrorMessage } from "../../modules/errors";
import { escapeHtml, formatDate } from "@nexly/utils";
import { AppLayout } from "../../components/AppLayout/AppLayout";
import { PeopleSection } from "../../components/PeopleSection/PeopleSection";

const MESSAGES = {
  loading: "Загружаем ваши чаты",
  error: "Произошла ошибка, обновите страницу",
  empty:
    "У вас пока нет чатов, найдите своих друзей среди возможных знакомых и общайтесь с ними",
  alone: "У вас пока нет чатов",
};

const NO_MESSAGES = "Сообщений пока нет";
const DELETED = "Сообщение удалено";

/**
 * Текст превью последнего сообщения чата.
 * @param chat Чат.
 * @returns Текст сообщения, «удалено» или «сообщений пока нет».
 */
function previewText(chat: Chat): string {
  if (!chat.last_message) {
    return NO_MESSAGES;
  }
  return chat.last_message.message_text ?? DELETED;
}

/**
 * Строка чата: аватар и имя собеседника, последнее сообщение и его дата. Вся строка — ссылка в диалог.
 * @param chat Чат.
 * @param myId id текущего пользователя.
 * @returns Разметка строки.
 */
function rowTemplate(chat: Chat, myId: number): string {
  const { name, avatarPath } = partnerView(chatPartner(chat, myId));
  const date = chat.last_message?.created_at ?? chat.created_at;
  return `
    <li class="chat-list__item" data-id="${chat.id}">
      <a class="chat-list__link" href="/chats/${chat.id}" data-link draggable="false">
        <span class="chat-list__person">
          ${avatarTemplate("chat-list", name, avatarPath)}
          <span class="chat-list__name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
        </span>
        <span class="chat-list__preview">${escapeHtml(previewText(chat))}</span>
        <time class="chat-list__date" datetime="${escapeHtml(date)}">${formatDate(date)}</time>
      </a>
    </li>
  `;
}

/**
 * Страница /chats: список чатов по последней активности. Новые сообщения приходят по сокету и поднимают чат наверх. Если чатов нет — возможные знакомые с кнопкой «Написать».
 */
export class ChatsPage {
  #parent: HTMLElement;
  #router: Router;
  #list!: HTMLElement;
  #status!: HTMLElement;
  #suggestions!: PeopleSection;
  #chats = new Map<number, Chat>();
  #unsubscribe: (() => void) | null = null;
  #isDestroyed = false;

  /**
   * @param parent Контейнер страницы.
   * @param router Роутер для переходов в чат и на /login.
   */
  constructor(parent: HTMLElement, router: Router) {
    this.#parent = parent;
    this.#router = router;
  }

  /**
   * Рисует карточку списка, загружает чаты и подписывается на новые сообщения.
   */
  render(): void {
    const main = new AppLayout(this.#parent, this.#router, "messages").render();
    main.insertAdjacentHTML(
      "beforeend",
      `
        <section class="chat-list">
          <h1 class="chat-list__title">Ваши чаты</h1>
          <ul class="chat-list__items"></ul>
          <p class="chat-list__status">${MESSAGES.loading}</p>
        </section>
      `,
    );
    const card = main.lastElementChild as HTMLElement;
    this.#list = card.querySelector(".chat-list__items") as HTMLElement;
    this.#status = card.querySelector(".chat-list__status") as HTMLElement;
    this.#list.addEventListener(
      "error",
      (event) => {
        const target = event.target as Element;
        if (target.classList.contains("chat-list__avatar-image")) {
          target.remove();
        }
      },
      true,
    );

    this.#suggestions = new PeopleSection(main, {
      title: "Возможно вы их знаете",
      actions: [{ name: "write", label: "Написать", kind: "primary" }],
      load: async (cursor) => {
        const { status, data } = await api.suggestions(cursor);
        if (status !== 200 || !data?.profiles) {
          return { status, data: data as null };
        }
        return {
          status,
          data: {
            people: data.profiles.map(({ profile }) => profile),
            has_more: data.has_more,
            next_cursor: data.next_cursor,
          },
        };
      },
      onAction: (_action, person) => this.#write(person),
    });
    this.#suggestions.render();
    this.#unsubscribe = chatSocket.onEvent((event) => this.#onEvent(event));
    this.#load();
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
   * Загружает все чаты и просит сокет подписаться на них. Если чатов нет — подсказка и возможные знакомые.
   */
  async #load(): Promise<void> {
    const { status, data } = await loadAllChats();
    if (this.#isDestroyed) {
      return;
    }
    if (status === 401) {
      this.#goToLogin();
      return;
    }
    if (status !== 200 || !data) {
      this.#status.textContent = MESSAGES.error;
      return;
    }
    this.#chats = new Map(data.map((chat) => [chat.id, chat]));
    this.#renderList();
    chatSocket.refresh(data.map((chat) => chat.id));
    if (data.length) {
      this.#status.textContent = "";
      return;
    }
    this.#status.textContent = MESSAGES.empty;
    const suggestionsStatus = await this.#suggestions.load();
    if (this.#isDestroyed) {
      return;
    }
    if (suggestionsStatus === 401) {
      this.#goToLogin();
      return;
    }
    if (this.#suggestions.count === 0) {
      this.#status.textContent = MESSAGES.alone;
    }
  }

  /**
   * Перерисовывает список, свежие чаты сверху.
   */
  #renderList(): void {
    const myId = user.profile?.id ?? 0;
    const chats = [...this.#chats.values()].sort(
      (a, b) => chatActivity(b) - chatActivity(a),
    );
    this.#list.innerHTML = chats
      .map((chat) => rowTemplate(chat, myId))
      .join("");
  }

  /**
   * Новое сообщение поднимает чат наверх с новым превью. Сообщение в неизвестный чат — значит, чат новый, список загружается заново.
   * @param event Событие сокета.
   */
  #onEvent(event: ChatEvent): void {
    if (event.type !== "message") {
      return;
    }
    const chat = this.#chats.get(event.chat_id);
    if (!chat) {
      this.#load();
      return;
    }
    chat.last_message = event.message;
    this.#renderList();
  }

  /**
   * Открывает чат с человеком из возможных знакомых и переходит в диалог.
   * @param person Короткий профиль.
   */
  async #write(person: ShortProfile): Promise<void> {
    this.#suggestions.setError("");
    this.#suggestions.setBusy(person.id, true);
    const response = await openChat(person.id);
    if (this.#isDestroyed) {
      return;
    }
    this.#suggestions.setBusy(person.id, false);
    if (response.status === 401) {
      this.#goToLogin();
      return;
    }
    if (!response.data?.id) {
      this.#suggestions.setError(serverErrorMessage(response));
      return;
    }
    this.#router.navigate(`/chats/${response.data.id}`);
  }
}
