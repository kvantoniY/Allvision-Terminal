import { DataTypes } from 'sequelize';

export function BankSession(sequelize) {
  return sequelize.define('BankSession', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    title: { type: DataTypes.STRING(80), allowNull: false },
    initialBank: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
    currentBank: { type: DataTypes.DECIMAL(18, 2), allowNull: false },
    status: { type: DataTypes.ENUM('OPEN', 'CLOSED'), allowNull: false, defaultValue: 'OPEN' },
    closedAt: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'bank_sessions',
    underscored: true
  });
}
