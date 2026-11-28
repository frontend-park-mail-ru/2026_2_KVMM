import { listEntries } from "./api";
import type { Entry } from "./api";
import "./index.scss";

const KIND_LABEL: Record<Entry["kind"], string> = {
  config: "Конфиг",
  flag: "Фича-флаг",
};

function createEntryRow(entry: Entry): HTMLTableRowElement {
  const row = document.createElement("tr");
  const name = document.createElement("code");
  name.textContent = `${entry.scope}.${entry.name}`;
  row.insertCell().append(name);
  row.insertCell().textContent = entry.scope;
  row.insertCell().textContent = KIND_LABEL[entry.kind];
  return row;
}

const filters = document.querySelector<HTMLFormElement>("#onlineconf-filters");
const table = document.querySelector<HTMLTableElement>("#onlineconf-entries");
const status = document.getElementById("onlineconf-status");
const retry = document.querySelector<HTMLButtonElement>("#onlineconf-retry");

if (filters && table && status && retry) {
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

      rows.replaceChildren(...entries.map(createEntryRow));
      table.hidden = false;
      status.hidden = true;
    } catch {
      if (!request.signal.aborted) {
        showStatus("Не удалось загрузить ключи", true);
      }
    }
  };

  filters.addEventListener("input", () => void refreshEntries());
  filters.addEventListener("submit", (event) => {
    event.preventDefault();
    void refreshEntries();
  });
  retry.addEventListener("click", () => void refreshEntries());
  void refreshEntries();
}
