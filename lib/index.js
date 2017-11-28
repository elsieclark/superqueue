'use strict';
const _            = require('lodash');
const EventEmitter = require('events').EventEmitter;
const util         = require('util');

const Err    = require('./error.service');
const Execute = require('./execute.service');
const Flag    = require('./flag.service');
const Valid   = require('./validate.service');

const SuperQueue = function (options) {
    const queue = [];
    const flags = {};
    const defaultFlag = Symbol();
    const timeout = {};

    EventEmitter.call(this);

    this.on('complete', () => {
        Execute.queue(queue, flags, defaultFlag, timeout, this);
    });

    this.push = (...args) => {
        return new Promise((resolve, reject) => {
            const queueItem = {
                flags: [defaultFlag],
                priority: 10,
                name: '',
                resolve,
                reject,
            };

            // Sort between different function headers
            if (_.isFunction(args[0])) {
                [queueItem.func, ...queueItem.params] = args;
            } else if (_.isFunction(args[1])) {
                let funcOptions;
                [funcOptions, queueItem.func, ...queueItem.params] = args;
                queueItem.priority = Valid.number(funcOptions, 'priority', 10, 0);
                queueItem.name = Valid.key(funcOptions, 'name', '');
                queueItem.flags.concat(Valid.flagArr(_.uniq(funcOptions.flags), flags));
            } else {
                throw Err('No function was provided to queue.push().');
            }

            // Add new item to queue
            queueItem.flags.forEach((flagName) => {
                flags[flagName].length++;
            });
            queue.splice(_.sortedLastIndexBy(queue, queueItem, 'priority'), 0, queueItem);
            Execute.queue(queue, flags, defaultFlag, timeout, this);
        });
    };

    this.setPause = (flagName, val) => {
        const flag = Flag.get(flags, flagName, defaultFlag);
        const wasPaused = flag.paused;
        flag.paused = !!val;
        return wasPaused === !val;
    };

    this.pause = (flagName) => {
        return this.setPause(flagName, true);
    };

    this.unpause = (flagName) => {
        const wasPaused = this.setPause(flagName, false);
        Execute.queue(queue, flags, defaultFlag, timeout, this);
        return wasPaused;
    };

    this.getLength = (flagName) => {
        return Flag.get(flags, flagName, defaultFlag).length;
    };

    this.getConcurrent = (flagName) => {
        return Flag.get(flags, flagName, defaultFlag).concurrent;
    };

    this.addFlag = (flagOptions) => {
        if ((!_.isString(flagOptions.name) && !_.isSymbol(flagOptions.name)) || !flagOptions.name) {
            throw Err(`Error creating flag: '${name}' is not a valid name.`);
        }
        Flag.init(flags, flagOptions.name, flagOptions);
    };

    // Initialize default flag. Handle different initializer methods.
    if (!options) {
        Flag.init(flags, defaultFlag, {});
        return;
    }
    if (!_.isFinite(options)) {
        Flag.init(flags, defaultFlag, options);
    }
    Flag.init(flags, defaultFlag, { concurrency: Valid.int({ concurrency: options }, 'concurrency', 1, 1) });
};

util.inherits(SuperQueue, EventEmitter);

module.exports = SuperQueue;
