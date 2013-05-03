#!/bin/env node
//  OpenShift sample Node application
var express = require('express');
var fs      = require('fs');
var mongodb	= require('mongodb');

/**
 *  Define the sample application.
 */
var SampleApp = function() {

    //  Scope.
    var self = this;


    /*  ================================================================  */
    /*  Helper functions.                                                 */
    /*  ================================================================  */

    /**
     *  Set up server IP address and port # using env variables/defaults.
     */
    self.setupVariables = function() {
        //  Set the environment variables we need.
        self.ipaddress = process.env.OPENSHIFT_INTERNAL_IP;
        self.port      = process.env.OPENSHIFT_INTERNAL_PORT || 8080;

        if (typeof self.ipaddress === "undefined") {
            //  Log errors on OpenShift but continue w/ 127.0.0.1 - this
            //  allows us to run/test the app locally.
            console.warn('No OPENSHIFT_INTERNAL_IP var, using 127.0.0.1');
            self.ipaddress = "127.0.0.1";
        };
    };


    /**
     *  Populate the cache.
     */
    self.populateCache = function() {
        if (typeof self.zcache === "undefined") {
            self.zcache = { 'index.html': '' };
        }

        //  Local cache for static content.
        self.zcache['index.html'] = fs.readFileSync('./index.html');
        
        self.zcache['css/home.css'] = fs.readFileSync('./css/home.css');
        
    };


    /**
     *  Retrieve entry (content) from cache.
     *  @param {string} key  Key identifying content to retrieve from cache.
     */
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


    /**
     *  Setup termination handlers (for exit and a list of signals).
     */
    self.setupTerminationHandlers = function(){
        //  Process on exit and signals.
        process.on('exit', function() { self.terminator(); });

        // Removed 'SIGPIPE' from the list - bugz 852598.
        ['SIGHUP', 'SIGINT', 'SIGQUIT', 'SIGILL', 'SIGTRAP', 'SIGABRT',
         'SIGBUS', 'SIGFPE', 'SIGUSR1', 'SIGSEGV', 'SIGUSR2', 'SIGTERM'
        ].forEach(function(element, index, array) {
            process.on(element, function() { self.terminator(element); });
        });
    };


    /*  ================================================================  */
    /*  App server functions (main app logic here).                       */
    /*  ================================================================  */

    /**
     *  Create the routing table entries + handlers for the application.
     */
    self.createRoutes = function() {
        self.routes = { };

        // Routes for /health, /asciimo and /
        self.routes['/health'] = function(req, res) {
            res.send('1');
        };
        
        /*
        self.routes['/css/home.css'] = function(req,res) {
	        res.setHeader('Content-Type', 'text/css');
	        res.send(self.cache_get('css/home.css'));
        };
        */
        
        self.routes['/asciimo'] = function(req, res) {
            var link = "http://i.imgur.com/kmbjB.png";
            res.send("<html><body><img src='" + link + "'></body></html>");
        };

        self.routes['/'] = function(req, res) {
            res.setHeader('Content-Type', 'text/html');
            res.send(self.cache_get('index.html') );
        };
    };

    /**
     *  Connect to the MongoDB
     */
    self.connectToDB = function() {
	    var db = new mongodb.Db('animal-list', new mongodb.Server('localhost', 27017, {auto_reconnect: true, safe: false}, {}));
	    db.open(function(err, db){
	    	var animalCol = db.collection("animals");
	    	var adjCol = db.collection("adjectives");
	    	animalCol.remove();
	    	adjCol.remove();
	    	
	    	var animals = fs.readFileSync("./animals.txt", "utf8").split("\n");
	    	var adjectives = fs.readFileSync("./adjectives.txt", "utf8").split("\n");
	    	
		    db.createCollection("animals", function(err, collection) {
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
		    })
	    });
    }
    
    /**
     *  Initialize the server (express) and create the routes and register
     *  the handlers.
     */
    self.initializeServer = function() {
        self.createRoutes();
        self.app = express.createServer();

        //  Add handlers for the app (from the routes).
        for (var r in self.routes) {
            self.app.get(r, self.routes[r]);
        }
        
        self.app.get( /^\/css\/.*\.css$/, function(req,res) {
        	res.setHeader('Content-Type', 'text/css');
	        //res.send(self.cache_get(req));
	        
	        res.send( fs.readFileSync('.' + req.url) );
	        
        });
      
        self.app.get( /^\/font\//, function(req,res) {
	        res.setHeader('Content-Type', 'application/x-font-woff');
	        res.send( fs.readFileSync('.' + req.url) );
        });
        
        self.app.get( '/js/animals.js', function(req,res) {
	        res.setHeader('Content-Type', 'text/javascript');
	        var db = new mongodb.Db('animal-list', new mongodb.Server('localhost',27017));
	        db.open(function(err, db) {
		        var animals_cursor = db.collection('animals').find({});
		        var result = animals_cursor.toArray( function(err,docs) {
		        	res.send(JSON.stringify( docs.map(function(d){ return d.name; })));
			    });
			});
        });
        
        self.app.get( '/js/adjectives.js', function(req,res) {
	        res.setHeader('Content-Type', 'text/javascript');
	        var db = new mongodb.Db('animal-list', new mongodb.Server('localhost',27017));
	        db.open(function(err, db) {
		        var animals_cursor = db.collection('adjectives').find({});
		        var result = animals_cursor.toArray( function(err,docs) {
		        	//res.send( '"use strict";' );
		        	res.send(JSON.stringify( docs.map(function(d){ return d.name; })));
			    });
			});	        
        });
        
    };


    /**
     *  Initializes the sample application.
     */
    self.initialize = function() {
        self.setupVariables();
        self.populateCache();
        self.setupTerminationHandlers();
        self.connectToDB();
        
        // Create the express server and routes.
        self.initializeServer();
    };


    /**
     *  Start the server (starts up the sample application).
     */
    self.start = function() {
        //  Start the app on the specific interface (and port).
        self.app.listen(self.port, self.ipaddress, function() {
            console.log('%s: Node server started on %s:%d ...',
                        Date(Date.now() ), self.ipaddress, self.port);
        });
    };

};   /*  Sample Application.  */



/**
 *  main():  Main code.
 */
var zapp = new SampleApp();
zapp.initialize();
zapp.start();

