import { defineConfig } from "@playwright/test";

// 连接已在运行的生产服务（先 `pnpm build && pnpm exec next start -H 127.0.0.1 -p 3417`），不由 Playwright 启动。
const baseURL = process.env.E2E_BASE_URL ?? "http://127.0.0.1:3417";
// PLAYWRIGHT_BROWSERS_PATH 由 Playwright 自行读取；E2E_CHROMIUM_PATH 可显式指定 Chromium 可执行文件。
const executablePath = process.env.E2E_CHROMIUM_PATH || undefined;

export default defineConfig({
  testDir: "./e2e",
  timeout: 900_000,
  expect: { timeout: 15_000 },
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL,
    viewport: { width: 1360, height: 900 },
    launchOptions: { args: ["--no-sandbox"], ...(executablePath ? { executablePath } : {}) },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
});
