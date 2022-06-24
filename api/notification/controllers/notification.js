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

    let usrfromToken;
    try {
      usrfromToken = ctx.state.user;
    } catch (err) {
      return ctx.badRequest(err, "error in token");
    }
    ctx.query.user = usrfromToken.id;

    if (ctx.query._q) {
      entities = await strapi.services.notification.search(ctx.query);
    } else {
      entities = await strapi.services.notification.find(ctx.query);
    }

    return entities.map(entity => sanitizeEntity(entity, { model: strapi.models.notification }));
  },

  /**
   * Retrieve a record.
   *
   * @return {Object}
   */
  async findOne(ctx) {
    const { id } = ctx.params;

    let usrfromToken;
    try {
      usrfromToken = ctx.state.user;
    } catch (err) {
      return ctx.badRequest(err, "error in token");
    }

    const entity = await strapi.services.notification.findOne({ id, user: usrfromToken.id });
    return sanitizeEntity(entity, { model: strapi.models.notification });
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
      return ctx.badRequest(err, "error in token");
    }
    ctx.query.user = usrfromToken.id;

    if (ctx.query._q) {
      return strapi.services.notification.countSearch(ctx.query);
    }
    return strapi.services.notification.count(ctx.query);
  },

  /**
   * Delete a record.
   *
   * @return {Object}
   */
   async delete(ctx) {
    const { id } = ctx.params;

    let usrfromToken;
    try {
      usrfromToken = ctx.state.user;
    } catch (err) {
      return ctx.badRequest(err, "error in token");
    }

    const entity = await strapi.services.notification.delete({ id, user: usrfromToken.id });
    return sanitizeEntity(entity, { model: strapi.models.notification });
  },

  /**
   * Delete all records.
   *
   * @return {Object}
   */
  async deleteAll(ctx) {
    let usrfromToken;
    try {
      usrfromToken = ctx.state.user;
    } catch (err) {
      return ctx.badRequest(err, "error in token");
    }

    const entity = await strapi.services.notification.delete({ user: usrfromToken.id });
    return sanitizeEntity(entity, { model: strapi.models.notification });
  },
};
