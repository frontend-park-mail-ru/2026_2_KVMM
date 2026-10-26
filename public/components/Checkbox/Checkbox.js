function template({ name, label }) {
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
  #parent;
  #config;
  #element;
  #control;
  #box;
  #error;

  /**
   * @param {HTMLElement} parent Контейнер, в конец которого добавляется чекбокс.
   * @param {object} config Настройки: name, label — статичная разметка подписи без данных пользователя, validate.
   */
  constructor(parent, config) {
    this.#parent = parent;
    this.#config = config;
  }

  get checked() {
    return this.#control.checked;
  }

  /**
   * Отмечает или снимает отметку, например при возврате на шаг формы.
   * @param {boolean} value Отмечен ли чекбокс.
   */
  set checked(value) {
    this.#control.checked = value;
    this.#box.classList.toggle("checkbox__box_checked", value);
  }

  get hasError() {
    return Boolean(this.#error.textContent);
  }

  /**
   * Вставляет чекбокс и подписывается на переключение и фокус с клавиатуры.
   */
  render() {
    this.#parent.insertAdjacentHTML("beforeend", template(this.#config));
    this.#element = this.#parent.lastElementChild;
    this.#control = this.#element.querySelector(".checkbox__control");
    this.#box = this.#element.querySelector(".checkbox__box");
    this.#error = this.#element.querySelector(".checkbox__error");

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
   * @returns {boolean} true, если значение корректно.
   */
  validate() {
    const message = this.#config.validate(this.checked);
    this.#error.textContent = message;
    this.#box.classList.toggle("checkbox__box_invalid", Boolean(message));
    this.#control.setAttribute("aria-invalid", String(Boolean(message)));
    return !message;
  }
}
