module.exports = {
  reactStrictMode: true,
  output: 'export',
  basePath: process.env.NODE_ENV == "development" ? "" : "/kata-dashboard-next",
  images: {
    unoptimized: true,
  }
}
