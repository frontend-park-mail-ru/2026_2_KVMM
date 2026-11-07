import "./index.scss";
import { api, isSession } from "./modules/api";
import { user } from "./modules/user";
import { Router } from "./modules/router";
import { LoginPage } from "./pages/LoginPage/LoginPage";
import { SignupPage } from "./pages/SignupPage/SignupPage";
import { FeedPage } from "./pages/FeedPage/FeedPage";
import { EmailCodePage } from "./pages/EmailCodePage/EmailCodePage";
import { SIGNUP_STEPS, signupDraft } from "./modules/signupDraft";
import type { Route } from "./modules/router";

const signupRoutes = Object.fromEntries(
  SIGNUP_STEPS.map((path, index) => [
    path,
    { page: SignupPage, auth: index > 0 },
  ]),
);

const routes: Record<string, Route> = {
  "/login": { page: LoginPage, auth: false },
  ...signupRoutes,
  "/signup/code": {
    page: EmailCodePage,
    auth: true,
    redirect: () => (signupDraft.pendingEmail() ? null : SIGNUP_STEPS[1]),
  },
  "/feed": { page: FeedPage, auth: true },
};

const router = new Router(
  document.getElementById("root") as HTMLElement,
  routes,
);

const { status, data } = await api.me();
if (status === 200 && isSession(data)) {
  user.set(data);
}

router.start();
