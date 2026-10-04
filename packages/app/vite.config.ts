import react from "@vitejs/plugin-react"
import { defineConfig } from "vite"

export default defineConfig({
    plugins: [react()],
    server: { port: 5173 },
    build: { outDir: "dist", target: "es2020" },
    // MapLibre's worker is an ES module (it shares code with the map chunk).
    worker: { format: "es" },
})
