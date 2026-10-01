import { user } from "../../modules/user.js";
import { escapeHtml } from "../../modules/utils.js";

function template({ name }) {
  return `
    <main class="page page_feed">
      <h1 class="logo">KVMM</h1>
      <p>Лента — в разработке. Вы вошли как ${escapeHtml(name)}</p>
    </main>
  `;
}

export class FeedPage {
  #parent;

  constructor(parent) {
    this.#parent = parent;
  }

  render() {
    const { profile_name: firstName, surname } = user.profile;
    this.#parent.insertAdjacentHTML(
      "beforeend",
      template({ name: `${firstName} ${surname}` }),
    );
  }
}
