const EYE_ICON = `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
`;

const EYE_OFF_ICON = `
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M10.6 5.1A10.4 10.4 0 0 1 12 5c6.4 0 10 7 10 7a17.6 17.6 0 0 1-2.9 3.9" />
    <path d="M6.6 6.6C3.6 8.5 2 12 2 12s3.6 7 10 7c1.9 0 3.6-.6 5-1.5" />
    <path d="M9.9 9.9a3 3 0 0 0 4.2 4.2" />
    <path d="M3 3l18 18" />
  </svg>
`;

const TOGGLE_LABELS = {
  show: "Показать пароль",
  hide: "Скрыть пароль",
};

function optionsTemplate(options) {
  return options
    .map(({ value, label }) => `<option value="${value}">${label}</option>`)
    .join("");
}

function attributesTemplate(attributes = {}) {
  return Object.entries(attributes)
    .map(([name, value]) => `${name}="${value}"`)
    .join(" ");
}

function controlTemplate({
  name,
  type,
  placeholder,
  autocomplete,
  options,
  attributes,
}) {
  if (options) {
    return `
      <select class="input__control" name="${name}" autocomplete="${autocomplete}" required>
        <option value="" disabled selected hidden>${placeholder}</option>
        ${optionsTemplate(options)}
      </select>
    `;
  }

  const passwordAttributes = type === "password" ? 'spellcheck="false"' : "";
  return `
    <input
      class="input__control"
      name="${name}"
      type="${type}"
      placeholder="${placeholder}"
      autocomplete="${autocomplete}"
      ${passwordAttributes}
      ${attributesTemplate(attributes)}
    >
  `;
}

function toggleTemplate() {
  return `
    <button class="input__toggle" type="button" aria-label="${TOGGLE_LABELS.show}" aria-pressed="false">
      ${EYE_ICON}
    </button>
  `;
}

function modifierClass({ type, options }) {
  if (options) {
    return " input_select";
  }
  if (type === "password" || type === "date") {
    return ` input_${type}`;
  }
  return "";
}

function template(config) {
  const toggle = config.type === "password" ? toggleTemplate() : "";
  const placeholder =
    config.type === "date" ? ` data-placeholder="${config.placeholder}"` : "";
  return `
    <div class="input${modifierClass(config)}">
      <div class="input__field"${placeholder}>
        ${controlTemplate(config)}
        ${toggle}
      </div>
      <p class="input__error"></p>
    </div>
  `;
}

/**
 * Поле формы с текстом ошибки под ним. Для пароля добавляет кнопку показа.
 */
export class Input {
  #parent;
  #config;
  #element;
  #control;
  #error;

  /**
   * @param {HTMLElement} parent Контейнер, в конец которого добавляется поле.
   * @param {object} config Настройки: name, type, placeholder, autocomplete, attributes, options и validate.
   */
  constructor(parent, config) {
    this.#parent = parent;
    this.#config = config;
  }

  get value() {
    return this.#control.value;
  }

  get hasError() {
    return Boolean(this.#error.textContent);
  }

  /**
   * Вставляет поле в контейнер и подписывается на ввод и уход из поля.
   */
  render() {
    this.#parent.insertAdjacentHTML("beforeend", template(this.#config));
    this.#element = this.#parent.lastElementChild;
    this.#control = this.#element.querySelector(".input__control");
    this.#error = this.#element.querySelector(".input__error");

    this.#control.addEventListener("blur", () => this.validate());
    this.#control.addEventListener("input", () => {
      if (this.hasError) {
        this.validate();
      }
    });

    const toggle = this.#element.querySelector(".input__toggle");
    if (toggle) {
      this.#bindToggle(toggle);
    }
  }

  /**
   * Проверяет значение и показывает или убирает ошибку.
   * @returns {boolean} true, если значение корректно.
   */
  validate() {
    const message = this.#config.validate(this.value, this.#control.validity);
    this.#error.textContent = message;
    this.#element.classList.toggle("input_invalid", Boolean(message));
    this.#control.setAttribute("aria-invalid", String(Boolean(message)));
    return !message;
  }

  #bindToggle(toggle) {
    toggle.addEventListener("mousedown", (event) => event.preventDefault());
    toggle.addEventListener("click", () => {
      const isHidden = this.#control.type === "password";
      this.#control.type = isHidden ? "text" : "password";
      toggle.innerHTML = isHidden ? EYE_OFF_ICON : EYE_ICON;
      toggle.setAttribute(
        "aria-label",
        isHidden ? TOGGLE_LABELS.hide : TOGGLE_LABELS.show,
      );
      toggle.setAttribute("aria-pressed", String(isHidden));
    });
  }
}
