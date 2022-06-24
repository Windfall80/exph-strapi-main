'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const { parseMultipartData, sanitizeEntity } = require("strapi-utils");

async function sanitizeQuotation(entity) {
  if(!entity) return sanitizeEntity(entity, { model: strapi.models['quotation'] });

  if(entity.offer && entity.offer.id){
    entity.offer = await strapi.services['quotation-offer'].findOne({ id: entity.offer.id });
    delete entity.offer.quotation;
  }
  if(entity.rating && entity.rating.id){
    entity.rating = await strapi.services['rating'].findOne({ id: entity.rating.id });
    delete entity.rating.quotation;
  }

  return sanitizeEntity(entity, { model: strapi.models['quotation'] });
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

    // add filters so suppliers can't access companies quotations
    if(usrfromToken.type == 'supplier'){
      ctx.query.supplier = usrfromToken.supplier;
    }

    // add filters so companies can't acces other companies quotations
    if(usrfromToken.type == 'company'){
      ctx.query.company = usrfromToken.company;

      // if user is not administrator he can only access his own quotations
      if(usrfromToken.role.type !== 'administrator'){
        ctx.query.user = usrfromToken.id;
      }
    }

    if (ctx.query._q) {
      entities = await strapi.services['quotation'].search(ctx.query);
    } else {
      entities = await strapi.services['quotation'].find(ctx.query);
    }

    return entities.map(entity => sanitizeEntity(entity, { model: strapi.models['quotation'] }));
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

    // add filters so suppliers can't access companies quotations
    if(usrfromToken.type == 'supplier'){
      ctx.query.supplier = usrfromToken.supplier;
    }

    // add filters so companies can't acces other companies quotations
    if(usrfromToken.type == 'company'){
      ctx.query.company = usrfromToken.company;

      // if user is not administrator he can only access his own quotations
      if(usrfromToken.role.type !== 'administrator'){
        ctx.query.user = usrfromToken.id;
      }
    }

    const entity = await strapi.services['quotation'].findOne({ id, ...ctx.query });

    return sanitizeQuotation(entity);
  },

  /**
   * Count records.
   *
   * @return {Number}
   */
  async count(ctx) {
    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    // add filters so suppliers can't access companies quotations
    if(usrfromToken.type == 'supplier'){
      ctx.query.supplier = usrfromToken.supplier;
    }

    // add filters so companies can't acces other companies quotations
    if(usrfromToken.type == 'company'){
      ctx.query.company = usrfromToken.company;

      // if user is not administrator he can only access his own quotations
      if(usrfromToken.role.type !== 'administrator'){
        ctx.query.user = usrfromToken.id;
      }
    }

    if (ctx.query._q) {
      return await strapi.services.quotation.countSearch(ctx.query);
    }
    return await strapi.services.quotation.count(ctx.query);
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
    data.status = 1;

    let service = await strapi.services.service.findOne({id: data.service});
    if(!service) {
      return ctx.badRequest(`Can't find service to quote.`);
    }
    data.supplier = service.supplier;

    let _q = await strapi.services.quotation.create(data, { files });

    // send notification to supplier(s) about new request for quotation
    if(_q) {
      const _users = await strapi.plugins["users-permissions"].services.user.fetchAll({ supplier: service.supplier.id, confirmed: true });
      for(let _us of _users) {
        strapi.services.notification.create({
          message: `<span class="name">${_q.company.name}</span> te ha enviado una solicitud de cotización.`,
          link: `/proveedores/cotizaciones/${_q.id}`,
          user: _us.id
        });
        strapi.services.email.sendNewQuotation(_us, _q);
      }
    }

    /** At the end greate group */
    const dataGroup = {
      name: data.name,
      quotations: [_q],
      user: usrfromToken.id,
      company: usrfromToken.company
    }

    entity = await strapi.services['quotation-group'].create(dataGroup);

    return sanitizeEntity(entity, { model: strapi.models['quotation-group'] });
  },

  /**
   * Method should only be appliction/json because file was previously uploaded
   * @param {*} ctx
   * @returns
   */
  async bulkCreate(ctx) {
    let entity;
    let data;

    if (ctx.is("multipart")) {
      ({ data } = parseMultipartData(ctx));
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
    data.status = 1;

    const _sid = data._services;
    delete data._services;
    let services = await strapi.services.service.find({id: _sid});
    if(services.length == 0) {
      return ctx.badRequest(`Can't find services to quote.`);
    }

    let quotations = [];
    for(let service of services) {
      data.service = service.id;
      data.supplier = service.supplier;

      let _q = await strapi.services.quotation.create(data);
      if(_q) quotations.push(_q);

      // send notification to supplier(s) about new request for quotation
      if(_q) {
        const _users = await strapi.plugins["users-permissions"].services.user.fetchAll({ supplier: service.supplier.id, confirmed: true });
        for(let _us of _users) {
          strapi.services.notification.create({
            message: `<span class="name">${_q.company.name}</span> te ha enviado una solicitud de cotización.`,
            link: `/proveedores/cotizaciones/${_q.id}`,
            user: _us.id
          });
          strapi.services.email.sendNewQuotation(_us, _q);
        }
      }
    }

    /** At the end greate group */
    let _qid = await quotations.map((_q=>{ return _q.id }));
    const dataGroup = {
      name: data.name,
      quotations: _qid,
      user: usrfromToken.id,
      company: usrfromToken.company
    }

    entity = await strapi.services['quotation-group'].create(dataGroup);

    return sanitizeEntity(entity, { model: strapi.models['quotation-group'] });
  },

  /**
   * Method should only be appliction/json because file was previously uploaded
   *
   * Recives quotation form (without service) and supplier search criteria, then creates one
   * quotation per matching supplier and groups them in a single quotation-group
   *
   * @param {*} ctx
   * @returns
   */
   async autoCreate(ctx) {
    let entity;
    let data;

    if (ctx.is("multipart")) {
      ({ data } = parseMultipartData(ctx));
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
    data.status = 1;

    // find matching suppliers
    const sc = data.supplier_criteria;
    delete data.supplier_criteria;
    /*{
      "main_category": 1,
      "categories": [5,6,7],
      "payment_methods": [1,2],
      "payment_terms": [1,2,3,4]
    }*/

    let suppliers = await strapi.services.supplier.find({...sc});
    if(suppliers.length == 0) {
      return ctx.badRequest(`No se encontraron proveedores que cumplan los criterios de búsqueda seleccionados.`);
    }

    let quotations = [];
    for(let supplier of suppliers) {
      data.supplier = supplier.id;

      let _q = await strapi.services.quotation.create(data);
      if(_q) quotations.push(_q);

      // send notification to supplier(s) about new request for quotation
      if(_q) {
        const _users = await strapi.plugins["users-permissions"].services.user.fetchAll({ supplier: supplier.id, confirmed: true });
        for(let _us of _users) {
          strapi.services.notification.create({
            message: `<span class="name">${_q.company.name}</span> te ha enviado una solicitud de cotización.`,
            link: `/proveedores/cotizaciones/${_q.id}`,
            user: _us.id
          });
          strapi.services.email.sendNewQuotation(_us, _q);
        }
      }
    }

    /** At the end greate group */
    let _qid = await quotations.map((_q=>{ return _q.id }));
    const dataGroup = {
      name: data.name,
      quotations: _qid,
      user: usrfromToken.id,
      company: usrfromToken.company
    }

    entity = await strapi.services['quotation-group'].create(dataGroup);

    return sanitizeEntity(entity, { model: strapi.models['quotation-group'] });
  },

  /**
   * transfer ownership of a quotation to another user.
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

    let entity = await strapi.services['quotation'].update({ id }, data);

    return sanitizeEntity(entity, { model: strapi.models['quotation'] });
  },

  /**
   * sets the status of quotation as interested (3) and sends notification to supplier.
   *
   * @return {Object}
   */
  async interest(ctx) {
    const { id } = ctx.params;

    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    // check if user can interact with quotation
    let entity = await strapi.services.quotation.findOne({ id });
    if( usrfromToken.id !== entity.user.id ) {
      return ctx.badRequest("User can't interact with this quotation.");
    }

    // update entity
    entity = await strapi.services.quotation.update({ id }, { status: 3 });

    //send notification
    try {
      strapi.services.notification.create({
        message: `A <span class="name">${entity.company.name}</span> le interesa tu cotización.`,
        link: `/proveedores/cotizaciones/${entity.id}`,
        user: entity.offer.author
      });
      strapi.services.email.sendQuotationInterest(entity.offer.author, entity);
    } catch (err) {}

    return sanitizeQuotation(entity);
  },

  /**
   * sets the status of quotation as accepted (5) and sends notification to supplier.
   *
   * @return {Object}
   */
  async close(ctx) {
    const { id } = ctx.params;

    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    // check if user can interact with quotation
    let entity = await strapi.services.quotation.findOne({ id });
    if( usrfromToken.id !== entity.user.id ) {
      return ctx.badRequest("User can't interact with this quotation.");
    }

    //update offer info
    let offer = await strapi.services['quotation-offer'].update({ id: entity.offer.id }, { accepted_at: Date.now() });

    // update entity
    entity = await strapi.services.quotation.update({ id }, { status: 5 });

    //send notification
    try {
      strapi.services.notification.create({
        message: `<span class="name">${entity.company.name}</span> ha aceptado tu oferta de cotización.`,
        link: `/proveedores/cotizaciones/${entity.id}`,
        user: entity.offer.author
      });
      strapi.services.email.sendQuotationClose(entity.offer.author, entity);
    } catch (err) {}

    return sanitizeQuotation(entity);
  },

  /**
   * sets delivery date for the quotation offer. and sends notification to suplier.
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

    // check if user can interact with quotation
    let entity = await strapi.services.quotation.findOne({ id });
    if( usrfromToken.id !== entity.user.id ) {
      return ctx.badRequest("User can't interact with this quotation.");
    }

    //update offer info
    let offer = await strapi.services['quotation-offer'].update({ id: entity.offer.id }, data);
    delete offer.quotation;

    //send notification
    try {
      strapi.services.notification.create({
        message: `<span class="name">${entity.company.name}</span> ha establecido un plazo de entrega para tu cotización.`,
        link: `/proveedores/cotizaciones/${entity.id}`,
        user: entity.offer.author
      });
      strapi.services.email.sendQuotationDeliverySet(entity.offer.author, entity);
    } catch (err) {}

    return sanitizeEntity(offer, { model: strapi.models['quotation-offer'] });
  },

  /**
   * sets quotation user rating and changues the status of quotation to finished (7).
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

    // check if user can interact with quotation
    let entity = await strapi.services.quotation.findOne({ id });
    if( usrfromToken.id !== entity.user.id ) {
      return ctx.badRequest("User can't interact with this quotation.");
    }

    // create rating record
    data.quotation = entity.id;
    if(entity.service)
      data.service = entity.service.id;
    data.supplier = entity.supplier.id;
    data.rated_by = usrfromToken.id;
    let rating = await strapi.services.rating.create(data)

    // set quotation status
    entity = await strapi.services.quotation.update({ id }, { status: 7 });

    //send notification
    try {
      strapi.services.notification.create({
        message: `<span class="name">${entity.company.name}</span> ha finalizado y calificado tu cotización.`,
        link: `/proveedores/cotizaciones/${entity.id}`,
        user: entity.offer.author
      });
      //strapi.services.email.sendQuotationRatingSet(entity.offer.author, entity, rating);
      strapi.services.email.sendQuotationRatingSet_Stars(entity.offer.author, entity, rating);
    } catch (err) {}

    return sanitizeQuotation(entity);
  },

  /**
   * sets quotation status as discarded (4) and alerts supplier.
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

    // check if user can interact with quotation
    let entity = await strapi.services.quotation.findOne({ id });
    if( usrfromToken.id !== entity.user.id ) {
      return ctx.badRequest("User can't interact with this quotation.");
    }

    // set quotation status
    entity = await strapi.services.quotation.update({ id }, { status: 4, discarded_at: Date.now(), ...data });

    //send notification
    try {
      if(entity.offer.author)
        strapi.services.notification.create({
          message: `<span class="name">${entity.company.name}</span> ha descartado su cotización.`,
          link: `/proveedores/cotizaciones/${entity.id}`,
          user: entity.offer.author
        });
        strapi.services.email.sendQuotationDiscard(entity.offer.author, entity);
    } catch (err) {}

    return sanitizeQuotation(entity);
  },

  /**
   * sets quotation status as rejected (6) and alerts supplier.
   *
   * @return {Object}
   */
  async reject(ctx) {
    const { id } = ctx.params;
    let data;

    if (ctx.is("multipart")) {
      ({ data } = parseMultipartData(ctx));
    } else {
      data = ctx.request.body;
    }

    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    // check if user can interact with quotation
    let entity = await strapi.services.quotation.findOne({ id });
    if( usrfromToken.id !== entity.user.id ) {
      return ctx.badRequest("User can't interact with this quotation.");
    }

    // update offer info
    let offer = await strapi.services['quotation-offer'].update({ id: entity.offer.id }, { rejected_at: Date.now(), ...data });

    // set quotation status
    entity = await strapi.services.quotation.update({ id }, { status: 6, discarded_at: Date.now(), ...data });

    //send notification
    try {
      if(entity.offer.author)
        strapi.services.notification.create({
          message: `<span class="name">${entity.company.name}</span> ha rechazado tu cotización.`,
          link: `/proveedores/cotizaciones/${entity.id}`,
          user: entity.offer.author
        });
        strapi.services.email.sendQuotationReject(entity.offer.author, entity);
    } catch (err) {}

    return sanitizeQuotation(entity);
  },

  /**
   * Creates a offer linked to quotation and sets quotation status as pending(2), then sends notification to company usser
   *
   * @return {Object}
   */
  async setOffer(ctx) {
    const { id } = ctx.params;
    let data, files;

    if (ctx.is("multipart")) {
      ({ data, files } = parseMultipartData(ctx));
    } else {
      data = ctx.request.body;
    }

    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    // check if user can interact with quotation
    let entity = await strapi.services.quotation.findOne({ id });
    if( usrfromToken.supplier !== entity.supplier.id ) {
      return ctx.badRequest("User can't set offer for this quotation.");
    }

    // create rating record
    data.quotation = entity.id;
    data.author = usrfromToken.id;
    let offer = await strapi.services['quotation-offer'].create(data, { files })

    // set quotation status
    entity = await strapi.services.quotation.update({ id }, { status: 2 });

    //send notification
    try {
      strapi.services.notification.create({
        message: `<span class="name">${entity.supplier.name}</span> te ha enviado una cotización.`,
        link: `/empresas/cotizaciones/${entity.group.id}/${entity.id}`,
        user: entity.user.id
      });
      strapi.services.email.sendNewPendingQuotation(entity.user, entity);
    } catch (err) {
      console.log(err);
    }

    //add 1 point to the supplier profile
    try {
      let { points } = await strapi.services.supplier.findOne({ id: usrfromToken.supplier, _publicationState: 'preview' });
      strapi.services.supplier.update({ id: usrfromToken.supplier }, { points: (points+1) });
    } catch (err) {}

    return sanitizeQuotation(entity);
  },
};
