'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('post_likes', {
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      post_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'posts', key: 'id' },
        onDelete: 'CASCADE'
      },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });

    await queryInterface.addConstraint('post_likes', {
      fields: ['user_id', 'post_id'],
      type: 'primary key',
      name: 'pk_post_likes_pair'
    });

    await queryInterface.addIndex('post_likes', ['post_id', 'created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('post_likes');
  }
};
