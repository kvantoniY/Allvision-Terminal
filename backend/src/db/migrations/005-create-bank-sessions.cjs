'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bank_sessions', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      user_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'users', key: 'id' },
        onDelete: 'CASCADE'
      },
      title: { type: Sequelize.STRING(80), allowNull: false },
      initial_bank: { type: Sequelize.DECIMAL(18, 2), allowNull: false },
      current_bank: { type: Sequelize.DECIMAL(18, 2), allowNull: false },
      status: { type: Sequelize.ENUM('OPEN', 'CLOSED'), allowNull: false, defaultValue: 'OPEN' },
      closed_at: { type: Sequelize.DATE, allowNull: true },
      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('bank_sessions');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_bank_sessions_status";');
  }
};
