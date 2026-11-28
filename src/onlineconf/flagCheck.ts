import { checkFlag, OnlineConfHttpError, redirectOnAccessDenied } from "./api";
import type { Entry, FlagCheckResult } from "./api";
import { element, showMessage, UUID_FORMAT } from "./form";

function describeResult({ enabled, reason, rollout }: FlagCheckResult): string {
  const state = enabled ? "Флаг включён." : "Флаг выключен.";
  switch (reason) {
  case "include":
    return state + " Пользователь в списке принудительного включения.";
  case "exclude":
    return state + " Пользователь в списке принудительного исключения.";
  case "rollout":
    return state + ` Результат процентной раскатки (${rollout}%).`;
  }
}

/**
 * Подключает проверку сохранённых правил флага для пользователя.
 * @param form Форма проверки по UUID.
 * @returns Выбирает флаг и очищает результат предыдущей проверки.
 */
export function bindFlagCheck(form: HTMLFormElement): (flag?: Pick<Entry, "scope" | "name">) => void {
  const uid = element<HTMLInputElement>(form, "[name=profile_uid]");
  const submit = element<HTMLButtonElement>(form, "[type=submit]");
  const error = element(form, "#onlineconf-flag-check-error");
  const result = element(form, "#onlineconf-flag-check-result");
  let selectedFlag: Pick<Entry, "scope" | "name"> | undefined;
  let pending: AbortController | undefined;

  const reset = (): void => {
    pending?.abort();
    pending = undefined;
    submit.disabled = false;
    uid.removeAttribute("aria-invalid");
    result.removeAttribute("data-enabled");
    showMessage(error, "");
    showMessage(result, "");
  };

  const runCheck = async (): Promise<void> => {
    if (!selectedFlag || pending) {
      return;
    }
    reset();
    const profileUid = uid.value.trim().toLowerCase();
    if (!UUID_FORMAT.test(profileUid)) {
      uid.setAttribute("aria-invalid", "true");
      showMessage(error, "Введите корректный UUID пользователя.");
      uid.focus();
      return;
    }

    const controller = new AbortController();
    pending = controller;
    submit.disabled = true;
    showMessage(result, "Проверяем флаг…");
    try {
      const evaluation = await checkFlag(selectedFlag, profileUid, controller.signal);
      if (!controller.signal.aborted) {
        result.dataset.enabled = String(evaluation.enabled);
        showMessage(result, describeResult(evaluation));
      }
    } catch (cause) {
      if (controller.signal.aborted) {
        return;
      }
      showMessage(result, "");
      if (redirectOnAccessDenied(cause)) {
        return;
      }
      if (cause instanceof OnlineConfHttpError && cause.status === 400) {
        uid.setAttribute("aria-invalid", "true");
        showMessage(error, "Проверьте, что UUID принадлежит существующему аккаунту Nexly.");
      } else if (cause instanceof OnlineConfHttpError && cause.status === 404) {
        showMessage(error, cause.code === "not_found"
          ? "Флаг не найден. Обновите список ключей."
          : "Проверка флагов пока недоступна на сервере.");
      } else {
        showMessage(error, "Не удалось проверить флаг. Повторите попытку.");
      }
    } finally {
      if (pending === controller) {
        pending = undefined;
        submit.disabled = false;
      }
    }
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void runCheck();
  });
  uid.addEventListener("input", reset);

  return (flag) => {
    reset();
    form.reset();
    selectedFlag = flag;
    form.hidden = !flag;
  };
}
