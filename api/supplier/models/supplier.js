'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  lifecycles: {
    async afterUpdate(result, params, data) {
      if( data.published_at ) {
        let user = await strapi.plugins["users-permissions"].services.user.fetch({supplier: result.id, role: 3});
        if(user) {
          console.log('enviar correo de aprobacion a '+user.email)
          strapi.services.email.sendPublishedSupplier(user);
        }
      }
    },

    async afterDelete(result, params) {
      // here we should also delete / disable child users

      if(result.Stripe_ID) {
        // delete customer from stripe to cancel all current subscriptions
        await strapi.services.stripe.deleteCustomer(result.Stripe_ID);
      }
    },
  },
};
