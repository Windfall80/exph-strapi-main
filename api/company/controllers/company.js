'use strict';
/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */

const { parseMultipartData, sanitizeEntity } = require("strapi-utils");
const stripe = require('stripe')(strapi.config.get('server.stripe_sk'));
const ExcelJS = require('exceljs');
const fs = require("fs");

const sanitizeUser = (user) =>
  sanitizeEntity(user, {
    model: strapi.query("user", "users-permissions").model,
  });

const formatError = (error) => [
  { messages: [{ id: error.id, message: error.message, field: error.field }] },
];

function getMessageByCode(code){
  let message = '';
  switch (code) {
    case "insufficient_funds":
        message = 'Su tarjeta no tiene fondos suficientes.';
        break;
    case "lost_card":
        message = 'Tu tarjeta fue rechazada.';
        break;
    case "expired_card":
          message = 'Tu tarjeta ha caducado';
          break;
    default:
        message = 'Se produjo un error al procesar su tarjeta. Vuelva a intentarlo.';
  }
  return message;

}

module.exports = {

  /**
   * Retrieve current user parent profile.
   *
   * @return {Array}
   */
   async profile(ctx) {
    let entity;

    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    // add filters so companies can't acces other companies groups
    if(usrfromToken.type == 'supplier'){
      return ctx.badRequest("Can't access company profile.");
    }

    entity = await strapi.services.company.findOne({id: usrfromToken.company, _publicationState: 'preview'});

    return sanitizeEntity(entity, { model: strapi.models.company });
  },

  /**
   * Create a record.
   *
   * @return {Object}
   */
  async create(ctx) {
    let entity, user;
    console.log("COMPANY CREATE HANDLER!!!");

    if (!ctx.is("multipart")) {
      return ctx.badRequest(`Request must be multipart/form-data.`);
    }

    const { data, files } = parseMultipartData(ctx);

    /**
     * Validate selected price and plan
     */
    let selectedPrice = await strapi.services['plan-price'].findOne({id: data.price});
    if(selectedPrice.type != 'free'){
      try{
        await strapi.services.stripe.validatePrice(selectedPrice);
      } catch( err ) {
        if(typeof err === 'string') return ctx.badRequest(err);
        else return ctx.badRequest(err.message);
      }
    }

    let customer = await strapi.services.stripe.createStripe(data);
    if(customer.type == 'StripeCardError') {
      return ctx.badRequest(getMessageByCode(stripe.raw.code));
    }
    data.Stripe_ID = customer.id;

    //   data.author = ctx.state.user.id;
    data.plan = selectedPrice.plan.id;
    entity = await strapi.services.company.create(data, { files });

    if(!entity || !entity.id) {
      //return ctx.badRequest(`Error creating company entity.`, );
      return sanitizeEntity(entity, { model: strapi.models.company })
    }

    /* -------------------- create first user -------------------- */
    const pluginStore = await strapi.store({
      environment: "",
      type: "plugin",
      name: "users-permissions",
    });

    const settings = await pluginStore.get({
      key: "advanced",
    });

    const advanced = await strapi
      .store({
        environment: "",
        type: "plugin",
        name: "users-permissions",
        key: "advanced",
      }).get();

    user = data.users[0];

    try{
      if (!user.email) throw ctx.badRequest("missing.email");
      if (!user.username) throw ctx.badRequest("missing.username");
      if (!user.password) throw ctx.badRequest("missing.password");

      const userWithSameUsername = await strapi
        .query("user", "users-permissions")
        .findOne({ username: user.username });

      if (userWithSameUsername) {
        throw ctx.badRequest("Auth.form.error.username.taken");
      }

      if (advanced.unique_email) {
        const userWithSameEmail = await strapi
          .query("user", "users-permissions")
          .findOne({ email: user.email.toLowerCase() });
        console.log("email exists:", userWithSameEmail);
        if (userWithSameEmail) {
          throw ctx.badRequest("Auth.form.error.email.taken");
        }
      }

      user.company = entity.id;
      user.email = user.email.toLowerCase();
      user.provider = 'local';
      user.confirmed = 1;
      user.blocked = 0;
      user.role = 3;
      user.type = 'company';

      const entityUser = await strapi.plugins["users-permissions"].services.user.add(user);

      if(entityUser){ // && data.tokenpayment
        if(entity.price.type == 'one_time') {
          //if is one time payment do a regular payment and update entity
          let inv = await strapi.services.stripe.createOneTime(entity.Stripe_ID, entity.price.stripe_price_ID);
          if(inv) {
            // aqui se devería verificar si la subscripcion no fallo
            entity = await strapi.services.company.update({id: entity.id }, {
              subscription_status: inv.paid? 'active':'unpaid',
              invoice_status: inv.status,
              current_period_start: new Date(),
              current_period_end: new Date(entity.plan.static_period_end),
              auto_renew: false,
            });
          } else throw new Error("Error creating invoice.");

        } else if(entity.price.type == 'recurring') {
          //if is recurring payment generate a subscription and update entity
          let cs = await strapi.services.stripe.createSubscription(entity.Stripe_ID, entity.price.stripe_price_ID);
          // aqui se devería verificar si la subscripcion no fallo
          if(cs) {
            let inv = await strapi.services.stripe.retriveInvoice(cs.latest_invoice);
            entity = await strapi.services.company.update({id: entity.id }, {
              Subscription_ID: cs.id,
              subscription_status: cs.status,
              invoice_status: inv.status? inv.status:null,
              current_period_start: new Date(cs.current_period_start * 1000),
              current_period_end: new Date(cs.current_period_end * 1000),
              auto_renew: true,
            });
          } else throw new Error("Error creating subscription.");

        } else if(entity.price.type == 'free') {
          // si se selecciono el plan gratis poner fechas del periodo manualmente
          //let config = await strapi.services.config.findOne({ slug: 'free-trial-days' });
          //if(!config) throw ctx.badRequest("Config.free-trial-days.unavalible");
          entity = await strapi.services.company.update({id: entity.id }, {
            subscription_status: 'active',
            current_period_start: new Date(),
            current_period_end: new Date(entity.plan.static_period_end),// new Date().addDays(config.value),
            auto_renew: false,
          });
        }
      }
      //entity.users = [sanitizeEntity(entityUser, { model: strapi.plugins["users-permissions"].models.user })];

      // enviar menzaje
      strapi.services.email.sendWelcomeEmail(entityUser);
      strapi.services.email.sendAdminNewCompany(entity);

    } catch(e) {
      console.log(e);
      // delete previosly created company on error
      if( entity.id ) await strapi.services.company.delete({ id: entity.id });
      if( user.id ) await strapi.plugins["users-permissions"].services.user.delete({ id: user.id });
      if( customer && customer.id && customer.object == "customer") await strapi.services.stripe.deleteCustomer(customer.id);
      return ctx.badRequest(err, "Internal error.");
    }

    return sanitizeEntity(entity, { model: strapi.models.company });
  },


  /**
   * retrives cards from stripe.
   *
   * @return {Object}
   */
  async getCards(ctx){
    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");
    let company = await strapi.services.company.findOne({ id: usrfromToken.company, _publicationState: 'preview' });
    let response;
    if(company){
    response = await strapi.services.stripe.getCards(company.Stripe_ID)
    }
    return response;

  },

  async addCard(ctx){
    let data = ctx.request.body;
    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    let addcardstripe = await strapi.services.stripe.addCard(data.user.company.Stripe_ID, data.token);
    return addcardstripe;
  },

  async removePaymentMethod(ctx){
    let data = ctx.params.id;
     const paymentMethod = await stripe.paymentMethods.detach(
      data
    );
    return paymentMethod;
  },

  /**
   * retrives subscription from stripe.
   *
   * @return {Object}
   */
  async subscription_date(ctx){

    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    let { Subscription_ID } = await strapi.services.company.findOne({ id: usrfromToken.company, _publicationState: 'preview' });
    if(Subscription_ID){
      const sr = await stripe.subscriptions.retrieve(
        Subscription_ID
      );
      console.log(sr);
      return sr;
    }
    //return ctx.badRequest("Profile don't have Subscription_ID.");
  },

  async updateSubscription(ctx) {
    let data;
    if (ctx.is("multipart")) {
      ({ data } = parseMultipartData(ctx));
    } else {
      data = ctx.request.body;
    }

    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    /**
     * Validate selected price and plan
     */
    let selectedPrice = await strapi.services['plan-price'].findOne({id: data.price});
    try{
      await strapi.services.stripe.validatePrice(selectedPrice);
    } catch( err ) {
      console.log(err);
      if(typeof err === 'string') return ctx.badRequest(err);
      else return ctx.badRequest(err.message);
    }

    // find user company entity
    let company = await strapi.services.company.findOne({ id: usrfromToken.company, _publicationState: 'preview' });
    if(!company) {
      return ctx.badRequest("Company not found.");
    }

    // if entity has current subscription atempt to cancel first
    if(company.Subscription_ID) await strapi.services.stripe.cancelSubscription(company.Subscription_ID);

    // create new subscription
    let subscription = await strapi.services.stripe.createSubscription( company.Stripe_ID, selectedPrice.stripe_price_ID, data.paymentcard );
    if( !subscription ) {
      return ctx.badRequest("Error creating new stripe subscription.");
    }

    // aqui se devería verificar si la subscripcion no fallo
    let invoice = await strapi.services.stripe.retriveInvoice(subscription.latest_invoice);

    company = await strapi.services.company.update({id: company.id},{
      price: selectedPrice.id,
      plan: selectedPrice.plan.id,
      Subscription_ID: subscription.id,
      subscription_status: subscription.status,
      invoice_status: invoice.status? invoice.status:null,
      current_period_start: new Date(subscription.current_period_start * 1000),
      current_period_end: new Date(subscription.current_period_end * 1000),
      auto_renew: true,
    });

    let user = await strapi.plugins["users-permissions"].services.user.fetch({id: usrfromToken.id});
    return sanitizeUser(user);
  },

  async cancelSubscription(ctx) {
    let data;
    if (ctx.is("multipart")) {
      ({ data } = parseMultipartData(ctx));
    } else {
      data = ctx.request.body;
    }

    let usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");

    // find user company entity
    let company = await strapi.services.company.findOne({ id: usrfromToken.company, _publicationState: 'preview' });
    if(!company) return ctx.badRequest("Company not found.");
    if(!company.Subscription_ID)  return ctx.badRequest("Subscription ID not found.");

    let subscription = await strapi.services.stripe.cancelSubscriptionRenewal(company.Subscription_ID);
    if(!subscription) return ctx.badRequest("Something went wrong updating subscription.");

    company = await strapi.services.company.update({id: company.id},{
      auto_renew: false,
    });

    let user = await strapi.plugins["users-permissions"].services.user.fetch({id: usrfromToken.id});
    return sanitizeUser(user);
  },

  async exportQuotationsReport(ctx) {
    const usrfromToken = ctx?.state?.user
    if(!usrfromToken) return ctx.unauthorized("User not authenticated.");
    const company = await strapi.services.company.findOne(usrfromToken.company);

    ctx.query.company = company.id;
    const quotations = await strapi.services.quotation.find({ ...ctx.query, _sort: 'created_at:DESC' });

    const _total = await strapi.services.quotation.count({ ...ctx.query });
    const _complete = await strapi.services.quotation.count({ ...ctx.query, status: 7 });
    const _acepted = await strapi.services.quotation.count({ ...ctx.query, status: 5 });
    const _discarded = await strapi.services.quotation.count({ ...ctx.query, status: 4 });
    const _rejected = await strapi.services.quotation.count({ ...ctx.query, status: 6 });

    /** generate-xslx */
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Reporte de cotizaciones', {});
    worksheet.views = [{
      showGridLines: false,
    }];

    const commonFont = {
      name: 'Arial',
      bold: false,
      color: { argb: '000000' },
      size: 10,
    };

    worksheet.columns = [
      { header: "Fecha", key: "date", width: 14 },
      { header: "Estado", key: "status", width: 24 },
      { header: "Usuario", key: "user", width: 24 },
      { header: "Proveedor/hotel", key: "supplier", width: 24 },
      { header: "Nombre del servicio", key: "service", width: 24 },
      { header: "Categoría", key: "category", width: 16 },
      { header: "Subcategorías", key: "subcategories", width: 16 },
      { header: "Precio", key: "price", width: 14, style: {font: {...commonFont, color: { argb: '6AA84F' }}, numFmt: '"$"#,##0.00;[Red]\-"$"#,##0.00'}},
      { header: "Calificación", key: "rating", width: 14 },
      { header: "Feedback", key: "feedback", width: 50 },
    ];

    for(let [i, quotation] of quotations.entries()){
      let _rating;
      switch(quotation.status?.id){
        case 7: _rating = `${quotation.rating?.rating} estrellas`; break;
        case 4: _rating = 'Descartada'; break;
        case 6: _rating = 'Rechazada'; break;
        default: _rating = 'Pendiente'; break;
      }

      let _category;
      let _subcategories = [];
      if(quotation.service){
        let service = await strapi.services.service.findOne({id: quotation.service.id, _publicationState: 'preview'});
        if(service?.main_category) _category = service.main_category.name;
        if(service?.categories.length) _subcategories = service.categories.map(x => x.name);
      }


      let _feedback = [];
      // feedback discarded
      if(quotation.status?.id == 4) {
        _feedback.push(...quotation.discard_motives.filter(x=>x.name!='Otros').map(x=>x.name));
        if(quotation.discard_details) _feedback.push('Otros: '+quotation.discard_details);
      }
      // feedback rejected
      if(quotation.status?.id == 6) {
        if(quotation.offer?.reject_details) _feedback.push(quotation.offer?.reject_details);
      }
      // feedback completed
      if(quotation.status?.id == 7 ) {
        let r = await strapi.services.rating.findOne(quotation.rating?.id);
        _feedback.push(...r.motives.filter(x=>x.name!='Otros').map(x=> x.name));
        if(r.rating_details) _feedback.push('Otros: '+r.rating_details);
      }

      let row = worksheet.addRow({
        date: new Date(quotation.created_at),
        status: quotation.status?.name,
        user: quotation.user?.firstname+' '+quotation.user?.lastname,
        supplier: quotation.supplier?.name,
        service: quotation.service?.name,
        category: _category,
        subcategories: _subcategories.join('\r\n'),
        price: quotation.offer?.amount,
        rating: _rating,
        feedback: _feedback.join(', '),
      });
      row.height = 45;
      row.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
      if(i%2 !== 0) row.fill = {type: 'pattern', pattern:'solid', fgColor:{argb:'EBEFF1'}, bgColor:{argb:'EBEFF1'}};

      let owColors;
      switch(quotation.status?.id){
        case 1: owColors = {font: '9673A6', fill: 'E1D5E7'}; break;
        case 2: owColors = {font: 'F89B46', fill: 'FFF3D6'}; break;
        case 3: owColors = {font: '82B366', fill: 'D5E8D4'}; break;
        case 4: owColors = {font: 'CC0000', fill: 'F4CCCC'}; break;
        case 5: owColors = {font: '0B5394', fill: 'CFE2F3'}; break;
        case 6: owColors = {font: 'B45F06', fill: 'F9CB9C'}; break;
        case 7: owColors = {font: '38761D', fill: 'D9EAD3'}; break;
      }
      if(owColors){
        row.getCell('B').fill = {type: 'pattern', pattern:'solid', fgColor:{argb:owColors.fill}, bgColor:{argb:owColors.fill}};
        row.getCell('B').font = {...commonFont, color:{ argb: owColors.font }};
      }
    }

    worksheet.insertRow(1);
    worksheet.insertRow(2, ['ExpHotel HIVE', null, `Total de cotizaciones en la plataforma :${_total}`, `Finalizadas : ${_complete}\r\nAceptadas : ${_acepted}`, `Descartadas: ${_discarded}\r\nRechazadas :${_rejected}`]);
    worksheet.mergeCells('A2', 'B2');
    worksheet.insertRow(3);

    worksheet.getRow(1).height = 5;
    worksheet.getRow(2).height = 40;
    worksheet.getRow(2).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    worksheet.getRow(3).height = 5;

    worksheet.insertRow(4,[company.name, null, new Date()]);
    worksheet.getRow(4).height = 22;
    worksheet.getRow(4).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    worksheet.getRow(4).font = {...commonFont, bold: true, color: { argb: 'FFFFFF' }};
    worksheet.getRow(4).fill = {type: 'pattern', pattern:'solid', fgColor:{argb:'0B5394'}, bgColor:{argb:'0B5394'}};
    worksheet.mergeCells('A4', 'B4');

    worksheet.getRow(5).height = 22;
    worksheet.getRow(5).alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    worksheet.getRow(5).font = {...commonFont, bold: true, color: { argb: 'FFFFFF' }};
    worksheet.getRow(5).fill = {type: 'pattern', pattern:'solid', fgColor:{argb:'FBBC04'}, bgColor:{argb:'FBBC04'}};

    let path = "public/exports/";
    let file = "quotations-export.xlsx";
    if (!fs.existsSync(path)) fs.mkdirSync(path);
    try{
      await workbook.xlsx.writeFile(path+file);

      //var filestream = fs.createReadStream(path+"file");
      var stream = fs.createReadStream(path+file);
      ctx.body = stream;
      ctx.type = 'application/vnd.ms-excel';
      ctx.set('Content-disposition', 'attachment; filename='+file);

    } catch(err) {
      console.log(err);
      return ctx.badRequest(err, "Error exporting file.");
    }
    /** /generate-xslx */
  }
};
