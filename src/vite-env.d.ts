/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCK: string;
  readonly VITE_DATA_SOURCE: string;
  readonly VITE_GATEWAY_BASE_URL: string;
  readonly VITE_GATEWAY_USERNAME: string;
  readonly VITE_GATEWAY_PASSWORD: string;
  readonly VITE_APP_TITLE: string;
  readonly VITE_STORAGE_ID: string;
  readonly VITE_STORAGE_NAME: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
