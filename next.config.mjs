/** @type {import('next').NextConfig} */
const nextConfig = {
  // Silence warnings
  // https://github.com/WalletConnect/walletconnect-monorepo/issues/1908
  webpack: (config) => {
    config.externals.push("pino-pretty", "lokijs", "encoding");
    return config;
  },
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'imagedelivery.net' },
      { protocol: 'https', hostname: 'i.imgur.com' },
      { protocol: 'https', hostname: '**.warpcast.com' },
      { protocol: 'https', hostname: 'api.dicebear.com' },
      { protocol: 'https', hostname: 'tba-mobile.mypinata.cloud' },
      { protocol: 'https', hostname: 'farcaster.xyz' },
      { protocol: 'https', hostname: 'ipfs.decentralized-content.com' },
    ],
  },
};

export default nextConfig;
