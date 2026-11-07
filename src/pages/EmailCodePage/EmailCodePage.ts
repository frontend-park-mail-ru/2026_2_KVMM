import { api } from "../../modules/api";
import type { Router } from "../../modules/router";
import { user } from "../../modules/user";
import { serverErrorMessage } from "../../modules/errors";
import { validateEmailCode } from "../../modules/validation";
import { escapeHtml } from "../../modules/utils";
import { signupDraft } from "../../modules/signupDraft";
import { Input } from "../../components/Input/Input";
import { authLayoutTemplate } from "../../components/AuthLayout/AuthLayout";
import { logoTemplate } from "../../components/Logo/Logo";

const RESEND_DELAY_MS = 2 * 60 * 1000;
const EMAIL_STEP = "/signup/email";
const NEXT_STEP = "/signup/about";
const WRONG_CODE = "Неверный или устаревший код";
const EMAIL_TAKEN = "Этот email уже занят";

function template(email: string): string {
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
          <button class="button button_secondary" type="button" data-action="skip">Возможно потом</button>
        </div>
      </form>
    </section>
  `);
}

function countdown(ms: number): string {
  const seconds = Math.ceil(ms / 1000);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}

/**
 * Подтверждение нового email кодом из письма: таймер повторной отправки на 2 минуты, «Возможно потом» оставляет email неподтверждённым.
 */
export class EmailCodePage {
  #parent: HTMLElement;
  #router: Router;
  #email = "";
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
    this.#email = signupDraft.pendingEmail()?.email ?? "";
    this.#parent.insertAdjacentHTML("beforeend", template(this.#email));
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
      ?.addEventListener("click", () => this.#router.navigate(NEXT_STEP));
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

  #tick(): void {
    const sentAt = signupDraft.pendingEmail()?.sentAt ?? 0;
    const left = sentAt + RESEND_DELAY_MS - Date.now();
    this.#resend.disabled = left > 0;
    this.#resend.textContent =
      left > 0
        ? `Отправить новый код: ${countdown(left)}`
        : "Отправить новый код";
  }

  async #sendAgain(): Promise<void> {
    this.#serverError.textContent = "";
    this.#resend.disabled = true;
    const response = await api.requestEmailChange(this.#email);
    if (this.#isDestroyed) {
      return;
    }
    if (response.status === 200) {
      signupDraft.setPendingEmail(this.#email);
    } else {
      this.#serverError.textContent = serverErrorMessage(response);
    }
    this.#tick();
  }

  async #confirm(): Promise<void> {
    this.#serverError.textContent = "";
    if (!this.#code.validate()) {
      return;
    }

    this.#submit.disabled = true;
    const response = await api.confirmEmail(
      this.#email,
      this.#code.value.trim(),
    );
    if (this.#isDestroyed) {
      return;
    }
    this.#submit.disabled = false;

    if (response.status === 200 && response.data?.id) {
      user.setProfile(response.data);
      signupDraft.complete(EMAIL_STEP);
      this.#router.navigate(NEXT_STEP, true);
      return;
    }
    if (response.status === 400) {
      this.#code.setError(WRONG_CODE);
      return;
    }
    if (response.status === 409) {
      signupDraft.setFieldError({ field: "email", message: EMAIL_TAKEN });
      this.#router.navigate(EMAIL_STEP);
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
