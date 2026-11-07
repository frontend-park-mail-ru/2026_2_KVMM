import type { Profile, ProfileUpdate } from "../../modules/api";
import { fieldConfigs } from "../../modules/profileFields";
import type { FieldConfig } from "../../modules/profileFields";
import { applyPhoneMask } from "../../modules/phoneMask";
import { normalizePhone, validateAvatarFile } from "../../modules/validation";
import { Input } from "../Input/Input";
import { FileField } from "../FileField/FileField";
import avatarPlaceholder from "../../pages/SignupPage/avatar-placeholder.svg";

const MAIN_FIELDS = [
  "phone_number",
  "email",
  "profile_name",
  "surname",
  "patronymic",
  "gender",
  "birthday",
];

const SIDE_FIELDS = ["bio"];

const CLEARABLE_FIELDS = new Set(["phone_number", "bio"]);

const REQUIRED = "Заполните поле";

/**
 * Изменения из формы профиля: поля для PATCH, новый email для подтверждения кодом и новая аватарка.
 */
export interface ProfileChanges {
  fields: ProfileUpdate;
  email: string | null;
  avatar: File | null;
}

/**
 * Обработчики формы профиля.
 */
export interface ProfileEditorConfig {
  onSubmit: (changes: ProfileChanges) => void;
  onCancel: () => void;
}

function template(): string {
  return `
    <form class="profile-editor profile-editor_hidden" novalidate>
      <div class="profile-editor__columns">
        <div class="profile-editor__main">
          <div class="profile-editor__fields"></div>
          <div class="profile-editor__actions">
            <button class="button button_neutral" type="button" data-action="cancel">Отменить</button>
            <button class="button button_primary" type="submit">Изменить</button>
          </div>
        </div>
        <div class="profile-editor__side">
          <img class="profile-editor__avatar" draggable="false" src="${avatarPlaceholder}" width="320" height="185" alt="">
        </div>
      </div>
      <p class="profile-editor__error" role="alert"></p>
    </form>
  `;
}

function formValue(name: string, profile: Profile): string {
  const value = String(profile[name as keyof Profile] ?? "").trim();
  if (name === "phone_number") {
    return value ? applyPhoneMask(value).value : "";
  }
  return name === "birthday" ? value.slice(0, 10) : value;
}

function sentValue(name: string, value: string): string {
  if (name === "phone_number") {
    return normalizePhone(value);
  }
  return name === "email" ? value.trim().toLowerCase() : value.trim();
}

/**
 * Форма редактирования профиля под карточкой: контакты, имя, пол, дата рождения, аватарка и рассказ о себе. Отправляет только изменённые поля, кнопка «Изменить» серая, пока менять нечего.
 */
export class ProfileEditor {
  #parent: HTMLElement;
  #config: ProfileEditorConfig;
  #form!: HTMLFormElement;
  #submit!: HTMLButtonElement;
  #error!: HTMLElement;
  #avatar!: HTMLImageElement;
  #fields: Record<string, Input> = {};
  #photo!: FileField;
  #initial: Record<string, string> = {};
  #avatarUrl = "";
  #previewUrl = "";

  /**
   * @param parent Контейнер, в конец которого добавляется форма.
   * @param config Обработчики отправки и отмены.
   */
  constructor(parent: HTMLElement, config: ProfileEditorConfig) {
    this.#parent = parent;
    this.#config = config;
  }

  get isOpen(): boolean {
    return !this.#form.classList.contains("profile-editor_hidden");
  }

  /**
   * Вставляет скрытую форму и подписывается на ввод и отправку.
   */
  render(): void {
    this.#parent.insertAdjacentHTML("beforeend", template());
    this.#form = this.#parent.lastElementChild as HTMLFormElement;
    this.#submit = this.#form.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    this.#error = this.#form.querySelector(
      ".profile-editor__error",
    ) as HTMLElement;
    this.#avatar = this.#form.querySelector(
      ".profile-editor__avatar",
    ) as HTMLImageElement;

    const configs = fieldConfigs((name) => this.#fields[name]?.value ?? "");
    const main = this.#form.querySelector(
      ".profile-editor__fields",
    ) as HTMLElement;
    const side = this.#form.querySelector(
      ".profile-editor__side",
    ) as HTMLElement;
    MAIN_FIELDS.forEach((name) => this.#addField(main, name, configs[name]));
    this.#photo = new FileField(side, {
      name: "avatar",
      hint: "Загрузите новое фото: png или jpeg до 5 МБ",
      accept: "image/png,image/jpeg",
      validate: validateAvatarFile,
      onChange: (file) => this.#showPreview(file),
    });
    this.#photo.render();
    SIDE_FIELDS.forEach((name) => this.#addField(side, name, configs[name]));

    this.#avatar.addEventListener("error", () => this.#showAvatar(""));
    this.#form.addEventListener("input", () => this.#updateSubmit());
    this.#form.addEventListener("change", () => this.#updateSubmit());
    this.#form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.#send();
    });
    this.#form
      .querySelector('[data-action="cancel"]')
      ?.addEventListener("click", () => this.#config.onCancel());
  }

  /**
   * Открывает форму с текущими данными профиля.
   * @param profile Профиль, с которого начинается правка.
   * @param avatarUrl Адрес текущей аватарки или пустая строка.
   */
  open(profile: Profile, avatarUrl: string): void {
    this.#avatarUrl = avatarUrl;
    this.reset(profile);
    this.#form.classList.remove("profile-editor_hidden");
    this.#fields[MAIN_FIELDS[0]].focus();
  }

  /**
   * Делает текущие данные профиля исходными: заполняет поля, сбрасывает выбранный файл и ошибки.
   * @param profile Профиль после последнего сохранения.
   */
  reset(profile: Profile): void {
    Object.entries(this.#fields).forEach(([name, field]) => {
      this.#initial[name] = formValue(name, profile);
      field.value = this.#initial[name];
      field.setError("");
    });
    this.#photo.clear();
    this.#showPreview(null);
    this.setError("");
    this.#updateSubmit();
  }

  /**
   * Делает сохранённые на бэке значения исходными, не трогая введённое: несохранённые поля остаются изменениями.
   * @param profile Профиль из ответа бэка.
   */
  commit(profile: Profile): void {
    Object.keys(this.#fields).forEach((name) => {
      this.#initial[name] = formValue(name, profile);
    });
    this.#updateSubmit();
  }

  /**
   * Запоминает новую аватарку после загрузки и сбрасывает выбранный файл.
   * @param avatarUrl Адрес новой аватарки.
   */
  setAvatar(avatarUrl: string): void {
    this.#avatarUrl = avatarUrl;
    this.#photo.clear();
    this.#showPreview(null);
    this.#updateSubmit();
  }

  /**
   * Прячет форму.
   */
  close(): void {
    this.#form.classList.add("profile-editor_hidden");
    this.#showPreview(null);
  }

  /**
   * Блокирует кнопки на время запроса.
   * @param isBusy Идёт ли запрос.
   */
  setBusy(isBusy: boolean): void {
    this.#form
      .querySelectorAll("button")
      .forEach((button) => (button.disabled = isBusy));
    if (!isBusy) {
      this.#updateSubmit();
    }
  }

  /**
   * Показывает общую ошибку под формой или убирает её.
   * @param message Текст ошибки или пустая строка.
   */
  setError(message: string): void {
    this.#error.textContent = message;
  }

  /**
   * Показывает ошибку под полем, например ответ сервера о занятом номере.
   * @param name Имя поля, avatar — поле фото.
   * @param message Текст ошибки.
   */
  setFieldError(name: string, message: string): void {
    if (name === "avatar") {
      this.#photo.setError(message);
      return;
    }
    this.#fields[name]?.setError(message);
  }

  /**
   * Подставляет значение в поле, например email, который не удалось подтвердить.
   * @param name Имя поля.
   * @param value Значение.
   */
  setValue(name: string, value: string): void {
    if (this.#fields[name]) {
      this.#fields[name].value = value;
      this.#updateSubmit();
    }
  }

  /**
   * Уничтожает временную ссылку на превью фото.
   */
  destroy(): void {
    this.#showPreview(null);
  }

  #addField(parent: HTMLElement, name: string, config: FieldConfig): void {
    const field = new Input(parent, {
      ...config,
      name,
      validate: (value, validity) => {
        if (value.trim() || validity.badInput) {
          return config.validate(value, validity);
        }
        const canBeEmpty = CLEARABLE_FIELDS.has(name) || !this.#initial[name];
        return canBeEmpty ? "" : config.validate(value, validity) || REQUIRED;
      },
    });
    field.render();
    this.#fields[name] = field;
  }

  #changes(): ProfileChanges {
    const fields: Record<string, string> = {};
    let email: string | null = null;
    Object.entries(this.#fields).forEach(([name, field]) => {
      const value = sentValue(name, field.value);
      if (value === sentValue(name, this.#initial[name] ?? "")) {
        return;
      }
      if (name === "email") {
        email = value;
      } else {
        fields[name] = value;
      }
    });
    return { fields, email, avatar: this.#photo.file };
  }

  #hasChanges({ fields, email, avatar }: ProfileChanges): boolean {
    return Object.keys(fields).length > 0 || email !== null || avatar !== null;
  }

  #updateSubmit(): void {
    const isActive = this.#hasChanges(this.#changes());
    this.#submit.classList.toggle("button_inactive", !isActive);
    this.#submit.setAttribute("aria-disabled", String(!isActive));
  }

  #send(): void {
    this.setError("");
    const results = Object.values(this.#fields).map((field) =>
      field.validate(),
    );
    results.push(this.#photo.validate());
    const changes = this.#changes();
    if (results.includes(false) || !this.#hasChanges(changes)) {
      return;
    }
    this.#config.onSubmit(changes);
  }

  #showPreview(file: File | null): void {
    if (this.#previewUrl) {
      URL.revokeObjectURL(this.#previewUrl);
    }
    this.#previewUrl = file ? URL.createObjectURL(file) : "";
    this.#showAvatar(this.#previewUrl || this.#avatarUrl);
  }

  #showAvatar(url: string): void {
    this.#avatar.src = url || avatarPlaceholder;
    this.#avatar.classList.toggle("profile-editor__avatar_photo", Boolean(url));
  }
}
