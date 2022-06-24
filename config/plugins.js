module.exports = ({ env }) => ({
  upload: {
      config: {
          provider: 'aws-s3',
          providerOptions: {
              accessKeyId: env('AKIATWKQUYYM7CX34IOR'),
              secretAccessKey: env('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'),
              region: env('us-east-1'),
              params: {
                  Bucket: env('estrapi-expohotel-images'),
              },
          },
      },
  }
});
