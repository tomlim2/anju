import type { NextConfig } from "next";
import path from "node:path";

const converterDir = path.resolve(__dirname, "../Typescript/src");

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname, ".."),
  serverExternalPackages: ["sharp"],
  experimental: {
    serverActions: {
      bodySizeLimit: "200mb",
    },
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Allow webpack to resolve TS files from the converter directory
      config.resolve = config.resolve ?? {};
      config.resolve.alias = {
        ...config.resolve.alias,
        "@converter": converterDir,
      };

      // Resolve .ts files when imported as .js (ESM convention in converter)
      config.resolve.extensionAlias = {
        ...config.resolve.extensionAlias,
        ".js": [".ts", ".js"],
      };

      // Externalize sharp — it's a native module, not bundleable
      const existingExternals = config.externals ?? [];
      config.externals = [
        ...(Array.isArray(existingExternals) ? existingExternals : [existingExternals]),
        "sharp",
      ];
    }
    return config;
  },
};

export default nextConfig;
