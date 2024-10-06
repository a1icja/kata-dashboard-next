module.exports = {
  reactStrictMode: true,
  output: 'export',
  basePath: "/kata-dashboard-next",
  images: {
    unoptimized: true,
  },
  webpack: (config, { dev }) => {
    if (dev) {
      config.devtool = false;
    }
    return config;
  },
  // publicRuntimeConfig: {
  //   basePath: '/kata-dashboard-next',
  // },
}
