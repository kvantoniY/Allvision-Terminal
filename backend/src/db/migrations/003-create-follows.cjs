'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('follows', {
      follower_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      following_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });
    await queryInterface.addConstraint('follows', {
      fields: ['follower_id', 'following_id'],
      type: 'primary key',
      name: 'pk_follows_pair'
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('follows');
  }
};
