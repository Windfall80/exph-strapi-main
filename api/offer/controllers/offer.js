'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const { parseMultipartData, sanitizeEntity } = require("strapi-utils");

async function sanitizeOffer(entity, user) {
  if(!entity) return sanitizeEntity(entity, { model: strapi.models['offer'] });

  // add missing attributes from nested levels
  if (entity.supplier && entity.supplier.id) {
    let { payment_methods, payment_terms } = await strapi.services.supplier.findOne({ id: entity.supplier.id, _publicationState: 'preview' });
    entity.supplier.payment_methods = payment_methods;
    entity.supplier.payment_terms = payment_terms;
  }

  if(user.type == 'company' && entity.requested){
    entity.request = await strapi.services['offer-request'].findOne({ offer: entity.id, user: user.id });
  }

  return sanitizeEntity(entity, { model: strapi.models['offer'] });
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

    if(usrfromToken.type == 'supplier'){
      ctx.query.supplier = usrfromToken.supplier;
      ctx.query._publicationState = 'preview';
    } else {
      ctx.query.expires_at_gte = new Date();
    }

    ctx.query._and = [];

    // filter sidesearch
    if("categories" in ctx.query) {
      let _c = ctx.query.categories;
      delete ctx.query.categories;
      if(typeof _c === 'string') _c = JSON.parse(_c);
      ctx.query._and.push({_or:[{categories_in: _c},{main_category_in: _c}]});
    }

    // filter sidesearch that belongs to supplier
    const s_and = [];
      if("payment_methods" in ctx.query) {
        let _pm = ctx.query.payment_methods;
        delete ctx.query.payment_methods;
        if(typeof _pm === 'string') _pm = JSON.parse(_pm);
        s_and.push({payment_methods_in: _pm});
      }
      if("payment_terms" in ctx.query) {
        let _pt = ctx.query.payment_terms;
        delete ctx.query.payment_terms;
        if(typeof _pt === 'string') _pt = JSON.parse(_pt);
        s_and.push({payment_terms_in: _pt});
      }

    if(s_and.length || usrfromToken.type == 'company') {
      const suppliers = await strapi.services.supplier.find({ _publicationState: 'live', _and: s_and});
      let _sids = suppliers.map(x=>x.id);
      ctx.query._and.push({supplier_in: _sids});

      // add filter already requested
      let pre_requests = await strapi.services['offer-request'].find({user: usrfromToken.id, status_nin: [4,6]}, []);
      ctx.query._and.push({_or: [{requested: false}, {requests_in: pre_requests.map(x=>x.id)}]});
    }

    if("_favs" in ctx.query){
      delete ctx.query._favs;
      ctx.query._and.push({favs: usrfromToken.id});
    }

    if("tab" in ctx.query){
      let _tab = ctx.query.tab;
      delete ctx.query.tab;
      if(_tab == 'open') {
        ctx.query._and.push({requested: false});
        ctx.query._and.push({expires_at_gte: new Date()});
      }
      if(_tab == 'requested') {
        ctx.query._and.push({requested: true});
      }
      if(_tab == 'expired') {
        ctx.query._and.push({requested: false});
        ctx.query._and.push({expires_at_lte: new Date()});
      }
    }

    // do search
    ctx.query.deleted = false;
    if (ctx.query._q) {
      entities = await strapi.services.offer.search(ctx.query);
    } else {
      entities = await strapi.services.offer.find(ctx.query);
    }

    let offers = await Promise.all(entities.map( async(entity) => {
      entity.isFav = entity.favs.some(e => e.id === usrfromToken.id);
      return sanitizeOffer(entity, usrfromToken);
    }));

    //count all
    let count
    if (ctx.query._q) {
      count = await strapi.services.offer.countSearch(ctx.query);
    } else {
      count = await strapi.services.offer.count(ctx.query);
    }

    return { count, data: offers };
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

    if(usrfromToken.type == 'supplier'){
      ctx.query.supplier = usrfromToken.supplier;
      ctx.query._publicationState = 'preview';
    } else {
      ctx.query.expires_at_gte = new Date();
    }

    const entity = await strapi.services.offer.findOne({ id, ...ctx.query });
    entity.isFav = entity.favs.some(e => e.id === usrfromToken.id);
    return sanitizeEntity(entity, { model: strapi.models.offer });
  },

  /**
   * Count records.
   *
   * @return {Number}
   */
  count(ctx) {
    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    if(usrfromToken.type == 'supplier'){
      ctx.query.supplier = usrfromToken.supplier;
      ctx.query._publicationState = 'preview';
    } else {
      ctx.query.expires_at_gte = new Date();
    }

    ctx.query.deleted = false;
    if (ctx.query._q) {
      return strapi.services.offer.countSearch(ctx.query);
    }
    return strapi.services.offer.count(ctx.query);
  },

  /**
   * Create a record.
   *
   * @return {Object}
   */
  async create(ctx) {
    let entity;
    let data, files;

    if (ctx.is("multipart")) {
      ({ data, files } = parseMultipartData(ctx));
    } else {
      data = ctx.request.body;
    }

    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    if(usrfromToken.type !== 'supplier'){
      return ctx.badRequest("User is not supplier, can't create services.");
    }

    // find avalible ticket
    let ticket = await strapi.services['offer-ticket'].findOne({
      supplier: usrfromToken.supplier,
      spent: false,
      _or: [
        {expires_at_null: true},
        {expires_at_gte: new Date()}
      ],
      _sort: 'free:DESC,expires_at:ASC'
    });

    if(!ticket) {
      return ctx.badRequest("Can't find any avalible offer ticket.");
    }

    data.author = usrfromToken.id;
    data.supplier = usrfromToken.supplier;
    data.expires_at = new Date().addDays(3);
    //data.published_at = null;
    entity = await strapi.services.offer.create(data, { files });

    // mark ticket as spent
    if(entity) {
      ticket = await strapi.services['offer-ticket'].update({ id: ticket.id }, {
        spent: true,
        spent_for: entity.id,
        spent_by: usrfromToken.id,
        spent_at: new Date()
      });
    }

    return sanitizeEntity(entity, { model: strapi.models.offer });
  },

  /**
   * Delete a record.
   *
   * @return {Object}
   */
  async delete(ctx) {
    const { id } = ctx.params;
    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    if(usrfromToken.type != 'supplier'){
      return ctx.badRequest("User not supplier.");
    }

    let entity = await strapi.services.offer.findOne({ id });

    if(entity) {
      if(usrfromToken.supplier != entity.supplier.id){
        return ctx.badRequest("This service don't belong to current user.");
      }
      entity = await strapi.services.offer.update({ id }, { deleted: true });
    }

    return sanitizeEntity(entity, { model: strapi.models.offer });
  },

  /**
   * sets fav item
   *
   * @return {Object}
   */
   async addFav(ctx) {
    const { id } = ctx.params;
    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");
    const entity = await strapi.services.offer.findOne({ id });
    if(!entity) {
      return ctx.badRequest("Item not found.");
    }

    const knex = strapi.connections.default;
    let _fav = await knex('offers_favs__users_fav_offers').where({user_id: usrfromToken.id, offer_id: entity.id}).first();

    if(!_fav){
      let ret = await knex('offers_favs__users_fav_offers').insert({user_id: usrfromToken.id, offer_id: entity.id});
      if(ret && ret[0]){
        _fav = await knex('offers_favs__users_fav_offers').where({id: ret[0]}).first();
      } else {
        return ctx.badRequest("Error adding item to favorites.");
      }
    }

    return _fav;
  },

  /**
   * removes fav item
   *
   * @return {Object}
   */
  async removeFav(ctx) {
    const { id } = ctx.params;
    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");
    const entity = await strapi.services.offer.findOne({ id });
    if(!entity) {
      return ctx.badRequest("Item not found.");
    }

    const knex = strapi.connections.default;
    let _fav = await knex('offers_favs__users_fav_offers').where({user_id: usrfromToken.id, offer_id: entity.id}).del();

    return _fav;
  },
};
