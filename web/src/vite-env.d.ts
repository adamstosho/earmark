/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NETWORK?: string;
  readonly VITE_POCKETS_ADDRESS?: string;
  readonly VITE_DEPLOY_BLOCK?: string;
  readonly VITE_RPC_URL?: string;
  readonly VITE_DEMO_POCKET_ID?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
