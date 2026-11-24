declare namespace App {
  interface Locals {
    userId: string | null;
  }
}

interface ImportMetaEnv {
  readonly PUBLIC_CLERK_PUBLISHABLE_KEY?: string;
  readonly TRAVIZ_NODE_SERVER?: boolean;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "server-only" {}

declare module "virtual:traviz-app-script" {
  const appScript: string;

  export default appScript;
}
