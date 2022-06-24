'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const { parseMultipartData, sanitizeEntity } = require("strapi-utils");

async function sanitizeRequest(entity) {
  if(!entity) return sanitizeEntity(entity, { model: strapi.models['offer-request'] });

  if(entity.offer && entity.offer.id){
    entity.offer = await strapi.services['offer'].findOne({ id: entity.offer.id });
    //delete entity.offer.request;
  }
  if(entity.rating && entity.rating.id){
    entity.rating = await strapi.services['rating'].findOne({ id: entity.rating.id });
    delete entity.rating.request;
  }

  return sanitizeEntity(entity, { model: strapi.models['offer-request'] });
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

    // add filters so suppliers can't access companies groups
    if(usrfromToken.type == 'supplier'){
      ctx.query.supplier = usrfromToken.supplier;
    }

    // add filters so companies can't acces other companies groups
    if(usrfromToken.type == 'company'){
      ctx.query.company = usrfromToken.company;

      // if user is not administrator he can only access his own groups
      if(usrfromToken.role.type !== 'administrator'){
        ctx.query.user = usrfromToken.id;
      }
    }

    if (ctx.query._q) {
      entities = await strapi.services['offer-request'].search(ctx.query);
    } else {
      entities = await strapi.services['offer-request'].find(ctx.query);
    }

    return entities.map(entity => sanitizeEntity(entity, { model: strapi.models['offer-request'] }));
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
      ctx.query.supplier = usrfromToken.supplier;
    }

    // add filters so companies can't acces other companies groups
    if(usrfromToken.type == 'company'){
      ctx.query.company = usrfromToken.company;

      // if user is not administrator he can only access his own groups
      if(usrfromToken.role.type !== 'administrator'){
        ctx.query.user = usrfromToken.id;
      }
    }

    const entity = await strapi.services['offer-request'].findOne({ id, ...ctx.query });

    return sanitizeRequest(entity);
  },

  /**
   * Method should only be multipart because expects file on same request
   *
   * @param {*} ctx
   * @returns
   */
   async create(ctx) {
    let entity;
    let data, files;

    if (ctx.is("multipart")) {
      ({ data, files } = parseMultipartData(ctx));
    } else {
      data = ctx.request.body;
    }

    let usrfromToken;
    try {
      usrfromToken = ctx.state.user;
    } catch (err) {
      return ctx.badRequest(err, "error in token");
    }
    data.user = usrfromToken.id;
    data.company = usrfromToken.company;
    data.status = 2; // set status as pending

    let offer = await strapi.services.offer.findOne({id: data.offer});
    if(!offer) {
      return ctx.badRequest(`Can't find offer rquested.`);
    }
    data.supplier = offer.supplier;

    entity = await strapi.services['offer-request'].create(data, { files });

    // send notification to supplier(s) about new request for quotation
    if(entity) {
      // set offer as already requested
      offer = await strapi.services.offer.update({id: offer.id}, { requested: true });
      // broadcast offer requested so other clients cant request
      strapi.io.emit("offer_requested", {offer: offer.id, user: usrfromToken.id});

      // send notification to supplier
      const _users = await strapi.plugins["users-permissions"].services.user.fetchAll({ supplier: entity.supplier.id, confirmed: true });
      for(let _us of _users) {
        strapi.services.notification.create({
          message: `<span class="name">${entity.company.name}</span> te ha enviado una solicitud de oferta relámpago.`,
          link: `/proveedores/ofertas-relampago/${entity.id}`,
          user: _us.id
        });
      }
    }

    return sanitizeEntity(entity, { model: strapi.models['offer-request'] });
  },

  /**
   * transfer ownership of a request to another user.
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

    let entity = await strapi.services['offer-request'].update({ id }, data);

    return sanitizeEntity(entity, { model: strapi.models['offer-request'] });
  },

  /**
   * sets the status of request as accepted (5) and sends notification to supplier.
   *
   * @return {Object}
   */
   async accept(ctx) {
    const { id } = ctx.params;

    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    // add filters so companies can't continue
    if(usrfromToken.type != 'supplier'){
      return ctx.badRequest("Clients can't accept offer requests.");
    }

    // load request
    let entity = await strapi.services['offer-request'].findOne({ id });
    if( usrfromToken.supplier !== entity.supplier.id ) {
      return ctx.badRequest("User can't interact with this request.");
    }

    // update entity
    entity = await strapi.services['offer-request'].update({ id }, { status: 5, accepted_at: Date.now() });

    //send notification
    try {
      strapi.services.notification.create({
        message: `<span class="name">${entity.supplier.name}</span> ha aceptado tu peticion de oferta.`,
        link: `/empresas/ofertas-relampago/${entity.id}`,
        user: entity.user.id
      });
    } catch (err) {}

    return sanitizeRequest(entity);
  },

  /**
   * sets request status as discarded (4) and alerts supplier.
   *
   * @return {Object}
   */
   async discard(ctx) {
    const { id } = ctx.params;
    let data;

    if (ctx.is("multipart")) {
      ({ data } = parseMultipartData(ctx));
    } else {
      data = ctx.request.body;
    }

    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    // add filters so companies can't continue
    if(usrfromToken.type != 'supplier'){
      return ctx.badRequest("Clients can't accept offer requests.");
    }

    // load request
    let entity = await strapi.services['offer-request'].findOne({ id });
    if( usrfromToken.supplier !== entity.supplier.id ) {
      return ctx.badRequest("User can't interact with this request.");
    }

    // set offer as not requested again
    let offer = await strapi.services.offer.update({id: entity.offer.id}, { requested: false });

    // update entity
    entity = await strapi.services['offer-request'].update({ id }, { status: 4, discarded_at: Date.now() });



    //send notification
    try {
      if(entity.offer.author)
        strapi.services.notification.create({
          message: `<span class="name">${entity.supplier.name}</span> ha rechazado tu peticion de oferta.`,
          link: `/empresas/ofertas-relampago/${entity.id}`,
          user: entity.user.id
        });
    } catch (err) {}

    return sanitizeRequest(entity);
  },

  /**
   * sets delivery date for the offer request. and sends notification to suplier.
   *
   * @return {Object}
   */
  async setDelivery(ctx) {
    const { id } = ctx.params;
    let data;

    if (ctx.is("multipart")) {
      ({ data } = parseMultipartData(ctx));
    } else {
      data = ctx.request.body;
    }

    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    // check if user can interact with request
    let entity = await strapi.services['offer-request'].findOne({ id });
    if( usrfromToken.id !== entity.user.id ) {
      return ctx.badRequest("User can't interact with this request.");
    }

    //update offer info
    entity = await strapi.services['offer-request'].update({ id }, data);

    //send notification
    try {
      strapi.services.notification.create({
        message: `<span class="name">${entity.company.name}</span> ha establecido un plazo de entrega para tu oferta.`,
        link: `/proveedores/ofertas-relampago/${entity.id}`,
        user: entity.offer.author
      });
    } catch (err) {}

    return sanitizeRequest(entity);
  },

  /**
   * sets request user rating and changues the status of request to finished (7).
   * also sends notification to supplier.
   *
   * @return {Object}
   */
   async setRating(ctx) {
    const { id } = ctx.params;
    let data;

    if (ctx.is("multipart")) {
      ({ data } = parseMultipartData(ctx));
    } else {
      data = ctx.request.body;
    }

    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    // check if user can interact with request
    let entity = await strapi.services['offer-request'].findOne({ id });
    console.log(entity);
    if( usrfromToken.id !== entity.user.id ) {
      return ctx.badRequest("User can't interact with this request.");
    }

    // create rating record
    data.request = entity.id;
    data.offer = entity.offer.id;
    data.supplier = entity.supplier.id;
    data.rated_by = usrfromToken.id;
    let rating = await strapi.services.rating.create(data);

    // set request status
    entity = await strapi.services['offer-request'].update({ id }, { status: 7 });

    //send notification
    try {
      strapi.services.notification.create({
        message: `<span class="name">${entity.company.name}</span> ha finalizado y calificado tu oferta.`,
        link: `/proveedores/ofertas-relampago/${entity.id}`,
        user: entity.offer.author
      });
    } catch (err) {}

    return sanitizeRequest(entity);
  },

};
