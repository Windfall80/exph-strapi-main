'use strict';

/**
 * An asynchronous bootstrap function that runs before
 * your application gets started.
 *
 * This gives you an opportunity to set up your data model,
 * run jobs, or perform some special logic.
 *
 * See more details here: https://strapi.io/documentation/developer-docs/latest/setup-deployment-guides/configurations.html#bootstrap
 */

const { lockTask } = require("./lock");

Date.prototype.addDays = function(days) {
  var date = new Date(this.valueOf());
  date.setDate(date.getDate() + days);
  return date;
}

module.exports = async () => {

  await lockTask("bootstrap", async () => {
    // stripe
    await strapi.services.stripe.init();

    //migration
    try{
      const DEF_CONFIGS = [
        {slug: 'ticket-exchange-price', value: 50, description: 'Precio en puntos de un ticket de oferta'},
        {slug: 'ticket-purchase-price', value: 50, description: 'Precio de compra en MXN de un ticket de oferta'},
        {slug: 'free-trial-days', value: 7, description: 'Numero de dias que se tiene acceso al sistema al registrarse con plan gratuito'},
        {slug: 'welcome-video-url', value: null, description: 'Url del video de bienvenida subido a la biblioteca multimedia'},
        //{slug: 'supplier-register-free-tickets', value: 10, description: 'Numero de tickets que recibe un proveedor a la hora de registrarse'}
      ];

      DEF_CONFIGS.forEach(async _c => {
        let config = await strapi.services.config.findOne({ slug: _c.slug });
        if(!config) config = await strapi.services.config.create({ ..._c });
      });
    } catch(err) {console.log(err);}
  });

  //socket io
  console.log('starting socket');
  strapi.services.socket.delete();

  var io = require('socket.io')(strapi.server, {
    path: '/socket.io',
    transports:  ['websocket','polling'],
    cors: {
      origin: "*", //http://localhost:4200
      methods: ["GET", "POST"],
      allowedHeaders: ["my-custom-header"],
      credentials: true
    }
  });

  io.on('connection', async (socket) => {
    // register socket token
    let _st;
    console.log('registering token');
    try {
      console.log(socket.id, socket.handshake.query['user'], socket.handshake.query['type']);
      if(socket.handshake.query['type'] == 'admin'){
        _st = await strapi.services.socket.create({token: socket.id, admin: socket.handshake.query['user']});
      } else {
        _st = await strapi.services.socket.create({token: socket.id, user: socket.handshake.query['user']});
      }

    } catch (err) {
      console.log(err);
    }

    socket.on('join_chat_room', async ({room, type, id, userType}) => {
      console.log(`${_st.id}(${_st.user? _st.user.username: _st.admin.username}) joining room ${room}`);
      socket.join(room);

      let roomEntity = await strapi.services['chat-room'].findOne({ room, _publicationState: 'preview' });
      if(!roomEntity) {
        let data = { room, type };
        switch( type ) {
          case 'quotation': data.quotation = id; break;
          case 'offer_request': data.offer_request = id; break;
          case 'issue': data.issue = id; break;
        }
        roomEntity = await strapi.services['chat-room'].create(data);
      } else {
        // clear unread messages for that room
        let data = {};
        switch( type ) {
          case 'quotation':
            if(userType == 'company') data.unread_a = 0;
            if(userType == 'supplier') data.unread_b = 0;
          break;
          case 'offer_request':
            if(userType == 'company') data.unread_a = 0;
            if(userType == 'supplier') data.unread_b = 0;
          break;
          case 'issue':
            if(userType == 'company' || userType == 'supplier') data.unread_a = 0;
            if(userType == 'admin') data.unread_b = 0;
          break;
        }
        console.log('clear unread:', roomEntity.room, data);
        roomEntity = await strapi.services['chat-room'].update({id: roomEntity.id}, data);
      }
    });

    socket.on('leave_chat_room', async (room) => {
      console.log(`${_st.id}(${_st.user? _st.user.username: _st.admin.username}) leaving room ${room}`);
      socket.leave(room);
    });

    socket.on('message', async (message) => {
      // for some reason the user is not joining room on chat init so firs thing is verify and join if neded
      socket.join(message.room);

      let _msg = await strapi.services.message.create(message);
      io.to(message.room).emit('reciveMessage', _msg );

      try{
        // find message main target to determine if will be counted as unread and send notification
        let roomEntity = await strapi.services['chat-room'].findOne({ room: message.room, _publicationState: 'preview' });

        switch(roomEntity.type) {
          case 'quotation':
            strapi.services['chat-room'].afterQuotationMessage(roomEntity, _msg);
          break;
          case 'offer_request':
            strapi.services['chat-room'].afterOfferRequestMessage(roomEntity, _msg);
          break;
          case 'issue':
            strapi.services['chat-room'].afterIssueMessage(roomEntity, _msg);
          break;
        }
      } catch(err) {
        console.log(err);
      }
    });


    socket.on('disconnect', () => {
      console.log('user disconnected', socket.id, socket.handshake.query['user']);
      if(_st) strapi.services.socket.delete({ id: _st.id });
    });
  });

  strapi.io = io;
};
