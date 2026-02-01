import { DataTypes } from 'sequelize';

export function Message(sequelize) {
  return sequelize.define('Message', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    dialogId: { type: DataTypes.UUID, allowNull: false },
    senderId: { type: DataTypes.UUID, allowNull: false },
    text: { type: DataTypes.STRING(5000), allowNull: true },
    sharedPostId: { type: DataTypes.UUID, allowNull: true }
  }, {
    tableName: 'messages',
    underscored: true
  });
}
