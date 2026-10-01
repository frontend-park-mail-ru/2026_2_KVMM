import { api } from "../../modules/api.js";
import { user } from "../../modules/user.js";
import { serverErrorMessage } from "../../modules/errors.js";
import {
  normalizePhone,
  validateEmail,
  validateGender,
  validateName,
  validateNickname,
  validatePassword,
  validatePasswordConfirm,
  validatePhone,
} from "../../modules/validation.js";
import { Input } from "../../components/Input/Input.js";

const GENDERS = [
  { value: "male", label: "Мужской" },
  { value: "female", label: "Женский" },
];

const DEPENDENT_FIELDS = {
  email: ["phone_number"],
  phone_number: ["email"],
  password: ["confirm_password"],
};

function fieldConfigs(valueOf) {
  return [
    {
      name: "nickname",
      type: "text",
      placeholder: "Введите логин",
      autocomplete: "username",
      validate: validateNickname,
    },
    {
      name: "email",
      type: "email",
      placeholder: "Введите email",
      autocomplete: "email",
      validate: (value) => validateEmail(value, valueOf("phone_number")),
    },
    {
      name: "phone_number",
      type: "tel",
      placeholder: "Введите номер телефона",
      autocomplete: "tel",
      validate: (value) => validatePhone(value, valueOf("email")),
    },
    {
      name: "profile_name",
      type: "text",
      placeholder: "Введите имя",
      autocomplete: "given-name",
      validate: (value) => validateName(value, "profile_name"),
    },
    {
      name: "surname",
      type: "text",
      placeholder: "Введите фамилию",
      autocomplete: "family-name",
      validate: (value) => validateName(value, "surname"),
    },
    {
      name: "patronymic",
      type: "text",
      placeholder: "Введите отчество",
      autocomplete: "additional-name",
      validate: (value) => validateName(value, "patronymic", false),
    },
    {
      name: "gender",
      placeholder: "Выберите пол",
      options: GENDERS,
      validate: validateGender,
    },
    {
      name: "password",
      type: "password",
      placeholder: "Введите пароль",
      autocomplete: "new-password",
      validate: validatePassword,
    },
    {
      name: "confirm_password",
      type: "password",
      placeholder: "Повторите пароль",
      autocomplete: "new-password",
      validate: (value) => validatePasswordConfirm(value, valueOf("password")),
    },
  ];
}

function template() {
  return `
    <main class="page page_auth">
      <section class="signup-card">
        <header class="signup-card__header">
          <h1 class="logo">KVMM</h1>
          <p class="signup-card__subtitle">Регистрация</p>
        </header>
        <form class="signup-card__form" novalidate>
          <div class="signup-card__fields"></div>
          <p class="signup-card__server-error" role="alert"></p>
          <div class="signup-card__actions">
            <button class="button button_primary" type="submit">Зарегистрироваться</button>
            <a class="button button_secondary" href="/login" data-link>Войти</a>
          </div>
        </form>
      </section>
    </main>
  `;
}

export class SignupPage {
  #parent;
  #router;
  #fields = {};
  #submit;
  #serverError;

  constructor(parent, router) {
    this.#parent = parent;
    this.#router = router;
  }

  render() {
    this.#parent.insertAdjacentHTML("beforeend", template());

    const form = this.#parent.querySelector(".signup-card__form");
    const fieldsContainer = form.querySelector(".signup-card__fields");
    this.#submit = form.querySelector("button[type=submit]");
    this.#serverError = form.querySelector(".signup-card__server-error");

    const valueOf = (name) => this.#fields[name].value;
    fieldConfigs(valueOf).forEach((config) => {
      const field = new Input(fieldsContainer, config);
      field.render();
      this.#fields[config.name] = field;
    });

    form.addEventListener("input", (event) => {
      this.#revalidateDependents(event.target.name);
    });
    form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.#submitForm();
    });
  }

  #revalidateDependents(name) {
    (DEPENDENT_FIELDS[name] ?? [])
      .map((dependent) => this.#fields[dependent])
      .filter((field) => field.hasError)
      .forEach((field) => field.validate());
  }

  #payload() {
    const valueOf = (name) => this.#fields[name].value;
    return {
      nickname: valueOf("nickname").trim(),
      email: valueOf("email").trim() || undefined,
      phone_number: normalizePhone(valueOf("phone_number")) || undefined,
      password: valueOf("password"),
      confirm_password: valueOf("confirm_password"),
      profile_name: valueOf("profile_name").trim(),
      surname: valueOf("surname").trim(),
      patronymic: valueOf("patronymic").trim() || undefined,
      gender: valueOf("gender"),
    };
  }

  async #submitForm() {
    this.#serverError.textContent = "";

    const results = Object.values(this.#fields).map((field) => field.validate());
    if (results.includes(false)) {
      return;
    }

    this.#submit.disabled = true;
    const response = await api.register(this.#payload());
    this.#submit.disabled = false;

    if (response.status === 201) {
      user.set(response.data);
      this.#router.navigate("/feed");
      return;
    }

    this.#serverError.textContent = serverErrorMessage(response);
  }
}
