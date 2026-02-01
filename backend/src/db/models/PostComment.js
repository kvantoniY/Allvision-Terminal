import { DataTypes } from 'sequelize';

export function PostComment(sequelize) {
  return sequelize.define('PostComment', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    postId: { type: DataTypes.UUID, allowNull: false },
    authorId: { type: DataTypes.UUID, allowNull: false },
    body: { type: DataTypes.STRING(2000), allowNull: false }
  }, {
    tableName: 'post_comments',
    underscored: true
  });
}
