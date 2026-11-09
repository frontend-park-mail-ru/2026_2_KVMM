import plusIcon from "./plus.svg";

/**
 * Настройки поля выбора файла.
 */
export interface FileFieldConfig {
  name: string;
  hint: string;
  accept: string;
  validate: (file: File | null) => string;
  onChange?: (file: File | null) => void;
}

/**
 * Разметка поля файла: скрытый input внутри подписи, текст подсказки, значок «плюс» и место под ошибку.
 * @param config Настройки поля.
 * @param config.name Имя поля формы.
 * @param config.hint Подсказка о форматах, пока файл не выбран.
 * @param config.accept Допустимые типы файлов для окна выбора.
 * @returns Разметка поля.
 */
function template({ name, hint, accept }: FileFieldConfig): string {
  return `
    <div class="file-field">
      <label class="file-field__box">
        <input class="file-field__control" type="file" name="${name}" accept="${accept}">
        <span class="file-field__text">${hint}</span>
        <img class="file-field__icon" draggable="false" src="${plusIcon}" width="12" height="12" alt="">
      </label>
      <p class="file-field__error"></p>
    </div>
  `;
}

/**
 * Поле выбора файла: подпись с форматом, имя выбранного файла и ошибка под полем.
 */
export class FileField {
  #parent: HTMLElement;
  #config: FileFieldConfig;
  #control!: HTMLInputElement;
  #text!: HTMLElement;
  #error!: HTMLElement;

  /**
   * @param parent Контейнер, в конец которого добавляется поле.
   * @param config Настройки: name, hint — статичная подпись, accept, validate и onChange.
   */
  constructor(parent: HTMLElement, config: FileFieldConfig) {
    this.#parent = parent;
    this.#config = config;
  }

  /**
   * Выбранный файл.
   * @returns Файл или null, если ничего не выбрано.
   */
  get file(): File | null {
    return this.#control.files?.[0] ?? null;
  }

  /**
   * Вставляет поле и подписывается на выбор файла.
   */
  render(): void {
    this.#parent.insertAdjacentHTML("beforeend", template(this.#config));
    const element = this.#parent.lastElementChild as HTMLElement;
    this.#control = element.querySelector(
      ".file-field__control",
    ) as HTMLInputElement;
    this.#text = element.querySelector(".file-field__text") as HTMLElement;
    this.#error = element.querySelector(".file-field__error") as HTMLElement;

    this.#control.addEventListener("change", () => {
      const file = this.file;
      this.#text.textContent = file ? file.name : this.#config.hint;
      const isValid = this.validate();
      this.#config.onChange?.(isValid ? file : null);
    });
  }

  /**
   * Сбрасывает выбранный файл, подпись и ошибку.
   */
  clear(): void {
    this.#control.value = "";
    this.#text.textContent = this.#config.hint;
    this.setError("");
  }

  /**
   * Проверяет выбранный файл и показывает или убирает ошибку.
   * @returns true, если файл не выбран или подходит.
   */
  validate(): boolean {
    const message = this.#config.validate(this.file);
    this.setError(message);
    return !message;
  }

  /**
   * Показывает ошибку под полем, например ответ сервера, или убирает её.
   * @param message Текст ошибки или пустая строка.
   */
  setError(message: string): void {
    this.#error.textContent = message;
    this.#control.setAttribute("aria-invalid", String(Boolean(message)));
  }
}
