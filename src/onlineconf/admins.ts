import { confirmDialog } from "../components/Dialog/Dialog";
import { grantAdmin, listAdmins, OnlineConfHttpError, redirectOnAccessDenied, revokeAdmin } from "./api";
import type { OnlineConfAdmin } from "./api";
import { element, showMessage, UUID_FORMAT } from "./form";

const DATE_FORMAT = new Intl.DateTimeFormat("ru-RU", { dateStyle: "medium", timeStyle: "short" });

function renderAdmin(
  admin: OnlineConfAdmin,
  onRevoke: (button: HTMLButtonElement) => void,
): HTMLLIElement {
  const row = document.createElement("li");
  row.className = "onlineconf__admin";
  const details = document.createElement("div");
  details.className = "onlineconf__admin-details";
  const uid = document.createElement("code");
  uid.textContent = admin.profile_uid;
  const time = document.createElement("time");
  const created = new Date(admin.created_at);
  time.dateTime = admin.created_at;
  time.textContent = Number.isNaN(created.getTime()) ? admin.created_at : DATE_FORMAT.format(created);
  details.append(uid, time);
  row.append(details);

  if (admin.is_bootstrap) {
    const role = document.createElement("span");
    role.className = "onlineconf__admin-role";
    role.textContent = "Корневой администратор";
    row.append(role);
  } else {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "onlineconf__button onlineconf__button_danger";
    button.textContent = "Отозвать";
    button.setAttribute("aria-label", "Отозвать доступ у " + admin.profile_uid);
    button.addEventListener("click", () => onRevoke(button));
    row.append(button);
  }
  return row;
}

function mutationError(cause: unknown, fallback: string): string {
  if (!(cause instanceof OnlineConfHttpError)) {
    return cause instanceof Error ? cause.message : fallback;
  }
  if (cause.code === "csrf_failed") {
    return "Не удалось подтвердить сессию. Повторите действие.";
  }
  switch (cause.status) {
  case 400:
    return "Проверьте, что UUID принадлежит существующему аккаунту Nexly.";
  case 404:
    return "У этого пользователя уже нет дополнительных прав администратора.";
  case 409:
    return "У этого пользователя уже есть доступ к OnlineConf.";
  default:
    return fallback;
  }
}

/**
 * Подключает список и управление доступом к разделу администраторов.
 * @param panel Раздел администраторов OnlineConf.
 * @returns Обновляет список при открытии раздела.
 */
export function bindAdminManager(panel: HTMLElement): () => void {
  const form = element<HTMLFormElement>(panel, "form");
  const uid = element<HTMLInputElement>(form, "[name=profile_uid]");
  const submit = element<HTMLButtonElement>(form, "[type=submit]");
  const fieldError = element(form, "#onlineconf-admin-uid-error");
  const error = element(panel, "#onlineconf-admin-error");
  const feedback = element(panel, "#onlineconf-admin-feedback");
  const status = element(panel, "#onlineconf-admins-status");
  const retry = element<HTMLButtonElement>(panel, "#onlineconf-admins-retry");
  const list = element<HTMLUListElement>(panel, "#onlineconf-admins-list");
  let busy = false;
  let bootstrapUid: string | undefined;

  const showUidError = (message: string): void => {
    showMessage(fieldError, message);
    uid.setAttribute("aria-invalid", String(Boolean(message)));
  };

  const setBusy = (value: boolean): void => {
    busy = value;
    uid.disabled = value;
    submit.disabled = value;
    retry.disabled = value;
    list.querySelectorAll("button").forEach((button) => { button.disabled = value; });
  };

  const run = async (action: () => Promise<void>): Promise<void> => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const load = async (): Promise<void> => {
    list.hidden = true;
    retry.hidden = true;
    showMessage(status, "Загружаем администраторов…");
    try {
      const admins = await listAdmins();
      bootstrapUid = admins.find((admin) => admin.is_bootstrap)?.profile_uid;
      list.replaceChildren(...admins.map((admin) => renderAdmin(admin, (button) => {
        void revoke(admin, button);
      })));
      list.hidden = admins.length === 0;
      showMessage(status, admins.length ? "" : "Администраторов пока нет");
    } catch (cause) {
      if (!redirectOnAccessDenied(cause)) {
        const unavailable = cause instanceof OnlineConfHttpError && cause.status === 404;
        showMessage(status, unavailable
          ? "Управление администраторами пока недоступно на сервере."
          : "Не удалось загрузить администраторов.");
        retry.hidden = false;
      }
    }
  };

  const changeAccess = async (
    action: () => Promise<void>,
    success: string,
    failure: string,
  ): Promise<void> => {
    showMessage(error, "");
    showMessage(feedback, "");
    try {
      await action();
      showMessage(feedback, success);
      await load();
    } catch (cause) {
      if (!redirectOnAccessDenied(cause)) {
        showMessage(error, mutationError(cause, failure));
      }
    }
  };

  const revoke = async (admin: OnlineConfAdmin, button: HTMLButtonElement): Promise<void> => {
    await run(async () => {
      if (!await confirmDialog({
        message: "Отозвать доступ к OnlineConf у " + admin.profile_uid + "?",
        confirm: "Отозвать",
        cancel: "Отмена",
      })) {
        return;
      }
      await changeAccess(
        () => revokeAdmin(admin.profile_uid),
        "Доступ отозван.",
        "Не удалось отозвать доступ.",
      );
    });
    if (!panel.hidden) {
      (button.isConnected ? button : uid).focus();
    }
  };

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    if (busy) {
      return;
    }
    const profileUid = uid.value.trim().toLowerCase();
    showMessage(error, "");
    showMessage(feedback, "");
    if (!UUID_FORMAT.test(profileUid) || profileUid === bootstrapUid) {
      showUidError(profileUid === bootstrapUid
        ? "У корневого администратора уже есть доступ."
        : "Введите корректный UUID пользователя.");
      uid.focus();
      return;
    }
    void run(() => changeAccess(
      async () => {
        await grantAdmin(profileUid);
        uid.value = "";
      },
      "Доступ выдан.",
      "Не удалось выдать доступ.",
    ));
  });
  uid.addEventListener("input", () => {
    showUidError("");
    showMessage(error, "");
  });

  const refresh = (): void => { void run(load); };
  retry.addEventListener("click", refresh);
  return refresh;
}
