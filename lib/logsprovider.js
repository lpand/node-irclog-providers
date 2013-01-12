var mongodb = require('mongodb')
	, util 		= require('../misc/util.js')
	,	Db 			= mongodb.Db
	,	Server 	= mongodb.Server;

var LogsProvider = function (host, port, user, password) {
	if (!(this instanceof LogsProvider))
		return new LogsProvider(host, port, user, password);
	
	if (!host)
		host = '127.0.0.1';
	if (!port)
		port = 27017;
	this.db = new Db('irc', new Server(host, port, {auto_reconnect: true, w: 100}, {keepAlive: 100}));
	this.db.open(function (err, db) {
		if (err) {
			console.error(' There was an error with the connection opening\n%s', err);
			return;
		}

		if (user && password) {
			db.authenticate(user, password, function (err, result) {
				if (err || !result) {
					console.error(' There was an error with the authentication\n%s\n%s'
						, err
						, 'the connection will be closed');

					db.close();
				}
			});
		}
	});
};

LogsProvider.prototype.collection = function (callback) {
	this.db.collection('channels', function (err, collection) {
		if (err)
			return callback(err);

		if (!collection)
			return this.db.createCollection('channels', callback);

		callback(err, collection);
	});
};

LogsProvider.prototype.save = function (channel, message, callback) {
	// the likelihood that the document already exists is high.
	var query = {_id: channel, 'log.day': util.now() }
		,	updatedFields = {$push: {'log.$.messages': message}}
		,	self = this;

	if (!callback)
		callback = function(){};
												
	this.collection(function(err, collection) {
		if (err)
			return callback(err);

		collection.update(query, updatedFields, function (err, result) {
			if (err) {
				console.error(err);
				callback(err);
			} else if (!result) {
				collection.insert(
					{_id: channel, log: [ {day: util.now(), messages: [message]} ]}
				,	callback);
			} else {
				callback(err, result);
			}
		});
	});
};

// Returns the log of the channel of the selected day.
// First param of the callback is the error, the second one is a cursor.
LogsProvider.prototype.findByChannelDay = function (channel, day, callback) {
	this.collection(function (err, collection) {
		if (err)
			return callback(err);

		return collection.find({_id: channel, 'log.day': day}
			, {'log.$.messages': 1, '_id': 0}
			, function (err, cursor) {
					if (err)
						return callback(err);
					cursor.nextObject(function (err, item) {
						if (err)
							return callback(err);
						if (item == null)
							return callback(null, []);
						callback(null, item.log[0].messages);
					});
				}
		);
	});
};


LogsProvider.prototype.channelNames = function(callback) {
	this.collection(function (err, collection) {
		if (err)
			return callback(err);

		var cursor = collection.find({}, {_id: 1}, {sort: [['_id', 1]]});
		cursor.toArray(function (err, documents) {
			if (err)
				return callback(err);

			var i = 0, len = documents.length, ary = [];
			
			for (; i < len; ++i)
				ary.push(documents[i]._id);
			
			callback(null, ary);
		});
	});
};


module.exports = LogsProvider;








