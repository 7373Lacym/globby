'use strict';
var fs = require('fs');
var Promise = require('pinkie-promise');
var arrayUnion = require('array-union');
var objectAssign = require('object-assign');
var glob = require('glob');
var pify = require('pify');

var globP = pify(glob, Promise).bind(glob);

function isNegative(pattern) {
	return pattern[0] === '!';
}

function isString(value) {
	return typeof value === 'string';
}

function assertPatternsInput(patterns) {
	if (!patterns.every(isString)) {
		throw new TypeError('patterns must be a string or an array of strings');
	}
}

function generateGlobTasks(patterns, opts) {
	patterns = [].concat(patterns);
	assertPatternsInput(patterns);

	var globTasks = [];

	opts = objectAssign({
		cache: Object.create(null),
		statCache: Object.create(null),
		realpathCache: Object.create(null),
		symlinks: Object.create(null),
		ignore: []
	}, opts);

	patterns.forEach(function (pattern, i) {
		if (isNegative(pattern)) {
			return;
		}

		var ignore = patterns.slice(i).filter(isNegative).map(function (pattern) {
			return pattern.slice(1);
		});

		globTasks.push({
			pattern: pattern,
			opts: objectAssign({}, opts, {
				ignore: opts.ignore.concat(ignore)
			})
		});
	});

	return globTasks;
}

module.exports = function (patterns, opts) {
	var globTasks;
	if (typeof opts !== 'undefined') {
		var hasFilesProperty = Object.prototype.hasOwnProperty.call(opts, 'files');
		if (hasFilesProperty) {
			fs.readFile(opts.files, 'utf8', function (err, contents) {
				contents = contents.split('\n');
				contents.forEach(function (element) {
					patterns.push(element);
				});
			});
		}
	}
	try {
		globTasks = generateGlobTasks(patterns, opts);
	} catch (err) {
		return Promise.reject(err);
	}

	return Promise.all(globTasks.map(function (task) {
		return globP(task.pattern, task.opts);
	})).then(function (paths) {
		return arrayUnion.apply(null, paths);
	});
};

module.exports.sync = function (patterns, opts) {
	var globTasks = generateGlobTasks(patterns, opts);

	return globTasks.reduce(function (matches, task) {
		return arrayUnion(matches, glob.sync(task.pattern, task.opts));
	}, []);
};

module.exports.generateGlobTasks = generateGlobTasks;

module.exports.hasMagic = function (patterns, opts) {
	return [].concat(patterns).some(function (pattern) {
		return glob.hasMagic(pattern, opts);
	});
};

