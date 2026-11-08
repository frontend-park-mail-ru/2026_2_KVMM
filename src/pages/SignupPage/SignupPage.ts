import { api, isSession } from "../../modules/api";
import type { ApiResult, Profile, RegisterFields } from "../../modules/api";
import type { Router } from "@nexly/router";
import { user } from "../../modules/user";
import { registerFieldError, serverErrorMessage } from "../../modules/errors";
import {
  normalizePhone,
  validateAvatarFile,
  validateConsent,
} from "../../modules/validation";
import { fieldConfigs } from "../../modules/profileFields";
import {
  SIGNUP_STEPS,
  isStepAvailable,
  signupDraft,
} from "../../modules/signupDraft";
import { Input } from "../../components/Input/Input";
import { Checkbox } from "../../components/Checkbox/Checkbox";
import { FileField } from "../../components/FileField/FileField";
import { authLayoutTemplate } from "../../components/AuthLayout/AuthLayout";
import { logoTemplate } from "../../components/Logo/Logo";
import avatarPlaceholder from "./avatar-placeholder.svg";

type ActionKind =
  "login" | "register" | "save" | "skip" | "step" | "back" | "forward";

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
  slogan?: boolean;
  photo?: boolean;
  actions: StepAction[];
}

const DEPENDENT_FIELDS: Record<string, string[]> = {
  password: ["confirm_password"],
};

const REQUIRED_FIELDS = ["nickname", "password", "confirm_password"];

const ABOUT_FIELDS = [
  "profile_name",
  "surname",
  "patronymic",
  "gender",
  "birthday",
];

const PHONE_TAKEN = "Этот номер уже используется";
const EMAIL_TAKEN = "Этот email уже занят";
const FIELD_REJECTED = "Сервер не принял это значение, проверьте его";
const PHOTO_HINT = "Формат: png, jpg, jpeg; до 5мб";

const PRIVACY_URL = "/public/privacy.pdf";

const CONSENT_LABEL = `Я даю согласие на <a class="checkbox__link" href="${PRIVACY_URL}" target="_blank" rel="noopener noreferrer">обработку персональных данных</a>`;

const ARROW_ICONS = {
  back: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>',
  forward:
    '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18l6-6-6-6" /></svg>',
};

const SLOGAN = "Nexly&nbsp;— Люди. Идеи. Ближе.";

const SKIP: StepAction = {
  kind: "skip",
  style: "secondary",
  label: "Возможно потом",
};

const STEPS: Record<string, Step> = {
  "/signup": {
    label: "логин и пароль",
    title: "Добро пожаловать",
    card: "auth-card_gap_large",
    fields: ["nickname", "password", "confirm_password"],
    fieldsModifier: "auth-card__fields_compact",
    consent: true,
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
    actions: [{ kind: "save", style: "primary", label: "Подтвердить" }, SKIP],
  },
  "/signup/about": {
    label: "о себе",
    title: "Расскажи нам о себе",
    card: "auth-card_padding_large",
    fields: ABOUT_FIELDS,
    actions: [{ kind: "save", style: "primary", label: "Продолжить" }, SKIP],
  },
  "/signup/photo": {
    label: "фото",
    title: "Добавьте фото профиля",
    card: "auth-card_gap_small auth-card_padding_large",
    fields: ["bio"],
    fieldsModifier: "auth-card__fields_profile",
    photo: true,
    actions: [{ kind: "save", style: "primary", label: "Продолжить" }, SKIP],
  },
};

const SUBMIT_KINDS: string[] = ["register", "save"];

/**
 * Кнопка шага. «Войти» — ссылка на /login, отправляющие действия — submit, остальные — обычные кнопки.
 * @param action Действие шага.
 * @param action.kind Вид действия.
 * @param action.style Модификатор кнопки.
 * @param action.label Подпись.
 * @returns Разметка кнопки или ссылки.
 */
function actionTemplate({ kind, style, label }: StepAction): string {
  const className = `button button_${style}`;
  if (kind === "login") {
    return `<a class="${className}" href="/login" data-link data-action="login">${label}</a>`;
  }
  const type = SUBMIT_KINDS.includes(kind) ? "submit" : "button";
  return `<button class="${className}" type="${type}" data-action="${kind}">${label}</button>`;
}

/**
 * Форма шага: содержимое сверху и кнопки шага снизу.
 * @param step Шаг регистрации.
 * @param groupContent Разметка заголовка, полей и места под ошибку.
 * @returns Разметка формы.
 */
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

/**
 * Пустой контейнер полей шага: сами поля добавляются компонентами.
 * @param step Шаг регистрации.
 * @returns Разметка контейнера.
 */
function fieldsTemplate(step: Step): string {
  const modifier = step.fieldsModifier ? ` ${step.fieldsModifier}` : "";
  return `<div class="auth-card__fields${modifier}"></div>`;
}

/**
 * Полоски шагов сверху карточки. Текущий шаг отмечен aria-current, у каждой полоски есть подпись для читалок.
 * @param current Путь текущего шага.
 * @returns Разметка навигации по шагам.
 */
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

/**
 * Навигация шага: стрелка назад, если предыдущий шаг доступен, полоски шагов и стрелка вперёд, которая появляется после прохождения шага.
 * @param path Путь текущего шага.
 * @returns Разметка навигации.
 */
function navTemplate(path: string): string {
  const index = SIGNUP_STEPS.indexOf(path);
  const previous = SIGNUP_STEPS[index - 1];
  const back =
    previous && isStepAvailable(previous, user.isAuthorized)
      ? `<button class="auth-card__arrow auth-card__arrow_back" type="button" data-action="back" aria-label="Назад">${ARROW_ICONS.back}</button>`
      : "";
  const forward =
    index < SIGNUP_STEPS.length - 1
      ? `<button class="auth-card__arrow auth-card__arrow_forward auth-card__arrow_hidden" type="button" data-action="forward" aria-label="Вперёд">${ARROW_ICONS.forward}</button>`
      : "";
  return back + stepsTemplate(path) + forward;
}

/**
 * Подсказка поля: у обязательных — логина и паролей — со звёздочкой, остальные необязательны, как на бэке.
 * @param name Имя поля.
 * @param placeholder Подсказка из настроек поля.
 * @returns Подсказка для шага.
 */
function placeholderFor(name: string, placeholder: string): string {
  return REQUIRED_FIELDS.includes(name) ? `${placeholder} *` : placeholder;
}

/**
 * Карточка обычного шага: логотип, форма с заголовком и полями, слоган на первом шаге и навигация.
 * @param step Шаг регистрации.
 * @param path Путь шага.
 * @returns Разметка страницы.
 */
function stepTemplate(step: Step, path: string): string {
  return authLayoutTemplate(`
    <section class="auth-card ${step.card} auth-card_stepped">
      ${logoTemplate("auth-card__logo")}
      ${formTemplate(
        step,
        `<p class="auth-card__title">${step.title}</p>${fieldsTemplate(step)}<p class="auth-card__server-error" role="alert"></p>`,
      )}
      ${step.slogan ? `<p class="auth-card__slogan">${SLOGAN}</p>` : ""}
      ${navTemplate(path)}
    </section>
  `);
}

/**
 * Карточка шага фото: маленький логотип, заголовок, круг под превью аватарки, форма и навигация.
 * @param step Шаг регистрации.
 * @param path Путь шага.
 * @returns Разметка страницы.
 */
function photoStepTemplate(step: Step, path: string): string {
  return authLayoutTemplate(`
    <section class="auth-card ${step.card} auth-card_stepped">
      ${logoTemplate("auth-card__logo", "small")}
      <p class="auth-card__title auth-card__title_compact">${step.title}</p>
      <img class="auth-card__avatar" draggable="false" src="${avatarPlaceholder}" width="320" height="185" alt="">
      ${formTemplate(
        step,
        `${fieldsTemplate(step)}<p class="auth-card__server-error" role="alert"></p>`,
      )}
      ${navTemplate(path)}
    </section>
  `);
}

/**
 * Регистрация в четыре шага: шаг 1 создаёт аккаунт, шаги 2–4 дозаполняют профиль уже вошедшего пользователя — контакты, данные о себе, фото и рассказ о себе. Любой из шагов 2–4 можно пропустить.
 */
export class SignupPage {
  #parent: HTMLElement;
  #router: Router;
  #path = "";
  #step!: Step;
  #fields: Record<string, Input> = {};
  #consent: Checkbox | null = null;
  #photo: FileField | null = null;
  #avatar: HTMLImageElement | null = null;
  #previewUrl = "";
  #buttons: HTMLButtonElement[] = [];
  #steps: HTMLButtonElement[] = [];
  #forward: HTMLButtonElement | null = null;
  #serverError!: HTMLElement;
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
    this.#steps = [
      ...card.querySelectorAll<HTMLButtonElement>(".auth-card__step"),
    ];
    this.#forward = card.querySelector<HTMLButtonElement>(
      '[data-action="forward"]',
    );
    this.#avatar = card.querySelector<HTMLImageElement>(".auth-card__avatar");
    this.#serverError = form.querySelector(
      ".auth-card__server-error",
    ) as HTMLElement;
    this.#buttons = [...card.querySelectorAll("button")];
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
   * Отмечает страницу закрытой, чтобы ответ сервера после ухода со страницы не обрабатывался, и освобождает превью фото.
   */
  destroy(): void {
    this.#isDestroyed = true;
    if (this.#previewUrl) {
      URL.revokeObjectURL(this.#previewUrl);
    }
  }

  /**
   * Создаёт поля шага со значениями из черновика: выбор фото, поля ввода и согласие на обработку данных.
   * @param container Контейнер полей.
   */
  #renderFields(container: HTMLElement): void {
    if (this.#step.photo) {
      this.#photo = new FileField(container, {
        name: "avatar",
        hint: PHOTO_HINT,
        accept: "image/png, image/jpeg",
        validate: validateAvatarFile,
        onChange: (file) => this.#showPreview(file),
      });
      this.#photo.render();
    }

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

  /**
   * Показывает выбранное фото в круге и освобождает адрес предыдущего превью.
   * @param file Файл или null, чтобы вернуть заглушку.
   */
  #showPreview(file: File | null): void {
    if (!this.#avatar) {
      return;
    }
    if (this.#previewUrl) {
      URL.revokeObjectURL(this.#previewUrl);
    }
    this.#previewUrl = file ? URL.createObjectURL(file) : "";
    this.#avatar.src = this.#previewUrl || avatarPlaceholder;
    this.#avatar.classList.toggle("auth-card__avatar_photo", Boolean(file));
  }

  /**
   * Показывает ошибку, оставленную для поля другим экраном, например «Этот email уже занят» с экрана кода.
   */
  #showPendingError(): void {
    const error = signupDraft.takeFieldError();
    if (error && this.#fields[error.field]) {
      this.#fields[error.field].setError(error.message);
    }
  }

  /**
   * Сохраняет ввод в черновик и снова открывает шаг: изменённый шаг нужно пройти заново. Если ошибка показана у повтора пароля, перепроверяет его при правке пароля.
   * @param target Изменённое поле.
   */
  #onEdit(target: HTMLInputElement): void {
    if (!target.name || target.type === "file") {
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

  /**
   * Обновляет навигацию: стрелку вперёд для пройденного шага, отметки пройденных шагов и доступность полосок.
   */
  #updateNav(): void {
    this.#forward?.classList.toggle(
      "auth-card__arrow_hidden",
      !signupDraft.isComplete(this.#path),
    );
    this.#steps.forEach((button) => {
      const path = button.dataset.step ?? "";
      const isCurrent = path === this.#path;
      const isAvailable = isStepAvailable(path, user.isAuthorized);
      button.classList.toggle(
        "auth-card__step_done",
        !isCurrent &&
          (signupDraft.isComplete(path) ||
            (path === SIGNUP_STEPS[0] && user.isAuthorized)),
      );
      button.disabled = isCurrent || !isAvailable;
    });
  }

  /**
   * Переходит на соседний шаг, после последнего — в ленту.
   * @param offset -1 — назад, 1 — вперёд.
   */
  #goTo(offset: number): void {
    const index = SIGNUP_STEPS.indexOf(this.#path) + offset;
    if (index >= SIGNUP_STEPS.length) {
      this.#finish();
      return;
    }
    this.#router.navigate(SIGNUP_STEPS[index]);
  }

  /**
   * Выполняет действие кнопки или полоски шага.
   * @param kind Вид действия.
   * @param step Путь шага для перехода по полоске.
   */
  #runAction(kind: ActionKind, step?: string): void {
    if (kind === "step" && step) {
      this.#router.navigate(step);
    } else if (kind === "back") {
      this.#goTo(-1);
    } else if (kind === "forward" || kind === "skip") {
      this.#goTo(1);
    } else if (kind === "register") {
      this.#register();
    } else if (kind === "save") {
      this.#save();
    }
  }

  /**
   * Проверяет все поля шага, согласие и фото, показывая ошибки сразу у всех.
   * @returns true, если всё заполнено верно.
   */
  #validateStep(): boolean {
    const results = Object.values(this.#fields).map((field) =>
      field.validate(),
    );
    if (this.#consent) {
      results.push(this.#consent.validate());
    }
    if (this.#photo) {
      results.push(this.#photo.validate());
    }
    return !results.includes(false);
  }

  /**
   * Значение поля шага, а если поля на этом шаге нет — из черновика.
   * @param name Имя поля.
   * @returns Значение.
   */
  #value(name: string): string {
    return this.#fields[name]?.value ?? signupDraft.text(name);
  }

  /**
   * Блокирует кнопки на время запроса и возвращает навигацию после него.
   * @param isBusy Идёт ли запрос.
   */
  #setBusy(isBusy: boolean): void {
    this.#buttons.forEach((button) => {
      button.disabled = isBusy;
    });
    if (!isBusy) {
      this.#updateNav();
    }
  }

  /**
   * Показывает ошибку сохранения: под полем, если бэк назвал поле или ошибка относится к известному полю, иначе — общей строкой. 401 ведёт на вход.
   * @param response Ответ бэка.
   * @param field Поле, к которому относится 400 без указания поля.
   */
  #showError(response: ApiResult<unknown>, field?: string): void {
    const fieldError = registerFieldError(response);
    const target = fieldError?.field ?? field;
    if (response.status === 400 && target && this.#fields[target]) {
      this.#fields[target].setError(fieldError?.message ?? FIELD_REJECTED);
      return;
    }
    if (response.status === 401) {
      user.clear();
      this.#router.navigate("/login");
      return;
    }
    this.#serverError.textContent = serverErrorMessage(response);
  }

  /**
   * Отмечает шаг пройденным и переходит дальше.
   */
  #completeStep(): void {
    signupDraft.complete(this.#path);
    this.#goTo(1);
  }

  /**
   * Завершает регистрацию: чистит черновик и открывает ленту.
   */
  #finish(): void {
    signupDraft.clear();
    this.#router.navigate("/feed", true);
  }

  /**
   * Шаг 1: создаёт аккаунт. После успеха пароли стираются из черновика и открывается шаг 2; ошибки бэка показываются под полями.
   */
  async #register(): Promise<void> {
    this.#serverError.textContent = "";
    if (!this.#validateStep()) {
      return;
    }

    const payload: RegisterFields = {
      nickname: this.#value("nickname").trim(),
      password: this.#value("password"),
      confirm_password: this.#value("confirm_password"),
      privacy_policy_allowed: true,
    };
    this.#setBusy(true);
    const response = await api.register(payload);
    if (this.#isDestroyed) {
      return;
    }
    this.#setBusy(false);

    if (response.status === 201 && isSession(response.data)) {
      user.set(response.data);
      signupDraft.forgetPasswords();
      signupDraft.complete(this.#path);
      this.#router.navigate(SIGNUP_STEPS[1], true);
      return;
    }

    const fieldError = registerFieldError(response);
    if (fieldError && this.#fields[fieldError.field]) {
      this.#fields[fieldError.field].setError(fieldError.message);
      return;
    }
    this.#serverError.textContent = serverErrorMessage(response);
  }

  /**
   * Шаги 2–4: проверяет поля и сохраняет данные текущего шага.
   */
  async #save(): Promise<void> {
    this.#serverError.textContent = "";
    if (!this.#validateStep()) {
      return;
    }
    this.#setBusy(true);
    if (this.#path === "/signup/email") {
      await this.#saveContacts();
    } else if (this.#path === "/signup/about") {
      await this.#saveAbout();
    } else {
      await this.#savePhoto();
    }
    if (!this.#isDestroyed) {
      this.#setBusy(false);
    }
  }

  /**
   * Запоминает профиль из удачного ответа.
   * @param response Ответ бэка на PATCH профиля.
   * @returns true, если профиль сохранён.
   */
  #applyProfile(response: ApiResult<Profile>): boolean {
    if (response.status === 200 && response.data?.id) {
      user.setProfile(response.data);
      return true;
    }
    return false;
  }

  /**
   * Шаг 2: сохраняет телефон, затем отправляет код на email и открывает экран кода. Без email шаг завершается сразу. 409 — номер или email уже заняты.
   */
  async #saveContacts(): Promise<void> {
    const email = this.#value("email").trim();
    const phone = normalizePhone(this.#value("phone_number"));
    const profile = user.profile;

    if (phone && phone !== profile?.phone_number) {
      const response = await api.updateProfile({ phone_number: phone });
      if (this.#isDestroyed) {
        return;
      }
      if (!this.#applyProfile(response)) {
        if (response.status === 409) {
          this.#fields.phone_number.setError(PHONE_TAKEN);
        } else {
          this.#showError(response, "phone_number");
        }
        return;
      }
    }

    if (email && email.toLowerCase() !== profile?.email?.toLowerCase()) {
      const response = await api.requestEmailChange(email);
      if (this.#isDestroyed) {
        return;
      }
      if (response.status === 200) {
        signupDraft.setPendingEmail(email, {
          next: "/signup/about",
          back: "/signup/email",
          skip: "Возможно потом",
        });
        this.#router.navigate("/signup/code");
        return;
      }
      if (response.status === 409) {
        this.#fields.email.setError(EMAIL_TAKEN);
      } else {
        this.#showError(response, "email");
      }
      return;
    }

    this.#completeStep();
  }

  /**
   * Шаг 3: сохраняет только заполненные поля — имя, фамилию, отчество, пол и дату рождения. Пустые не отправляются: бэк их не примет. Если не заполнено ничего, шаг завершается без запроса, как «Возможно потом».
   */
  async #saveAbout(): Promise<void> {
    const fields = Object.fromEntries(
      ABOUT_FIELDS.map((name) => [name, this.#value(name).trim()]).filter(
        ([, value]) => value,
      ),
    );
    if (Object.keys(fields).length === 0) {
      this.#completeStep();
      return;
    }
    const response = await api.updateProfile(fields);
    if (this.#isDestroyed) {
      return;
    }
    if (this.#applyProfile(response)) {
      this.#completeStep();
      return;
    }
    this.#showError(response);
  }

  /**
   * Шаг 4: загружает фото и рассказ о себе, если они есть, и завершает регистрацию.
   */
  async #savePhoto(): Promise<void> {
    const file = this.#photo?.file ?? null;
    if (file) {
      const response = await api.uploadAvatar(file);
      if (this.#isDestroyed) {
        return;
      }
      if (response.status !== 201) {
        if (response.status === 400 || response.status === 409) {
          this.#photo?.setError(serverErrorMessage(response));
        } else {
          this.#showError(response);
        }
        return;
      }
    }

    const bio = this.#value("bio").trim();
    if (bio) {
      const response = await api.updateProfile({ bio });
      if (this.#isDestroyed) {
        return;
      }
      if (!this.#applyProfile(response)) {
        this.#showError(response, "bio");
        return;
      }
    }

    this.#finish();
  }
}
