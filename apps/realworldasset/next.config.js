const isGitHubPages = process.env.GITHUB_ACTIONS === "true";
const basePath = process.env.RWA_BASE_PATH || (isGitHubPages ? "/rwa" : "");

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  output: "export",
  trailingSlash: true,
  images: { unoptimized: true },
  basePath,
  assetPrefix: basePath,
  typescript: { ignoreBuildErrors: true },
};

module.exports = nextConfig;
