function template() {
  return `
    <main class="page page_auth">
      <h1 class="logo">KVMM</h1>
      <p>Регистрация — в разработке</p>
      <a href="/login" data-link>Войти</a>
    </main>
  `;
}

export class SignupPage {
  #parent;

  constructor(parent) {
    this.#parent = parent;
  }

  render() {
    this.#parent.insertAdjacentHTML("beforeend", template());
  }
}
