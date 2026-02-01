'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('blacklist', {
      owner_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      blocked_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });
    await queryInterface.addConstraint('blacklist', {
      fields: ['owner_id', 'blocked_id'],
      type: 'primary key',
      name: 'pk_blacklist_pair'
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('blacklist');
  }
};
