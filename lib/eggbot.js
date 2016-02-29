'use strict';

var util = require('util');
var path = require('path');
var fs = require('fs');
var SQLite = require('sqlite3').verbose();
var Bot = require('slackbots');

var Wemo = require('wemo-client');
var wemo = new Wemo();

var wit = require('node-wit');


var EggBot = function Constructor(settings) {
  this.settings = settings;
  this.settings.name = this.settings.name || 'eggbot';
  this.dbPath = settings.dbPath || path.resolve(process.cwd(), 'data', 'eggbot.db');

  this.user = null;
  this.db = null;

  this.wemoClient = null;
  this._onWemoBinaryStateChangeBound = this._onWemoBinaryStateChange.bind(this);

  this.scheduledSwitchOff = null;
  this.scheduledSwitchOn = null;

  this.WIT_ACCESS_TOKE = 'API TOKEN HERE';
};
var p = EggBot.prototype;

p.run = function() {
  console.log('run');
  EggBot.super_.call(this, this.settings);

  this.on('start', this._onStart);
  this.on('message', this._onMessage);
};

p._onStart = function(){
  console.log('_onStart');
  this._loadBotUser();
  this._connectDb();
  this._wemoDiscover();
  this._firstRunCheck();
};

p._loadBotUser = function(){
  console.log('_loadBotUser');
  var that = this;
  this.user = this.users.filter(function(user) {
    return user.name === that.name;
  })[0];
};

p._connectDb = function() {
  console.log('_connectDb : ', this.dbPath);
  if (!fs.existsSync(this.dbPath)) {
    console.error('Database path ' + '"' + this.dbPath + '" does not exists or it\'s not readable.');
    process.exit(1);
  }
  console.log('made it here');
  this.db = new SQLite.Database(this.dbPath);
};
p._firstRunCheck = function() {
  console.log('_firstRunCheck');
  var that = this;
  that.db.get('SELECT val FROM info WHERE name = "lastrun" LIMIT 1', function(err, record) {
    if (err) {
      return console.error('DATABASE ERROR:', err);
    }
    var currentTime = (new Date()).toJSON();
    if(!record) {
      that._welcomeMessage();
      return that.db.run('INSERT INTO info(name, val) VALUES("lastrun", ?)', currentTime);
    }
    that.db.run('UPDATE info SET val = ? WHERE name = "lastrun"', currentTime);
  });
};

p._welcomeMessage = function(){
  console.log('_welcomeMessage');
  this.postMessageToChannel(this.channels[0].name, 'Hi guys,' +
    '\n I can help you with your egg related needs just say `eggbot` or `' + this.name + '` to invoke me!',
    {as_user: true});
};

p._onMessage = function(message) {
  if(this._isChatMessage(message) && this._isChannelConversation(message) && !this._isFromEggbot(message) && this._isMentioningEggbot(message)) {
    this._handleAction(message);
  }
};

p._handleAction = function(originalMessage) {
  console.log('_handleAction :: originalMessage : ', originalMessage);
  var channel = this._getChannelById(originalMessage.channel);
  var response;

  var that = this;
  wit.captureTextIntent(this.WIT_ACCESS_TOKE, originalMessage.text, function (err, res) {
    console.log("Response from Wit");
    if (err) console.log("Error: ", err);
    console.log('json : ', JSON.stringify(res, null, " "));

    console.log('res.outcomes : ', res.outcomes);

    if(parseFloat(res.outcomes[0].confidence) < 0.44) {
      that._postMessage(channel, 'I have no idea what the fuck you\'re on about!');
      return;
    }
    var intent = res.outcomes[0].intent;
    console.log('intent : ', intent);
    if(intent === 'make_eggs') {

      response = 'Your eggs will be ready in [value]mins, I\'ll message you when they are done.';
      var fields = [], values = [];
      if(res.outcomes[0].entities['number']) {
        fields.push('noEggs');
        values.push(res.outcomes[0].entities['number'][0].value);
      }
      if(res.outcomes[0].entities['egg_preference']) {
        fields.push('preference');
        values.push(res.outcomes[0].entities['egg_preference'][0].value);
      } else {
        fields.push('preference');
        values.push('medium');
      }

      that._turnWemoOn();
      return that.getMessage(channel, response, fields, values, 'time');

    } else if(intent === 'get_amount_of_water') {
      response = 'You need [value]ml of water to cook those bad boys! Let me know when you want me to get to cooking.';
      var fields = [], values = [];
      if(res.outcomes[0].entities['number']) {
        fields.push('noEggs');
        values.push(res.outcomes[0].entities['number'][0].value);
      }
      if(res.outcomes[0].entities['egg_preference']) {
        fields.push('preference');
        values.push(res.outcomes[0].entities['egg_preference'][0].value);
      } else {
        fields.push('preference');
        values.push('medium');
      }
      return that.getMessage(channel, response, fields, values, 'water');

    } else if(intent === 'switch_on') {
      response = 'The egg maker is now switched on';
      that._turnWemoOn();
    } else if(intent === 'switch_off') {
      response = 'The egg maker is now switched off';
      that._turnWemoOff();
    } else if(intent === 'attack') {
      response = 'Fuck off Alex!';
    } else {
      response = 'We have a working bot';
    }

    that._postMessage(channel, response);

  });
};

p.getMessage = function(channel, response, fields, values, selectValue) {
  var that = this;
  var query = 'SELECT * FROM eggtimes WHERE ';
  for(var i=0; i<fields.length; i++) {
    var f = fields[i];
    var v = values[i];
    query += f+'='+'\''+v+'\'';
    if(i !== fields.length-1) {
      query += ' AND ';
    }
  }
  console.log('query : ', query);
  that.db.get(query, function(err, record) {
    if(err) {
      console.log('Error getting record data : ', err);
      return;
    }

    if(record === undefined) {
      that._postMessage(channel, 'I\'m sorry I couldn\'t find any data on the requirements you asked. Try again and if your still struggling ask @liamviney');
      return;
    }
    console.log('record : ', record);
    response = response.replace('[value]', record[selectValue]);
    console.log('response : ', response);

    if(selectValue === 'time') {
      that.scheduledSwitchOff = setTimeout(function() {
        that._turnWemoOff();
        that._postMessage(channel, 'Yay! Eggs are ready, Enjoy :) ');
      }, record[selectValue] * 60 * 1000);
    }
    that._postMessage(channel, response);
  });
};
p._postMessage = function(channel, response) {
  if(channel !== undefined) {
    this.postMessageToChannel(channel.name, response, {as_user:true});
  }
};


p._isChatMessage = function(message){
  var check = message.type === 'message' && Boolean(message.text);
  return check;
};
p._isChannelConversation = function(message) {
  return typeof message.channel === 'string' && message.channel[0] === 'C';
};
p._isFromEggbot = function(message) {
  var check = message.user === this.user.id;
  return check;
};
p._isMentioningEggbot = function(message) {
  var check = message.text.toLowerCase().indexOf('eggbot') > -1 || message.text.toLowerCase().indexOf(this.name) > -1;
  return check;
};
p._getChannelById = function(channelId) {
  return this.channels.filter(function (item) {
    return item.id === channelId;
  })[0];
};


p._wemoDiscover = function() {
  var that = this;
  wemo.discover(function(deviceInfo) {
    console.log('deviceInfo : ', deviceInfo);

    that.client = wemo.client(deviceInfo);
    console.log('we have a wemo.');
    that.client.on('binaryState', that._onWemoBinaryStateChangeBound);
  });
};

p._onWemoBinaryStateChange = function(value) {
  console.log('Binary State changed to: %s', value);
};

p._turnWemoOn = function() {
  if(this.client == null) {
    console.log('Sorry I can not find a Wemo Device');
    return;
  }

  if(this.scheduledSwitchOn !== null) {
    clearTimeout(this.scheduledSwitchOn);
    this.scheduledSwitchOn = null;
  }
  this.client.setBinaryState(1);
};
p._turnWemoOff = function() {
  if(this.client == null) {
    console.log('Sorry I can not find a Wemo Device');
    return;
  }

  if(this.scheduledSwitchOff !== null) {
    clearTimeout(this.scheduledSwitchOff);
    this.scheduledSwitchOff = null;
  }
  this.client.setBinaryState(0);
};

util.inherits(EggBot, Bot);

module.exports = EggBot;
