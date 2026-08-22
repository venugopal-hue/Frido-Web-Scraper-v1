/** @type {import('next').NextConfig} */
const nextConfig = {
  images: { remotePatterns: [{ protocol: 'https', hostname: 'cdn.shopify.com' }] },
  async rewrites() {
    // Proxy API calls to the Express backend so the browser sees same-origin.
    // Defaults to the deployed API so a fresh clone works without any local
    // backend. Override with API_BASE_URL to point at one.
    const target = process.env.API_BASE_URL ?? 'https://frido-web-scraper-v1.onrender.com';
    return [{ source: '/api/:path*', destination: `${target}/api/:path*` }];
  },
};
export default nextConfig;
