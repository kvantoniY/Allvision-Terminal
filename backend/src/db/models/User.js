import { DataTypes } from 'sequelize';
import { isOnline } from '../../realtime/presence.js';

export function User(sequelize) {
  const model = sequelize.define('User', {
    id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
    username: { type: DataTypes.STRING(32), allowNull: false, unique: true },
    publicId: { type: DataTypes.STRING(16), allowNull: false, unique: true },
    passwordHash: { type: DataTypes.STRING, allowNull: false },
    avatarUrl: { type: DataTypes.STRING, allowNull: true },
    bio: { type: DataTypes.STRING(280), allowNull: true },
    lastSeenAt: { type: DataTypes.DATE, allowNull: true },
  }, {
    tableName: 'users',
    underscored: true
  });

  // Inject live presence into all JSON payloads where User is embedded.
  // This keeps API contracts stable and avoids having to modify every controller.
  model.prototype.toJSON = function () {
    const values = { ...this.get() };
    values.isOnline = isOnline(values.id);
    return values;
  };

  return model;
}
