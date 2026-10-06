// Runs the API server (restarting when its source changes) and the Vite dev server together.
import { spawn } from "node:child_process";
import { watch } from "node:fs";

let server;
let restartTimer;
const startServer = () => {
  server = spawn(process.execPath, ["--env-file-if-exists=.env", "server/index.js"], { stdio: "inherit" });
};
const restartServer = () => {
  clearTimeout(restartTimer);
  restartTimer = setTimeout(() => {
    console.log("[dev] source changed — restarting API server");
    server.once("exit", startServer);
    server.kill();
  }, 150);
};

// Node's --watch also reacts to SQLite's journal files on macOS, so watch source folders ourselves.
for (const dir of ["server", "src/lib", "src/data"]) {
  watch(dir, { recursive: true }, (_event, file) => file?.endsWith(".js") && restartServer());
}

startServer();
const vite = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["vite"], { stdio: "inherit" });

const stop = () => { server?.kill(); vite.kill(); process.exit(0); };
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
vite.on("exit", stop);
