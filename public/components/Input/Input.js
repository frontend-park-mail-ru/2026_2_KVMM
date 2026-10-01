function template({ name, type, placeholder, autocomplete }) {
  return `
    <div class="input">
      <input
        class="input__control"
        name="${name}"
        type="${type}"
        placeholder="${placeholder}"
        autocomplete="${autocomplete}"
      >
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

  get value() {
    return this.#control.value;
  }

  render() {
    this.#parent.insertAdjacentHTML("beforeend", template(this.#config));
    this.#element = this.#parent.lastElementChild;
    this.#control = this.#element.querySelector(".input__control");
    this.#error = this.#element.querySelector(".input__error");

    this.#control.addEventListener("blur", () => this.validate());
    this.#control.addEventListener("input", () => {
      if (this.#error.textContent) {
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
