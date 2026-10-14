/** Ambient declarations for browser extension globals and Vite ?url imports. */

declare const chrome: {
  storage: {
    local: {
      get<T = Record<string, unknown>>(keys: string | string[] | null): Promise<T>;
      set(items: Record<string, unknown>): Promise<void>;
      remove(keys: string | string[]): Promise<void>;
    };
  };
  runtime?: {
    onMessage?: any;
    id?: string;
  };
};

declare module "*?url" {
  const src: string;
  export default src;
}
