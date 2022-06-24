'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const { parseMultipartData, sanitizeEntity } = require("strapi-utils");

module.exports = {
  /**
   * Retrieve the record.
   *
   * @return {Object}
   */

   async find(ctx) {
    const entity = await strapi.services['nav-catalog'].find();
    //console.dir(entity, { depth: null });
    return sanitizeEntity(entity, { model: strapi.models['nav-catalog'] });
  },
};
