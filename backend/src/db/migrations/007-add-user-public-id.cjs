'use strict';

const { randomBytes } = require('crypto');

function genId() {
  return randomBytes(9).toString('base64url'); // ~12 символов
}

module.exports = {
  async up(queryInterface, Sequelize) {
    // 1. Добавляем колонку
    await queryInterface.addColumn('users', 'public_id', {
      type: Sequelize.STRING(16),
      allowNull: true
    });

    // 2. Проставляем существующим
    const [rows] = await queryInterface.sequelize.query(`SELECT id FROM users`);
    for (const r of rows) {
      await queryInterface.sequelize.query(
        `UPDATE users SET public_id = :pid WHERE id = :id`,
        { replacements: { pid: genId(), id: r.id } }
      );
    }

    // 3. Делаем NOT NULL + UNIQUE
    await queryInterface.changeColumn('users', 'public_id', {
      type: Sequelize.STRING(16),
      allowNull: false,
      unique: true
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('users', 'public_id');
  }
};
