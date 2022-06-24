'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const { parseMultipartData, sanitizeEntity } = require("strapi-utils");
const stripe = require('stripe')(strapi.config.get('server.stripe_sk'));

async function addTickets(qty, supplier){
  let entity;
  let entities = [];
  for(let i = 0; i < qty; i++) {
    entity = await strapi.services['offer-ticket'].create({
      //expires_at: new Date().addDays(30),
      supplier: supplier
    });
    if(entity) {
      entities.push(sanitizeEntity(entity, { model: strapi.models['offer-ticket'] }));
    }
  }
  return entities;
}


module.exports = {
  /**
   * Retrieve records.
   *
   * @return {Array}
   */
   async find(ctx) {
    let entities;

    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    if(usrfromToken.type != 'supplier'){
      return ctx.badRequest("User is not supplier.");
    }

    ctx.query = {
      ...ctx.query,
      supplier: usrfromToken.supplier,
      spent: false,
      _or: [
        {expires_at_null: true},
        {expires_at_gte: new Date()}
      ],

      _sort: 'free:DESC,expires_at:ASC'
    }

    if (ctx.query._q) {
      entities = await strapi.services['offer-ticket'].search(ctx.query);
    } else {
      entities = await strapi.services['offer-ticket'].find(ctx.query);
    }

    return entities.map(entity => sanitizeEntity(entity, { model: strapi.models['offer-ticket'] }));
  },

  /**
   * Retrieve a record.
   *
   * @return {Object}
   */
   async findOne(ctx) {
    const { id } = ctx.params;

    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    if(usrfromToken.type != 'supplier'){
      return ctx.badRequest("User is not supplier.");
    }

    ctx.query = {
      ...ctx.query,
      supplier: usrfromToken.supplier,
      spent: false,
      _or: [
        {expires_at_null: true},
        {expires_at_gte: new Date()}
      ]
    }

    const entity = await strapi.services['offer-ticket'].findOne({ id, ...ctx.query });
    return sanitizeEntity(entity, { model: strapi.models['offer-ticket'] });
  },

  /**
   * Count records.
   *
   * @return {Number}
   */
  count(ctx) {
    let usrfromToken;

    try {
      usrfromToken = ctx.state.user;
    } catch (err) {
      return ctx.badRequest(err, "User not authenticated.");
    }

    if(usrfromToken.type != 'supplier'){
      return ctx.badRequest("User is not supplier.");
    }

    ctx.query = {
      ...ctx.query,
      supplier: usrfromToken.supplier,
      spent: false,
      _or: [
        {expires_at_null: true},
        {expires_at_gte: new Date()}
      ]
    }

    if (ctx.query._q) {
      return strapi.services['offer-ticket'].countSearch(ctx.query);
    }
    return strapi.services['offer-ticket'].count(ctx.query);
  },

  /**
   * Exchange tickets with points.
   *
   * @return {Object}
   */
  async exchange(ctx) {
    let entity;
    let data;

    if (ctx.is('multipart')) {
      ({ data } = parseMultipartData(ctx));
    } else {
      data = ctx.request.body;
    }

    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    if(usrfromToken.type != 'supplier'){
      return ctx.badRequest("User is not supplier.");
    }

    let { points } = await strapi.services.supplier.findOne({ id: usrfromToken.supplier, _publicationState: 'preview' });
    let { value: price } = await strapi.services.config.findOne({ slug: 'ticket-exchange-price' });
    let { qty } = data;

    if( points == null || price == null || qty == null ) {
      return ctx.badRequest("Bad request.");
    }

    if( points < price * qty ) {
      return ctx.badRequest("Not enough points.");
    }

    let entities = [];
    for(let i = 0; i < qty; i++) {
      entity = await strapi.services['offer-ticket'].create({
        //expires_at: new Date().addDays(30),
        supplier: usrfromToken.supplier
      });
      if(entity) {
        entities.push(sanitizeEntity(entity, { model: strapi.models['offer-ticket'] }));
      }
    }

    // update supplier points
    let total_spent = entities.length * price;
    let supplier = await strapi.services.supplier.update({ id: usrfromToken.supplier }, { points: points - total_spent });

    return { points: supplier.points, entities };
  },

  /**
   * Purchases tickets with money.
   *
   * @return {Object}
   */
   async purchase(ctx) {
    let entity;
    let data;

    if (ctx.is('multipart')) {
      ({ data } = parseMultipartData(ctx));
    } else {
      data = ctx.request.body;
    }
    console.log(data);
    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    if(usrfromToken.type != 'supplier'){
      return ctx.badRequest("User is not supplier.");

    }
    let { Stripe_ID } = await strapi.services.supplier.findOne({ id: usrfromToken.supplier, _publicationState: 'preview' });

    let { value: price } = await strapi.services.config.findOne({ slug: 'ticket-purchase-price' });
    let { qty } = data;

    if( price == null || qty == null ) {
      return ctx.badRequest("Bad request.");
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: (qty*price)*100,
      currency: 'mxn',
      customer: Stripe_ID,
      payment_method: data.paymentcard,
      off_session: true,
      confirm: true,
    });

    if(paymentIntent){
      var r_entities = await addTickets(qty, usrfromToken.supplier);
      return {paymentIntent, r_entities};
    }
    return paymentIntent;
  },
};
