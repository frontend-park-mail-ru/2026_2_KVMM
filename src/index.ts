import "./index.css";
import { api } from "./modules/api";
import type { Session } from "./modules/api";
import { user } from "./modules/user";
import { Router } from "./modules/router";
import { LoginPage } from "./pages/LoginPage/LoginPage";
import { SignupPage } from "./pages/SignupPage/SignupPage";
import { FeedPage } from "./pages/FeedPage/FeedPage";
import { SIGNUP_STEPS, signupRedirect } from "./modules/signupDraft";

const signupRoutes = Object.fromEntries(
  SIGNUP_STEPS.map((path) => [
    path,
    { page: SignupPage, auth: false, redirect: signupRedirect },
  ]),
);

const routes = {
  "/login": { page: LoginPage, auth: false },
  ...signupRoutes,
  "/feed": { page: FeedPage, auth: true },
};

const router = new Router(
  document.getElementById("root") as HTMLElement,
  routes,
);

const { status, data } = await api.me();
if (status === 200) {
  user.set(data as Session);
}

router.start();
