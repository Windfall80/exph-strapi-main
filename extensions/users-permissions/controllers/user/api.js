"use strict";

const _ = require("lodash");
const { sanitizeEntity } = require("strapi-utils");

const sanitizeUser = (user) =>
  sanitizeEntity(user, {
    model: strapi.query("user", "users-permissions").model,
  });

const formatError = (error) => [
  { messages: [{ id: error.id, message: error.message, field: error.field }] },
];

module.exports = {
  /**
   * Create a/an user record.
   * @return {Object}
   */

  async create(ctx) {
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
      })
      .get();

    const { email, username, password, role } = ctx.request.body;

    let usrfromToken;
    try {
      usrfromToken = ctx.state.user;
    } catch (err) {
      return ctx.badRequest(err, "error in token");
    }

    // ----------------------------- TO GET THE PLAN SELECTED -----------------------------
    let planSelected;
    if(usrfromToken.type == 'company' && (usrfromToken.company != null && usrfromToken.company != undefined)) {
      let company = await strapi.services.company.findOne(usrfromToken.company);
      planSelected = company.plan;
    } else if(usrfromToken.type == 'supplier' && (usrfromToken.supplier != null && usrfromToken.supplier != undefined)) {
      let supplier = await strapi.services.supplier.findOne(usrfromToken.supplier);
      planSelected = supplier.plan;
    } else {
      return ctx.badRequest("error, the creator doesn't have company or supplier");
    }

    // ----------------------------- TO GET THE USERS REGISTERED -----------------------------
    let countParams;
    if(usrfromToken.type == 'company') countParams = {company: usrfromToken.company};
    else if(usrfromToken.type == 'supplier') countParams = {supplier: usrfromToken.supplier};
    const countUsers = await strapi
      .query("user", "users-permissions")
      .count(countParams);

    if (countUsers < planSelected.users) {
      if (!email) return ctx.badRequest("missing.email");
      if (!username) return ctx.badRequest("missing.username");
      if (!password) return ctx.badRequest("missing.password");

      const userWithSameUsername = await strapi
        .query("user", "users-permissions")
        .findOne({ username });

      if (userWithSameUsername) {
        return ctx.badRequest(
          null,
          formatError({
            id: "Auth.form.error.username.taken",
            message: "Username already taken.",
            field: ["username"],
          })
        );
      }

      if (advanced.unique_email) {
        const userWithSameEmail = await strapi
          .query("user", "users-permissions")
          .findOne({ email: email.toLowerCase() });

        if (userWithSameEmail) {
          return ctx.badRequest(
            null,

            formatError({
              id: "Auth.form.error.email.taken",
              message: "Email already taken.",
              field: ["email"],
            })
          );
        }
      }

      const user = {
        ...ctx.request.body,
        provider: "local",
      };

      user.email = user.email.toLowerCase();

      // --------------------- SET THE DATA FROM THE CREATOR ---------------------
      user.author = usrfromToken.id;
      if (usrfromToken.supplier != null && usrfromToken.supplier != undefined) {
        user.supplier = usrfromToken.supplier;
        user.type = 'supplier';
      } else if (
        usrfromToken.company != null &&
        usrfromToken.company != undefined
      ) {
        user.company = usrfromToken.company;
        user.type = 'company';
      } else {
        return ctx.badRequest("error, the creator doesn't have company or supplier");
      }

      // --------------- SET THE EMPLOYEE ROLE ---------------
      user.role = 4;
      user.blocked = false;
      user.confirmed = true;

      try {
        const data = await strapi.plugins[
          "users-permissions"
        ].services.user.add(user);

        if (settings.email_confirmation) {
          try {
            await strapi.plugins[
              "users-permissions"
            ].services.user.sendConfirmationEmail(data);
          } catch (err) {
            console.log(err);
            //return ctx.badRequest(null, err);
          }
        }

        ctx.created(sanitizeUser(data));
      } catch (error) {
        ctx.badRequest(null, formatError(error));
      }
    } else {
      ctx.badRequest(
        null,
        formatError({
          id: "limit.users.reached",
          message: "Maximum limit of users reached.",
        })
      );
    }
  },
  /**
   * Update a/an user record.
   * @return {Object}
   */

  async update(ctx) {
    const advancedConfigs = await strapi
      .store({
        environment: "",
        type: "plugin",
        name: "users-permissions",
        key: "advanced",
      })
      .get();

    let usrfromToken;
    try {
      usrfromToken = ctx.state.user;
    } catch (err) {
      ctx.badRequest(err, "error in token");
    }

    const { id } = ctx.params;
    const { email, username, password } = ctx.request.body;

    const user = await strapi.plugins["users-permissions"].services.user.fetch({
      id,
    });

    if (user.id == usrfromToken.id || user.author.id == usrfromToken.id) {

      if (_.has(ctx.request.body, "email") && !email) {
        return ctx.badRequest("email.notNull");
      }

      if (_.has(ctx.request.body, "username") && !username) {
        return ctx.badRequest("username.notNull");
      }

      if (
        _.has(ctx.request.body, "password") &&
        !password &&
        user.provider === "local"
      ) {
        return ctx.badRequest("password.notNull");
      }

      if (_.has(ctx.request.body, "username")) {
        const userWithSameUsername = await strapi
          .query("user", "users-permissions")
          .findOne({ username });

        if (userWithSameUsername && userWithSameUsername.id != id) {
          return ctx.badRequest(
            null,
            formatError({
              id: "Auth.form.error.username.taken",
              message: "username.alreadyTaken.",
              field: ["username"],
            })
          );
        }
      }

      if (_.has(ctx.request.body, "email") && advancedConfigs.unique_email) {
        const userWithSameEmail = await strapi
          .query("user", "users-permissions")
          .findOne({ email: email.toLowerCase() });

        if (userWithSameEmail && userWithSameEmail.id != id) {
          return ctx.badRequest(
            null,
            formatError({
              id: "Auth.form.error.email.taken",
              message: "Email already taken",
              field: ["email"],
            })
          );
        }
        ctx.request.body.email = ctx.request.body.email.toLowerCase();
      }

      let updateData = {
        ...ctx.request.body,
      };

      if (_.has(ctx.request.body, "password") && password === user.password) {
        delete updateData.password;
      }

      const data = await strapi.plugins["users-permissions"].services.user.edit(
        { id },
        updateData
      );

      ctx.send(sanitizeUser(data));
    }else{
      ctx.unauthorized("You don't have permissions to update this user");
    }
  },

  /**
   * Retrieve authenticated user.
   * @return {Object|Array}
   */
   async me(ctx) {
    const user = ctx.state.user;

    if (!user) {
      return ctx.badRequest(null, [
        { messages: [{ id: "No authorization header was found" }] },
      ]);
    }

    console.log('ENTRO EN ME');
    let entity = await strapi.plugins["users-permissions"].services.user.fetch({id: user.id});
    return sanitizeUser(entity);
  },
};
