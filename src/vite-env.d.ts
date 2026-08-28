/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_USE_MOCK: string;
  readonly VITE_TDENGINE_TARGET: string;
  readonly VITE_TDENGINE_BASE_URL: string;
  readonly VITE_TDENGINE_AUTH: string;
  readonly VITE_TDENGINE_DATABASE: string;
  readonly VITE_TDENGINE_STABLE: string;
  readonly VITE_TDENGINE_TEMP_FIELD: string;
  readonly VITE_TDENGINE_TS_FIELD: string;
  readonly VITE_TDENGINE_POLL_INTERVAL: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
