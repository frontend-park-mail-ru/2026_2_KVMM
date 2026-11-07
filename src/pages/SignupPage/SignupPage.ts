import { api } from "../../modules/api";
import { isSession } from "../../modules/api";
import type { RegisterFields } from "../../modules/api";
import type { Router } from "../../modules/router";
import { user } from "../../modules/user";
import { registerFieldError, serverErrorMessage } from "../../modules/errors";
import {
  MAX_LENGTH,
  birthdayRange,
  validateBio,
  validateBirthday,
  validateConsent,
  validateEmail,
  validateGender,
  validateName,
  validateNickname,
  validatePassword,
  validatePasswordConfirm,
  validatePhone,
} from "../../modules/validation";
import { attachPhoneMask } from "../../modules/phoneMask";
import {
  SIGNUP_STEPS,
  signupDraft,
  signupRedirect,
} from "../../modules/signupDraft";
import { Input } from "../../components/Input/Input";
import type { InputConfig, InputOption } from "../../components/Input/Input";
import { Checkbox } from "../../components/Checkbox/Checkbox";
import { authLayoutTemplate } from "../../components/AuthLayout/AuthLayout";
import { logoTemplate } from "../../components/Logo/Logo";
import plusIcon from "../../components/FileField/plus.svg";
import avatarPlaceholder from "./avatar-placeholder.svg";

type ActionKind =
  | "next"
  | "login"
  | "register"
  | "register-without-bio"
  | "step"
  | "back"
  | "forward";

interface StepAction {
  kind: ActionKind;
  style: string;
  label: string;
}

interface Step {
  label: string;
  title: string;
  card: string;
  fields: string[];
  fieldsModifier?: string;
  consent?: boolean;
  hint?: string;
  slogan?: boolean;
  photo?: boolean;
  actions: StepAction[];
}

type FieldConfig = Omit<InputConfig, "name">;

const GENDERS: InputOption[] = [
  { value: "male", label: "Мужской" },
  { value: "female", label: "Женский" },
];

const DEPENDENT_FIELDS: Record<string, string[]> = {
  email: ["phone_number"],
  phone_number: ["email"],
  password: ["confirm_password"],
};

const REQUIRED_FIELDS = [
  "nickname",
  "password",
  "confirm_password",
  "profile_name",
  "surname",
  "gender",
  "birthday",
];

const OPTIONAL_PLACEHOLDERS: Record<string, string> = {
  patronymic: "Введите отчество (необязательно)",
  bio: "Расскажите о себе (необязательно)",
};

const REQUIRED_HINT = "* — обязательные поля";
const CONTACT_HINT = "Заполните хотя бы одно поле";

const PRIVACY_URL = "/public/privacy.pdf";

const CONSENT_LABEL = `Я даю согласие на <a class="checkbox__link" href="${PRIVACY_URL}" target="_blank" rel="noopener noreferrer">обработку персональных данных</a>`;

const ARROW_ICONS = {
  back: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>',
  forward:
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>',
};

const SLOGAN = "Nexly&nbsp;— Люди. Идеи. Ближе.";

const STEPS: Record<string, Step> = {
  "/signup": {
    label: "логин и пароль",
    title: "Добро пожаловать",
    card: "auth-card_gap_large",
    fields: ["nickname", "password", "confirm_password"],
    fieldsModifier: "auth-card__fields_compact",
    consent: true,
    hint: REQUIRED_HINT,
    slogan: true,
    actions: [
      { kind: "register", style: "secondary", label: "Зарегистрироваться" },
      { kind: "login", style: "primary", label: "Войти" },
    ],
  },
  "/signup/email": {
    label: "email или телефон",
    title: "Добавьте email или телефон — это поможет защитить ваш аккаунт",
    card: "auth-card_gap_large auth-card_padding_large",
    fields: ["email", "phone_number"],
    hint: CONTACT_HINT,
    actions: [{ kind: "next", style: "primary", label: "Подтвердить" }],
  },
  "/signup/about": {
    label: "о себе",
    title: "Расскажи нам о себе",
    card: "auth-card_padding_large",
    fields: ["profile_name", "surname", "patronymic", "gender", "birthday"],
    hint: REQUIRED_HINT,
    actions: [{ kind: "next", style: "primary", label: "Продолжить" }],
  },
  "/signup/photo": {
    label: "фото",
    title: "Добавьте фото профиля",
    card: "auth-card_gap_small auth-card_padding_large",
    fields: ["bio"],
    fieldsModifier: "auth-card__fields_profile",
    photo: true,
    actions: [
      { kind: "register", style: "primary", label: "Продолжить" },
      {
        kind: "register-without-bio",
        style: "secondary",
        label: "Возможно потом",
      },
    ],
  },
};

const SUBMIT_KINDS: string[] = ["next", "register"];

function fieldConfigs(
  valueOf: (name: string) => string,
): Record<string, FieldConfig> {
  return {
    nickname: {
      type: "text",
      placeholder: "Введите логин",
      autocomplete: "username",
      attributes: { maxlength: MAX_LENGTH.nickname },
      validate: validateNickname,
    },
    password: {
      type: "password",
      placeholder: "Введите пароль",
      autocomplete: "new-password",
      attributes: { maxlength: MAX_LENGTH.password },
      validate: validatePassword,
    },
    confirm_password: {
      type: "password",
      placeholder: "Повторите пароль",
      autocomplete: "new-password",
      attributes: { maxlength: MAX_LENGTH.password },
      validate: (value) => validatePasswordConfirm(value, valueOf("password")),
    },
    email: {
      type: "email",
      placeholder: "Введите email",
      autocomplete: "email",
      attributes: { maxlength: MAX_LENGTH.email },
      validate: (value) => validateEmail(value, valueOf("phone_number")),
    },
    phone_number: {
      type: "tel",
      placeholder: "Введите номер телефона",
      autocomplete: "tel",
      mask: attachPhoneMask,
      validate: (value) => validatePhone(value, valueOf("email")),
    },
    profile_name: {
      type: "text",
      placeholder: "Введите имя",
      autocomplete: "given-name",
      attributes: { maxlength: MAX_LENGTH.name },
      validate: (value) => validateName(value, "profile_name"),
    },
    surname: {
      type: "text",
      placeholder: "Введите фамилию",
      autocomplete: "family-name",
      attributes: { maxlength: MAX_LENGTH.name },
      validate: (value) => validateName(value, "surname"),
    },
    patronymic: {
      type: "text",
      placeholder: "Введите отчество",
      autocomplete: "additional-name",
      attributes: { maxlength: MAX_LENGTH.name },
      validate: (value) => validateName(value, "patronymic", false),
    },
    gender: {
      placeholder: "Выберите пол",
      autocomplete: "sex",
      options: GENDERS,
      validate: validateGender,
    },
    birthday: {
      type: "date",
      placeholder: "Дата рождения",
      autocomplete: "bday",
      attributes: {
        ...birthdayRange(),
        required: "required",
        "aria-label": "Дата рождения",
      },
      validate: validateBirthday,
    },
    bio: {
      type: "textarea",
      placeholder: "Расскажите о себе",
      attributes: { maxlength: MAX_LENGTH.bio },
      validate: validateBio,
    },
  };
}

function actionTemplate({ kind, style, label }: StepAction): string {
  const className = `button button_${style}`;
  if (kind === "login") {
    return `<a class="${className}" href="/login" data-link data-action="login">${label}</a>`;
  }
  const type = SUBMIT_KINDS.includes(kind) ? "submit" : "button";
  return `<button class="${className}" type="${type}" data-action="${kind}">${label}</button>`;
}

function formTemplate(step: Step, groupContent: string): string {
  return `
    <form class="auth-card__form" novalidate>
      <div class="auth-card__group">
        ${groupContent}
      </div>
      <div class="auth-card__actions">
        ${step.actions.map(actionTemplate).join("")}
      </div>
    </form>
  `;
}

function fieldsTemplate(step: Step, content: string = ""): string {
  const modifier = step.fieldsModifier ? ` ${step.fieldsModifier}` : "";
  return `<div class="auth-card__fields${modifier}">${content}</div>`;
}

function stepsTemplate(current: string): string {
  const steps = SIGNUP_STEPS.map((path, index) => {
    const label = `Шаг ${index + 1} из ${SIGNUP_STEPS.length}: ${STEPS[path].label}`;
    const isCurrent = path === current;
    const modifier = isCurrent ? " auth-card__step_current" : "";
    const ariaCurrent = isCurrent ? ' aria-current="step"' : "";
    return `<button class="auth-card__step${modifier}" type="button" data-action="step" data-step="${path}" aria-label="${label}" title="${label}"${ariaCurrent}></button>`;
  });
  return `<nav class="auth-card__steps" aria-label="Шаги регистрации">${steps.join("")}</nav>`;
}

function navTemplate(path: string): string {
  const index = SIGNUP_STEPS.indexOf(path);
  const back =
    index > 0
      ? `<button class="auth-card__arrow auth-card__arrow_back" type="button" data-action="back" aria-label="Назад">${ARROW_ICONS.back}</button>`
      : "";
  const forward =
    index < SIGNUP_STEPS.length - 1
      ? `<button class="auth-card__arrow auth-card__arrow_forward auth-card__arrow_hidden" type="button" data-action="forward" aria-label="Вперёд">${ARROW_ICONS.forward}</button>`
      : "";
  return back + stepsTemplate(path) + forward;
}

function placeholderFor(name: string, placeholder: string): string {
  if (REQUIRED_FIELDS.includes(name)) {
    return `${placeholder} *`;
  }
  return OPTIONAL_PLACEHOLDERS[name] ?? placeholder;
}

function stepTemplate(step: Step, path: string): string {
  const hint = step.hint ? `<p class="auth-card__hint">${step.hint}</p>` : "";
  return authLayoutTemplate(`
    <section class="auth-card ${step.card} auth-card_stepped">
      ${logoTemplate("auth-card__logo")}
      ${formTemplate(
        step,
        `<p class="auth-card__title">${step.title}</p>${fieldsTemplate(step)}${hint}<p class="auth-card__server-error" role="alert"></p>`,
      )}
      ${step.slogan ? `<p class="auth-card__slogan">${SLOGAN}</p>` : ""}
      ${navTemplate(path)}
    </section>
  `);
}

function photoStepTemplate(step: Step, path: string): string {
  const fileField = `
    <label class="file-field file-field_disabled">
      <input class="file-field__control" type="file" accept="image/png, image/jpeg" disabled aria-disabled="true">
      <span class="file-field__text">Фото можно добавить позже</span>
      <img class="file-field__icon" draggable="false" src="${plusIcon}" width="12" height="12" alt="">
    </label>
  `;
  return authLayoutTemplate(`
    <section class="auth-card ${step.card} auth-card_stepped">
      ${logoTemplate("auth-card__logo", "small")}
      <p class="auth-card__title auth-card__title_compact">${step.title}</p>
      <img class="auth-card__avatar" draggable="false" src="${avatarPlaceholder}" width="320" height="185" alt="">
      ${formTemplate(
        step,
        `${fieldsTemplate(step, fileField)}<p class="auth-card__server-error" role="alert"></p>`,
      )}
      ${navTemplate(path)}
    </section>
  `);
}

function stepOfField(field: string): string | undefined {
  return SIGNUP_STEPS.find((path) => STEPS[path].fields.includes(field));
}

/**
 * Регистрация из четырёх шагов: логин и пароль, email или телефон, данные о себе, фото и рассказ о себе. Значения шагов хранит черновик в памяти, на бэк уходит один запрос в конце.
 */
export class SignupPage {
  #parent: HTMLElement;
  #router: Router;
  #path = "";
  #step!: Step;
  #fields: Record<string, Input> = {};
  #consent: Checkbox | null = null;
  #buttons: HTMLButtonElement[] = [];
  #steps: HTMLButtonElement[] = [];
  #forward: HTMLButtonElement | null = null;
  #serverError: HTMLElement | null = null;
  #isDestroyed = false;

  /**
   * @param parent Контейнер страницы.
   * @param router Роутер для переходов между шагами и в ленту.
   */
  constructor(parent: HTMLElement, router: Router) {
    this.#parent = parent;
    this.#router = router;
  }

  /**
   * Рисует текущий шаг, подставляет значения из черновика и подписывается на ввод и кнопки.
   */
  render(): void {
    this.#path = window.location.pathname;
    this.#step = STEPS[this.#path];
    const template = this.#step.photo ? photoStepTemplate : stepTemplate;
    this.#parent.insertAdjacentHTML(
      "beforeend",
      template(this.#step, this.#path),
    );

    const card = this.#parent.querySelector(".auth-card") as HTMLElement;
    const form = card.querySelector(".auth-card__form") as HTMLFormElement;
    this.#buttons = [...card.querySelectorAll("button")];
    this.#steps = [
      ...card.querySelectorAll<HTMLButtonElement>(".auth-card__step"),
    ];
    this.#forward = card.querySelector<HTMLButtonElement>(
      '[data-action="forward"]',
    );
    this.#serverError = form.querySelector<HTMLElement>(
      ".auth-card__server-error",
    );
    this.#renderFields(form.querySelector(".auth-card__fields") as HTMLElement);
    this.#showPendingError();
    this.#updateNav();

    form.addEventListener("input", (event) =>
      this.#onEdit(event.target as HTMLInputElement),
    );
    form.addEventListener("change", (event) =>
      this.#onEdit(event.target as HTMLInputElement),
    );
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const submit = this.#step.actions.find(({ kind }) =>
        SUBMIT_KINDS.includes(kind),
      );
      this.#runAction((submit as StepAction).kind);
    });
    card.addEventListener("click", (event) => {
      const target = (event.target as Element).closest<HTMLElement>(
        "[data-action]",
      );
      const action = target?.dataset.action;
      if (target && action && !SUBMIT_KINDS.includes(action)) {
        this.#runAction(action as ActionKind, target.dataset.step);
      }
    });
  }

  /**
   * Отмечает страницу закрытой, чтобы ответ сервера после ухода со страницы не обрабатывался.
   */
  destroy(): void {
    this.#isDestroyed = true;
  }

  #renderFields(container: HTMLElement): void {
    const configs = fieldConfigs((name) =>
      this.#fields[name] ? this.#fields[name].value : signupDraft.text(name),
    );
    this.#step.fields.forEach((name) => {
      const placeholder = placeholderFor(name, configs[name].placeholder);
      const field = new Input(container, {
        ...configs[name],
        name,
        placeholder,
      });
      field.render();
      field.value = signupDraft.text(name);
      this.#fields[name] = field;
    });

    if (this.#step.consent) {
      this.#consent = new Checkbox(container, {
        name: "consent",
        label: CONSENT_LABEL,
        validate: validateConsent,
      });
      this.#consent.render();
      this.#consent.checked = signupDraft.value("consent") === true;
    }
  }

  #showPendingError(): void {
    const error = signupDraft.takeFieldError();
    if (error && this.#fields[error.field]) {
      this.#fields[error.field].setError(error.message);
    }
  }

  #onEdit(target: HTMLInputElement): void {
    if (!target.name) {
      return;
    }
    signupDraft.reopen(this.#path);
    this.#updateNav();
    signupDraft.set(
      target.name,
      target.type === "checkbox" ? target.checked : target.value,
    );
    (DEPENDENT_FIELDS[target.name] ?? [])
      .map((name) => this.#fields[name])
      .filter((field) => field?.hasError)
      .forEach((field) => field.validate());
  }

  #updateNav(): void {
    this.#forward?.classList.toggle(
      "auth-card__arrow_hidden",
      !signupDraft.isComplete(this.#path),
    );
    this.#steps.forEach((button) => {
      const path = button.dataset.step ?? "";
      const isCurrent = path === this.#path;
      button.classList.toggle(
        "auth-card__step_done",
        !isCurrent && signupDraft.isComplete(path),
      );
      button.disabled = isCurrent || signupRedirect(path) !== null;
    });
  }

  #goTo(offset: number): void {
    const index = SIGNUP_STEPS.indexOf(this.#path) + offset;
    this.#router.navigate(SIGNUP_STEPS[index]);
  }

  #runAction(kind: ActionKind, step?: string): void {
    if (kind === "step") {
      this.#router.navigate(step ?? "");
    } else if (kind === "back") {
      this.#goTo(-1);
    } else if (kind === "forward") {
      this.#goTo(1);
    } else if (kind === "next") {
      this.#goNext();
    } else if (kind === "register" || kind === "register-without-bio") {
      this.#register();
    }
  }

  #validateStep(): boolean {
    const results = Object.values(this.#fields).map((field) =>
      field.validate(),
    );
    if (this.#consent) {
      results.push(this.#consent.validate());
    }
    return !results.includes(false);
  }

  #goNext(): void {
    if (!this.#validateStep()) {
      return;
    }
    signupDraft.complete(this.#path);
    this.#goTo(1);
  }

  #payload(): RegisterFields {
    const value = (name: string): string =>
      this.#fields[name]?.value ?? signupDraft.text(name);
    return {
      nickname: value("nickname").trim(),
      password: value("password"),
      confirm_password: value("confirm_password"),
      privacy_policy_allowed: true,
    };
  }

  #setBusy(isBusy: boolean): void {
    this.#buttons.forEach((button) => {
      button.disabled = isBusy;
    });
    if (!isBusy) {
      this.#updateNav();
    }
  }

  async #register(): Promise<void> {
    (this.#serverError as HTMLElement).textContent = "";
    if (!this.#validateStep()) {
      return;
    }

    this.#setBusy(true);
    const response = await api.register(this.#payload());
    if (this.#isDestroyed) {
      return;
    }
    this.#setBusy(false);

    if (response.status === 201 && isSession(response.data)) {
      signupDraft.clear();
      user.set(response.data);
      this.#router.navigate("/feed", true);
      return;
    }

    const fieldError = registerFieldError(response);
    const target = fieldError && stepOfField(fieldError.field);
    if (target && target !== this.#path) {
      signupDraft.setFieldError(fieldError);
      signupDraft.reopen(target);
      this.#router.navigate(target);
      return;
    }
    if (target && fieldError) {
      this.#fields[fieldError.field].setError(fieldError.message);
      return;
    }
    (this.#serverError as HTMLElement).textContent =
      serverErrorMessage(response);
  }
}
