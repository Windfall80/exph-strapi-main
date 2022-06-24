'use strict';

/**
 * Cron config that gives you an opportunity
 * to run scheduled jobs.
 *
 * The cron format consists of:
 * [SECOND (optional)] [MINUTE] [HOUR] [DAY OF MONTH] [MONTH OF YEAR] [DAY OF WEEK]
 *
 * See more details here: https://strapi.io/documentation/developer-docs/latest/setup-deployment-guides/configurations.html#cron-tasks
 */

const { lockTask } = require("./lock");

module.exports = {
  /**
   * Simple example.
   * Every monday at 1am.
   */
  // '0 1 * * 1': () => {
  //
  // }

  /**
   * Refresh free tickets.
   * Every 1st of month at 1am.
   */
  '0 1 1 * *': async () => {
    //maybe delete previous unused and expired tickets
    await strapi.services['offer-ticket'].delete({ spent: false, free: true });

    //find active suppliers
    const suppliers = await strapi.services.supplier.find();
    for(let supplier of suppliers){
      strapi.services['offer-ticket'].createFreeTickets(supplier);
    }
  },

  //'*/5 * * * * *': async () => {
  //  console.log("🚀 ~ file: cron.js ~ line 33 ~Every 5sec");
  //}
};
