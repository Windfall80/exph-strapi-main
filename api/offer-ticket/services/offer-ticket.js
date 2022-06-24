'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

const moment = require('moment');

module.exports = {
  async createFreeTickets(supplier) {
    try{
      const endOfMonth = moment().endOf('month').format('YYYY-MM-DD hh:mm');
      console.log(new Date(endOfMonth));

      //let config = await strapi.services.config.findOne({ slug: 'supplier-register-free-tickets' });
      if(!supplier.plan || !supplier.plan.free_tickets || typeof supplier.plan.free_tickets != 'number' ) throw "Error, invalid plan 'free_tickets' value.";

      for(var i in Array.from(Array(supplier.plan.free_tickets))){
        //console.log('creando ticket ', i+1);
        let ticket = await strapi.query('offer-ticket').create({
          expires_at: new Date(endOfMonth),
          spent: false,
          free: true,
          supplier: supplier.id
        });
        if(ticket){
          //console.log('ticket creado');
        }
      }
    } catch(err) {
      console.log(err);
    }
  },
};
