'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('dialog_members', {
      dialog_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'dialogs', key: 'id' },
        onDelete: 'CASCADE'
      },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      unread_count: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 0 },
      last_read_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });

    await queryInterface.addConstraint('dialog_members', {
      fields: ['dialog_id', 'user_id'],
      type: 'primary key',
      name: 'pk_dialog_members_pair'
    });

    await queryInterface.addIndex('dialog_members', ['user_id']);
  },
  async down(queryInterface) {
    await queryInterface.dropTable('dialog_members');
  }
};
