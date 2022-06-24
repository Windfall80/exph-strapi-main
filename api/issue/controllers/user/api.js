'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */
const { parseMultipartData, sanitizeEntity } = require("strapi-utils");

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

    // add filters so suppliers can't access companies issues
    if(usrfromToken.type == 'supplier'){
      ctx.query.supplier = usrfromToken.supplier;
    }

    // add filters so companies can't acces other companies issues
    if(usrfromToken.type == 'company'){
      ctx.query.company = usrfromToken.company;
    }

    // if user is not administrator he can only access his own issues
    if(usrfromToken.role.type !== 'administrator'){
      ctx.query.user = usrfromToken.id;
    }

    ctx.query._publicationState = 'preview';
    if (ctx.query._q) {
      entities = await strapi.services['issue'].search(ctx.query);
    } else {
      entities = await strapi.services['issue'].find(ctx.query);
    }

    return entities.map(entity => sanitizeEntity(entity, { model: strapi.models['issue'] }));
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

    // add filters so suppliers can't access companies issues
    if(usrfromToken.type == 'supplier'){
      ctx.query.supplier = usrfromToken.supplier;
    }

    // add filters so companies can't acces other companies issues
    if(usrfromToken.type == 'company'){
      ctx.query.company = usrfromToken.company;
    }

    // if user is not administrator he can only access his own issues
    if(usrfromToken.role.type !== 'administrator'){
      ctx.query.user = usrfromToken.id;
    }

    ctx.query._publicationState = 'preview';
    const entity = await strapi.services['issue'].findOne({ id, ...ctx.query });

    return sanitizeEntity(entity, { model: strapi.models['issue'] });
  },

  /**
   * Count records.
   *
   * @return {Number}
   */

  count(ctx) {
    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    // add filters so suppliers can't access companies issues
    if(usrfromToken.type == 'supplier'){
      ctx.query.supplier = usrfromToken.supplier;
    }

    // add filters so companies can't acces other companies issues
    if(usrfromToken.type == 'company'){
      ctx.query.company = usrfromToken.company;
    }

    // if user is not administrator he can only access his own issues
    if(usrfromToken.role.type !== 'administrator'){
      ctx.query.user = usrfromToken.id;
    }

    if (ctx.query._q) {
      return strapi.services.issue.countSearch(ctx.query);
    }
    return strapi.services.issue.count(ctx.query);
  },

  /**
   * Update a record.
   *
   * @return {Object}
   */
  async update(ctx) {
    return ctx.badRequest("Not allowed.");

    const { id } = ctx.params;

    let entity;
    if (ctx.is('multipart')) {
      const { data, files } = parseMultipartData(ctx);
      entity = await strapi.services.issue.update({ id }, data, {
        files,
      });
    } else {
      entity = await strapi.services.issue.update({ id }, ctx.request.body);
    }

    return sanitizeEntity(entity, { model: strapi.models.issue });
  },
};
