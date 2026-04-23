import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
const workspaceRoot = path.resolve(__dirname, "../..");
export default defineConfig({
    envDir: workspaceRoot,
    plugins: [react()],
    server: {
        host: "127.0.0.1",
        port: 5173,
        strictPort: true,
    },
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
            "@yunwu/shared": path.resolve(__dirname, "../../packages/shared/src"),
        },
    },
});
