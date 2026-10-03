import { defineConfig, devices } from "@playwright/test"

import { APP_URL } from "./stand/config.js"

/**
 * End-to-end checks of every user path on the local stand. The specs share one database,
 * so they run one after another; each spec file starts from fresh demo data.
 */
export default defineConfig({
    testDir: "./specs",
    fullyParallel: false,
    workers: 1,
    retries: 0,
    timeout: 60_000,
    expect: { timeout: 10_000 },
    reporter: [["list"], ["html", { open: "never", outputFolder: "report" }]],
    outputDir: "test-results",
    use: {
        ...devices["Pixel 7"],
        baseURL: APP_URL,
        locale: "ru-RU",
        timezoneId: "Asia/Tashkent",
        // An action that waits for an element fails in 15 s with its own message, not at the
        // 1-minute test timeout.
        actionTimeout: 15_000,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },
    // CI uses the Google Chrome already on GitHub's runners: no browser download.
    projects: [
        {
            name: "telegram-android",
            use: { browserName: "chromium", channel: process.env["CI"] ? "chrome" : undefined },
        },
    ],
    webServer: {
        command: "bun stand/run.ts",
        url: APP_URL,
        reuseExistingServer: true,
        timeout: 240_000,
        stdout: "pipe",
    },
})
