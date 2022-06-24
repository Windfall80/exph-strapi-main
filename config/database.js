module.exports = ({ env }) => ({
  defaultConnection: 'default',
  connections: {
    default: {
      connector: 'mysql',
      settings: {
        client: 'mysql',
        host: env('DATABASE_HOST', '127.0.0.1'),
        port: env.int('DATABASE_PORT', 3306),
        database: env('DATABASE_NAME', 'strapi-database-main'),
        username: env('DATABASE_USERNAME', 'postgrest'),
        password: env('DATABASE_PASSWORD', '-Marcosprime-'),
        ssl: env.bool('DATABASE_SSL', false),
      },
      options: {}
    },
  },
});
