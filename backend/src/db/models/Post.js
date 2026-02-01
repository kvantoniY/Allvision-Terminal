import { DataTypes } from 'sequelize';

export function Post(sequelize) {
  return sequelize.define('Post', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },

    authorId: { type: DataTypes.UUID, allowNull: false },

    type: { type: DataTypes.ENUM('POST', 'REPOST'), allowNull: false, defaultValue: 'POST' },
    originalPostId: { type: DataTypes.UUID, allowNull: true }, // for REPOST

    text: { type: DataTypes.TEXT, allowNull: false },
    imageUrl: { type: DataTypes.STRING, allowNull: true },

    attachedBetId: { type: DataTypes.UUID, allowNull: true } // optional (Bet.id)
  }, {
    tableName: 'posts',
    underscored: true
  });
}
