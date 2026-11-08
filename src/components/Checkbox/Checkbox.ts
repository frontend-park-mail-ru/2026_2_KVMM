/**
 * Настройки чекбокса: label — статичная разметка подписи без данных пользователя.
 */
export interface CheckboxConfig {
  name: string;
  label: string;
  validate: (checked: boolean) => string;
}

/**
 * Разметка чекбокса: скрытый input, нарисованный кружок, подпись и место под ошибку.
 * @param config Настройки чекбокса.
 * @param config.name Имя поля формы.
 * @param config.label Статичная разметка подписи.
 * @returns Разметка чекбокса.
 */
function template({ name, label }: CheckboxConfig): string {
  return `
    <div class="checkbox">
      <label class="checkbox__label">
        <input class="checkbox__control" type="checkbox" name="${name}">
        <span class="checkbox__box" aria-hidden="true"></span>
        <span class="checkbox__text">${label}</span>
      </label>
      <p class="checkbox__error"></p>
    </div>
  `;
}

/**
 * Круглый чекбокс с подписью и текстом ошибки под ним.
 */
export class Checkbox {
  #parent: HTMLElement;
  #config: CheckboxConfig;
  #element!: HTMLElement;
  #control!: HTMLInputElement;
  #box!: HTMLElement;
  #error!: HTMLElement;

  /**
   * @param parent Контейнер, в конец которого добавляется чекбокс.
   * @param config Настройки: name, label — статичная разметка подписи без данных пользователя, validate.
   */
  constructor(parent: HTMLElement, config: CheckboxConfig) {
    this.#parent = parent;
    this.#config = config;
  }

  /**
   * Отмечен ли чекбокс.
   * @returns true, если отмечен.
   */
  get checked(): boolean {
    return this.#control.checked;
  }

  /**
   * Отмечает или снимает отметку, например при возврате на шаг формы.
   * @param value Отмечен ли чекбокс.
   */
  set checked(value: boolean) {
    this.#control.checked = value;
    this.#box.classList.toggle("checkbox__box_checked", value);
  }

  /**
   * Показана ли сейчас ошибка: тогда чекбокс перепроверяется при каждом переключении.
   * @returns true, если под чекбоксом есть текст ошибки.
   */
  get hasError(): boolean {
    return Boolean(this.#error.textContent);
  }

  /**
   * Вставляет чекбокс и подписывается на переключение и фокус с клавиатуры.
   */
  render(): void {
    this.#parent.insertAdjacentHTML("beforeend", template(this.#config));
    this.#element = this.#parent.lastElementChild as HTMLElement;
    this.#control = this.#element.querySelector(
      ".checkbox__control",
    ) as HTMLInputElement;
    this.#box = this.#element.querySelector(".checkbox__box") as HTMLElement;
    this.#error = this.#element.querySelector(
      ".checkbox__error",
    ) as HTMLElement;

    this.#control.addEventListener("change", () => {
      this.#box.classList.toggle("checkbox__box_checked", this.checked);
      if (this.hasError) {
        this.validate();
      }
    });
    this.#control.addEventListener("focus", () => {
      this.#box.classList.toggle(
        "checkbox__box_focused",
        this.#control.matches(":focus-visible"),
      );
    });
    this.#control.addEventListener("blur", () => {
      this.#box.classList.remove("checkbox__box_focused");
    });
  }

  /**
   * Проверяет отметку и показывает или убирает ошибку.
   * @returns true, если значение корректно.
   */
  validate(): boolean {
    const message = this.#config.validate(this.checked);
    this.#error.textContent = message;
    this.#box.classList.toggle("checkbox__box_invalid", Boolean(message));
    this.#control.setAttribute("aria-invalid", String(Boolean(message)));
    return !message;
  }
}
