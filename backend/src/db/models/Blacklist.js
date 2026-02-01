import { DataTypes } from 'sequelize';

export function Blacklist(sequelize) {
  return sequelize.define('Blacklist', {
    ownerId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    blockedId: { type: DataTypes.UUID, allowNull: false, primaryKey: true }
  }, {
    tableName: 'blacklist',
    underscored: true,
    timestamps: true,
    updatedAt: false
  });
}
