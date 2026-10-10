const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("hakStore", {
  load: () => ipcRenderer.sendSync("store-load"),
  save: (str) => ipcRenderer.sendSync("store-save", str),
  info: () => ipcRenderer.sendSync("store-info"),
  openFolder: () => ipcRenderer.send("open-data-folder")
});
