import { confirmDialog } from "../components/Dialog/Dialog";
import { createEntry, deleteEntry, redirectOnAccessDenied, updateEntry } from "./api";
import type { Entry, EntryValue, JsonValue } from "./api";

const UUID_FORMAT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

function element<T extends HTMLElement>(root: HTMLElement, selector: string): T {
  const node = root.querySelector<T>(selector);
  if (!node) {
    throw new Error("Поле OnlineConf не найдено: " + selector);
  }
  return node;
}

function checkUserIds(text: string): { ids: string[]; error: string } {
  const lines = new Map<string, number>();
  let error = "";

  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const id = line.trim().toLowerCase();
    const lineNumber = index + 1;
    if (!id) {
      continue;
    }
    if (!UUID_FORMAT.test(id)) {
      error ||= "Строка " + lineNumber + ". Введите корректный UUID.";
      continue;
    }

    const firstLine = lines.get(id);
    if (firstLine === undefined) {
      lines.set(id, lineNumber);
    } else {
      error ||= "Строка " + lineNumber + ". UUID уже указан в строке " + firstLine + ".";
    }
  }

  return { ids: [...lines.keys()], error };
}

function showMessage(target: HTMLElement, message: string): void {
  if (target.textContent !== message) {
    target.textContent = message;
  }
  target.hidden = !message;
}

type FieldControl = HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;

/**
 * Подключает создание, редактирование и удаление флагов к форме OnlineConf.
 * @param panel Панель редактора.
 * @param onChanged Действие после успешного изменения списка ключей.
 * @returns Функция, открывающая форму для указанного или нового ключа.
 */
export function bindEntryEditor(panel: HTMLElement, onChanged: () => void): (entry?: Entry) => void {
  const form = element<HTMLFormElement>(panel, "form");
  const title = element(panel, "#onlineconf-editor-title");
  const scope = element<HTMLSelectElement>(form, "[name=scope]");
  const name = element<HTMLInputElement>(form, "[name=name]");
  const kind = element<HTMLSelectElement>(form, "[name=kind]");
  const json = element<HTMLTextAreaElement>(form, "[name=value]");
  const rollout = element<HTMLInputElement>(form, "[name=rollout]");
  const include = element<HTMLTextAreaElement>(form, "[name=include]");
  const exclude = element<HTMLTextAreaElement>(form, "[name=exclude]");
  const configFields = element(form, "#onlineconf-config-fields");
  const flagFields = element(form, "#onlineconf-flag-fields");
  const conflict = element(form, "#onlineconf-override-conflict");
  const error = element(form, "#onlineconf-editor-error");
  const save = element<HTMLButtonElement>(form, "[type=submit]");
  const cancel = element<HTMLButtonElement>(form, "#onlineconf-cancel");
  const remove = element<HTMLButtonElement>(form, "#onlineconf-delete");
  let editing: Entry | undefined;
  let busy = false;

  const showError = (message: string): void => showMessage(error, message);
  const showRequestError = (cause: unknown, fallback: string): void => {
    if (!redirectOnAccessDenied(cause)) {
      showError(cause instanceof Error ? cause.message : fallback);
    }
  };
  const fieldControls = [scope, name, json, rollout];

  const showFieldError = (field: FieldControl, message: string, invalid = Boolean(message)): void => {
    showMessage(element(form, "#onlineconf-" + field.name + "-error"), message);
    field.setAttribute("aria-invalid", String(invalid));
  };

  const showFields = (): void => {
    configFields.hidden = kind.value !== "config";
    flagFields.hidden = kind.value !== "flag";
  };

  const checkOverrides = (): {
    includeIds: string[];
    excludeIds: string[];
    invalidField?: HTMLTextAreaElement;
  } => {
    const included = checkUserIds(include.value);
    const excluded = checkUserIds(exclude.value);
    const excludedIds = new Set(excluded.ids);
    const overlap = included.ids.find((id) => excludedIds.has(id));

    const invalidInclude = Boolean(included.error || overlap);
    const invalidExclude = Boolean(excluded.error || overlap);
    showFieldError(include, included.error, invalidInclude);
    showFieldError(exclude, excluded.error, invalidExclude);
    showMessage(conflict, overlap
      ? "UUID " + overlap + " указан в обоих списках. Оставьте его в одном списке."
      : "");

    return {
      includeIds: included.ids,
      excludeIds: excluded.ids,
      invalidField: invalidInclude ? include : invalidExclude ? exclude : undefined,
    };
  };

  const setBusy = (value: boolean): void => {
    busy = value;
    save.disabled = value;
    cancel.disabled = value;
    remove.disabled = value;
  };

  const readValue = (): EntryValue | undefined => {
    if (kind.value === "config") {
      let value: JsonValue;
      try {
        value = JSON.parse(json.value) as JsonValue;
      } catch {
        showFieldError(json, "Введите корректное значение JSON.");
        json.focus();
        return;
      }
      showFieldError(json, "");
      return { kind: "config", value };
    }

    const percent = Number(rollout.value);
    const invalidPercent = !rollout.value || !Number.isInteger(percent) || percent < 0 || percent > 100;
    showFieldError(rollout, invalidPercent ? "Укажите целый процент от 0 до 100." : "");
    const overrides = checkOverrides();
    if (invalidPercent) {
      rollout.focus();
      return;
    }
    if (overrides.invalidField) {
      overrides.invalidField.focus();
      return;
    }

    return {
      kind: "flag",
      rollout: percent,
      include: overrides.includeIds,
      exclude: overrides.excludeIds,
    };
  };

  const submit = async (): Promise<void> => {
    if (busy) {
      return;
    }
    showError("");
    const keyName = name.value.trim();
    showFieldError(scope, scope.value ? "" : "Выберите скоуп.");
    showFieldError(name, keyName ? "" : "Введите имя ключа.");
    if (!scope.value || !keyName) {
      (scope.value ? name : scope).focus();
      return;
    }

    const value = readValue();
    if (!value) {
      return;
    }

    setBusy(true);
    save.textContent = "Сохраняем…";

    try {
      if (editing) {
        await updateEntry(editing.id, value);
      } else {
        await createEntry({ scope: scope.value, name: keyName, ...value });
      }
      panel.hidden = true;
      onChanged();
    } catch (cause) {
      showRequestError(cause, "Не удалось сохранить ключ");
    } finally {
      setBusy(false);
      save.textContent = "Сохранить";
    }
  };

  const removeFlag = async (): Promise<void> => {
    const entry = editing;
    if (busy || entry?.kind !== "flag") {
      return;
    }
    setBusy(true);
    showError("");
    try {
      const confirmed = await confirmDialog({
        message: "Удалить фича-флаг «" + entry.scope + "." + entry.name + "»? Продукт будет использовать значение по умолчанию.",
        confirm: "Удалить",
        cancel: "Отмена",
      });
      if (!confirmed) {
        return;
      }

      await deleteEntry(entry.id);
      panel.hidden = true;
      onChanged();
    } catch (cause) {
      showRequestError(cause, "Не удалось удалить флаг");
    } finally {
      setBusy(false);
      if (!panel.hidden) {
        remove.focus();
      }
    }
  };

  for (const field of fieldControls) {
    field.addEventListener("input", () => showFieldError(field, ""));
  }

  kind.addEventListener("change", showFields);
  include.addEventListener("input", checkOverrides);
  exclude.addEventListener("input", checkOverrides);
  remove.addEventListener("click", () => void removeFlag());
  cancel.addEventListener("click", () => { panel.hidden = true; });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void submit();
  });

  return (entry) => {
    if (busy) {
      return;
    }
    editing = entry;
    form.reset();
    showError("");
    for (const field of fieldControls) {
      showFieldError(field, "");
    }
    title.textContent = entry ? "Редактирование ключа" : "Новый ключ";
    remove.hidden = entry?.kind !== "flag";
    for (const field of [scope, name, kind]) {
      field.disabled = Boolean(entry);
    }

    if (entry) {
      scope.value = entry.scope;
      name.value = entry.name;
      kind.value = entry.kind;
      if (entry.kind === "config") {
        json.value = JSON.stringify(entry.value, null, 2);
      } else {
        rollout.value = String(entry.rollout);
        include.value = entry.include.join("\n");
        exclude.value = entry.exclude.join("\n");
      }
    }

    showFields();
    checkOverrides();
    panel.hidden = false;
    if (entry) {
      (entry.kind === "config" ? json : rollout).focus();
    } else {
      scope.focus();
    }
  };
}
