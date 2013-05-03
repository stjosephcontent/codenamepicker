var mongo = require('mongodb');
var fs = require('fs');

var dbInitializer = function(host, port) {
	this.db = new mongo.DB('animal-lists', new Server(host, port, {}, {}));
	this.db.open(function(){});
}

