import { listEntries } from "./api";
import type { Entry } from "./api";
import { bindEntryEditor } from "./editor";
import "./index.scss";

const KIND_LABEL: Record<Entry["kind"], string> = {
  config: "Конфиг",
  flag: "Фича-флаг",
};

function createEntryRow(entry: Entry, openEditor: (entry: Entry) => void): HTMLTableRowElement {
  const row = document.createElement("tr");
  row.className = "onlineconf__entry";
  row.addEventListener("click", () => openEditor(entry));
  const button = document.createElement("button");
  button.type = "button";
  button.className = "onlineconf__entry-key";
  const name = document.createElement("code");
  name.textContent = `${entry.scope}.${entry.name}`;
  button.append(name);
  row.insertCell().append(button);
  row.insertCell().textContent = entry.scope;
  row.insertCell().textContent = KIND_LABEL[entry.kind];
  return row;
}

const filters = document.querySelector<HTMLFormElement>("#onlineconf-filters");
const table = document.querySelector<HTMLTableElement>("#onlineconf-entries");
const status = document.getElementById("onlineconf-status");
const retry = document.querySelector<HTMLButtonElement>("#onlineconf-retry");
const create = document.querySelector<HTMLButtonElement>("#onlineconf-create");
const editor = document.getElementById("onlineconf-editor");

if (filters && table && status && retry && create && editor) {
  const rows = table.tBodies[0];
  let listRequest: AbortController | undefined;

  const showStatus = (message: string, canRetry = false): void => {
    table.hidden = true;
    status.hidden = false;
    status.textContent = message;
    retry.hidden = !canRetry;
  };

  const refreshEntries = async (): Promise<void> => {
    listRequest?.abort();
    const request = new AbortController();
    listRequest = request;

    const values = new FormData(filters);
    const query = String(values.get("q") ?? "").trim();
    const scope = String(values.get("scope") ?? "");

    showStatus("Загружаем ключи…");
    try {
      const entries = await listEntries(query, scope, request.signal);
      if (request.signal.aborted) {
        return;
      }
      if (!entries.length) {
        showStatus(query || scope ? "Ключи не найдены" : "Ключей пока нет");
        return;
      }

      rows.replaceChildren(...entries.map((entry) => createEntryRow(entry, openEditor)));
      table.hidden = false;
      status.hidden = true;
    } catch {
      if (!request.signal.aborted) {
        showStatus("Не удалось загрузить ключи", true);
      }
    }
  };

  const openEditor = bindEntryEditor(editor, () => void refreshEntries());
  create.addEventListener("click", () => openEditor());
  filters.addEventListener("input", () => void refreshEntries());
  filters.addEventListener("submit", (event) => {
    event.preventDefault();
    void refreshEntries();
  });
  retry.addEventListener("click", () => void refreshEntries());
  void refreshEntries();
}
