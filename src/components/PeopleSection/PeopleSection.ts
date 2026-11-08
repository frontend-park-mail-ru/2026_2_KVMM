import type { ApiResult, ShortProfile } from "../../modules/api";
import { escapeHtml, nextOffset } from "@nexly/utils";
import { displayName } from "../../modules/profileName";
import { avatarTemplate } from "../../modules/avatar";
import { people } from "../../modules/people";

/**
 * Кнопка в строке человека: name уходит в data-action, kind задаёт вид.
 */
export interface PersonAction {
  name: string;
  label: string;
  kind: "primary" | "danger";
}

/**
 * Страница людей для секции.
 */
export interface PeoplePage {
  people: ShortProfile[];
  has_more: boolean;
  next_cursor?: number;
}

/**
 * Настройки секции: заголовок, кнопки в строках, загрузка страницы по смещению и обработчик нажатий.
 */
export interface PeopleSectionConfig {
  title: string;
  actions: PersonAction[];
  load: (cursor: number) => Promise<ApiResult<PeoplePage>>;
  onAction: (action: string, person: ShortProfile) => void;
}

const MORE_ERROR = "Не удалось загрузить, попробуйте ещё раз";

/**
 * Разметка пустой секции: заголовок, список, место под ошибку и кнопка «Смотреть еще». Секция скрыта, пока не загружена.
 * @param title Заголовок секции.
 * @returns Разметка секции.
 */
function template(title: string): string {
  return `
    <section class="people people_hidden">
      <h2 class="people__title">${escapeHtml(title)}</h2>
      <ul class="people__list"></ul>
      <p class="people__error" role="alert"></p>
      <button class="people__more people__more_hidden" type="button">Смотреть еще</button>
    </section>
  `;
}

/**
 * Строка человека: ссылка на его страницу с аватаркой и именем и кнопки действий справа.
 * @param person Короткий профиль.
 * @param actions Кнопки строки.
 * @returns Разметка строки.
 */
function itemTemplate(person: ShortProfile, actions: PersonAction[]): string {
  const name = displayName(person);
  const buttons = actions
    .map(
      ({ name: action, label, kind }) =>
        `<button class="people__button people__button_${kind}" type="button" data-action="${action}">${escapeHtml(label)}</button>`,
    )
    .join("");
  return `
    <li class="people__item" data-id="${person.id}">
      <a class="people__person" href="/profile/${person.id}" data-link draggable="false">
        ${avatarTemplate("people", name, person.avatar_urls ?? "")}
        <span class="people__name" title="${escapeHtml(name)}">${escapeHtml(name)}</span>
      </a>
      <span class="people__actions">${buttons}</span>
    </li>
  `;
}

/**
 * Секция страницы друзей: заголовок, список людей с кнопками и «Смотреть еще». Пустая секция скрыта.
 */
export class PeopleSection {
  #parent: HTMLElement;
  #config: PeopleSectionConfig;
  #element!: HTMLElement;
  #list!: HTMLElement;
  #error!: HTMLElement;
  #more!: HTMLButtonElement;
  #people = new Map<number, ShortProfile>();
  #cursor = 0;
  #hasMore = false;

  /**
   * @param parent Контейнер, в конец которого добавляется секция.
   * @param config Заголовок, кнопки, загрузка и обработчик нажатий.
   */
  constructor(parent: HTMLElement, config: PeopleSectionConfig) {
    this.#parent = parent;
    this.#config = config;
  }

  /**
   * Сколько людей сейчас в секции.
   * @returns Число строк.
   */
  get count(): number {
    return this.#people.size;
  }

  /**
   * Вставляет пустую скрытую секцию и подписывается на кнопки.
   */
  render(): void {
    this.#parent.insertAdjacentHTML("beforeend", template(this.#config.title));
    this.#element = this.#parent.lastElementChild as HTMLElement;
    this.#list = this.#element.querySelector(".people__list") as HTMLElement;
    this.#error = this.#element.querySelector(".people__error") as HTMLElement;
    this.#more = this.#element.querySelector(
      ".people__more",
    ) as HTMLButtonElement;

    this.#more.addEventListener("click", () => this.load());
    this.#list.addEventListener("click", (event) => {
      const button = (event.target as Element).closest<HTMLButtonElement>(
        "[data-action]",
      );
      const id = Number(button?.closest<HTMLElement>("[data-id]")?.dataset.id);
      const person = this.#people.get(id);
      if (button && person) {
        this.#config.onAction(button.dataset.action ?? "", person);
      }
    });
  }

  /**
   * Загружает следующую страницу и дописывает людей в конец.
   * @returns HTTP-статус ответа, 0 — сервер недоступен.
   */
  async load(): Promise<number> {
    this.#more.disabled = true;
    this.setError("");
    const response = await this.#config.load(this.#cursor);
    this.#more.disabled = false;
    const { status, data } = response;
    if (status !== 200 || !data?.people) {
      if (this.count > 0) {
        this.setError(MORE_ERROR);
      }
      return status;
    }
    data.people
      .filter((person) => !this.#people.has(person.id))
      .forEach((person) => this.#append(person, "beforeend"));
    ({ cursor: this.#cursor, hasMore: this.#hasMore } = nextOffset(
      this.#cursor,
      data,
    ));
    this.#update();
    return status;
  }

  /**
   * Загружает все страницы подряд, для коротких списков без «Смотреть еще».
   * @param maxPages Сколько страниц загрузить самое большее.
   * @returns HTTP-статус последнего ответа.
   */
  async loadAll(maxPages: number = 10): Promise<number> {
    let status = await this.load();
    for (
      let page = 1;
      page < maxPages && status === 200 && this.#hasMore;
      page++
    ) {
      status = await this.load();
    }
    this.#hasMore = false;
    this.#update();
    return status;
  }

  /**
   * Добавляет человека в начало, например после принятой заявки. Смещение сдвигается, чтобы следующая страница не повторила его.
   * @param person Краткий профиль.
   */
  prepend(person: ShortProfile): void {
    if (this.#people.has(person.id)) {
      return;
    }
    this.#append(person, "afterbegin");
    this.#cursor += 1;
    this.#update();
  }

  /**
   * Убирает человека из списка. Смещение сдвигается назад, чтобы следующая страница никого не пропустила.
   * @param id Id профиля.
   */
  remove(id: number): void {
    if (!this.#people.delete(id)) {
      return;
    }
    this.#list.querySelector(`[data-id="${id}"]`)?.remove();
    this.#cursor = Math.max(0, this.#cursor - 1);
    this.#update();
  }

  /**
   * Блокирует кнопки строки на время запроса.
   * @param id Id профиля.
   * @param isBusy Идёт ли запрос.
   */
  setBusy(id: number, isBusy: boolean): void {
    this.#list
      .querySelectorAll<HTMLButtonElement>(`[data-id="${id}"] button`)
      .forEach((button) => (button.disabled = isBusy));
  }

  /**
   * Показывает ошибку под списком или убирает её.
   * @param message Текст ошибки или пустая строка.
   */
  setError(message: string): void {
    this.#error.textContent = message;
  }

  /**
   * Добавляет строку человека и запоминает его в кеше людей, чтобы его страница сразу знала имя. Сломанная аватарка заменяется буквой.
   * @param person Короткий профиль.
   * @param position В начало или в конец списка.
   */
  #append(person: ShortProfile, position: InsertPosition): void {
    this.#people.set(person.id, person);
    people.remember(person.id, {
      name: displayName(person),
      avatarUrl: person.avatar_urls ?? "",
    });
    this.#list.insertAdjacentHTML(
      position,
      itemTemplate(person, this.#config.actions),
    );
    const item =
      position === "afterbegin"
        ? this.#list.firstElementChild
        : this.#list.lastElementChild;
    const image = item?.querySelector(".people__avatar-image");
    image?.addEventListener("error", () => image.remove());
  }

  /**
   * Прячет пустую секцию, которой нечего подгружать, и кнопку «Смотреть еще», когда страниц больше нет.
   */
  #update(): void {
    this.#element.classList.toggle(
      "people_hidden",
      this.count === 0 && !this.#hasMore,
    );
    this.#more.classList.toggle("people__more_hidden", !this.#hasMore);
  }
}
