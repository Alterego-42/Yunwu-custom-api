import { contextBridge, ipcRenderer } from "electron";

contextBridge.exposeInMainWorld("yunwuDesktop", {
  getStatus: () => ipcRenderer.invoke("desktop:get-status"),
  retry: () => ipcRenderer.invoke("desktop:retry"),
  openWorkbench: () => ipcRenderer.invoke("desktop:open-workbench"),
  openAdmin: () => ipcRenderer.invoke("desktop:open-admin"),
  openUserData: () => ipcRenderer.invoke("desktop:open-user-data"),
  onStatus: (callback: (status: unknown) => void) => {
    const listener = (_event: Electron.IpcRendererEvent, status: unknown) => callback(status);
    ipcRenderer.on("desktop:status", listener);
    return () => ipcRenderer.removeListener("desktop:status", listener);
  }
});
