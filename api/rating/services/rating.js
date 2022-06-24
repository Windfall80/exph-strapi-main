'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

const { isDraft } = require('strapi-utils').contentTypes;
const util = require('util');

module.exports = {
  /**
   * Promise to add record
   *
   * @return {Promise}
   */
  async create(data) {
    const validData = await strapi.entityValidator.validateEntityCreation(
      strapi.models.rating,
      data,
      { isDraft: isDraft(data, strapi.models.rating) }
    );

    const entry = await strapi.query('rating').create(validData);

    const knex = strapi.connections.default;
    console.log(util.inspect(entry, {showHidden: false, depth: null, colors: true}))

    //recalculate and save supplier model rating
    if (entry.supplier) {
      // get avg and count ratings
      let r = await knex('ratings').where({supplier: entry.supplier.id}).select([knex.raw('ROUND(AVG(rating),1) as rating'), knex.raw('COUNT(id) as rating_count')]).first();
      if(r){
        let supplier = await strapi.query('supplier').update({id: entry.supplier.id}, {rating: r.rating, rating_count: r.rating_count});
      }
    }

    //recalculate and save service model rating
    if (entry.quotation && entry.service) {
      // get avg and count ratings
      let r = await knex('ratings').where({'service': entry.service.id}).select([knex.raw('ROUND(AVG(rating),1) as rating'), knex.raw('COUNT(id) as rating_count')]).first();
      if(r){
        let service = await strapi.query('service').update({id: entry.service.id}, {rating: r.rating, rating_count: r.rating_count});
      }
    }

    return entry;
  },
};
