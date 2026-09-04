import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Proxy API calls to the backend during development
    proxy: {
      "/api": {
        target: "sap-poc-api.cfapps.us10-001.hana.ondemand.com",
        changeOrigin: true,
      },
      "/auth": {
        target: "sap-poc-api.cfapps.us10-001.hana.ondemand.com",
        changeOrigin: true,
      },
    },
  },
});
