const config = {
  app: {
    name: 'MyCars',
    port: parseInt(process.env.PORT, 10) || 3100,
    env: process.env.NODE_ENV || 'development',
  },
  // Project root is one level up from website/ — where skills/, dealerships/,
  // vehicles/, references/, and CLAUDE.md live.
  projectRoot: new URL('../../../', import.meta.url).pathname,
};

export default config;
