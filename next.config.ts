import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Every screen sits behind login and shows live data, so pages render
  // per request instead of using Cache Components' static shells.
  cacheComponents: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
