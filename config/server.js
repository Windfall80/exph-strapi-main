module.exports = ({ env }) => ({
  host: env('HOST', '0.0.0.0'),
  port: env.int('PORT', 5337),
  admin: {
    auth: {
      secret: env('ADMIN_JWT_SECRET', 'f22bb6440f007d16078001c12d4039cc'),
    },
  },
  cron: {
    enabled: true,
  },
  base_front_url: env('BASE_FRONT_URL', 'https://exphotelhive.com'),
  base_public_url: env('BASE_PUBLIC_URL', 'https://strapi.exphotelhive.com'),
  stripe_sk: env('STRIPE_SECRET_KEY', 'sk_test_51JVNb1ACZMb0KPuOFSrhhEHwVzYY13Qyt6wASYZHp3TSNDdNwEtei1GiB7hSrlAFdpe9WQUBFaCwbUheJVZNoePJ00Ht8WgZdU'),
  stripe_es: env('STRIPE_ENDPOINT_SECRET', 'whsec_fvgLRwwq13vDJb6tWgFwRI6LkbbBlRVk'),
});
