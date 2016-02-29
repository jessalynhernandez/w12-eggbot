var path = require('path');
var request = require('request');
var sqlite3 = require('sqlite3').verbose();

var outputFile = process.argv[2] || path.resolve(__dirname, 'eggbot.db');
var db = new sqlite3.Database(outputFile);

var data = [

  {
    preference: 'soft',
    water: 35.0,
    noEggs: 8,
    time: 7.0
  },
  {
    preference: 'soft',
    water: 55.0,
    noEggs: 16,
    time: 11.0
  },

  {
    preference: 'medium',
    water: 35.0,
    noEggs: 8,
    time: 8.0
  },
  {
    preference: 'medium',
    water: 55.0,
    noEggs: 16,
    time: 13.0
  },


  {
    preference: 'medium well',
    water: 55.0,
    noEggs: 8,
    time: 11.0
  },
  {
    preference: 'medium well',
    water: 65.0,
    noEggs: 16,
    time: 14.0
  },


  {
    preference: 'well done',
    water: 85.0,
    noEggs: 8,
    time: 15.0
  },
  {
    preference: 'well done',
    water: 75.0,
    noEggs: 16,
    time: 18.0
  },
  {
    preference: 'hard', // Same as well done just a different naming convention
    water: 85.0,
    noEggs: 8,
    time: 15.0
  },
  {
    preference: 'hard', // Same as well done just a different naming convention
    water: 75.0,
    noEggs: 16,
    time: 18.0
  }
];

db.serialize();
db.run('CREATE TABLE IF NOT EXISTS info (name TEXT PRIMARY KEY, val TEXT DEFAULT NULL)');

// db.run('DROP TABLE eggtimes');

db.run('CREATE TABLE IF NOT EXISTS eggtimes (id INTEGER PRIMARY KEY AUTOINCREMENT, preference TEXT, water FLOAT, noEggs INTEGER, time FLOAT)');

for(var i=0; i<data.length; i++) {
  var d = data[i];
  var insertArray = [d.preference,d.water,d.noEggs,d.time];
  console.log('insertArray : ', insertArray);
  db.run('INSERT INTO eggtimes (preference,water,noEggs,time) VALUES (?,?,?,?)', insertArray, function (err) {
    if(err) {
      console.log('db error : ', err.message);
    }
    console.log('success adding item');
  });
}

db.close();
