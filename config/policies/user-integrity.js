module.exports = async (ctx, next) => {
  const usrfromToken = ctx.state?.user;
  if (usrfromToken && !ctx.state.isAuthenticatedAdmin) {
    let parent;
    if(usrfromToken.type == 'supplier'){
      parent = usrfromToken.supplier;
    }
    if(usrfromToken.type == 'company'){
      parent = usrfromToken.company;
    }

    // if user parent company/supplier is not asigned properly return error
    if(!parent){
      strapi.log.error(`User integrity fail for user: ${usrfromToken.id}`);
      return ctx.badRequest("User integrity fail!", 400);
    }
  }

  return await next();
};
