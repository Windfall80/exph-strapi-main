'use strict';

/**
 * Read the documentation (https://strapi.io/documentation/developer-docs/latest/development/backend-customization.html#core-services)
 * to customize this service
 */

async function isUsserInRoom(userId, room){
  try{
    let socket = await strapi.services.socket.findOne({ user: userId, _publicationState: 'preview' });

    if(!socket) {
      console.log(`message recipient [${userId}] not online...`);
      return false;
    }

    const clients = strapi.io.sockets.adapter.rooms.get(room);
    if(!clients){
      console.log(`chat-room not existent...`);
      return false;
    }

    if(!clients.has(socket.token)){
      console.log(`user not currently on chat-room...`);
      return false;
    }

    return true;
  } catch(err) {
    console.log(err);
    return false;
  }

}

async function isAnyAdminInRoom(room){
  try{
    let sockets = await strapi.services.socket.find({ admin_null: false, _publicationState: 'preview' });
    console.log(sockets);
    if(!sockets) {
      console.log(`message recipients not online...`);
      return false;
    }

    const clients = strapi.io.sockets.adapter.rooms.get(room);
    if(!clients){
      console.log(`chat-room not existent...`);
      return false;
    }

    for(let socket of sockets){
      if(clients.has(socket.token)){
        console.log(`there is at least one admin on chat-room...`);
        return true;
      }
    }

    return false;
  } catch(err) {
    console.log(err);
    return false;
  }

}

module.exports = {
  /**
   * Recives new QUOTATION message and chat-room and determines if sends notification and counts as read
   * @param {*} roomEntity
   * @param {*} messageEntity
   */
  async afterQuotationMessage(roomEntity, messageEntity){
    console.log('post procesing quotation chat message...');
    let entity = await strapi.services['quotation'].findOne({id: roomEntity.quotation.id, _publicationState: 'preview'});
    //console.log(entity);

    let targetId;
    if(messageEntity.type == 'company') targetId = entity.offer.author;
    if(messageEntity.type == 'supplier') targetId = entity.user.id;
    if(!targetId) return;

    if(!await isUsserInRoom(targetId, roomEntity.room)) {
      console.log('user recipient not in chat room, send notification and count as unread');

      // the message was intended for a company user
      if(messageEntity.type == 'supplier'){
        //if there where no previos unread messages send notification
        if(!roomEntity.unread_a) {
          console.log('notification sent');
          strapi.services.notification.create({
            message: `<span class="name">${entity.supplier.name}</span> te ha enviado un mensaje.`,
            link: `/empresas/cotizaciones/${entity.group.id}/${entity.id}`,
            user: entity.user.id
          });
        }
        roomEntity = await strapi.services['chat-room'].update({id: roomEntity.id}, {unread_a: roomEntity.unread_a+1})
      };

      // the message was intended for a supplier user
      if(messageEntity.type == 'company'){
        //if there where no previos unread messages send notification
        if(!roomEntity.unread_b) {
          console.log('notification sent');
          strapi.services.notification.create({
            message: `<span class="name">${entity.company.name}</span> te ha enviado un mensaje.`,
            link: `/proveedores/cotizaciones/${entity.id}`,
            user: entity.offer.author
          });
        }
        roomEntity = await strapi.services['chat-room'].update({id: roomEntity.id}, {unread_b: roomEntity.unread_b+1})
      };

    } else {
      console.log('user has already seen message.');
    }
  },

  /**
   * Recives new OFFER REQUEST message and chat-room and determines if sends notification and counts as read
   * @param {*} roomEntity
   * @param {*} messageEntity
   */
  async afterOfferRequestMessage(roomEntity, messageEntity){
    console.log('post procesing offer-request chat message...');
    let entity = await strapi.services['offer-request'].findOne({id: roomEntity.offer_request.id, _publicationState: 'preview'});
    //console.log(entity);

    let targetId;
    if(messageEntity.type == 'company') targetId = entity.offer.author;
    if(messageEntity.type == 'supplier') targetId = entity.user.id;
    if(!targetId) return;

    if(!await isUsserInRoom(targetId, roomEntity.room)) {
      console.log('user recipient not in chat room, send notification and count as unread');

      // the message was intended for a company user
      if(messageEntity.type == 'supplier'){
        //if there where no previos unread messages send notification
        if(!roomEntity.unread_a) {
          console.log('notification sent');
          strapi.services.notification.create({
            message: `<span class="name">${entity.supplier.name}</span> te ha enviado un mensaje.`,
            link: `/empresas/ofertas-relampago/${entity.id}`,
            user: entity.user.id
          });
        }
        roomEntity = await strapi.services['chat-room'].update({id: roomEntity.id}, {unread_a: roomEntity.unread_a+1})
      };

      // the message was intended for a supplier user
      if(messageEntity.type == 'company'){
        //if there where no previos unread messages send notification
        if(!roomEntity.unread_b) {
          console.log('notification sent');
          strapi.services.notification.create({
            message: `<span class="name">${entity.company.name}</span> te ha enviado un mensaje.`,
            link: `/proveedores/ofertas-relampago/${entity.id}`,
            user: entity.offer.author
          });
        }
        roomEntity = await strapi.services['chat-room'].update({id: roomEntity.id}, {unread_b: roomEntity.unread_b+1})
      };

    } else {
      console.log('user has already seen message.');
    }
  },

  /**
   * Recives new ISSUE message and chat-room and determines if sends notification and counts as read
   * @param {*} roomEntity
   * @param {*} messageEntity
   */
  async afterIssueMessage(roomEntity, messageEntity){
    console.log('post procesing issue chat message...');
    let entity = await strapi.services['issue'].findOne({id: roomEntity.issue.id, _publicationState: 'preview'});
    //console.log(entity);

    let targetId;

    // the message was from an admin
    if(messageEntity.type == 'admin') {
      targetId = entity.user.id

      if(!await isUsserInRoom(targetId, roomEntity.room) ) {
        console.log('user recipient not in chat room, send notification and count as unread');

        //if there where no previos unread messages send notification
        if(!roomEntity.unread_a) {
          console.log('notification sent');
          if(entity.user.type == 'company') {
            strapi.services.notification.create({
              message: `<span class="name">ExphotelHive</span> te ha enviado un mensaje.`,
              link: `/empresas/incidencias/${entity.id}`,
              user: entity.user.id
            });
          }
          if(entity.user.type == 'supplier') {
            strapi.services.notification.create({
              message: `<span class="name">ExphotelHive</span> te ha enviado un mensaje.`,
              link: `/proveedores/incidencias/${entity.id}`,
              user: entity.user.id
            });
          }

        }
        roomEntity = await strapi.services['chat-room'].update({id: roomEntity.id}, {unread_a: roomEntity.unread_a+1})
      } else {
        console.log('user has already seen message.');
      }
    }

    // te message is form a company/supplier
    if(messageEntity.type == 'company' || messageEntity.type == 'supplier') {
      //if there is not admin watching the chat increment unread_b counter
      if(!await isAnyAdminInRoom(roomEntity.room)){
        console.log('incrementing unread_b count');
        roomEntity = await strapi.services['chat-room'].update({id: roomEntity.id}, {unread_b: roomEntity.unread_b+1});
      } else {
        console.log('user has already seen message.');
      }
    }
  },
};
