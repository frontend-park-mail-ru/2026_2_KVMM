declare module "*.svg" {
  const url: string;
  export default url;
}

declare module "*.scss";

declare const SERVICE_WORKER: boolean;
declare const ONLINECONF_DEV_MOCK: boolean;
