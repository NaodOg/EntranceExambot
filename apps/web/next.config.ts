import type { NextConfig } from "next";
import path from "path";
import { fileURLToPath } from "url";

// next.config.ts is loaded as ESM, so __dirname is not defined here.
const dirname = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  transpilePackages: ["convex"],
  turbopack: {
    resolveAlias: {
      "convex/_generated": path.join(dirname, "../../convex/_generated"),
    },
  },
};

export default nextConfig;
