#!/bin/env node
var express = require('express');
var fs      = require('fs');
var mongodb	= require('mongodb');

var App = function() {
    var self = this;
    self.setupVariables = function() {
        self.ipaddress = process.env.OPENSHIFT_INTERNAL_IP;
        self.port      = process.env.OPENSHIFT_INTERNAL_PORT || 8080;
        if (typeof self.ipaddress === "undefined") {
            console.warn('No OPENSHIFT_INTERNAL_IP var, using 127.0.0.1');
            self.ipaddress = "127.0.0.1";
            self.mongo = {
	            "host": "localhost",
	            "port": 27017,
	            "username": null,
	            "passwd": null
            };
            self.connection_url = 'mongodb://' + self.mongo.host + ':' + self.mongo.port;
        } else {
            self.mongo = {
	            "host": process.env.OPENSHIFT_MONGODB_DB_HOST,
	            "port": process.env.OPENSHIFT_MONGODB_DB_PORT,
	            "username": process.env.OPENSHIFT_MONGODB_DB_USERNAME,
	            "passwd": process.env.OPENSHIFT_MONGODB_DB_PASSWORD
            };
            self.connection_url = 'mongodb://' + self.mongo.username + ':' + self.mongo.passwd + '@' + self.mongo.host + ':' + self.mongo.port;
        } 
    };
    //	cache
    self.populateCache = function() {
        if (typeof self.zcache === "undefined") {
            self.zcache = { 'index.html': '' };
        }
        self.zcache['index.html'] = fs.readFileSync('./index.html');
        self.zcache['css/home.css'] = fs.readFileSync('./css/home.css');
        self.zcache['css/font-awesome.min.css'] = fs.readFileSync('./css/font-awesome.min.css');
        self.zcache['js/app.js'] = fs.readFileSync('./js/app.js');
    };
    self.cache_get = function(key) { return self.zcache[key]; };
    /**
     *  terminator === the termination handler
     *  Terminate server on receipt of the specified signal.
     *  @param {string} sig  Signal to terminate on.
     */
    self.terminator = function(sig){
        if (typeof sig === "string") {
           console.log('%s: Received %s - terminating sample app ...',
                       Date(Date.now()), sig);
           process.exit(1);
        }
        console.log('%s: Node server stopped.', Date(Date.now()) );
    };
    self.setupTerminationHandlers = function(){
        process.on('exit', function() { self.terminator(); });
        ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
         'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
        ].forEach(function(element, index, array) {
            process.on(element, function() { self.terminator(element); });
        });
    };
    //	db
    self.connectToDB = function() {
		mongodb.Db.connect(self.connection_url, function(err, db) {
			if (err) console.log(err);
	    	var animalCol = db.collection("animals");
	    	var adjCol = db.collection("adjectives");
	    	animalCol.remove({}, function() {});
	    	adjCol.remove({}, function() {});
	    	var animals = fs.readFileSync("./animals.txt", "utf8").split("\n");
	    	var adjectives = fs.readFileSync("./adjectives.txt", "utf8").split("\n");
		    db.createCollection("animals", function(err, collection) {
		    	if (err) {
			    	console.log('create collection didnt work',err);
		    	}
		    	for (var i = 0; i < animals.length; i++) {
		    		if (animals[i] !== '') {
			    		collection.insert({"name":animals[i]}, function(){});		
		    		}
		    	}
		    });
		    db.createCollection("adjectives", function(err, collection) {
			    for (var i = 0; i < adjectives.length; i++) {
				    if (adjectives[i] != '') {
					    var adj = adjectives[i].split(" ")[1];
					    (function(adj) {
							var result = collection.findOne({name: adj}, function(err, doc){
							    if (typeof doc !== null) {
									collection.insert({name: adj}, console.log);    
							    }
						    });		    
					    })(adj);				    
				    }
			    }
		    });		
		});
    };
    //	routing
    self.createRoutes = function() {
        self.routes = { };
        self.routes['/health'] = function(req, res) {
            res.send('1');
        };
        self.routes['/'] = function(req, res) {
            res.setHeader('Content-Type', 'text/html');
            res.send(self.cache_get('index.html'));
        };
        self.routes['/js/app.js'] = function(req,res) {
	        res.setHeader('Content-Type', 'text/javascript');
	        res.send(self.cache_get('js/app.js'));
        };
        self.routes['/js/adjectives.js'] = function(req,res) {
	        res.setHeader('Content-Type', 'text/javascript');
	        mongodb.Db.connect(self.connection_url, function(err, db) {
		        var animals_cursor = db.collection('adjectives').find({});
		        var result = animals_cursor.toArray( function(err,docs) {
		        	res.send(
		        		'var adjectives = '
		        		+ JSON.stringify( docs.map(function(d){ return d.name; }))
		        		+ ';'
		        	);
			    });
	        });
        };
        self.routes['/js/animals.js'] = function(req,res) {
	        res.setHeader('Content-Type', 'text/javascript');
	        mongodb.Db.connect(self.connection_url, function(err, db) {
		        var animals_cursor = db.collection('animals').find({});
		        var result = animals_cursor.toArray( function(err,docs) {
		        	res.send(
		        		'var animals = '
		        		+ JSON.stringify( docs.map(function(d){ return d.name; }))
		        		+ ';'
		        	);
			    });
	        });
        }
    };
    self.initializeServer = function() {
        self.createRoutes();
        self.app = express.createServer();
        for (var r in self.routes) {
            self.app.get(r, self.routes[r]);
        }
        self.app.get( /^\/css\/.*\.css$/, function(req,res) {
	        var cachekey = req.url.replace(/^\//,'');
	        res.setHeader('Content-Type', 'text/css');
	        res.send(self.cache_get(cachekey));
        });
        self.app.get( /^\/font\//, function(req,res) {
	        res.setHeader('Content-Type', 'application/x-font-woff');
	        res.send( fs.readFileSync('.' + req.url) );
        });
    };
    self.initialize = function() {
        self.setupVariables();
        self.populateCache();
        self.setupTerminationHandlers();
        self.connectToDB();
        // Create the express server and routes.
        self.initializeServer();
    };
    self.start = function() {
        //  Start the app on the specific interface (and port).
        self.app.listen(self.port, self.ipaddress, function() {
            console.log('%s: Node server started on %s:%d ...',
                        Date(Date.now() ), self.ipaddress, self.port);
        });
    };
};

var zapp = new App();
zapp.initialize();
zapp.start();