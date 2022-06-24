'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const { sanitizeEntity } = require("strapi-utils");

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

    // add filters so suppliers can't access companies groups
    if(usrfromToken.type == 'supplier'){
      return ctx.badRequest("User type supplier should not access groups.");
    }

    // add filters so companies can't acces other companies groups
    if(usrfromToken.type == 'company'){
      ctx.query.company = usrfromToken.company;

      // if user is not administrator he can only access his own groups
      if(usrfromToken.role.type !== 'administrator'){
        ctx.query._or = [
          { user: usrfromToken.id },
          { "quotations.user": usrfromToken.id }
        ];
      }
    }

    if (ctx.query._q) {
      entities = await strapi.services['quotation-group'].search(ctx.query);
    } else {
      entities = await strapi.services['quotation-group'].find(ctx.query);
    }

    return entities.map(entity => sanitizeEntity(entity, { model: strapi.models['quotation-group'] }));
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

    // add filters so suppliers can't access companies groups
    if(usrfromToken.type == 'supplier'){
      return ctx.badRequest(err, "User type supplier should not access groups.");
    }

    // add filters so companies can't acces other companies groups
    if(usrfromToken.type == 'company'){
      ctx.query.company = usrfromToken.company;

      // if user is not administrator he can only access his own groups
      if(usrfromToken.role.type !== 'administrator'){
        ctx.query._or = [
          { user: usrfromToken.id },
          { "quotations.user": usrfromToken.id }
        ];
      }
    }

    const entity = await strapi.services['quotation-group'].findOne({ id, ...ctx.query });
    return sanitizeEntity(entity, { model: strapi.models['quotation-group'] });
  },

  /**
   * transfer ownership of a group to another user.
   *
   * @return {Object}
   */
  async share(ctx) {
    const { id } = ctx.params;
    let data;

    if (ctx.is("multipart")) {
      ({ data } = parseMultipartData(ctx));
    } else {
      data = ctx.request.body;
    }

    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    // verify that new user exists and is from te same company that originarl user
    const user = await strapi.plugins["users-permissions"].services.user.fetch({ id: data.user });
    if(!user || user.company.id !== usrfromToken.company){
      return ctx.badRequest("Can't transfer to users from another company.");
    }

    let entity = await strapi.services['quotation-group'].update({ id }, data);

    // update childrens with query because i cant remove limit of one with .update
    await strapi.query('quotation').model.where({ group: id, user: usrfromToken.id }).save({ ...data }, {method: 'update', patch: true});

    return sanitizeEntity(entity, { model: strapi.models['quotation-group'] });
  },

  /**
   * changue status of group to closed and set all non accepted quotations as discarded.
   *
   * @return {Object}
   */
  async close(ctx) {
    const { id } = ctx.params;
    let data;

    if (ctx.is("multipart")) {
      ({ data } = parseMultipartData(ctx));
    } else {
      data = ctx.request.body;
    }

    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    // set status as discarded of children with non accepted status 1
    let toUpdate = await strapi.services.quotation.find({ group: id, status: [1,2,3] });
    for( let _q of toUpdate ) {
      await strapi.services.quotation.update({ id: _q.id }, { status: 4 });
    }

    let entity = await strapi.services['quotation-group'].update({ id }, {status: 0, ...data});
    return sanitizeEntity(entity, { model: strapi.models['quotation-group'] });
  },
};
