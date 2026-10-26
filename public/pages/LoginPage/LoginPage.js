import { api } from "../../modules/api.js";
import { user } from "../../modules/user.js";
import { serverErrorMessage } from "../../modules/errors.js";
import {
  MAX_LENGTH,
  normalizeLogin,
  validateLogin,
  validateLoginPassword,
} from "../../modules/validation.js";
import { Input } from "../../components/Input/Input.js";
import { authLayoutTemplate } from "../../components/AuthLayout/AuthLayout.js";
import { logoTemplate } from "../../components/Logo/Logo.js";

const FIELDS = {
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

function template() {
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
      <p class="auth-card__slogan">Nexly - Люди. Идеи. Ближе.</p>
    </section>
  `);
}

/**
 * Страница входа.
 */
export class LoginPage {
  #parent;
  #router;
  #fields;
  #submit;
  #serverError;

  /**
   * @param {HTMLElement} parent Контейнер страницы.
   * @param {import("../../modules/router.js").Router} router Роутер для перехода в ленту после входа.
   */
  constructor(parent, router) {
    this.#parent = parent;
    this.#router = router;
  }

  /**
   * Рисует форму входа и подписывается на отправку.
   */
  render() {
    this.#parent.insertAdjacentHTML("beforeend", template());

    const form = this.#parent.querySelector(".auth-card__form");
    const fieldsContainer = form.querySelector(".auth-card__fields");
    this.#submit = form.querySelector("button[type=submit]");
    this.#serverError = form.querySelector(".auth-card__server-error");

    this.#fields = {
      login: new Input(fieldsContainer, FIELDS.login),
      password: new Input(fieldsContainer, FIELDS.password),
    };
    Object.values(this.#fields).forEach((field) => field.render());

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.#submitForm();
    });
  }

  async #submitForm() {
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

    if (response.status === 200) {
      user.set(response.data);
      this.#router.navigate("/feed");
      return;
    }

    this.#serverError.textContent = serverErrorMessage(response);
  }
}
