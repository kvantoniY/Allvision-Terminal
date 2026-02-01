import { DataTypes } from 'sequelize';

export function PrivacySettings(sequelize) {
  return sequelize.define('PrivacySettings', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    userId: { type: DataTypes.UUID, allowNull: false, unique: true },
    showBets: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    showStats: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    showFollowers: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
    allowMessages: { type: DataTypes.ENUM('ALL', 'FOLLOWERS', 'MUTUAL', 'NONE'), allowNull: false, defaultValue: 'ALL' }
  }, {
    tableName: 'privacy_settings',
    underscored: true
  });
}
