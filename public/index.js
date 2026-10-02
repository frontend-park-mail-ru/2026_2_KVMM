import { api } from "./modules/api.js";
import { user } from "./modules/user.js";
import { Router } from "./modules/router.js";
import { LoginPage } from "./pages/LoginPage/LoginPage.js";
import { SignupPage } from "./pages/SignupPage/SignupPage.js";
import { FeedPage } from "./pages/FeedPage/FeedPage.js";

const routes = {
  "/login": { page: LoginPage, auth: false },
  "/signup": { page: SignupPage, auth: false },
  "/feed": { page: FeedPage, auth: true },
};

const router = new Router(document.getElementById("root"), routes);

const { status, data } = await api.me();
if (status === 200) {
  user.set(data);
}

router.start();
