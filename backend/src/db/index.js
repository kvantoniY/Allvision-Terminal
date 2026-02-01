import { Sequelize } from 'sequelize';
import { env } from '../config/env.js';
import { initModels } from './models/index.js';

export const sequelize = new Sequelize(env.DATABASE_URL, {
  dialect: 'postgres',
  logging: false
});

export const db = {
  sequelize,
  Sequelize,
  models: {}
};

export async function initDb() {
  await sequelize.authenticate();
  db.models = initModels(sequelize);
}
