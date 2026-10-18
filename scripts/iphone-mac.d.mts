export type IphoneAccessOptions = {
  projectDir?: string;
  signal?: AbortSignal;
  dataDirectory?: string;
  tailscaleBin?: string;
  port?: number;
  platform?: string;
  fetchImpl?: typeof fetch;
  onMessage?: (message: string) => void;
  openBrowser?: boolean;
  preventSleep?: boolean;
  readinessTimeoutMs?: number;
};
export function startIphoneAccess(options?: IphoneAccessOptions): Promise<{
  url: string;
  stop: () => Promise<void>;
  closed: Promise<void>;
}>;
