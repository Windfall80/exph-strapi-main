'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-controllers)
 * to customize this controller
 */
 const _ = require("lodash");
const { parseMultipartData, sanitizeEntity } = require("strapi-utils");
const adminUserController = require("./user/admin");
const apiUserController = require("./user/api");


const resolveController = (ctx) => {

  const {
    state: { isAuthenticatedAdmin },
  } = ctx;
  return isAuthenticatedAdmin ? adminUserController : apiUserController;
};
const resolveControllerMethod = (method) => (ctx) => {
  const controller = resolveController(ctx);
  const callbackFn = controller[method];

  if (!_.isFunction(callbackFn)) {
    return ctx.notFound();
  }

  return callbackFn(ctx);
};
module.exports = {
  find: resolveControllerMethod("find"),
  findOne: resolveControllerMethod("findOne"),
  count: resolveControllerMethod("count"),
  update: resolveControllerMethod("update"),
};
