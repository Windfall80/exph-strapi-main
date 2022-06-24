'use strict';

const moment = require('moment');
const stripe = require('stripe')(strapi.config.get('server.stripe_sk'));

async function createPlanProduct(plan){
  return await stripe.products.create({
    name: `Plan ${plan.name}`,
  });
}

async function createPlanPrice(plan){
  return await stripe.prices.create({
    product: plan.stripe_product_ID,
    unit_amount: (plan.price)*100,
    currency: 'mxn',
    recurring: {
      interval: plan.interval? plan.interval:'year',
    },
  });
}

module.exports = {
  /**
   * initializes stripe, creates products and prices if needed
   *
   */
  async init() {
    try {
      console.log('init stripe');
    } catch (err) {
      console.log(err);
    }
  },

  /**
   * recives invoice when invoice.billing_reason == 'subscription_cycle' || 'subscription_create'
   * updates supplier/company current_period_start and current_period_end
   *
   */
  async onSubscriptionInvoiced(invoice){
    //const customer = invoice.customer;
    //const subscription = invoice.subscription;

    let _service;
    let entity = await strapi.services.company.findOne({ Stripe_ID: invoice.customer, _publicationState: 'preview' });
    if(entity) _service = 'company';
    else {
      // if is not found as company search as supplier
      entity = await strapi.services.supplier.findOne({ Stripe_ID: invoice.customer, _publicationState: 'preview' });
      if(entity) _service = 'supplier';
    }

    if(!entity) throw new Error("Can't find customer.");

    // retrive subscription from stripe
    const subscription = await stripe.subscriptions.retrieve(invoice.subscription);
    if(!subscription) throw new Error("Can't find subscription.");

    return entity = await strapi.services[_service].update({id: entity.id }, {
      Subscription_ID: subscription.id,
      subscription_status: subscription.status,
      invoice_status: invoice.status,
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
    });
  },

  /**
   * recives invoice when creating new one time subscription (invoice.billing_reason == 'manual' && invoice.metadata.internal_reason == 'one_time_subscription')
   * updates supplier/company current_period_start and current_period_end
   *
   */
  async onRegisterPaymentInvoiced(invoice){
    //const customer = invoice.customer;
    //const subscription = invoice.subscription;

    let _service;
    let entity = await strapi.services.company.findOne({ Stripe_ID: invoice.customer, _publicationState: 'preview' });
    if(entity) _service = 'company';
    else {
      // if is not found as company search as supplier
      entity = await strapi.services.supplier.findOne({ Stripe_ID: invoice.customer, _publicationState: 'preview' });
      if(entity) _service = 'supplier';
    }

    if(!entity) throw new Error("Can't find customer.");

    return entity = await strapi.services[_service].update({id: entity.id }, {
      subscription_status: invoice.paid? 'active':'unpaid',
      invoice_status: invoice.status,
    });
  },

  async onSubscriptionUpdated(subscription){
    let _service;
    let entity = await strapi.services.company.findOne({ Stripe_ID: subscription.customer, _publicationState: 'preview' });
    if(entity) _service = 'company';
    else {
      // if is not found as company search as supplier
      entity = await strapi.services.supplier.findOne({ Stripe_ID: subscription.customer, _publicationState: 'preview' });
      if(entity) _service = 'supplier';
    }

    if(!entity) throw new Error("Can't find customer.");

    return entity = await strapi.services[_service].update({id: entity.id }, {
      Subscription_ID: subscription.id,
      subscription_status: subscription.status,
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
    });
  },

  async onSubscriptionDeleted(subscription){
    let _service;
    let entity = await strapi.services.company.findOne({ Stripe_ID: subscription.customer, _publicationState: 'preview' });
    if(entity) _service = 'company';
    else {
      // if is not found as company search as supplier
      entity = await strapi.services.supplier.findOne({ Stripe_ID: subscription.customer, _publicationState: 'preview' });
      if(entity) _service = 'supplier';
    }

    if(!entity) throw new Error("Can't find customer.");

    return entity = await strapi.services[_service].update({id: entity.id }, {
      Subscription_ID: null,
      subscription_status: subscription.status,
    });
  },

  async createStripe(data){
    const user = data.users[0];
    let result;
    console.log(data);
    const customer = await stripe.customers.create({
      name: data.representative_name,
      description: data.business_name,
      email: user.email.toLowerCase(),
      address: {
        city: data.city,
        country: 'MX',
        line1: data.address,
        postal_code: data.postal_code,
        state: data.state
      }
    })
    result = customer;

    if(data.tokenpayment){
      const paymentMethod = await stripe.paymentMethods.attach(
        data.tokenpayment,
        {customer: customer.id}
      ).catch((error) => {
        console.log(error);
        result = error;
      });
      if(paymentMethod){
        console.log("SETTING DEFAUL PAYMENT FOR CLIENT", customer.id, paymentMethod.id);
        const customerupdate = await stripe.customers.update(
          customer.id,
          {invoice_settings: {default_payment_method: paymentMethod.id}}
        );
      }
    }

    return result;
  },

  async createOneTime(customer, price, default_payment_method = false){
    const data = {
      customer: customer,
      collection_method: 'charge_automatically',
      metadata: {
        internal_reason: 'one_time_subscription'
      }
    };

    if( default_payment_method ) data.default_payment_method = default_payment_method;

    try {
      // create an invoice item with the customer_id and price_id
      const invoiceItem = await stripe.invoiceItems.create({
        customer: customer,
        price: price,
      });

      // create invoice draft
      const invoice_draft = await stripe.invoices.create(data);

      // attempt to charge invoice immediately
      const invoice = await stripe.invoices.pay(invoice_draft.id);
      console.log(invoice);
      return invoice;
    } catch (error) {
      console.log(error);
      return false;
    }
  },

  async createSubscription(customer, price, default_payment_method = false){
    const data = {
      customer: customer,
      items: [
        {price: price},
      ],
      trial_end: "now"
    };

    if( default_payment_method ) data.default_payment_method = default_payment_method;

    try {
      const subscription = await stripe.subscriptions.create(data);
      console.log(subscription);
      return subscription;
    } catch (error) {
      console.log(error);
      return false;
    }
  },

  async cancelSubscription(subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.retrieve( subscriptionId );
      if( subscription.status == "active") {
        const deleted = await stripe.subscriptions.del( subscriptionId );
        return deleted;
      }
    } catch (err) {
      console.log(err);
    }
    return false;
  },

  async cancelSubscriptionRenewal(subscriptionId) {
    try {
      const subscription = await stripe.subscriptions.update(subscriptionId, {cancel_at_period_end: true});
      return subscription;
    } catch (err) {
      console.log(err);
    }
    return false;
  },

  async retriveInvoice(invoiceId) {
    try {
      const invoice = await stripe.invoices.retrieve(invoiceId);
      return invoice;
    } catch (err) {
      console.log(err);
    }
    return false;
  },

  async deleteCustomer(customerId) {
    try {
      const deleted = await stripe.customers.del(customerId);
      return deleted;
    } catch (err) {
      console.log(err);
    }
    return false;
  },

  async addCard(customerId, token, setDefault = false){
    try {
      const paymentMethod = await stripe.paymentMethods.attach(
        token,
        {customer: customerId}
      );

      if(paymentMethod && setDefault){
        console.log("SETTING DEFAUL PAYMENT FOR CLIENT", customer.id, paymentMethod.id);
        const customerupdate = await stripe.customers.update(
          customerId,
          {invoice_settings: {default_payment_method: paymentMethod.id}}
        );
      }

      return paymentMethod;
    } catch (error) {
      return error;
    }
  },

  async getCards(customerId){
    const cards = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card'
    });
    return cards;
  },

  /**
   * recives plan-price object selected by customer
   * validates plan-price / plan exists, has corresponding ids and these ids exist on stripe dashboard
   *
   * returs void if ok, throws error if something is wrong
   */
  async validatePrice(selectedPrice){
    if(!selectedPrice) throw new Error(`Selected price not found.`);
    if(!selectedPrice.plan) throw new Error(`Selected plan not found.`);

    if(!selectedPrice.plan.stripe_product_ID) throw new Error(`Missing plan stripe_product_ID.`);
    // verify product is avalible on stripe
    const product = await stripe.products.retrieve(selectedPrice.plan.stripe_product_ID);

    if(!selectedPrice.stripe_price_ID) throw new Error(`Missing price stripe_product_ID.`);
    const price = await stripe.prices.retrieve(selectedPrice.stripe_price_ID);

    //check if selected one_time payment type the date for static_period_end exists on plan object
    if(selectedPrice.type == 'one_time'){
      if(!selectedPrice.plan.static_period_end) throw new Error(`Plan's period end missing for one time payment.`);
      if(moment().isSameOrAfter(moment(selectedPrice.plan.static_period_end), 'day'))
        throw new Error(`Plan's end period end expired.`);
    }

    return;
  }

};
