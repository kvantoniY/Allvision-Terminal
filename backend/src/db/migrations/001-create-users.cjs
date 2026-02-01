'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('users', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      username: { type: Sequelize.STRING(32), allowNull: false, unique: true },
      password_hash: { type: Sequelize.STRING, allowNull: false },
      avatar_url: { type: Sequelize.STRING, allowNull: true },
      bio: { type: Sequelize.STRING(280), allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('users');
  }
};
