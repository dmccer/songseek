const path = require('path');
const Sequelize = require('sequelize');
const Conf = require('./pbc.conf').db;

module.exports = new Sequelize(Conf.name, Conf.user, Conf.pwd, {
  host: Conf.host,
  dialect: 'mysql',
  port: Conf.port,
  pool: {
    max: 5,
    min: 0,
    acquire: 30000,
    idle: 10000
  },

  // http://docs.sequelizejs.com/manual/tutorial/querying.html#operators
  operatorsAliases: false
});

