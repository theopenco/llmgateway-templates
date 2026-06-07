import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Transpile the workspace SDK packages so Next bundles them from source.
  transpilePackages: [
    "@llmgateway/client",
    "@llmgateway/elements",
    "@llmgateway/server",
  ],
};

export default nextConfig;
