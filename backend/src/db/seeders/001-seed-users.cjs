'use strict';

const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');

module.exports = {
  async up(queryInterface) {
    const u1 = randomUUID();
    const u2 = randomUUID();

    const pass1 = await bcrypt.hash('password123', 10);
    const pass2 = await bcrypt.hash('password123', 10);

    await queryInterface.bulkInsert('users', [
      { id: u1, username: 'ivan', password_hash: pass1, created_at: new Date(), updated_at: new Date() },
      { id: u2, username: 'alex', password_hash: pass2, created_at: new Date(), updated_at: new Date() }
    ]);

    await queryInterface.bulkInsert('privacy_settings', [
      { id: randomUUID(), user_id: u1, show_bets: true, show_stats: true, show_followers: true, allow_messages: 'ALL', created_at: new Date(), updated_at: new Date() },
      { id: randomUUID(), user_id: u2, show_bets: true, show_stats: true, show_followers: true, allow_messages: 'ALL', created_at: new Date(), updated_at: new Date() }
    ]);
  },

  async down(queryInterface) {
    await queryInterface.bulkDelete('privacy_settings', null, {});
    await queryInterface.bulkDelete('users', null, {});
  }
};
