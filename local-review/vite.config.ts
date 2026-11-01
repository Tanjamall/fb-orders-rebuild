import { defineConfig, mergeConfig } from "vite";
import base from "../vite.config.ts";
export default defineConfig((env) =>
  mergeConfig(typeof base === "function" ? base(env) : base, {
    define: {
      "import.meta.env.VITE_DATA_MODE": JSON.stringify("demo"),
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(""),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(""),
    },
    server: {
      host: "127.0.0.1",
      port: 5186,
      strictPort: true,
      headers: {
        "Content-Security-Policy":
          "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws://127.0.0.1:5186; frame-src 'none'; form-action 'none'",
      },
    },
  }),
);
