/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // exFAT/FAT volumes return EISDIR (not EINVAL) for readlink on regular
  // files, which crashes webpack's symlink resolution. This repo uses no
  // symlinks, so skip readlink entirely.
  webpack: (config) => {
    config.resolve.symlinks = false;
    return config;
  },
  async redirects() {
    // Wallet and Profile are merged into /mine; Promotion is the referral hub.
    return [
      { source: "/wallet", destination: "/mine", permanent: false },
      { source: "/profile", destination: "/mine", permanent: false },
      { source: "/promotion", destination: "/referral", permanent: false },
    ];
  },
};

export default nextConfig;
