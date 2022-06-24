'use strict';

const _ = require('lodash');
const { contentTypes: contentTypesUtils, parseMultipartData, sanitizeEntity } = require('strapi-utils');



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
            return ctx.badRequest(err, "User not authenticated.");
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
    const { id } = ctx.params;
    let data, files;

    if (ctx.is("multipart")) {
      ({ data, files } = parseMultipartData(ctx));
    } else {
      data = ctx.request.body;
    }

    let entity = await strapi.services.issue.findOne({ id });

    if(entity) {
      let _prevStatus = entity.status.id;
      entity = await strapi.services.issue.update({ id }, data, { files });

      if(entity && _prevStatus != entity.status.id) {
        let route
        if(entity.user.type = 'company'){
          route = `/empresas/incidencias/${entity.id}`;
        } else {
          route = `/proveedores/incidencias/${entity.id}`;
        }

        strapi.services.notification.create({
          message: `El estatus de tu reporte de incidencia cambio a "${entity.status.name}".`,
          link: route,
          user: entity.user
        });
      }
    }
    return sanitizeEntity(entity, { model: strapi.models.issue });
  },
};
