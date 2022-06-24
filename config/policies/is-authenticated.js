module.exports = async (ctx, next) => {
    // if (ctx.state.user) {
      // Go to next policy or will reach the controller's action.
      return await next();
    // }
  
    // strapi.log.info('Test log message', {
    //     anything: ctx
    //   });
    // ctx.unauthorized(`You're not logged in!`);
    // ctx.badRequest("")
    // ctx.forbidden("unauth")
  };