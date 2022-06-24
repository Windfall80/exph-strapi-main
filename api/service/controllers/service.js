'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const { parseMultipartData, sanitizeEntity } = require("strapi-utils");
const util = require('util');

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
    }

    ctx.query._and = [];
    if(ctx.query._slug) {
      let _cat = await strapi.services.category.findOne({slug: ctx.query._slug});
      delete ctx.query._slug;

      if(_cat) {
        ctx.query._and.push({_or: [ {main_category_eq: _cat.id}, {categories_in: [_cat.id]} ]});
      } else {
        return ctx.badRequest("Category not found.");
      }
    }

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
    }

    if("_favs" in ctx.query) {
      delete ctx.query._favs;
      ctx.query._and.push({favs: usrfromToken.id});
    }

    // by default order by rating
    if( !("_sort" in ctx.query) ) {
      ctx.query._sort = 'rating:DESC';
    }
    ctx.query._sort += ',id:ASC';

    // do search
    ctx.query.deleted = false;
    if (ctx.query._q) {
      entities = await strapi.services.service.search(ctx.query);
    } else {
      entities = await strapi.services.service.find(ctx.query);
    }

    let services = await Promise.all(entities.map( async(entity) => {
      const service = sanitizeEntity(entity, {
        model: strapi.models.service,
      });

      // add missing attributes from nested levels
      if (service.supplier && service.supplier.id) {
        let { payment_methods, payment_terms } = await strapi.services.supplier.findOne({ id: service.supplier.id, _publicationState: 'preview' });
        service.supplier.payment_methods = payment_methods;
        service.supplier.payment_terms = payment_terms;
      }

      service.isFav = entity.favs.some(e => e.id === usrfromToken.id);

      return service;
    }));

    //count all
    let count
    if (ctx.query._q) {
      count = await strapi.services.service.countSearch(ctx.query);
    } else {
      count = await strapi.services.service.count(ctx.query);
    }

    return { count, data: services };
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
    }

    const entity = await strapi.services.service.findOne({ id, ...ctx.query });
    entity.isFav = entity.favs.some(e => e.id === usrfromToken.id);
    return sanitizeEntity(entity, { model: strapi.models.service });
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
    }

    ctx.query.deleted = false;
    if (ctx.query._q) {
      return strapi.services.service.countSearch(ctx.query);
    }
    return strapi.services.service.count(ctx.query);
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

    data.supplier = usrfromToken.supplier;

    //data.published_at = null;
    entity = await strapi.services.service.create(data, { files });

    return sanitizeEntity(entity, { model: strapi.models.service });
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

    let entity = await strapi.services.service.findOne({ id });

    if(entity) {
      if(usrfromToken.supplier != entity.supplier.id){
        return ctx.badRequest("This service don't belong to current user.");
      }
      entity = await strapi.services.service.update({ id }, { deleted: true });
    }

    return sanitizeEntity(entity, { model: strapi.models.service });
  },

  /**
   * removes fav item
   *
   * @return {Object}
   */
   async addFav(ctx) {
    const { id } = ctx.params;
    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");
    const entity = await strapi.services.service.findOne({ id });
    if(!entity) {
      return ctx.badRequest("Item not found.");
    }

    const knex = strapi.connections.default;
    let _fav = await knex('services_favs__users_fav_services').where({user_id: usrfromToken.id, service_id: entity.id}).first();

    if(!_fav){
      let ret = await knex('services_favs__users_fav_services').insert({user_id: usrfromToken.id, service_id: entity.id});
      if(ret && ret[0]){
        _fav = await knex('services_favs__users_fav_services').where({id: ret[0]}).first();
      } else {
        return ctx.badRequest("Error adding item to favorites.");
      }
    }

    return _fav;
  },

  /**
   * sets fav item
   *
   * @return {Object}
   */
  async removeFav(ctx) {
    const { id } = ctx.params;
    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");
    const entity = await strapi.services.service.findOne({ id });
    if(!entity) {
      return ctx.badRequest("Item not found.");
    }

    const knex = strapi.connections.default;
    let _fav = await knex('services_favs__users_fav_services').where({user_id: usrfromToken.id, service_id: entity.id}).del();

    return _fav;
  },
};
