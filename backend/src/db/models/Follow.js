import { DataTypes } from 'sequelize';

export function Follow(sequelize) {
  return sequelize.define('Follow', {
    followerId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    followingId: { type: DataTypes.UUID, allowNull: false, primaryKey: true }
  }, {
    tableName: 'follows',
    underscored: true,
    timestamps: true,
    updatedAt: false
  });
}
