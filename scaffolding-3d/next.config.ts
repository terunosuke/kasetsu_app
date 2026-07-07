import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // このフォルダを単独のプロジェクトとして扱う（親の旧アプリの package-lock.json を無視）。
  // Vercel で Root Directory = scaffolding-3d としてデプロイする際の警告・誤検出を防ぐ。
  outputFileTracingRoot: path.join(__dirname),
};

export default nextConfig;
