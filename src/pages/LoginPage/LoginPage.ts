import { api, isSession } from "../../modules/api";
import type { Router } from "@nexly/router";
import { user } from "../../modules/user";
import { serverErrorMessage } from "../../modules/errors";
import {
  MAX_LENGTH,
  normalizeLogin,
  validateLogin,
  validateLoginPassword,
} from "../../modules/validation";
import { signupDraft } from "../../modules/signupDraft";
import { Input } from "../../components/Input/Input";
import type { InputConfig } from "../../components/Input/Input";
import { authLayoutTemplate } from "../../components/AuthLayout/AuthLayout";
import { logoTemplate } from "../../components/Logo/Logo";

const FIELDS: Record<"login" | "password", InputConfig> = {
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
};

function template(): string {
  return authLayoutTemplate(`
    <section class="auth-card">
      ${logoTemplate("auth-card__logo")}
      <form class="auth-card__form" novalidate>
        <div class="auth-card__group">
          <p class="auth-card__title">С возвращением</p>
          <div class="auth-card__fields"></div>
          <p class="auth-card__server-error" role="alert"></p>
        </div>
        <div class="auth-card__actions">
          <button class="button button_primary" type="submit">Войти</button>
          <a class="button button_secondary" href="/signup" data-link>Зарегистрироваться</a>
        </div>
      </form>
      <p class="auth-card__slogan">Nexly&nbsp;— Люди. Идеи. Ближе.</p>
    </section>
  `);
}

/**
 * Страница входа.
 */
export class LoginPage {
  #parent: HTMLElement;
  #router: Router;
  #fields!: Record<"login" | "password", Input>;
  #submit!: HTMLButtonElement;
  #serverError!: HTMLElement;

  /**
   * @param parent Контейнер страницы.
   * @param router Роутер для перехода в ленту после входа.
   */
  constructor(parent: HTMLElement, router: Router) {
    this.#parent = parent;
    this.#router = router;
  }

  /**
   * Рисует форму входа и подписывается на отправку.
   */
  render(): void {
    this.#parent.insertAdjacentHTML("beforeend", template());

    const form = this.#parent.querySelector(
      ".auth-card__form",
    ) as HTMLFormElement;
    const fieldsContainer = form.querySelector(
      ".auth-card__fields",
    ) as HTMLElement;
    this.#submit = form.querySelector(
      "button[type=submit]",
    ) as HTMLButtonElement;
    this.#serverError = form.querySelector(
      ".auth-card__server-error",
    ) as HTMLElement;

    this.#fields = {
      login: new Input(fieldsContainer, FIELDS.login),
      password: new Input(fieldsContainer, FIELDS.password),
    };
    Object.values(this.#fields).forEach((field) => field.render());

    const { login, password } = signupDraft.loginPrefill();
    this.#fields.login.value = login;
    this.#fields.password.value = password;

    form.addEventListener("input", () => {
      signupDraft.applyLogin(
        this.#fields.login.value,
        this.#fields.password.value,
      );
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.#submitForm();
    });
  }

  async #submitForm(): Promise<void> {
    this.#serverError.textContent = "";

    const results = Object.values(this.#fields).map((field) =>
      field.validate(),
    );
    if (results.includes(false)) {
      return;
    }

    this.#submit.disabled = true;
    const response = await api.login(
      normalizeLogin(this.#fields.login.value),
      this.#fields.password.value,
    );
    this.#submit.disabled = false;

    if (response.status === 200 && isSession(response.data)) {
      signupDraft.clear();
      user.set(response.data);
      this.#router.navigate("/feed");
      return;
    }

    this.#serverError.textContent = serverErrorMessage(response);
  }
}
