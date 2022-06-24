module.exports = ({ env }) => ({
    email: {
      provider: 'smtp',
      providerOptions: {
        host: 'email-smtp.us-east-2.amazonaws.com', //SMTP Host
        port: 465, //SMTP Port
        secure: true,
        username: 'AKIARRIYIUCP5QLMHS7Z',
        password: 'BBaPwSVbopJxpSPn73AY9x+2EDzyBp8ap1LdXtsPPM4U',
        rejectUnauthorized: true,
        requireTLS: false,
        connectionTimeout: 1,
      },
      settings: {
        from: '"Soporte Exphotel" <no-reply@exphotelhive.com>',
        defaultFrom: 'no-reply@exphotelhive.com',
        defaultReplyTo: 'no-reply@exphotelhive.com'
      },
    },
  });
