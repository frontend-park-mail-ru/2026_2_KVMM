import { api, isSession } from "../../modules/api";
import type { Router } from "@nexly/router";
import { user } from "../../modules/user";
import { serverErrorMessage } from "../../modules/errors";
import {
  MAX_LENGTH,
  normalizeLogin,
  validateLogin,
  validateLoginPassword,
  validateRequiredEmail,
} from "../../modules/validation";
import { signupDraft } from "../../modules/signupDraft";
import { Input } from "../../components/Input/Input";
import type { InputConfig } from "../../components/Input/Input";
import { authLayoutTemplate } from "../../components/AuthLayout/AuthLayout";
import { logoTemplate } from "../../components/Logo/Logo";
import {
  modeSwitchTemplate,
  setActiveMode,
} from "../../components/ModeSwitch/ModeSwitch";

type LoginMode = "password" | "code";
type LoginField = "login" | "password" | "email";

const MODES = [
  { value: "password", label: "паролю" },
  { value: "code", label: "коду" },
];

const FIELDS: Record<LoginField, InputConfig> = {
  login: {
    name: "login",
    type: "text",
    placeholder: "Введите логин",
    autocomplete: "username",
    attributes: { maxlength: MAX_LENGTH.login },
    validate: validateLogin,
  },
  password: {
    name: "password",
    type: "password",
    placeholder: "Введите пароль",
    autocomplete: "current-password",
    attributes: { maxlength: MAX_LENGTH.password },
    validate: validateLoginPassword,
  },
  email: {
    name: "email",
    type: "email",
    placeholder: "Введите email",
    autocomplete: "email",
    attributes: { maxlength: MAX_LENGTH.email },
    validate: validateRequiredEmail,
  },
};

const MODE_FIELDS: Record<LoginMode, LoginField[]> = {
  password: ["login", "password"],
  code: ["email"],
};

const ACTIONS: Record<LoginMode, string> = {
  password:
    '<button class="button button_primary" type="submit">Войти</button><a class="button button_secondary" href="/signup" data-link>Зарегистрироваться</a>',
  code: '<button class="button button_primary" type="submit">Отправить код</button>',
};

const ACCOUNT_NOT_FOUND = "Аккаунт с такой почтой не найден";
const CODE_FLOW = {
  purpose: "login" as const,
  next: "/feed",
  back: "/login",
  skip: "Войти по паролю",
};

/**
 * Разметка карточки входа: заголовок, переключатель «паролю | коду», поля, место под ошибку, «Забыли пароль?» и кнопки режима.
 * @param mode Режим, с которым открывается страница.
 * @returns Разметка страницы.
 */
function template(mode: LoginMode): string {
  return authLayoutTemplate(`
    <section class="auth-card">
      ${logoTemplate("auth-card__logo")}
      <form class="auth-card__form" novalidate>
        <div class="auth-card__group">
          <p class="auth-card__title">С возвращением</p>
          ${modeSwitchTemplate("Войти по", MODES, mode, "auth-card__mode")}
          <div class="auth-card__fields"></div>
          <p class="auth-card__server-error" role="alert"></p>
          <button class="auth-card__link" type="button" data-action="forgot">Забыли пароль?</button>
        </div>
        <div class="auth-card__actions"></div>
      </form>
      <p class="auth-card__slogan">Nexly&nbsp;— Люди. Идеи. Ближе.</p>
    </section>
  `);
}

/**
 * Страница входа по паролю или по коду из письма. «Забыли пароль?» переключает на вход по коду: восстановления пароля у бэка нет, а код его заменяет.
 */
export class LoginPage {
  #parent: HTMLElement;
  #router: Router;
  #mode: LoginMode = "password";
  #form!: HTMLFormElement;
  #switch!: HTMLElement;
  #fieldsContainer!: HTMLElement;
  #actions!: HTMLElement;
  #forgot!: HTMLButtonElement;
  #fields: Partial<Record<LoginField, Input>> = {};
  #serverError!: HTMLElement;
  #isDestroyed = false;

  /**
   * @param parent Контейнер страницы.
   * @param router Роутер для перехода в ленту или на экран кода.
   */
  constructor(parent: HTMLElement, router: Router) {
    this.#parent = parent;
    this.#router = router;
  }

  /**
   * Рисует форму. Если код входа уже отправлен (вернулись с экрана кода кнопкой «назад»), открывает вход по коду с тем же email.
   */
  render(): void {
    const pending = signupDraft.pendingEmail();
    const pendingEmail = pending?.purpose === "login" ? pending.email : "";
    this.#mode = pendingEmail ? "code" : "password";
    this.#parent.insertAdjacentHTML("beforeend", template(this.#mode));

    this.#form = this.#parent.querySelector(
      ".auth-card__form",
    ) as HTMLFormElement;
    const find = <T extends Element>(selector: string) =>
      this.#form.querySelector(selector) as T;
    this.#switch = find(".mode-switch");
    this.#fieldsContainer = find(".auth-card__fields");
    this.#actions = find(".auth-card__actions");
    this.#forgot = find('[data-action="forgot"]');
    this.#serverError = find(".auth-card__server-error");

    this.#switch.addEventListener("click", (event) => {
      const option = (event.target as Element).closest<HTMLElement>(
        "[data-mode]",
      );
      if (option?.dataset.mode) {
        this.#setMode(option.dataset.mode as LoginMode);
      }
    });
    this.#forgot.addEventListener("click", () => this.#setMode("code"));
    this.#form.addEventListener("input", () => {
      if (this.#mode === "password") {
        signupDraft.applyLogin(
          this.#fields.login?.value ?? "",
          this.#fields.password?.value ?? "",
        );
      }
    });
    this.#form.addEventListener("submit", (event) => {
      event.preventDefault();
      if (this.#mode === "password") {
        this.#submitPassword();
      } else {
        this.#submitCode();
      }
    });
    this.#renderMode(pendingEmail);
  }

  /**
   * Игнорирует ответы, пришедшие после ухода со страницы.
   */
  destroy(): void {
    this.#isDestroyed = true;
  }

  /**
   * Переключает режим входа и ставит фокус в первое поле.
   * @param mode Новый режим.
   */
  #setMode(mode: LoginMode): void {
    if (mode === this.#mode) {
      return;
    }
    const typedLogin = this.#fields.login?.value.trim() ?? "";
    this.#mode = mode;
    setActiveMode(this.#switch, mode);
    this.#renderMode(typedLogin.includes("@") ? typedLogin : "");
    Object.values(this.#fields)[0]?.focus();
  }

  /**
   * Рисует поля и кнопки режима. Логин и пароль подставляются из черновика, email — из переданного значения.
   * @param email Email для поля входа по коду.
   */
  #renderMode(email: string): void {
    this.#serverError.textContent = "";
    this.#fieldsContainer.innerHTML = "";
    this.#fields = {};
    MODE_FIELDS[this.#mode].forEach((name) => {
      const field = new Input(this.#fieldsContainer, FIELDS[name]);
      field.render();
      this.#fields[name] = field;
    });
    if (this.#mode === "password") {
      const { login, password } = signupDraft.loginPrefill();
      (this.#fields.login as Input).value = login;
      (this.#fields.password as Input).value = password;
    } else {
      (this.#fields.email as Input).value = email;
    }
    this.#actions.innerHTML = ACTIONS[this.#mode];
    this.#forgot.hidden = this.#mode !== "password";
  }

  /**
   * Блокирует кнопку отправки на время запроса.
   * @param isBusy Идёт ли запрос.
   */
  #setBusy(isBusy: boolean): void {
    const submit = this.#actions.querySelector<HTMLButtonElement>(
      'button[type="submit"]',
    );
    if (submit) {
      submit.disabled = isBusy;
    }
  }

  /**
   * Проверяет поля и входит по паролю. Логин нормализуется (телефон — в +7…), черновик регистрации очищается, после входа — лента.
   */
  async #submitPassword(): Promise<void> {
    this.#serverError.textContent = "";
    const results = Object.values(this.#fields).map((field) =>
      field.validate(),
    );
    if (results.includes(false)) {
      return;
    }

    this.#setBusy(true);
    const response = await api.login(
      normalizeLogin(this.#fields.login?.value ?? ""),
      this.#fields.password?.value ?? "",
    );
    if (this.#isDestroyed) {
      return;
    }
    this.#setBusy(false);

    if (response.status === 200 && isSession(response.data)) {
      signupDraft.clear();
      user.set(response.data);
      this.#router.navigate("/feed");
      return;
    }
    this.#serverError.textContent = serverErrorMessage(response);
  }

  /**
   * Отправляет код входа на email и открывает экран кода. Неизвестный email — ошибка под полем.
   */
  async #submitCode(): Promise<void> {
    this.#serverError.textContent = "";
    const field = this.#fields.email as Input;
    if (!field.validate()) {
      return;
    }

    const email = field.value.trim();
    this.#setBusy(true);
    const response = await api.requestLoginCode(email);
    if (this.#isDestroyed) {
      return;
    }
    this.#setBusy(false);

    if (response.status === 200) {
      signupDraft.setPendingEmail(email, CODE_FLOW);
      this.#router.navigate("/login/code");
      return;
    }
    if (response.status === 401) {
      field.setError(ACCOUNT_NOT_FOUND);
      return;
    }
    if (response.status === 400) {
      field.setError(serverErrorMessage(response));
      return;
    }
    this.#serverError.textContent = serverErrorMessage(response);
  }
}
