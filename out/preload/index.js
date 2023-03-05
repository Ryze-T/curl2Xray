"use strict";
const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("xAPI", {
  curlScan: (curls) => ipcRenderer.invoke("curlScan", curls),
  logSender: (callback) => ipcRenderer.on("log-sender", callback),
  xraySender: (callback) => ipcRenderer.on("xray-sender", callback),
  xrayStart: (callback) => ipcRenderer.invoke("xray-start", callback),
  xrayStop: () => ipcRenderer.invoke("xray-stop"),
  xrayRes: (callback) => ipcRenderer.on("xray-res", callback),
  pathGet: (path) => ipcRenderer.on("path-get", path),
  pathSet: (path) => ipcRenderer.invoke("path-set", path),
  pathExist: (status) => ipcRenderer.on("path-exist", status)
});
