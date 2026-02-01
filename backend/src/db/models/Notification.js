import { DataTypes } from 'sequelize';

export function Notification(sequelize) {
  return sequelize.define('Notification', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false },
    actorId: { type: DataTypes.UUID, allowNull: false },
    type: { type: DataTypes.ENUM('FOLLOW','LIKE_POST','COMMENT_POST','REPOST_POST','MESSAGE'), allowNull: false },
    entityId: { type: DataTypes.UUID, allowNull: false },
    isRead: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false }
  }, {
    tableName: 'notifications',
    underscored: true
  });
}
