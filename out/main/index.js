"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const icon = path.join(__dirname, "../../resources/icon.png");
const curlConverter = require("curlconverter");
const request = require("request");
const { spawn } = require("child_process");
const http = require("http");
const util = require("util");
const Store = require("electron-store");
const fs = require("fs");
var pid = 0;
const store = new Store();
function xrayExist(file) {
  return fs.existsSync(file + "/xray");
}
function webhookHandle(win) {
  var server = http.createServer(function(req, rsp) {
    let data = [];
    req.on("data", (chunk) => {
      data.push(chunk);
    });
    req.on("end", () => {
      var jsonData = JSON.parse(data);
      if (jsonData.type == "web_vuln" || jsonData.type == "host_vuln") {
        var res = util.format('{"addr":"%s","payload":"%s","plugin":"%s"}', jsonData.data.detail.addr, jsonData.data.detail.payload, jsonData.data.plugin);
        win.webContents.send("xray-res", res);
      }
      if (jsonData.type == "web_statistic") {
        if (jsonData.data.num_found_urls == 0) {
          win.webContents.send("log-sender", "扫描结束");
        }
      }
    });
  });
  server.listen(10001);
  console.log("Sever Running At http://localhost:10001");
}
function xraying(win, path2) {
  if (pid == 0 || pid == void 0) {
    const xray = spawn("./xray", ["webscan", "-listen", "127.0.0.1:10000", "--webhook-output", "http://localhost:10001"], { cwd: path2 });
    xray.unref();
    pid = xray.pid;
    xray.stdout.on("data", (data) => {
      win.webContents.send("xray-sender", `${data}`);
    });
    xray.on("close", (code) => {
      win.webContents.send("xray-sender", `child process exited with code ${code}`);
    });
  } else {
    win.webContents.send("log-sender", "xray 已开启，请关闭");
  }
}
function xrayStop() {
  if (pid != 0) {
    process.kill(pid);
  }
  pid = 0;
}
function httpSender(curlCmd, id, win) {
  const proxy = "http://127.0.0.1:10000";
  var json = false;
  var curl = JSON.parse(curlCmd);
  console.log(curl);
  if (curl.method == "get") {
    request({
      url: curl.raw_url,
      method: curl.method,
      headers: curl.headers,
      proxy,
      rejectUnauthorized: false
    }, (err, rep, body) => {
      if (err) {
        win.webContents.send("log-sender", id + " 错误: " + err);
      }
      if (body) {
        if (rep.statusCode != 200) {
          win.webContents.send("log-sender", id + " 状态码异常: " + rep.statusCode);
        }
      }
    });
  } else {
    const postData = JSON.parse(Object.keys(curl.data)[0]);
    if (curl.headers.hasOwnProperty("Content-Type")) {
      if (curl.headers["Content-Type"] == "application/json") {
        json = true;
      }
    }
    request({
      url: curl.raw_url,
      method: curl.method,
      headers: curl.headers,
      body: postData,
      json,
      proxy,
      rejectUnauthorized: false
    }, (err, rep, body) => {
      if (err) {
        win.webContents.send("log-sender", id + "错误: " + err);
      }
      if (body) {
        if (rep.statusCode != 200) {
          win.webContents.send("log-sender", id + " 状态码异常: " + rep.statusCode);
        }
      }
    });
  }
}
function createWindow() {
  const mainWindow = new electron.BrowserWindow({
    width: 800,
    height: 790,
    show: false,
    ...process.platform === "linux" ? { icon } : {},
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js")
    }
  });
  webhookHandle(mainWindow);
  electron.ipcMain.handle("curlScan", (event, msg) => {
    const curlObject = JSON.parse(msg);
    const curlsNum = Object.keys(curlObject).length;
    if (curlsNum > 1 || curlObject[0] != "") {
      for (var i = 0; i < curlObject.length; i++) {
        var curlCmd = curlConverter.toJsonString(curlObject[i]);
        curlCmd.replace("\\\\n", "");
        httpSender(curlCmd, i, mainWindow);
      }
    }
  });
  electron.ipcMain.handle("xray-start", (event, msg) => {
    xraying(mainWindow, msg);
  });
  electron.ipcMain.handle("xray-stop", xrayStop);
  electron.ipcMain.handle("path-set", (event, msg) => {
    store.set("xpath", msg);
    mainWindow.webContents.send("path-exist", xrayExist(msg));
  });
  mainWindow.on("ready-to-show", () => {
    const xpath = store.get("xpath");
    mainWindow.webContents.send("path-get", xpath);
    mainWindow.webContents.send("path-exist", xrayExist(xpath));
    mainWindow.show();
  });
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
}
electron.app.whenReady().then(() => {
  utils.electronApp.setAppUserModelId("com.electron");
  electron.app.on("browser-window-created", (_, window) => {
    utils.optimizer.watchWindowShortcuts(window);
  });
  createWindow();
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0)
      createWindow();
  });
});
electron.app.on("window-all-closed", () => {
  electron.app.quit();
});
