import type { Post as PostData } from "../../modules/api";
import { MAX_LENGTH, validatePostText } from "../../modules/validation";
import { Input } from "../Input/Input";

/**
 * Обработчики формы: сохранить текст (post — правка, null — новый пост) и удалить пост.
 */
export interface PostEditorHandlers {
  onSubmit: (text: string, post: PostData | null) => void;
  onDelete: (post: PostData) => void;
}

const LABELS = { create: "Опубликовать", edit: "Изменить" };

/**
 * Разметка редактора: кнопка «Создать пост» и скрытая форма с полем, ошибкой и кнопками.
 * @returns Разметка редактора.
 */
function template(): string {
  return `
    <section class="post-editor">
      <button class="button button_outline post-editor__open" type="button">Создать пост</button>
      <form class="post-editor__form post-editor__form_hidden" novalidate>
        <div class="post-editor__field"></div>
        <p class="post-editor__error" role="alert"></p>
        <div class="post-editor__actions">
          <button class="button button_neutral" type="button" data-action="cancel">Отменить</button>
          <button class="button button_danger post-editor__delete post-editor__delete_hidden" type="button" data-action="delete">Удалить</button>
          <button class="button button_primary" type="submit">${LABELS.create}</button>
        </div>
      </form>
    </section>
  `;
}

/**
 * Форма создания и правки поста: свёрнута в кнопку «Создать пост», раскрывается для нового поста или для правки своего.
 */
export class PostEditor {
  #parent: HTMLElement;
  #handlers: PostEditorHandlers;
  #element!: HTMLElement;
  #open!: HTMLButtonElement;
  #form!: HTMLFormElement;
  #actions!: HTMLElement;
  #submit!: HTMLButtonElement;
  #error!: HTMLElement;
  #text!: Input;
  #post: PostData | null = null;

  /**
   * @param parent Контейнер формы.
   * @param handlers Сохранение и удаление.
   */
  constructor(parent: HTMLElement, handlers: PostEditorHandlers) {
    this.#parent = parent;
    this.#handlers = handlers;
  }

  /**
   * Вставляет форму в свёрнутом виде.
   */
  render(): void {
    this.#parent.insertAdjacentHTML("beforeend", template());
    this.#element = this.#parent.lastElementChild as HTMLElement;
    this.#open = this.#element.querySelector(
      ".post-editor__open",
    ) as HTMLButtonElement;
    this.#form = this.#element.querySelector(
      ".post-editor__form",
    ) as HTMLFormElement;
    this.#actions = this.#element.querySelector(
      ".post-editor__actions",
    ) as HTMLElement;
    this.#submit = this.#form.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    this.#error = this.#element.querySelector(
      ".post-editor__error",
    ) as HTMLElement;

    this.#text = new Input(
      this.#element.querySelector(".post-editor__field") as HTMLElement,
      {
        name: "post_text",
        type: "textarea",
        placeholder: "Что у вас нового?",
        attributes: { maxlength: MAX_LENGTH.post },
        validate: validatePostText,
      },
    );
    this.#text.render();

    this.#open.addEventListener("click", () => this.#show(null));
    this.#form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.setError("");
      if (this.#text.validate()) {
        this.#handlers.onSubmit(this.#text.value.trim(), this.#post);
      }
    });
    this.#form.addEventListener("click", (event) => {
      const action = (event.target as Element).closest<HTMLElement>(
        "[data-action]",
      )?.dataset.action;
      if (action === "cancel") {
        this.close();
      } else if (action === "delete" && this.#post) {
        this.#handlers.onDelete(this.#post);
      }
    });
  }

  /**
   * Открывает форму с текстом своего поста для правки.
   * @param post Пост, который правим.
   */
  edit(post: PostData): void {
    this.#show(post);
    this.#element.scrollIntoView({ block: "center" });
  }

  /**
   * Прячет или возвращает весь блок, например пока открыта правка профиля.
   * @param isHidden Спрятать ли блок.
   */
  hide(isHidden: boolean): void {
    this.#element.classList.toggle("post-editor_hidden", isHidden);
  }

  /**
   * Сворачивает форму и очищает поле.
   */
  close(): void {
    this.#post = null;
    this.#text.value = "";
    this.#text.setError("");
    this.setError("");
    this.setBusy(false);
    this.#form.classList.add("post-editor__form_hidden");
    this.#open.classList.remove("post-editor__open_hidden");
  }

  /**
   * Блокирует кнопки на время запроса.
   * @param isBusy Идёт ли запрос.
   */
  setBusy(isBusy: boolean): void {
    this.#form.querySelectorAll("button").forEach((button) => {
      button.disabled = isBusy;
    });
  }

  /**
   * Показывает ошибку сервера под полем или убирает её.
   * @param message Текст ошибки или пустая строка.
   */
  setError(message: string): void {
    this.#error.textContent = message;
  }

  /**
   * Показывает ошибку проверки текста поста.
   * @param message Текст ошибки.
   */
  setFieldError(message: string): void {
    this.#text.setError(message);
  }

  /**
   * Раскрывает форму: для нового поста — пустую с «Опубликовать», для правки — с текстом поста, «Изменить» и «Удалить».
   * @param post Пост для правки или null для нового.
   */
  #show(post: PostData | null): void {
    this.#post = post;
    this.#text.value = post?.post_text ?? "";
    this.#text.setError("");
    this.setError("");
    this.#submit.textContent = post ? LABELS.edit : LABELS.create;
    this.#actions.classList.toggle("post-editor__actions_edit", Boolean(post));
    this.#actions
      .querySelector(".post-editor__delete")
      ?.classList.toggle("post-editor__delete_hidden", !post);
    this.#open.classList.add("post-editor__open_hidden");
    this.#form.classList.remove("post-editor__form_hidden");
    this.#form.querySelector("textarea")?.focus();
  }
}
