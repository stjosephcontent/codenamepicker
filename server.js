#!/bin/env node
var express		= require('express'),
    sessions	= require('client-sessions'),
    mongodb		= require('mongodb'),
    fs			= require('fs');

var app = express();

process.env['COOKIE_SECRET'] = 'iusodfuygosiudfygsoiudfgy78';

app.use(express.logger());

//	routes
app.use(function (req, res, next) {
  if (/^\/api/.test(req.url)) {
    res.setHeader('Cache-Control', 'no-cache, max-age=0');
    return sessions({
      cookieName: '123done',
      secret: process.env['COOKIE_SECRET'] || 'define a real secret, please',
      cookie: {
        path: '/api',
        httpOnly: true
      }
    })(req, res, next);
  } else {
    return next();
  }
});
app.use(function(req,res,next){
	if (req.url == '/') {
		fs.readFile('./index.html', function(err,data){
			res.writeHead(200, {'Content-Type': 'text/html'});
			res.end(data);
		});
	} else {
		next();
	}
});
app.use(function(req,res,next) {
	//	adjectives and animals
}

app.use(express.static('./'));

/*
app.use(express.static('/css',__dirname + "/css"));
app.use(express.static('/js',__dirname + "/js"));
app.use(express.static('/font',__dirname + "/font"));
*/

// a function to verify that the current user is authenticated
function checkAuth(req, res, next) {
  if (!req.session.user) {
    res.send("authentication required\n", 401);
  } else {
    next();
  }
}

// logout clears the current authenticated user
app.post('/api/logout', checkAuth, function(req, res) {
  req.session.user = null;
  res.send(200);
});

app.post('/api/verify', function(req, res) {
  var body = JSON.stringify({
    assertion: req.body.assertion,
    audience: 'http://' + req.headers.host
  });
  var vreq = https.request({
    host: req.verifier_host,
    path: '/verify',
    method: 'POST',
    headers: {
      'Content-Length': body.length,
      'Content-Type': 'application/json'
    }
  }, function (vres) {
    var body = "";
    vres.on('data', function(chunk) { body += chunk; });
    vres.on('end', function() {
      try {
        // if response is successful, indicate the user is logged in
        req.session.user = JSON.parse(body).email;
      } catch(e) {
      }
      res.send(body);
    });
  });
  vreq.write(body);
  vreq.end();
});

// auth status reports who the currently logged in user is on this
// session
app.get('/api/auth_status', function(req, res) {
  res.send(JSON.stringify({
    logged_in_email: req.session.user || null,
  }));
});

if (typeof process.env.OPENSHIFT_INTERNAL_PORT != "undefined") {
	app.locals({
		'ip': process.env.OPENSHIFT_INTERNAL_IP,
		'port': process.env.OPENSHIFT_INTERNAL_PORT,
		'mongo': {
			'host': process.env.OPENSHIFT_MONGODB_DB_HOST,
			'port': process.env.OPENSHIFT_MONGODB_DB_PORT,
			'username': process.env.OPENSHIFT_MONGODB_DB_USERNAME,
			'passwd': process.env.OPENSHIFT_MONGODB_DB_PASSWORD
		}
	});
} else {
	app.locals({
		'ip': '127.0.0.1',
		'port': 8080,
		'mongo': {
			'host': 'localhost',
			'port': 27017,
			'username': null,
			'passwd': null
		}
	});
}

if (app.locals.mongo.passwd == null) {
	app.locals.mongo.connection_url = 'mongodb://' + app.locals.mongo.host + ':' + app.locals.mongo.port;
	app.use(express.logger());
} else {
	app.locals.mongo.connection_url = 'mongodb://' + app.locals.mongo.username + ':' + app.locals.mongo.passwd + '@' + app.locals.mongo.host + ':' + app.locals.mongo.port;
}

var populateDB = function() {
	mongodb.Db.connect(app.locals.mongo.connection_url, function(err, db) {
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


//populateDB();

app.listen(app.locals.port,app.locals.ip);