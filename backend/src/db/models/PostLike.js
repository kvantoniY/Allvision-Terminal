import { DataTypes } from 'sequelize';

export function PostLike(sequelize) {
  return sequelize.define('PostLike', {
    userId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    postId: { type: DataTypes.UUID, allowNull: false, primaryKey: true }
  }, {
    tableName: 'post_likes',
    underscored: true,
    timestamps: true,
    updatedAt: false
  });
}
