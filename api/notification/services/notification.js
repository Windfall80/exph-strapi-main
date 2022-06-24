'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

const { isDraft } = require('strapi-utils').contentTypes;

module.exports = {
  /**
   * Promise to add record
   *
   * @return {Promise}
   */

   async create(data) {
    const validData = await strapi.entityValidator.validateEntityCreation(
      strapi.models.notification,
      data,
      { isDraft: isDraft(data, strapi.models.notification) }
    );

    const entry = await strapi.query('notification').create(validData);

    if (entry) {
      // automatically push notification to user if is connected trough socket
      let socket = await strapi.services.socket.findOne({user: entry.user.id});
      if(socket){
        //console.log('emiting notification to: ', socket);
        strapi.io.to(socket.token).emit("notificacion_insert", entry);
      }
    }

    return entry;
  },
};
