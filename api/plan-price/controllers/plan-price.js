'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const { sanitizeEntity } = require('strapi-utils');

module.exports = {
  /**
   * Retrieve records.
   *
   * @return {Array}
   */
  async find(ctx) {
    let entities;

    ctx.query._where = [
      { plan_null: false }
    ];

    ctx.query._sort = 'plan.id:ASC';

    if (ctx.query._q) {
      entities = await strapi.services['plan-price'].search(ctx.query);
    } else {
      entities = await strapi.services['plan-price'].find(ctx.query);
    }

    if(entities) {

    }

    return entities.map(entity => sanitizeEntity(entity, { model: strapi.models['plan-price'] }));
  },
};
