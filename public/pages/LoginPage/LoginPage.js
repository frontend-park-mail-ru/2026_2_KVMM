function template() {
  return `
    <main class="page page_auth">
      <h1 class="logo">KVMM</h1>
      <p>Вход — в разработке</p>
      <a href="/signup" data-link>Зарегистрироваться</a>
    </main>
  `;
}

export class LoginPage {
  #parent;

  constructor(parent) {
    this.#parent = parent;
  }

  render() {
    this.#parent.insertAdjacentHTML("beforeend", template());
  }
}
