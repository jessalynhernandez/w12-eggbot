'use strict';

var EggBot = require('../lib/eggbot.js');

var token = process.env.BOT_API_KEY;
var dbPath = process.env.BOT_DB_PATH;
var name = process.env.BOT_NAME;

var eggbot = new EggBot({
  token:token,
  dbPath: dbPath,
  name: name
});

eggbot.run();
