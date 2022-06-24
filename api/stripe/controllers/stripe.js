'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const unparsed = require('koa-body/unparsed.js');
const stripe = require('stripe')(strapi.config.get('server.stripe_sk'));
const endpointSecret = strapi.config.get('server.stripe_es');

async function fixEntity(entity, _service) {
  console.log('Entering fixEntity method', _service, entity.id);

  const data = {
    Subscription_ID: null,
    plan: 1,
    current_period_end: new Date('2022-06-30T23:59:00.000Z'),
  }

  if(_service == 'company') data.price = 1;
  if(_service == 'supplier') data.price = 2;

  try{
    let customer;
    if( entity.Stripe_ID ) {
      // verificar que el Stripe_ID exista en stripe si no crear uno nuevo
      try{
        customer = await stripe.customers.retrieve(entity.Stripe_ID);
      } catch (err) {
        customer = await strapi.services.stripe.createStripe(entity);
      }
    } else {
      customer = await strapi.services.stripe.createStripe(entity);
    }
    if(customer) data.Stripe_ID = customer.id;


    entity = await strapi.services[_service].update({id: entity.id }, data);

  } catch (err){
    console.log(err);
  }
}

module.exports = {
  /**
   * Create a record.
   *
   * @return {Object}
   */
  async endpoint(ctx) {
    const unparsedBody = ctx.request.body[unparsed];
    const sig = ctx.request.headers['stripe-signature'];
    let event;

    try {
      event = stripe.webhooks.constructEvent(unparsedBody, sig, endpointSecret);
    } catch (err) {
      console.log(err);
      return ctx.badRequest(`Webhook Error: ${err.message}`);
    }

    switch (event.type) {
      case 'invoice.payment_succeeded': {
        let invoice = event.data.object;
        // Then define and call a function to handle the event invoice.payment_succeeded
        switch (invoice.billing_reason) {
          case 'subscription_cycle': {
            try {
              let res = await strapi.services.stripe.onSubscriptionInvoiced(invoice);
              if(!res) throw new Error("Error updating customer entity.");
            } catch (err) {
              return ctx.badRequest(err, "Error updating subscription.");
            }
            break;
          }

          case 'subscription_create': {
            try {
              let res = await strapi.services.stripe.onSubscriptionInvoiced(invoice);
              if(!res) throw new Error("Error updating customer entity.");
            } catch (err) {
              return ctx.badRequest(err, "Error updating subscription.");
            }
            break;
          }

          case 'manual': {
            if( invoice.metadata && invoice.metadata.internal_reason == 'one_time_subscription' ) {
              try {
                let res = await strapi.services.stripe.onRegisterPaymentInvoiced(invoice);
                if(!res) throw new Error("Error updating customer entity.");
              } catch (err) {
                return ctx.badRequest(err, "Error updating subscription.");
              }
            }
            break;
          }
        }
        break;
      }

      case 'invoice.payment_failed': {
        let invoice = event.data.object;
        // Then define and call a function to handle the event invoice.payment_succeeded
        switch (invoice.billing_reason) {
          case 'subscription_cycle': {
            try {
              let res = await strapi.services.stripe.onSubscriptionInvoiced(invoice);
              if(!res) throw new Error("Error updating customer entity.");
            } catch (err) {
              return ctx.badRequest(err, "Error updating subscription.");
            }
            break;
          }

          case 'subscription_create': {
            try {
              let res = await strapi.services.stripe.onSubscriptionInvoiced(invoice);
              if(!res) throw new Error("Error updating customer entity.");
            } catch (err) {
              return ctx.badRequest(err, "Error updating subscription.");
            }
            break;
          }

          case 'manual': {
            if( invoice.metadata && invoice.metadata.internal_reason == 'one_time_subscription' ) {
              try {
                let res = await strapi.services.stripe.onRegisterPaymentInvoiced(invoice);
                if(!res) throw new Error("Error updating customer entity.");
              } catch (err) {
                return ctx.badRequest(err, "Error updating subscription.");
              }
            }
            break;
          }
        }
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        try {
          let res = await strapi.services.stripe.onSubscriptionUpdated(subscription);
          if(!res) throw new Error("Error updating customer entity.");
        } catch (err) {
          return ctx.badRequest(err, "Error updating subscription.");
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        try {
          let res = await strapi.services.stripe.onSubscriptionDeleted(subscription);
          if(!res) throw new Error("Error updating customer entity.");
        } catch (err) {
          return ctx.badRequest(err, "Error updating subscription.");
        }
        break;
      }

      // ... handle other event types
      default: {
        console.log(`Unhandled event type ${event.type}`);
      }
    }

    return ctx.send({message: 'ok'}, 200);
  },


  async fix(ctx) {
    // search suppliers
    const suppliers = await strapi.services.supplier.find({ _publicationState: 'preview'});
    for(let supplier of suppliers){
      fixEntity(supplier, 'supplier');
    }

    const companies = await strapi.services.company.find({ _publicationState: 'preview' });
    for(let company of companies){
      fixEntity(company, 'company');
    }

    const subscriptions = await stripe.subscriptions.list({status: 'active'});
    for(let sub of subscriptions.data){
      await stripe.subscriptions.del(sub.id);
    }

    return 'ok';
  }
};
