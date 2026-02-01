import { DataTypes } from 'sequelize';

export function Bet(sequelize) {
  return sequelize.define('Bet', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    sessionId: { type: DataTypes.UUID, allowNull: false },

    game: { type: DataTypes.ENUM('DOTA2', 'CS2'), allowNull: false },
    tournament: { type: DataTypes.STRING(120), allowNull: false },
    team1: { type: DataTypes.STRING(80), allowNull: false },
    team2: { type: DataTypes.STRING(80), allowNull: false },
    pickTeam: { type: DataTypes.STRING(80), allowNull: true },

    betType: { type: DataTypes.ENUM('HANDICAP', 'MAP_WIN', 'MATCH_WIN'), allowNull: false },
    bo: { type: DataTypes.INTEGER, allowNull: false }, // 1/2/3/5
    tier: { type: DataTypes.INTEGER, allowNull: false }, // 1/2/3
    risk: { type: DataTypes.INTEGER, allowNull: false }, // 1..5
    odds: { type: DataTypes.DECIMAL(10, 2), allowNull: false },

    recommendedPct: { type: DataTypes.DECIMAL(8, 5), allowNull: false },
    recommendedStake: { type: DataTypes.DECIMAL(18, 2), allowNull: false },

    stake: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
    status: { type: DataTypes.ENUM('PENDING', 'WIN', 'LOSE'), allowNull: false, defaultValue: 'PENDING' },
    profit: { type: DataTypes.DECIMAL(18, 2), allowNull: false, defaultValue: 0 },
    settledAt: { type: DataTypes.DATE, allowNull: true },

    stakingModel: { type: DataTypes.STRING(40), allowNull: false, defaultValue: 'risk_adjusted_v1' }
  }, {
    tableName: 'bets',
    underscored: true
  });
}
