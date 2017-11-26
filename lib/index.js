'use strict';
const _            = require('lodash');
const EventEmitter = require('events').EventEmitter;
const util         = require('util');

const Err = (str) => {
    return new Error(`SuperQueue Error: ${str}`);
};

const validNumber = (value, name, min, max) => {
    if (!_.isFinite(value)) {
        throw Err(`${name} option is not a valid number; got '${value}'.`);
    }
    if (_.isFinite(min) && value < min) {
        throw Err(`${name} option must be at least ${min}; got '${value}'.`);
    }
    if (_.isFinite(max) && value > max) {
        throw Err(`${name} option must be at most ${max}; got '${value}'.`);
    }
    return value;
};

const validInt = (value, name, min, max) => {
    return Math.floor(validNumber(value, name, min, max));
};

const validKey = (value, name) => {
    if (!_.isString(value) && !_.isSymbol(value)) {
        throw Err(`${name} option must be a valid key (String or Symbol); got '${value}'.`);
    }
    return value;
};

const initializeFlag = (flags, flagName, options) => {
    flags[flagName] = {
        concurrency: 1,
        interval: 0,
        rate: 0,
        rateDenominator: 1000,
        concurrent: 0,
        length: 0,
        paused: false,
        recent: [],
    };

    if (_.has(options, 'concurrency')) {
        flags[flagName].concurrency = validInt(options.concurrency, 'concurrency', 1);
    }
    if (_.has(options, 'interval')) {
        flags[flagName].interval = validNumber(options.interval, 'interval', 0);
    }
    if (_.has(options, 'rate')) {
        flags[flagName].rate = validInt(options.rate, 'rate', 0);
    }
    if (_.has(options, 'rateDenominator')) {
        flags[flagName].rateDenominator = validNumber(options.rateDenominator, 'rateDenominator', 0.001);
    }
};

const getFlag = (flags, flagName, defaultFlag) => {
    if (_.isUndefined(flagName)) {
        return flags[defaultFlag];
    }
    if (_.has(flags, flagName)) {
        return flags[flagName];
    }
    throw Err(`No flag named '${flagName}'. Cannot access.`);
};

const nextFlagExecutionTime = (flag) => {
    if (flag.paused || flag.concurrent >= flag.concurrency) {
        return Infinity;
    }
    const intervalConstraint = flag.recent.length ? _.max(flag.recent) + flag.interval : 0;
    // If not enough items have been sent to fill the queue even once
    if (!flag.rate || flag.recent.length < flag.rate) {
        return intervalConstraint;
    }
    const rateConstraint = _.min(flag.recent) + flag.rateDenominator;
    return Math.max(intervalConstraint, rateConstraint);
};

const updateFlagExecutionStart = (flag) => {
    const startTime = Date.now();
    flag.concurrent++;
    flag.length--;
    if (flag.recent.length < flag.rate) {
        return flag.recent.push((startTime));
    }
    flag.recent[_.indexOf(flag.recent, _.min(flag.recent))] = startTime;
};

const updateFlagExecutionFinish = (flag) => {
    flag.concurrent--;
};

const executeItem = (item, emitter, flags) => {
    const startTime = Date.now();
    const emission = {
        name: item.name,
        flags: _.drop(item.flags),
    };
    emitter.emit('start', emission);

    _.forEach(item.flags, (flagName) => {
        updateFlagExecutionStart(flags[flagName]);
    });
    item.func(...item.params)
        .then((res) => {
            item.resolve(res);
            emission.error = false;
            emission.result = res;
        })
        .catch((err) => {
            item.reject(err);
            emission.error = true;
            emission.result = err;
        })
        .then(() => {
            _.forEach(item.flags, (flagName) => {
                updateFlagExecutionFinish(flags[flagName]);
            });
            emission.duration = Date.now() - startTime;
            emitter.emit('complete', emission);
        });
};

const executeOnQueue = (queue, flags, defaultFlag, timeout, emitter) => {
    clearTimeout(timeout.timeout);
    const currentTime = Date.now();
    if (!queue.length) {
        return;
    }
    const flagNames = [...Object.getOwnPropertySymbols(flags), ...Object.getOwnPropertyNames(flags)];

    let flagNextExecutionTimes = {};
    _.forEach(flagNames, (flagName) => {
        flagNextExecutionTimes[flagName] = nextFlagExecutionTime(flags[flagName]);
    });

    // Check if default flag is blocked. setTimeout stops working above 2147483647 (~24 days)
    let waitDuration = Math.min(flagNextExecutionTimes[defaultFlag] - currentTime, 2147483647);
    if (waitDuration > 0) {
        clearTimeout(timeout.timeout);
        setTimeout(executeOnQueue, waitDuration, queue, flags, defaultFlag, timeout, emitter);
        return;
    }
    _.forEach(queue, (queueItem) => {
        const itemReady = _.every(queueItem.flags, (flagName) => {
            return flagNextExecutionTimes[flagName] <= currentTime;
        });

        if (itemReady) {
            _.pull(queue, queueItem);
            executeItem(queueItem, emitter, flags);
            _.forEach(queueItem.flags, (flagName) => {
                flagNextExecutionTimes[flagName] = nextFlagExecutionTime(flags[flagName]);
            });
            if (!queue.length) {
                emitter.emit('empty');
                return false;
            }
            if (flagNextExecutionTimes[defaultFlag] > currentTime) {
                return false;
            }
        }
    });
    if (!queue.length) {
        return false;
    }

    flagNextExecutionTimes = {};
    // Find all the flags actually being waited on
    _.forEach(queue, (queueItem) => {
        _.forEach(queueItem.flags, (flagName) => {
            if (!flagNextExecutionTimes[flagName]) {
                flagNextExecutionTimes[flagName] = nextFlagExecutionTime(flags[flagName]);
            }
        });
    });

    waitDuration = _.reduce(flagNames, (acc, flagName) => {
        return Math.min(flagNextExecutionTimes[flagName], acc);
    }, Infinity) + 1 - currentTime;

    // setTimeout stops working above this (~24 days)
    waitDuration = Math.min(Math.max(waitDuration, 1), 2147483647);
    clearTimeout(timeout.timeout);
    timeout.timeout = setTimeout(executeOnQueue, waitDuration, queue, flags, defaultFlag, timeout, emitter);
};

// TODO: Use EventEmitter for executing items
const SuperQueue = function (options) {
    const queue = [];
    const flags = {};
    const defaultFlag = Symbol();
    const timeout = {};

    EventEmitter.call(this);

    this.on('complete', () => {
        executeOnQueue(queue, flags, defaultFlag, timeout, this);
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
            let funcOptions = {};
            // Sort between different function headers
            if (_.isFunction(args[0])) {
                [queueItem.func, ...queueItem.params] = args;
            } else if (_.isFunction(args[1])) {
                [funcOptions, queueItem.func, ...queueItem.params] = args;
            } else {
                throw Err('No function was provided to queue.push().');
            }

            // Parse options
            if (_.has(funcOptions, 'priority')) {
                queueItem.priority = validNumber(funcOptions.priority, 'priority', 0);
            }
            if (_.has(funcOptions, 'name')) {
                queueItem.name = validKey(funcOptions.name, 'name');
            }
            if (_.has(funcOptions, 'flags')) {
                if (!_.isArray(funcOptions.flags)) {
                    throw Err(`"flags" property provided to '.push()' must be an array. 
                            Got: '${funcOptions.flags}'.`);
                }
                funcOptions.flags.forEach((flagName) => {
                    if (!_.isString(flagName) && !_.isSymbol(flagName)) {
                        throw Err(`Flag '${flagName}' provided to '.push()' is not a valid flag name. The flag name
                        must be either a String or a Symbol`);
                    }
                    if (!flags[flagName]) {
                        throw Err(`Flag '${flagName}' provided to '.push()' has not been registered with the queue`);
                    }
                });
                queueItem.flags.push(...funcOptions.flags);
            }

            // Add new item to queue
            _.forEach(queueItem.flags, (flagName) => {
                flags[flagName].length++;
            });
            queue.splice(_.sortedLastIndexBy(queue, queueItem, 'priority'), 0, queueItem);
            executeOnQueue(queue, flags, defaultFlag, timeout, this);
        });
    };

    this.setPause = (flagName, val) => {
        const flag = getFlag(flags, flagName, defaultFlag);
        const wasPaused = flag.paused;
        flag.paused = !!val;
        return wasPaused === !val;
    };

    this.pause = (flagName) => {
        return this.setPause(flagName, true);
    };

    this.unpause = (flagName) => {
        const wasPaused = this.setPause(flagName, false);
        executeOnQueue(queue, flags, defaultFlag, timeout, this);
        return wasPaused;
    };

    this.getLength = (flagName) => {
        return getFlag(flags, flagName, defaultFlag).length;
    };

    this.getConcurrent = (flagName) => {
        return getFlag(flags, flagName, defaultFlag).concurrent;
    };

    this.addFlag = (flagOptions) => {
        if ((!_.isString(flagOptions.name) && !_.isSymbol(flagOptions.name)) || !flagOptions.name) {
            throw Err(`Error creating flag: '${name}' is not a valid name.`);
        }
        initializeFlag(flags, flagOptions.name, flagOptions);
    };

    // Initialize default flag. Handle different initializer methods.
    let defaultFlagOptions = {};
    if (options) {
        try {
            defaultFlagOptions.concurrency = validInt({ concurrency: options }, 'concurrency', 1);
        } catch (e) {
            defaultFlagOptions = options;
        }
    }
    initializeFlag(flags, defaultFlag, defaultFlagOptions);
    return this;
};

util.inherits(SuperQueue, EventEmitter);

module.exports = SuperQueue;
