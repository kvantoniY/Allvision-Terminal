'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('messages', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      dialog_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'dialogs', key: 'id' },
        onDelete: 'CASCADE'
      },
      sender_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      text: { type: Sequelize.STRING(5000), allowNull: true },
      shared_post_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'posts', key: 'id' },
        onDelete: 'SET NULL'
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });

    await queryInterface.addIndex('messages', ['dialog_id', 'created_at']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('messages');
  }
};
