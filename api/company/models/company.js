'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#lifecycle-hooks)
 * to customize this model
 */

module.exports = {
  async afterDelete(result, params) {
    // here we should also delete / disable child users

    if(result.Stripe_ID) {
      // delete customer from stripe to cancel all current subscriptions
      await strapi.services.stripe.deleteCustomer(result.Stripe_ID);
    }
  },
};
