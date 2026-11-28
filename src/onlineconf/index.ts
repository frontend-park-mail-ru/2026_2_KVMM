import "./index.scss";

const root = document.getElementById("onlineconf");

if (root) {
  root.innerHTML = `
    <header class="onlineconf__header">
      <div class="onlineconf__container">
        <a class="onlineconf__home" href="/">Nexly</a>
      </div>
    </header>
    <main class="onlineconf__container onlineconf__main">
      <h1 class="onlineconf__title">OnlineConf</h1>
      <p class="onlineconf__description">Настройки и фича-флаги Nexly</p>
    </main>
  `;
}
