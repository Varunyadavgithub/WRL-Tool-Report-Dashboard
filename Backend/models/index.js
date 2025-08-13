import { Sequelize } from 'sequelize';
import sequelize, { testConnection } from '../config/database.js';

import UserModel from './user.model.js'; // example model

await testConnection(); // test DB connection

const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

db.User = UserModel(sequelize, DataTypes);
// Add more models as needed

export default db;