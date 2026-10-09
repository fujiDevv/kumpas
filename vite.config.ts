import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";
import { responseStoreServiceBinding } from "./cloudflare.config.ts";
import { responseStoreAdapter } from "@vinext/cloudflare/cache/response-store-adapter";
import { imagesOptimizer } from "@vinext/cloudflare/images/images-optimizer";

export default defineConfig({
  plugins: [
    vinext({
      cache: responseStoreAdapter(),
      images: { optimizer: imagesOptimizer() },
    }),
    cloudflare({
      auxiliaryWorkers: [{ config: responseStoreServiceBinding }],
      viteEnvironment: {
        name: "rsc",
        childEnvironments: ["ssr"],
      },
    }),
  ],
});
