/** @type {import('next').NextConfig} */
const nextConfig = {
  async headers() {
    return [
      {
        source: '/v1/:path*',
        headers: [
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET, POST, PATCH, OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Content-Type, Authorization, X-API-Key' },
        ],
      },
    ];
  },
  async rewrites() {
    return [
      // Clean API routes: /v1/score/:id → /api/v1/score/[id]
      { source: '/v1/score/:id', destination: '/api/v1/score/:id' },
      { source: '/v1/search', destination: '/api/v1/search' },
      { source: '/v1/register', destination: '/api/v1/register' },
      { source: '/v1/rate/:id', destination: '/api/v1/rate/:id' },
      { source: '/v1/agents/:id', destination: '/api/v1/agents/:id' },
      { source: '/v1/leaderboard', destination: '/api/v1/leaderboard' },
    ];
  },
};

module.exports = nextConfig;
