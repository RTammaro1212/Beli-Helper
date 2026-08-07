import { execFile } from "node:child_process";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const tileRankingAppsScript = String.raw`
const systemEvents = Application("System Events");
const currentApp = Application.currentApplication();
currentApp.includeStandardAdditions = true;

function runningProcessNames() {
    return systemEvents.applicationProcesses.name();
}

function focusChromiumLocalhostTab(appName) {
    const browser = Application(appName);
    const windows = browser.windows();

    for (let windowIndex = 0; windowIndex < windows.length; windowIndex += 1) {
        const tabs = windows[windowIndex].tabs();
        for (let tabIndex = 0; tabIndex < tabs.length; tabIndex += 1) {
            const url = tabs[tabIndex].url();
            if (typeof url === "string" && url.includes("localhost")) {
                windows[windowIndex].activeTabIndex = tabIndex + 1;
                windows[windowIndex].index = 1;
                browser.activate();
                return true;
            }
        }
    }

    return false;
}

function focusSafariLocalhostTab() {
    const browser = Application("Safari");
    const windows = browser.windows();

    for (let windowIndex = 0; windowIndex < windows.length; windowIndex += 1) {
        const tabs = windows[windowIndex].tabs();
        for (let tabIndex = 0; tabIndex < tabs.length; tabIndex += 1) {
            const url = tabs[tabIndex].url();
            if (typeof url === "string" && url.includes("localhost")) {
                windows[windowIndex].currentTab = tabs[tabIndex];
                windows[windowIndex].index = 1;
                browser.activate();
                return true;
            }
        }
    }

    return false;
}

function findLocalhostBrowser() {
    const processes = runningProcessNames();
    const chromiumBrowsers = [
        "Google Chrome",
        "Arc",
        "Brave Browser",
        "Microsoft Edge",
    ];

    for (const appName of chromiumBrowsers) {
        if (processes.includes(appName) && focusChromiumLocalhostTab(appName)) {
            return appName;
        }
    }

    if (processes.includes("Safari") && focusSafariLocalhostTab()) {
        return "Safari";
    }

    throw new Error("No open browser tab with a localhost URL was found.");
}

function waitForProcess(processName) {
    for (let attempt = 0; attempt < 50; attempt += 1) {
        const process = systemEvents.applicationProcesses.byName(processName);
        if (process.exists()) return process;
        delay(0.2);
    }

    throw new Error(processName + " did not open.");
}

const browserName = findLocalhostBrowser();
currentApp.doShellScript("/usr/bin/open -a 'iPhone Mirroring'");
const phoneProcess = waitForProcess("iPhone Mirroring");
delay(1);

const desktopBounds = Application("Finder").desktop.window.bounds();
const left = desktopBounds[0];
const top = desktopBounds[1] + 25;
const width = desktopBounds[2] - desktopBounds[0];
const height = desktopBounds[3] - top;
const leftWidth = Math.floor(width / 2);
const rightWidth = width - leftWidth;

const browserProcess = systemEvents.applicationProcesses.byName(browserName);
browserProcess.frontmost = true;
browserProcess.windows[0].position = [left, top];
browserProcess.windows[0].size = [leftWidth, height];

phoneProcess.windows[0].position = [left + leftWidth, top];
phoneProcess.windows[0].size = [rightWidth, height];
phoneProcess.frontmost = true;
`;

export async function openRankingWorkspace() {
    if (process.platform !== "darwin") {
        throw new Error("The ranking workspace requires macOS.");
    }

    await execFileAsync(
        "/usr/bin/osascript",
        ["-l", "JavaScript", "-e", tileRankingAppsScript],
        { timeout: 20_000 },
    );
}
