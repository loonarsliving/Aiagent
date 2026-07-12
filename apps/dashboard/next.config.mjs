/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: [
    "@mkh/shared",
    "@mkh/database",
    "@mkh/security",
    "@mkh/connectors",
    "@mkh/notifications",
    "@mkh/ai-engine",
    "@mkh/scheduler",
  ],
};

export default nextConfig;
