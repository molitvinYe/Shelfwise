import type { NextConfig } from 'next';
import { getServerEnv } from './lib/env';

const env = getServerEnv();

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  // One origin for the browser: /api/* is proxied to the NestJS API (docs/adr/0002).
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${env.API_ORIGIN}/:path*`,
      },
    ];
  },
};

export default nextConfig;
