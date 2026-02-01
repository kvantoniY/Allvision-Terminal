'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('bets', {
      id: { type: Sequelize.UUID, primaryKey: true, allowNull: false },
      session_id: {
        type: Sequelize.UUID,
        allowNull: false,
        references: { model: 'bank_sessions', key: 'id' },
        onDelete: 'CASCADE'
      },

      game: { type: Sequelize.ENUM('DOTA2', 'CS2'), allowNull: false },
      tournament: { type: Sequelize.STRING(120), allowNull: false },
      team1: { type: Sequelize.STRING(80), allowNull: false },
      team2: { type: Sequelize.STRING(80), allowNull: false },
      pick_team: { type: Sequelize.STRING(80), allowNull: true },

      bet_type: { type: Sequelize.ENUM('HANDICAP', 'MAP_WIN', 'MATCH_WIN'), allowNull: false },
      bo: { type: Sequelize.INTEGER, allowNull: false },
      tier: { type: Sequelize.INTEGER, allowNull: false },
      risk: { type: Sequelize.INTEGER, allowNull: false },
      odds: { type: Sequelize.DECIMAL(10, 2), allowNull: false },

      recommended_pct: { type: Sequelize.DECIMAL(8, 5), allowNull: false },
      recommended_stake: { type: Sequelize.DECIMAL(18, 2), allowNull: false },

      stake: { type: Sequelize.DECIMAL(18, 2), allowNull: false },
      status: { type: Sequelize.ENUM('PENDING', 'WIN', 'LOSE'), allowNull: false, defaultValue: 'PENDING' },
      profit: { type: Sequelize.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
      settled_at: { type: Sequelize.DATE, allowNull: true },

      staking_model: { type: Sequelize.STRING(40), allowNull: false, defaultValue: 'risk_adjusted_v1' },

      created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') },
      updated_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.fn('NOW') }
    });
  },
  async down(queryInterface) {
    await queryInterface.dropTable('bets');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_bets_game";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_bets_bet_type";');
    await queryInterface.sequelize.query('DROP TYPE IF EXISTS "enum_bets_status";');
  }
};
