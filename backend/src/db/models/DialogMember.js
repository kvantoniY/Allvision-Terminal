import { DataTypes } from 'sequelize';

export function DialogMember(sequelize) {
  return sequelize.define('DialogMember', {
    dialogId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, primaryKey: true },
    unreadCount: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 0 },
    lastReadAt: { type: DataTypes.DATE, allowNull: true }
  }, {
    tableName: 'dialog_members',
    underscored: true,
    timestamps: true,
    updatedAt: false
  });
}
