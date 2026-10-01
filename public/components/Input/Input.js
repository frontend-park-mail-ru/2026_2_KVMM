function optionsTemplate(options) {
  return options
    .map(({ value, label }) => `<option value="${value}">${label}</option>`)
    .join("");
}

function controlTemplate({ name, type, placeholder, autocomplete, options }) {
  if (options) {
    return `
      <select class="input__control" name="${name}" required>
        <option value="" disabled selected hidden>${placeholder}</option>
        ${optionsTemplate(options)}
      </select>
    `;
  }

  return `
    <input
      class="input__control"
      name="${name}"
      type="${type}"
      placeholder="${placeholder}"
      autocomplete="${autocomplete}"
    >
  `;
}

function template(config) {
  const modifier = config.options ? " input_select" : "";
  return `
    <div class="input${modifier}">
      ${controlTemplate(config)}
      <p class="input__error"></p>
    </div>
  `;
}

export class Input {
  #parent;
  #config;
  #element;
  #control;
  #error;

  constructor(parent, config) {
    this.#parent = parent;
    this.#config = config;
  }

  get name() {
    return this.#config.name;
  }

  get value() {
    return this.#control.value;
  }

  get hasError() {
    return Boolean(this.#error.textContent);
  }

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
  }

  validate() {
    const message = this.#config.validate(this.value);
    this.#error.textContent = message;
    this.#element.classList.toggle("input_invalid", Boolean(message));
    this.#control.setAttribute("aria-invalid", String(Boolean(message)));
    return !message;
  }
}
