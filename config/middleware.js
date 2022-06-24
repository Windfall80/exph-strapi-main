module.exports = ({ env }) => ({
  settings: {
    parser: {
      enabled: true,
      //multipart: true,
      includeUnparsed: true,
    },
    cors: {
      enabled: true,
      // Configure CORS to app's client-side and Strapi client (admin panel)
      // client-side 1 : http://localhost:4200
      // client-side 2 : https://exphotelhive.com
      // Strapi client (admin panel) 1 : http://localhost:5337
      // Strapi client (admin panel) 2 : https://strapi-test.exphotelhive.com

      origin: env('CORS_ORIGIN', '*').split(','), //allow all origins
      headers: env('CORS_HEADERS', '*').split(','), //allow all headers
    }
  }
});
