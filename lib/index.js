'use strict';
const _            = require('lodash');
const EventEmitter = require('events').EventEmitter;
const util         = require('util');

const Err = (str) => {
    return new Error(`SuperQueue Error: ${str}`);
};

const validNumber = (object, name, def, min, max) => {
    const value = _.get(object, name, def);
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

const validInt = (value, name, def, min, max) => {
    return Math.floor(validNumber(value, name, def, min, max));
};

const validFlagArr = (arr, flags) => {
    if (_.isUndefined(arr)) {
        return [];
    }
    if (!_.isArray(funcOptions.flags)) {
        throw Err(`"flags" property provided to '.push()' must be an array. Got: '${funcOptions.flags}'.`);
    }
    return _.forEach(arr, (flagName) => {
        if (!_.isString(flagName) && !_.isSymbol(flagName)) {
            throw Err(`Flag '${flagName}' provided to '.push()' is not a valid flag name. The flag name
                        must be either a String or a Symbol`);
        }
        if (!flags[flagName]) {
            throw Err(`Flag '${flagName}' provided to '.push()' has not been registered with the queue`);
        }
    });
};

const validKey = (value, name, def) => {
    if (_.isUndefined(value)) {
        return def;
    }
    if (!_.isString(value) && !_.isSymbol(value)) {
        throw Err(`${name} option must be a valid key (String or Symbol); got '${value}'.`);
    }
    return value;
};

const initializeFlag = (flags, flagName, options) => {
    flags[flagName] = {
        concurrency: validInt(options, 'concurrency', 1, 1),
        interval: validNumber(options, 'interval', 0, 0),
        rate: validInt(options, 'rate', 0, 0),
        rateDenominator: validNumber(options, 'rateDenominator', 1000, 0.001),
        concurrent: 0,
        length: 0,
        paused: false,
        recent: [],
    };
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

const findFlagUnlockTime = (flag) => {
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

const executeItem = (item, emitter, flags, flagUnlockTimes) => {
    const startTime = Date.now();
    const emission = {
        name: item.name,
        flags: _.drop(item.flags),
        error: false,
    };
    emitter.emit('start', emission);

    _.forEach(item.flags, (flagName) => {
        updateFlagExecutionStart(flags[flagName]);
        flagUnlockTimes[flagName] = findFlagUnlockTime(flags[flagName]);
    });
    item.func(...item.params)
        .then((res) => {
            item.resolve(res);
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
    if (!queue.length) {
        return;
    }
    const currentTime = Date.now();
    const flagNames = [...Object.getOwnPropertySymbols(flags), ...Object.getOwnPropertyNames(flags)];

    let flagUnlockTimes = _.zipObject(flagNames, flagNames.map((flagName) => {
        return findFlagUnlockTime(flags[flagName]);
    }));

    // Check if default flag is blocked. setTimeout stops working above 2147483647 (~24 days)
    let waitDuration = Math.min(flagUnlockTimes[defaultFlag] - currentTime, 2147483647);
    if (waitDuration > 0) {
        timeout.timeout = setTimeout(executeOnQueue, waitDuration, queue, flags, defaultFlag, timeout, emitter);
        return;
    }
    _.forEach(queue, (queueItem) => {
        const itemReady = _.every(queueItem.flags, (flagName) => {
            return flagUnlockTimes[flagName] <= currentTime;
        });

        if (!itemReady) {
            return;
        }
        _.pull(queue, queueItem);
        executeItem(queueItem, emitter, flags, flagUnlockTimes);
        if (!queue.length) {
            emitter.emit('empty');
            return false;
        }
        if (flagUnlockTimes[defaultFlag] > currentTime) {
            return false;
        }
    });

    const awaitedFlags = _.uniq(_.reduce(queue, (acc, queueItem) => {
        acc.concat(queueItem.flags);
    }, []));

    waitDuration = _.minBy(awaitedFlags, (flagName) => {
        return findFlagUnlockTime(flags[flagName]);
    }) + 1 - currentTime;

    // setTimeout stops working above this (~24 days)
    waitDuration = Math.min(Math.max(waitDuration, 1), 2147483647);
    timeout.timeout = setTimeout(executeOnQueue, waitDuration, queue, flags, defaultFlag, timeout, emitter);
};

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

            // Sort between different function headers
            if (_.isFunction(args[0])) {
                [queueItem.func, ...queueItem.params] = args;
            } else if (_.isFunction(args[1])) {
                let funcOptions;
                [funcOptions, queueItem.func, ...queueItem.params] = args;
                queueItem.priority = validNumber(funcOptions, 'priority', 10, 0);
                queueItem.name = validKey(funcOptions, 'name', '');
                queueItem.flags.concat(validFlagArr(_.uniq(funcOptions.flags), flags));
            } else {
                throw Err('No function was provided to queue.push().');
            }

            // Add new item to queue
            queueItem.flags.forEach((flagName) => {
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
        if (_.isFinite(options)) {
            defaultFlagOptions.concurrency = validInt({ concurrency: options }, 'concurrency', 1, 1);
        } else {
            defaultFlagOptions = options;
        }
    }
    initializeFlag(flags, defaultFlag, defaultFlagOptions);
    return this;
};

util.inherits(SuperQueue, EventEmitter);

module.exports = SuperQueue;
