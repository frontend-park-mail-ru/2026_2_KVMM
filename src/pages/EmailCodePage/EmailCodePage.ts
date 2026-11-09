import { api, isSession } from "../../modules/api";
import type { Router } from "@nexly/router";
import { user } from "../../modules/user";
import { serverErrorMessage } from "../../modules/errors";
import { validateEmailCode } from "../../modules/validation";
import { escapeHtml } from "@nexly/utils";
import { signupDraft } from "../../modules/signupDraft";
import type { PendingEmail } from "../../modules/signupDraft";
import { Input } from "../../components/Input/Input";
import { authLayoutTemplate } from "../../components/AuthLayout/AuthLayout";
import { logoTemplate } from "../../components/Logo/Logo";

const RESEND_DELAY_MS = 2 * 60 * 1000;
const WRONG_CODE = "Неверный или устаревший код";
const EMAIL_TAKEN = "Этот email уже занят";
const REGISTER_FAILED =
  "Не получилось создать аккаунт с этой почтой, зарегистрируйтесь по логину";

/**
 * Разметка экрана кода: куда отправлен код, поле кода, кнопка повторной отправки с таймером, «Продолжить» и кнопка ухода.
 * @param pending Ожидающий подтверждения email.
 * @param pending.email Адрес, на который отправлен код.
 * @param pending.skip Подпись кнопки ухода: «Возможно потом» при регистрации, «Отменить» в профиле.
 * @returns Разметка экрана.
 */
function template({ email, skip }: PendingEmail): string {
  return authLayoutTemplate(`
    <section class="auth-card auth-card_gap_large">
      ${logoTemplate("auth-card__logo")}
      <form class="auth-card__form" novalidate>
        <div class="auth-card__group">
          <p class="auth-card__title">Код отправлен на<br>${escapeHtml(email)}</p>
          <div class="auth-card__fields"></div>
          <button class="auth-card__resend" type="button" disabled></button>
          <p class="auth-card__server-error" role="alert"></p>
        </div>
        <div class="auth-card__actions">
          <button class="button button_primary" type="submit">Продолжить</button>
          <button class="button button_secondary" type="button" data-action="skip">${escapeHtml(skip)}</button>
        </div>
      </form>
    </section>
  `);
}

/**
 * Оставшееся время до повторной отправки в виде м:сс.
 * @param ms Сколько миллисекунд осталось.
 * @returns Например, 1:05.
 */
function countdown(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Экран кода из письма для трёх сценариев: смена email в профиле, вход по email без пароля и регистрация по email. Таймер повторной отправки на 2 минуты; кнопка ухода оставляет email неподтверждённым или возвращает на предыдущий экран.
 */
export class EmailCodePage {
  #parent: HTMLElement;
  #router: Router;
  #pending!: PendingEmail;
  #code!: Input;
  #resend!: HTMLButtonElement;
  #submit!: HTMLButtonElement;
  #serverError!: HTMLElement;
  #timer = 0;
  #isDestroyed = false;

  /**
   * @param parent Контейнер страницы.
   * @param router Роутер для перехода к следующему шагу.
   */
  constructor(parent: HTMLElement, router: Router) {
    this.#parent = parent;
    this.#router = router;
  }

  /**
   * Рисует форму кода и запускает таймер повторной отправки.
   */
  render(): void {
    this.#pending = signupDraft.pendingEmail() as PendingEmail;
    this.#parent.insertAdjacentHTML("beforeend", template(this.#pending));
    const form = this.#parent.querySelector(
      ".auth-card__form",
    ) as HTMLFormElement;
    this.#resend = form.querySelector(
      ".auth-card__resend",
    ) as HTMLButtonElement;
    this.#submit = form.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    this.#serverError = form.querySelector(
      ".auth-card__server-error",
    ) as HTMLElement;

    this.#code = new Input(
      form.querySelector(".auth-card__fields") as HTMLElement,
      {
        name: "code",
        type: "text",
        placeholder: "Введите код из письма",
        autocomplete: "one-time-code",
        attributes: { inputmode: "numeric", maxlength: 6 },
        validate: validateEmailCode,
      },
    );
    this.#code.render();

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      this.#confirm();
    });
    form
      .querySelector('[data-action="skip"]')
      ?.addEventListener("click", () => this.#leave());
    this.#resend.addEventListener("click", () => this.#sendAgain());

    this.#tick();
    this.#timer = window.setInterval(() => this.#tick(), 1000);
  }

  /**
   * Останавливает таймер и игнорирует ответы, пришедшие после ухода со страницы.
   */
  destroy(): void {
    this.#isDestroyed = true;
    window.clearInterval(this.#timer);
  }

  /**
   * Обновляет кнопку повторной отправки раз в секунду: пока не прошли 2 минуты, она выключена и показывает обратный отсчёт.
   */
  #tick(): void {
    const sentAt = signupDraft.pendingEmail()?.sentAt ?? 0;
    const left = sentAt + RESEND_DELAY_MS - Date.now();
    this.#resend.disabled = left > 0;
    this.#resend.textContent =
      left > 0
        ? `Отправить новый код: ${countdown(left)}`
        : "Отправить новый код";
  }

  /**
   * Отправляет код ещё раз и перезапускает таймер от нового времени отправки.
   */
  async #sendAgain(): Promise<void> {
    this.#serverError.textContent = "";
    this.#resend.disabled = true;
    const { email, purpose } = this.#pending;
    const send = {
      login: api.requestLoginCode,
      register: api.requestRegisterCode,
      change: api.requestEmailChange,
    }[purpose];
    const response = await send(email);
    if (this.#isDestroyed) {
      return;
    }
    if (response.status === 200) {
      signupDraft.setPendingEmail(email, this.#pending);
      this.#pending = signupDraft.pendingEmail() as PendingEmail;
    } else {
      this.#serverError.textContent = serverErrorMessage(response);
    }
    this.#tick();
  }

  /**
   * Кнопка ухода. При смене email — дальше без подтверждения, при входе и регистрации — назад, где можно ввести другой email или войти по паролю.
   */
  #leave(): void {
    if (this.#pending.purpose !== "change") {
      signupDraft.clearPendingEmail();
      this.#router.navigate(this.#pending.back);
      return;
    }
    this.#router.navigate(this.#pending.next);
  }

  /**
   * Проверяет код. Вход: успех — сессия и лента, 401 — неверный код. Смена email: успех — email подтверждён, переход дальше; 400 — неверный код; 409 — email занят, возврат к полю email с ошибкой; 401 — на вход.
   */
  async #confirm(): Promise<void> {
    this.#serverError.textContent = "";
    if (!this.#code.validate()) {
      return;
    }
    this.#submit.disabled = true;
    const code = this.#code.value.trim();
    if (this.#pending.purpose === "login") {
      await this.#confirmLogin(code);
    } else if (this.#pending.purpose === "register") {
      await this.#confirmRegister(code);
    } else {
      await this.#confirmChange(code);
    }
    if (!this.#isDestroyed) {
      this.#submit.disabled = false;
    }
  }

  /**
   * Вход по коду: сохраняет сессию, очищает черновики и открывает ленту.
   * @param code Код из письма.
   */
  async #confirmLogin(code: string): Promise<void> {
    const { email, next } = this.#pending;
    const response = await api.loginByCode(email, code);
    if (this.#isDestroyed) {
      return;
    }
    if (response.status === 200 && isSession(response.data)) {
      signupDraft.clear();
      user.set(response.data);
      this.#router.navigate(next, true);
      return;
    }
    if (response.status === 401) {
      this.#code.setError(WRONG_CODE);
      return;
    }
    this.#serverError.textContent = serverErrorMessage(response);
  }

  /**
   * Регистрация по email: бэк создаёт аккаунт с придуманным логином, дальше — шаг «О себе». 409 — email заняли, пока шёл код; 500 — бэк не смог придумать логин по этой почте.
   * @param code Код из письма.
   */
  async #confirmRegister(code: string): Promise<void> {
    const { email, next, back } = this.#pending;
    const response = await api.registerByEmail(email, code);
    if (this.#isDestroyed) {
      return;
    }
    if (response.status === 201 && isSession(response.data)) {
      user.set(response.data);
      signupDraft.complete(back);
      signupDraft.clearPendingEmail();
      this.#router.navigate(next, true);
      return;
    }
    if (response.status === 400) {
      this.#code.setError(WRONG_CODE);
      return;
    }
    if (response.status === 409) {
      signupDraft.setFieldError({ field: "email", message: EMAIL_TAKEN });
      signupDraft.clearPendingEmail();
      this.#router.navigate(back);
      return;
    }
    this.#serverError.textContent =
      response.status >= 500 ? REGISTER_FAILED : serverErrorMessage(response);
  }

  /**
   * Подтверждение нового email вошедшего пользователя.
   * @param code Код из письма.
   */
  async #confirmChange(code: string): Promise<void> {
    const { email, next, back } = this.#pending;
    const response = await api.confirmEmail(email, code);
    if (this.#isDestroyed) {
      return;
    }
    if (response.status === 200 && response.data?.id) {
      user.setProfile(response.data);
      signupDraft.complete(back);
      signupDraft.clearPendingEmail();
      this.#router.navigate(next, true);
      return;
    }
    if (response.status === 400) {
      this.#code.setError(WRONG_CODE);
      return;
    }
    if (response.status === 409) {
      signupDraft.setFieldError({ field: "email", message: EMAIL_TAKEN });
      this.#router.navigate(back);
      return;
    }
    if (response.status === 401) {
      user.clear();
      this.#router.navigate("/login");
      return;
    }
    this.#serverError.textContent = serverErrorMessage(response);
  }
}
