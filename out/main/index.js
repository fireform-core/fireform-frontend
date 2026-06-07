"use strict";
const electron = require("electron");
const path = require("path");
const child_process = require("child_process");
let backendProcess = null;
function startBackend() {
  if (electron.app.isPackaged) {
    const ext = process.platform === "win32" ? ".exe" : "";
    const backendPath = path.join(process.resourcesPath, "bin", `api-backend${ext}`);
    backendProcess = child_process.spawn(backendPath, [], { stdio: "ignore" });
    backendProcess.on("error", (err) => {
      console.error("Failed to start backend process.", err);
    });
  } else {
    console.log("Development mode: backend assumed running via Docker.");
  }
}
function createWindow() {
  const win = new electron.BrowserWindow({
    width: 1100,
    height: 800,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js")
    }
  });
  win.webContents.session.setPermissionRequestHandler(
    (_webContents, permission, callback) => {
      callback(permission === "media");
    }
  );
  if (electron.app.isPackaged) {
    win.loadFile(path.join(__dirname, "../../renderer/index.html"));
  } else {
    win.loadURL(process.env["ELECTRON_RENDERER_URL"]);
    win.webContents.openDevTools();
  }
}
electron.app.whenReady().then(() => {
  startBackend();
  createWindow();
});
electron.app.on("will-quit", () => {
  backendProcess?.kill();
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") electron.app.quit();
});
electron.app.on("activate", () => {
  if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
});
