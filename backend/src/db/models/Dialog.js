import { DataTypes } from 'sequelize';

export function Dialog(sequelize) {
  return sequelize.define('Dialog', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true }
  }, {
    tableName: 'dialogs',
    underscored: true
  });
}
