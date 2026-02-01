'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('privacy_settings', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        unique: true,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      show_bets: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      show_stats: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      show_followers: { type: Sequelize.BOOLEAN, allowNull: false, defaultValue: true },
      allow_messages: { type: Sequelize.ENUM('ALL', 'FOLLOWERS', 'MUTUAL', 'NONE'), allowNull: false, defaultValue: 'ALL' },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('privacy_settings');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_privacy_settings_allow_messages";');
  }
};
