'use strict';

const front_url = strapi.config.get('server.base_front_url', 'https://exphotelhive.com');
const public_url = strapi.config.get('server.base_public_url', 'https://strapi.exphotelhive.com');

module.exports = {


  /**
   * Supplier emails
   */
  async sendWelcomeSupplier(user) {
    try {
      if(typeof user === 'number') user = await strapi.plugins["users-permissions"].services.user.fetch({id: user});

      await strapi.plugins['email-designer'].services.email.sendTemplatedEmail(
        {
          to: user.email, // required
          from: 'Soporte Exphotel <no-reply@exphotelhive.com>', // optional if /config/plugins.js -> email.settings.defaultFrom is set
          replyTo: 'no-reply@exphotelhive.com', // optional if /config/plugins.js -> email.settings.defaultReplyTo is set
          attachments: [], // optional array of files
        },
        {
          templateId: 21, // required - you can get the template id from the admin panel (can change on import)
          sourceCodeToTemplateId: 16, // ID that can be defined in the template designer (won't change on import)
          //subject: `Thank you for your order`, // If provided here will override the template's subject. Can include variables like `Thank you for your order {{= user.firstName }}!`
        },
        {
          URL: `${front_url}`,
          USER: user,
        }
      );
    } catch (err) {
      console.log('Error Enviando email...', err);
      //return ctx.badRequest(null, err);
    }
  },
  async sendPublishedSupplier(user) {
    try {
      if(typeof user === 'number') user = await strapi.plugins["users-permissions"].services.user.fetch({id: user});

      await strapi.plugins['email-designer'].services.email.sendTemplatedEmail(
        {
          to: user.email, // required
          from: 'Soporte Exphotel <no-reply@exphotelhive.com>', // optional if /config/plugins.js -> email.settings.defaultFrom is set
          replyTo: 'no-reply@exphotelhive.com', // optional if /config/plugins.js -> email.settings.defaultReplyTo is set
          attachments: [], // optional array of files
        },
        {
          templateId: 22, // required - you can get the template id from the admin panel (can change on import)
          sourceCodeToTemplateId: 17, // ID that can be defined in the template designer (won't change on import)
          //subject: `Thank you for your order`, // If provided here will override the template's subject. Can include variables like `Thank you for your order {{= user.firstName }}!`
        },
        {
          URL: `${front_url}`,
          USER: user,
        }
      );
    } catch (err) {
      console.log('Error Enviando email...', err);
      //return ctx.badRequest(null, err);
    }
  },

  async sendNewQuotation(user, quotation) {
    try {
      if(typeof user === 'number') user = await strapi.plugins["users-permissions"].services.user.fetch({id: user});

      await strapi.plugins['email-designer'].services.email.sendTemplatedEmail(
        {
          to: user.email,
          from: 'Soporte Exphotel <no-reply@exphotelhive.com>',
          replyTo: 'no-reply@exphotelhive.com',
          attachments: [],
        },
        {
          templateId: 2,
          sourceCodeToTemplateId: 2,
        },
        {
          URL: `${front_url}/proveedores/cotizaciones/${quotation.id}`,
          USER: user,
          company: quotation.company
        }
      );
    } catch (err) {
      console.log('Error Enviando email...', err);
      //return ctx.badRequest(null, err);
    }
  },
  async sendQuotationInterest(user, quotation) {
    try {
      if(typeof user === 'number') user = await strapi.plugins["users-permissions"].services.user.fetch({id: user});

      await strapi.plugins['email-designer'].services.email.sendTemplatedEmail(
        {
          to: user.email,
          from: 'Soporte Exphotel <no-reply@exphotelhive.com>',
          replyTo: 'no-reply@exphotelhive.com',
          attachments: [],
        },
        {
          templateId: 4,
          sourceCodeToTemplateId: 4,
        },
        {
          URL: `${front_url}/proveedores/cotizaciones/${quotation.id}`,
          USER: user,
          company: quotation.company
        }
      );
    } catch (err) {
      console.log('Error Enviando email...', err);
      //return ctx.badRequest(null, err);
    }
  },
  async sendQuotationClose(user, quotation) {
    try {
      if(typeof user === 'number') user = await strapi.plugins["users-permissions"].services.user.fetch({id: user});

      await strapi.plugins['email-designer'].services.email.sendTemplatedEmail(
        {
          to: user.email,
          from: 'Soporte Exphotel <no-reply@exphotelhive.com>',
          replyTo: 'no-reply@exphotelhive.com',
          attachments: [],
        },
        {
          templateId: 6,
          sourceCodeToTemplateId: 6,
        },
        {
          URL: `${front_url}/proveedores/cotizaciones/${quotation.id}`,
          USER: user,
          company: quotation.company
        }
      );
    } catch (err) {
      console.log('Error Enviando email...', err);
      //return ctx.badRequest(null, err);
    }
  },
  async sendQuotationDeliverySet(user, quotation) {
    try {
      if(typeof user === 'number') user = await strapi.plugins["users-permissions"].services.user.fetch({id: user});

      await strapi.plugins['email-designer'].services.email.sendTemplatedEmail(
        {
          to: user.email,
          from: 'Soporte Exphotel <no-reply@exphotelhive.com>',
          replyTo: 'no-reply@exphotelhive.com',
          attachments: [],
        },
        {
          templateId: 7,
          sourceCodeToTemplateId: 7,
        },
        {
          URL: `${front_url}/proveedores/cotizaciones/${quotation.id}`,
          USER: user,
          company: quotation.company
        }
      );
    } catch (err) {
      console.log('Error Enviando email...', err);
      //return ctx.badRequest(null, err);
    }
  },
  async sendQuotationRatingSet(user, quotation) {
    try {
      if(typeof user === 'number') user = await strapi.plugins["users-permissions"].services.user.fetch({id: user});

      await strapi.plugins['email-designer'].services.email.sendTemplatedEmail(
        {
          to: user.email,
          from: 'Soporte Exphotel <no-reply@exphotelhive.com>',
          replyTo: 'no-reply@exphotelhive.com',
          attachments: [],
        },
        {
          templateId: 9,
          sourceCodeToTemplateId: 9,
        },
        {
          URL: `${front_url}/proveedores/cotizaciones/${quotation.id}`,
          USER: user,
          company: quotation.company,
        }
      );
    } catch (err) {
      console.log('Error Enviando email...', err);
      //return ctx.badRequest(null, err);
    }
  },
  async sendQuotationRatingSet_Stars(user, quotation, rating) {
    try {
      if(typeof user === 'number') user = await strapi.plugins["users-permissions"].services.user.fetch({id: user});

      await strapi.plugins['email-designer'].services.email.sendTemplatedEmail(
        {
          to: user.email,
          from: 'Soporte Exphotel <no-reply@exphotelhive.com>',
          replyTo: 'no-reply@exphotelhive.com',
          attachments: [],
        },
        {
          templateId: 13,
          sourceCodeToTemplateId: 13,
        },
        {
          URL: `${front_url}/proveedores/cotizaciones/${quotation.id}`,
          USER: user,
          company: quotation.company,
          rating: rating
        }
      );
    } catch (err) {
      console.log('Error Enviando email...', err);
      //return ctx.badRequest(null, err);
    }
  },
  async sendQuotationDiscard(user, quotation) {
    try {
      if(typeof user === 'number') user = await strapi.plugins["users-permissions"].services.user.fetch({id: user});

      await strapi.plugins['email-designer'].services.email.sendTemplatedEmail(
        {
          to: user.email,
          from: 'Soporte Exphotel <no-reply@exphotelhive.com>',
          replyTo: 'no-reply@exphotelhive.com',
          attachments: [],
        },
        {
          templateId: 5,
          sourceCodeToTemplateId: 5,
        },
        {
          URL: `${front_url}/proveedores/cotizaciones/${quotation.id}`,
          USER: user,
          company: quotation.company
        }
      );
    } catch (err) {
      console.log('Error Enviando email...', err);
      //return ctx.badRequest(null, err);
    }
  },
  async sendQuotationReject(user, quotation) {
    try {
      if(typeof user === 'number') user = await strapi.plugins["users-permissions"].services.user.fetch({id: user});

      await strapi.plugins['email-designer'].services.email.sendTemplatedEmail(
        {
          to: user.email,
          from: 'Soporte Exphotel <no-reply@exphotelhive.com>',
          replyTo: 'no-reply@exphotelhive.com',
          attachments: [],
        },
        {
          templateId: 12,
          sourceCodeToTemplateId: 12,
        },
        {
          URL: `${front_url}/proveedores/cotizaciones/${quotation.id}`,
          USER: user,
          company: quotation.company
        }
      );
    } catch (err) {
      console.log('Error Enviando email...', err);
      //return ctx.badRequest(null, err);
    }
  },

  /**
   * Company emails
   */
  async sendWelcomeEmail(user) {
    try {
      if(typeof user === 'number') user = await strapi.plugins["users-permissions"].services.user.fetch({id: user});

      await strapi.plugins['email-designer'].services.email.sendTemplatedEmail(
        {
          to: user.email, // required
          from: 'Soporte Exphotel <no-reply@exphotelhive.com>', // optional if /config/plugins.js -> email.settings.defaultFrom is set
          replyTo: 'no-reply@exphotelhive.com', // optional if /config/plugins.js -> email.settings.defaultReplyTo is set
          attachments: [], // optional array of files
        },
        {
          templateId: 1, // required - you can get the template id from the admin panel (can change on import)
          sourceCodeToTemplateId: 1, // ID that can be defined in the template designer (won't change on import)
          //subject: `Thank you for your order`, // If provided here will override the template's subject. Can include variables like `Thank you for your order {{= user.firstName }}!`
        },
        {
          URL: `${front_url}`,
          USER: user,
        }
      );
    } catch (err) {
      console.log('Error Enviando email...', err);
      //return ctx.badRequest(null, err);
    }
  },
  async sendNewPendingQuotation(user, quotation) {
    try {
      if(typeof user === 'number') user = await strapi.plugins["users-permissions"].services.user.fetch({id: user});

      console.log(await strapi.plugins['email-designer'].services.email.sendTemplatedEmail(
        {
          to: user.email,
          from: 'Soporte Exphotel <no-reply@exphotelhive.com>',
          replyTo: 'no-reply@exphotelhive.com',
          attachments: [],
        },
        {
          templateId: 3,
          sourceCodeToTemplateId: 3,
        },
        {
          URL: `${front_url}/empresas/cotizaciones/${quotation.group.id}/${quotation.id}`,
          USER: user,
          supplier: quotation.supplier
        }
      ));
    } catch (err) {
      console.log('Error Enviando email...', err);
    }
  },

  /**
   * Admin emails
   */
  async sendAdminNewSupplier(supplier) {
    try {
      // aqui hacer busqueda de a quien de los admins se le va a enviar el email
      await strapi.plugins['email-designer'].services.email.sendTemplatedEmail(
        {
          to: ['support@exphotelhive.com'],
          from: 'Soporte Exphotel <no-reply@exphotelhive.com>',
          replyTo: 'no-reply@exphotelhive.com',
          attachments: [],
        },
        {
          templateId: 18,
          sourceCodeToTemplateId: 14,
        },
        {
          URL: `${public_url}/admin/plugins/content-manager/collectionType/application::supplier.supplier/${supplier.id}`,
          supplier: supplier,
        }
      );
    } catch (err) {
      console.log('Error Enviando email...', err);
      //return ctx.badRequest(null, err);
    }
  },
  async sendAdminNewCompany(company) {
    try {
      // aqui hacer busqueda de a quien de los admins se le va a enviar el email
      await strapi.plugins['email-designer'].services.email.sendTemplatedEmail(
        {
          to: ['support@exphotelhive.com'],
          from: 'Soporte Exphotel <no-reply@exphotelhive.com>',
          replyTo: 'no-reply@exphotelhive.com',
          attachments: [],
        },
        {
          templateId: 20,
          sourceCodeToTemplateId: 15,
        },
        {
          URL: `${public_url}/admin/plugins/content-manager/collectionType/application::company.company/${company.id}`,
          company: company,
        }
      );
    } catch (err) {
      console.log('Error Enviando email...', err);
      //return ctx.badRequest(null, err);
    }
  },
};
