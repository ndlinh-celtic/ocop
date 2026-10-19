import path from "node:path";
import type { NextConfig } from "next";

const config: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(import.meta.dirname, "../.."),
  transpilePackages: ["@ocop/core", "@ocop/infra", "@ocop/ui"],
  serverExternalPackages: ["pg", "pg-boss", "@node-rs/argon2"],
  poweredByHeader: false,
};

export default config;
