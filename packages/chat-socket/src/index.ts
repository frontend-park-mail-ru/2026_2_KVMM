/**
 * Сообщение в чате. message_text = null у удалённых сообщений.
 */
export interface ChatMessage {
  id: number;
  chat_id: number;
  author_id: number;
  message_text: string | null;
  repost_from?: number;
  reply_from?: number;
  created_at: string;
  updated_at?: string;
  deleted_at?: string;
}

/**
 * Настройки клиента: адрес сокета на этом сайте, имена замка и канала между вкладками,
 * откуда брать CSRF-токен сессии и id текущего пользователя.
 */
export interface ChatSocketOptions {
  path: string;
  lockName: string;
  channelName: string;
  getCsrf: () => string;
  getMyId: () => number;
}

const SEND_TIMEOUT = 10000;
const RETRY_DELAYS = [1000, 2000, 4000, 8000, 16000, 30000];
const SHORT_LIFE = 5000;
const MAX_SHORT_LIVES = 3;
const NOT_SUBSCRIBED = "chat is not subscribed";
const AUTH_ERRORS = new Set([
  "authentication_required",
  "unauthorized",
  "csrf_failed",
]);
const TAB_ID = Math.random().toString(36).slice(2);

/**
 * Состояние соединения:
 * idle — не запущено; connecting — подключаемся; online — подписаны на чаты;
 * waiting — ждём повторной попытки; stalled — соединение рвётся сразу после подключения, клиент ждёт действия пользователя;
 * unauthorized — бэк не принял сессию.
 */
export type ChatSocketStatus =
  "idle" | "connecting" | "online" | "waiting" | "stalled" | "unauthorized";

/**
 * Статус и чаты, на которые подписано соединение.
 */
export interface ChatSocketState {
  status: ChatSocketStatus;
  chatIds: number[];
}

/**
 * Ошибка из события бэка.
 */
export interface ChatSocketError {
  code: string;
  message: string;
}

/**
 * Событие от бэка.
 */
export type ChatEvent =
  | { type: "connected" }
  | { type: "subscribed"; chat_id?: number; chat_ids?: number[] }
  | { type: "message"; chat_id: number; message: ChatMessage }
  | { type: "error"; chat_id?: number; error: ChatSocketError };

/**
 * Итог отправки: сохранённое сообщение или код ошибки.
 * Свои коды: timeout, connection_lost, stopped.
 */
export type SendResult =
  { ok: true; message: ChatMessage } | { ok: false; code: string };

type ChannelMessage =
  | { kind: "event"; event: ChatEvent }
  | { kind: "state"; state: ChatSocketState }
  | { kind: "send"; id: string; chatId: number; text: string }
  | { kind: "sent"; id: string; result: SendResult }
  | { kind: "refresh"; chatIds: number[] }
  | { kind: "wake" }
  | { kind: "hello"; csrf: string }
  | { kind: "stop"; csrf: string };

interface Outgoing {
  chatId: number;
  text: string;
  expires: number;
  isRetried: boolean;
  finish: (result: SendResult) => void;
}

/**
 * Разбирает кадр сокета. Нетекстовые кадры и неверный JSON пропускаются.
 * @param data Данные кадра.
 * @returns Событие или null.
 */
function parseEvent(data: unknown): ChatEvent | null {
  if (typeof data !== "string") {
    return null;
  }
  try {
    const event = JSON.parse(data) as ChatEvent | null;
    return typeof event?.type === "string" ? event : null;
  } catch {
    return null;
  }
}

/**
 * Чаты из события subscribed: бэк присылает chat_id, если чат один, chat_ids — если их несколько, и ничего — если чатов нет.
 * @param event Событие subscribed.
 * @param event.chat_id Единственный чат.
 * @param event.chat_ids Несколько чатов.
 * @returns Список id чатов.
 */
function subscribedIds(event: { chat_id?: number; chat_ids?: number[] }) {
  return event.chat_ids ?? (event.chat_id ? [event.chat_id] : []);
}

/**
 * Клиент WebSocket чатов. Сокет открывает только вкладка-лидер (Web Locks), а остальные получают
 * события и отправляют сообщения через неё по BroadcastChannel: на браузер одно соединение, сколько бы
 * вкладок ни было открыто. Когда лидер закрывается, замок и соединение переходят к следующей вкладке.
 */
export class ChatSocket {
  #options: ChatSocketOptions;
  #channel: BroadcastChannel | null = null;
  #socket: WebSocket | null = null;
  #csrf = "";
  #isRunning = false;
  #isLeader = false;
  #isBound = false;
  #lockAbort: AbortController | null = null;
  #releaseLock: (() => void) | null = null;
  #state: ChatSocketState = { status: "idle", chatIds: [] };
  #eventListeners = new Set<(event: ChatEvent) => void>();
  #stateListeners = new Set<(state: ChatSocketState) => void>();
  #outbox: Outgoing[] = [];
  #inflight = new Map<number, Outgoing[]>();
  #requests = new Map<string, (result: SendResult) => void>();
  #requestCount = 0;
  #retryTimer = 0;
  #attempt = 0;
  #shortLives = 0;
  #onlineAt = 0;

  /**
   * @param options Адрес, имена замка и канала, источники CSRF-токена и id пользователя.
   */
  constructor(options: ChatSocketOptions) {
    this.#options = options;
  }

  /**
   * Текущий статус и подписки (во вкладке-ведомой — со слов лидера).
   * @returns Копия состояния.
   */
  get state(): ChatSocketState {
    return { ...this.#state, chatIds: [...this.#state.chatIds] };
  }

  /**
   * Включает чаты для текущей сессии: встаёт в очередь за замком и спрашивает состояние у лидера.
   * Повторный вызов с новым CSRF-токеном переподключает лидера.
   */
  start(): void {
    const csrf = this.#options.getCsrf();
    this.#bind();
    if (this.#isRunning) {
      if (csrf !== this.#csrf) {
        this.#csrf = csrf;
        this.#post({ kind: "hello", csrf });
        if (this.#isLeader) {
          this.#connect();
        }
      }
      return;
    }
    this.#isRunning = true;
    this.#csrf = csrf;
    this.#applyState({ status: "connecting", chatIds: [] });
    this.#post({ kind: "hello", csrf });
    this.#joinLock();
  }

  /**
   * Выключает чаты при выходе: закрывает соединение и просит остальные вкладки этой сессии сделать то же.
   */
  stop(): void {
    if (!this.#isRunning) {
      return;
    }
    this.#post({ kind: "stop", csrf: this.#csrf });
    this.#halt();
  }

  /**
   * Отправляет сообщение через соединение лидера. Пока соединения нет, сообщение ждёт до 10 секунд.
   * @param chatId Чат.
   * @param text Текст сообщения.
   * @returns Сохранённое бэком сообщение или код ошибки.
   */
  send(chatId: number, text: string): Promise<SendResult> {
    return new Promise((resolve) => {
      if (!this.#isRunning) {
        resolve({ ok: false, code: "stopped" });
        return;
      }
      const id = `${TAB_ID}:${++this.#requestCount}`;
      let isDone = false;
      const finish = (result: SendResult) => {
        if (!isDone) {
          isDone = true;
          clearTimeout(timer);
          this.#requests.delete(id);
          resolve(result);
        }
      };
      const timer = setTimeout(
        () => finish({ ok: false, code: "timeout" }),
        SEND_TIMEOUT,
      );
      if (this.#isLeader) {
        this.#enqueue(chatId, text, finish);
      } else {
        this.#requests.set(id, finish);
        this.#post({ kind: "send", id, chatId, text });
      }
    });
  }

  /**
   * Переподключается, если соединение не подписано на какой-то из чатов: бэк подписывает только
   * при подключении, поэтому новый чат без этого молчит. Без аргументов переподключается всегда.
   * @param chatIds Чаты, которые должны приходить.
   */
  refresh(chatIds: number[] = []): void {
    if (!this.#isRunning) {
      return;
    }
    if (this.#isLeader) {
      this.#refresh(chatIds);
    } else {
      this.#post({ kind: "refresh", chatIds });
    }
  }

  /**
   * Подписка на события бэка: новые сообщения, ошибки, подписки.
   * @param listener Обработчик.
   * @returns Функция отписки.
   */
  onEvent(listener: (event: ChatEvent) => void): () => void {
    this.#eventListeners.add(listener);
    return () => this.#eventListeners.delete(listener);
  }

  /**
   * Подписка на смену статуса соединения.
   * @param listener Обработчик.
   * @returns Функция отписки.
   */
  onState(listener: (state: ChatSocketState) => void): () => void {
    this.#stateListeners.add(listener);
    return () => this.#stateListeners.delete(listener);
  }

  /**
   * Один раз создаёт канал между вкладками и подписывается на возврат сети и показ вкладки — чтобы сразу переподключиться.
   */
  #bind(): void {
    if (this.#isBound) {
      return;
    }
    this.#isBound = true;
    if ("BroadcastChannel" in window) {
      this.#channel = new BroadcastChannel(this.#options.channelName);
      this.#channel.addEventListener("message", (event) =>
        this.#onChannel(event.data as ChannelMessage),
      );
    }
    window.addEventListener("online", () => this.#wakeUp());
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible") {
        this.#wakeUp();
      }
    });
  }

  /**
   * Отправляет сообщение другим вкладкам.
   * @param message Сообщение канала.
   */
  #post(message: ChannelMessage): void {
    this.#channel?.postMessage(message);
  }

  /**
   * Обрабатывает сообщения других вкладок. Ведомая вкладка принимает события и состояние лидера, лидер — просьбы отправить, переподключиться, проснуться и узнать состояние.
   * @param message Сообщение канала.
   */
  #onChannel(message: ChannelMessage): void {
    if (message.kind === "sent") {
      this.#requests.get(message.id)?.(message.result);
      return;
    }
    if (message.kind === "stop") {
      if (this.#isRunning && message.csrf === this.#csrf) {
        this.#halt();
      }
      return;
    }
    if (!this.#isLeader) {
      if (message.kind === "event") {
        this.#emit(message.event);
      } else if (message.kind === "state" && this.#isRunning) {
        this.#applyState(message.state);
      }
      return;
    }
    if (message.kind === "send") {
      this.#enqueue(message.chatId, message.text, (result) =>
        this.#post({ kind: "sent", id: message.id, result }),
      );
    } else if (message.kind === "refresh") {
      this.#refresh(message.chatIds);
    } else if (message.kind === "wake") {
      this.#wakeUp();
    } else if (message.kind === "hello") {
      if (message.csrf && message.csrf !== this.#csrf) {
        this.#csrf = message.csrf;
        this.#connect();
      }
      this.#post({ kind: "state", state: this.#state });
    }
  }

  /**
   * Встаёт в очередь за замком Web Locks. Получивший замок становится лидером и держит его, пока не остановится или не закроется вкладка. Без Web Locks вкладка сразу лидер.
   */
  #joinLock(): void {
    if (!("locks" in navigator)) {
      this.#lead();
      return;
    }
    const abort = new AbortController();
    this.#lockAbort = abort;
    navigator.locks
      .request(this.#options.lockName, { signal: abort.signal }, () => {
        this.#lockAbort = null;
        this.#lead();
        return new Promise<void>((resolve) => (this.#releaseLock = resolve));
      })
      .catch(() => {});
  }

  /**
   * Становится лидером: сбрасывает счётчики переподключений и открывает соединение.
   */
  #lead(): void {
    this.#isLeader = true;
    this.#attempt = 0;
    this.#shortLives = 0;
    this.#connect();
  }

  /**
   * Полная остановка: выходит из очереди за замком, закрывает соединение, отпускает замок и отвечает «stopped» на всё, что ждало отправки.
   */
  #halt(): void {
    this.#isRunning = false;
    this.#lockAbort?.abort();
    this.#lockAbort = null;
    this.#isLeader = false;
    clearTimeout(this.#retryTimer);
    this.#closeSocket("stopped");
    this.#releaseLock?.();
    this.#releaseLock = null;
    this.#outbox
      .splice(0)
      .forEach((item) => item.finish({ ok: false, code: "stopped" }));
    this.#requests.forEach((finish) => finish({ ok: false, code: "stopped" }));
    this.#applyState({ status: "idle", chatIds: [] });
  }

  /**
   * Открывает новое соединение вместо старого и сразу отправляет auth с CSRF-токеном: бэк ждёт его не дольше 10 секунд. События старого сокета игнорируются.
   */
  #connect(): void {
    clearTimeout(this.#retryTimer);
    this.#closeSocket("connection_lost");
    this.#setState("connecting", []);
    const protocol = location.protocol === "https:" ? "wss:" : "ws:";
    const socket = new WebSocket(
      `${protocol}//${location.host}${this.#options.path}`,
    );
    this.#socket = socket;
    socket.addEventListener("open", () =>
      socket.send(JSON.stringify({ type: "auth", csrf_token: this.#csrf })),
    );
    socket.addEventListener("message", (event) => {
      const parsed = parseEvent(event.data);
      if (parsed && this.#socket === socket) {
        this.#receive(parsed);
      }
    });
    socket.addEventListener("close", () => {
      if (this.#socket === socket) {
        this.#onClose();
      }
    });
  }

  /**
   * Закрывает соединение. Отправленные, но не подтверждённые сообщения получают ошибку: неизвестно, дошли ли они, а повтор мог бы создать дубль.
   * @param code Код ошибки для неподтверждённых отправок.
   */
  #closeSocket(code: string): void {
    const socket = this.#socket;
    this.#socket = null;
    this.#onlineAt = 0;
    socket?.close();
    this.#inflight.forEach((items) =>
      items.forEach((item) => item.finish({ ok: false, code })),
    );
    this.#inflight.clear();
  }

  /**
   * Обрабатывает событие бэка: subscribed — соединение готово, можно отправлять очередь; своё message — подтверждение отправки; error авторизации — сессия не принята. Затем событие получают подписчики этой и других вкладок.
   * @param event Событие бэка.
   */
  #receive(event: ChatEvent): void {
    if (event.type === "subscribed") {
      this.#onlineAt = Date.now();
      this.#attempt = 0;
      this.#setState("online", subscribedIds(event));
      this.#flush();
    } else if (event.type === "message") {
      if (event.message.author_id === this.#options.getMyId()) {
        this.#inflight
          .get(event.chat_id)
          ?.shift()
          ?.finish({ ok: true, message: event.message });
      }
    } else if (event.type === "error") {
      if (
        AUTH_ERRORS.has(event.error.code) &&
        this.#state.status !== "online"
      ) {
        this.#closeSocket("connection_lost");
        this.#setState("unauthorized", []);
      } else if (event.chat_id) {
        this.#onSendError(event.chat_id, event.error);
      }
    }
    this.#emit(event);
    this.#post({ kind: "event", event });
  }

  /**
   * Ошибка в ответ на отправку. Если чат не в подписках, переподключается и отправляет ещё раз, один раз.
   * @param chatId Чат из ошибки.
   * @param error Код и текст ошибки.
   */
  #onSendError(chatId: number, error: ChatSocketError): void {
    const item = this.#inflight.get(chatId)?.shift();
    if (!item) {
      return;
    }
    if (error.message === NOT_SUBSCRIBED && !item.isRetried) {
      item.isRetried = true;
      this.#outbox.unshift(item);
      this.#connect();
      return;
    }
    item.finish({ ok: false, code: error.code });
  }

  /**
   * Соединение закрылось не по нашей воле. Переподключается с растущей паузой. Если соединение три раза подряд закрылось быстрее чем за 5 секунд после подключения, повторять бесполезно — клиент перестаёт переподключаться до следующего действия пользователя.
   */
  #onClose(): void {
    const lived = this.#onlineAt ? Date.now() - this.#onlineAt : -1;
    this.#closeSocket("connection_lost");
    if (!this.#isLeader || this.#state.status === "unauthorized") {
      return;
    }
    if (lived >= 0) {
      this.#shortLives = lived < SHORT_LIFE ? this.#shortLives + 1 : 0;
    }
    if (this.#shortLives >= MAX_SHORT_LIVES) {
      this.#setState("stalled", []);
      return;
    }
    const delay =
      RETRY_DELAYS[Math.min(this.#attempt, RETRY_DELAYS.length - 1)];
    this.#attempt += 1;
    this.#setState("waiting", []);
    this.#retryTimer = window.setTimeout(() => this.#connect(), delay);
  }

  /**
   * Переподключается сразу, если лидер ждёт паузы или сдался. Ведомая вкладка будит лидера.
   */
  #wakeUp(): void {
    if (!this.#isRunning) {
      return;
    }
    if (!this.#isLeader) {
      this.#post({ kind: "wake" });
      return;
    }
    const status = this.#state.status;
    if (status === "waiting" || status === "stalled") {
      this.#attempt = 0;
      this.#shortLives = 0;
      this.#connect();
    }
  }

  /**
   * Переподключается, если какой-то из чатов не в подписках; без списка — всегда.
   * @param chatIds Чаты, которые должны приходить.
   */
  #refresh(chatIds: number[]): void {
    const known = new Set(this.#state.chatIds);
    if (!chatIds.length || chatIds.some((id) => !known.has(id))) {
      this.#attempt = 0;
      this.#shortLives = 0;
      this.#connect();
    }
  }

  /**
   * Ставит сообщение в очередь лидера. Онлайн — отправляет сразу, иначе будит соединение. В очереди сообщение ждёт не дольше 10 секунд.
   * @param chatId Чат.
   * @param text Текст.
   * @param finish Куда сообщить итог.
   */
  #enqueue(
    chatId: number,
    text: string,
    finish: (result: SendResult) => void,
  ): void {
    this.#outbox.push({
      chatId,
      text,
      finish,
      expires: Date.now() + SEND_TIMEOUT,
      isRetried: false,
    });
    if (this.#state.status === "online") {
      this.#flush();
    } else {
      this.#wakeUp();
    }
  }

  /**
   * Отправляет очередь, пока соединение подписано. Просроченные сообщения получают timeout, отправленные ждут подтверждения по своему чату.
   */
  #flush(): void {
    const socket = this.#socket;
    while (
      this.#outbox.length &&
      socket?.readyState === WebSocket.OPEN &&
      this.#state.status === "online"
    ) {
      const item = this.#outbox.shift() as Outgoing;
      if (item.expires < Date.now()) {
        item.finish({ ok: false, code: "timeout" });
        continue;
      }
      socket.send(
        JSON.stringify({
          type: "message",
          chat_id: item.chatId,
          message: { message_text: item.text },
        }),
      );
      const queue = this.#inflight.get(item.chatId) ?? [];
      queue.push(item);
      this.#inflight.set(item.chatId, queue);
    }
  }

  /**
   * Меняет состояние лидера и сообщает его ведомым вкладкам.
   * @param status Новый статус.
   * @param chatIds Подписанные чаты.
   */
  #setState(status: ChatSocketStatus, chatIds: number[]): void {
    this.#applyState({ status, chatIds });
    this.#post({ kind: "state", state: this.#state });
  }

  /**
   * Сохраняет состояние и сообщает подписчикам этой вкладки.
   * @param state Новое состояние.
   */
  #applyState(state: ChatSocketState): void {
    this.#state = state;
    this.#stateListeners.forEach((listener) => listener(this.state));
  }

  /**
   * Передаёт событие бэка подписчикам этой вкладки.
   * @param event Событие.
   */
  #emit(event: ChatEvent): void {
    this.#eventListeners.forEach((listener) => listener(event));
  }
}
