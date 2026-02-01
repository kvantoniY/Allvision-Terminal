'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('posts', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },

      author_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },

      type: { type: Sequelize.ENUM('POST', 'REPOST'), allowNull: false, defaultValue: 'POST' },

      original_post_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'posts', key: 'id' },
        onDelete: 'SET NULL'
      },

      text: { type: Sequelize.TEXT, allowNull: false },
      image_url: { type: Sequelize.STRING, allowNull: true },

      attached_bet_id: {
        type: Sequelize.UUID,
        allowNull: true,
        references: { model: 'bets', key: 'id' },
        onDelete: 'SET NULL'
      },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });

    await queryInterface.addIndex('posts', ['author_id', 'created_at']);
    await queryInterface.addIndex('posts', ['type', 'created_at']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('posts');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_posts_type";');
  }
};
