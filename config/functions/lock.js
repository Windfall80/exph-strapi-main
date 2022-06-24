'use strict';

/**
 *
 */

 const lockTask = async (taskName, task) => {
  const knex = strapi.connections.default;
  await knex.transaction(async (t) => {
    try {
      const response = await knex("locks")
      .where({ Task: taskName })
      .select("*")
      .transacting(t)
      .forUpdate()
      .noWait();

      if (!response.length) {
        await t.insert({ Task: taskName }).into("locks");
      }

      await task();

      return true;
    } catch (err) {
      console.log(err);
      return false;
    }
  });
};

module.exports = {
  lockTask,
};
