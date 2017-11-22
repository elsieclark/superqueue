'use strict';
const _            = require('lodash');
const EventEmitter = require('events');
const util         = require('util');

const Err = (str) => {
    return new Error(`SuperQueue Error: ${str}`);
};

const validNumber = (value, name, min, max) => {
    if (!_.isFinite(value)) {
        throw Err(`${name} option is not a valid number`);
    }
    if (_.isFinite(min) && value < min) {
        throw Err(`${name} option must be at least ${min}`);
    }
    if (_.isFinite(max) && value > max) {
        throw Err(`${name} option must be at most ${max}`);
    }
    return value;
};

const validInt = (value, name, min, max) => {
    return Math.floor(validNumber(value, name, min, max));
};

const validString = (value, name) => {
    if (!_.isString(value)) {
        throw Err(`${name} option must be a valid string; got ${value}`);
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
        flags[flagName].rate = validNumber(options.rate, 'rate', 0.001);
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
    throw Err(`No flag named ${flagName}. Cannot access.`);
};

/* Queue Object
 *
 * {
 *     name,
 *     priority,
 *     flags: [defaultFlag, "flag1", "flag2"],
 *     func: thennable,
 *     resolve,
 *     reject,
 *     params,
 * }
 *
 */

const executeItem = (item, emitter) => {
    const startTime = Date.now();
    let error = false;
    item.func(...item.params)
        .then((result) => {
            item.resolve(result);
        })
        .catch((err) => {
            item.reject(err);
            error = true;
        })
        .then(() => {
            // TODO: Emit
            emitter.emit('complete', {
                duration: Date.now() - startTime,
                flags: _.drop(item.flags),
                error,
                name:
            });
        });
};

const nextFlagExecutionTime = (flag) => {
    // If paused, Infinity
};

const executeAllPossibleItems = (queue, flags, defaultFlag, timeout) => {
    if (!queue.length) {
        return;
    }
    const flagNames = [...Object.getOwnPropertySymbols(flags), ...Object.getOwnPropertyNames(flags)];
    // First check all flags
    const flagNextExecutionTimes = _.mapValues(flagNames, (flagName) => {
        return nextFlagExecutionTime(flags[flagName]);
    });

    if (flagNextExecutionTimes[defaultFlag] <= Date.now()) {
        // TODO: Set timeout to next defaultFlag
        return;
    }

    _.forEach(queue, (queueItem) => {
        const itemReady = _.every(queueItem.flags, (flagName) => {
            return flagNextExecutionTimes[flagName] <= Date.now();
        });

        if (itemReady) {
            // TODO: Execute item and emit
            // TODO: Update flagNextExecutionTimes
            // TODO: Exit (and emit) if queue is empty or default flag isn't ready (set timeout).
        }
    });

    // TODO: Set timeout
    clearTimeout(timeout);
    //setTimeout(executeAllPossibleItems, nextFutureExecutionTime + 1 - Date.now(), queue, flags, defaultFlag, timeout);
};

// TODO: Use EventEmitter for executing items
const SuperQueue = (options) => {
    const queue = [];
    const flags = {};
    const defaultFlag = Symbol();
    let timeout;

    this.push = (...args) => {
        return new Promise((resolve, reject) => {
            let thennable;
            let params;
            let priority = 10;
            let name = '';
            let attachedFlags = [defaultFlag];
            if (_.isFunction(args[0])) {
                [thennable, ...params] = args;
            } else if (_.isFunction(args[1])) {
                let funcOptions;
                [funcOptions, thennable, ...params] = args;
                if (_.has(funcOptions, 'priority')) {
                    priority = validNumber(funcOptions.priority, 'priority', 0);
                }
                if (_.has(funcOptions, 'flags')) {
                    if (!_.isArray(funcOptions.flags)) {
                        throw Err(`"flags" property provided to queue.push() must be an array`);
                    }
                    funcOptions.flags.forEach((flagName) => {
                        if (!_.isString(flagOptions.name) && !_.isSymbol(flagOptions.name)) {
                            throw Err(`Flag ${flagName} provided to queue.push() is not a valid flag name`);
                        }
                        if (!flags[flagName]) {
                            throw Err(`Flag ${flagName} provided to queue.push() Does not exist`);
                        }
                    });
                    attachedFlags.push(...funcOptions.flags);
                    priority = validNumber(funcOptions.priority, 'priority', 0);
                    name = validString(funcOptions.name, 'name');
                }
            } else {
                throw Err('No function was provided to queue.push()');
            }
            const queueObject = {
                func: thennable,
                flags: attachedFlags,
                priority,
                name,
                resolve,
                reject,
                params,
            };
            queue.splice(_.sortedIndexBy(queue, queueObject, 'priority'));

            executeAllPossibleItems(queue, flags, defaultFlag, timeout);
        });
    };

    this.setPause = (flagName, val) => {
        const flag = getFlag(flags, flagName, defaultFlag);
        const wasPaused = flag.paused;
        flag.paused = !!val;
        return wasPaused !== !!val;
    };

    this.pause = (flagName) => {
        return this.setPause(flagName, true);
    };

    this.unpause = (flagName) => {
        return this.setPause(flagName, false);
    };

    this.getLength = (flagName) => {
        return getFlag(flags, flagName, defaultFlag).length;
    };

    this.getConcurrent = (flagName) => {
        return getFlag(flags, flagName, defaultFlag).concurrent;
    };

    this.addFlag = (flagOptions) => {
        if (!_.isString(flagOptions.name) && !_.isSymbol(flagOptions.name)) {
            throw Err(`Error creating flag: ${name} is not a valid name`);
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
    return initializeFlag(flags, defaultFlag, defaultFlagOptions);
};

util.inherits(SuperQueue, EventEmitter);



























class SuperQueue3 extends EventEmitter {
    constructor(options) {
        super();

        this.concurrency = 1;
        this.length = 0;

        // No options, everything's default
        if (!options) {
            return;
        }

        // Single concurrency parameter is given
        if (checkAndAssignInt(this, options, 0, 'concurrency')) {
            return;
        }
        checkAndAssignInt(this, options.concurrency, 1, 'concurrency');
        checkAndAssignInt(this, options.interval, 0, 'interval');
        checkAndAssignNumber(this, options.interval, 0, 'rate');
        checkAndAssignNumber(this, options.interval, 0, 'rate');
    }

    addFlag(config) {
        if (!config.name) {
            return Promise.reject('Error: Flag must have name property');
        }
        this.flags[config.name] = _.pick(config, ['concurrency', 'interval', 'rate']);
        this.flags[config.name].rateDenominator = config.rateDenominator || 1000;
    }

    push() {

    }

    _iterate() {

    }

    pause() {
        this.paused = true;
    }

    unpause() {
        this.paused = false;
    }









}

function buildInstance(options) {
    return new SuperQueue(options);
}

module.exports = buildInstance;









function SuperQueue2(options = {}) {
    if (!(this instanceof SuperQueue)) {
        return new SuperQueue(options);
    }

    this.concurrency = options.concurrency || 1;
    this.timeout = options.timeout || 0;
    this.rate = options.rate || 0;

    this.queue = [];
    this.labels = {};
    this.concurrent = 0;
    this.paused = false;
}

SuperQueue2.prototype.addLabel = function(name, concurrency) {
    this.labels[name] = concurrency;
};

SuperQueue2.prototype.pause = function() {
    this.paused = true;
    return promise.resolve();
};

SuperQueue2.prototype.unpause = function() {
    this.paused = false;
    if (this.queue.length)
        return promise.resolve();
};

SuperQueue2.prototype.iterate = function() {
    const queueItem = this.queue.pop();
    if (!queueItem) {
        this.concurrent--;
        return;
    }
    queueItem.task()
        .then((result) => {
            queueItem.resolve(result);
        })
        .catch((err) => {
            queueItem.reject(err);
        })
        .then(() => {
            setImmediate(this.startIterator);
        });
};

SuperQueue2.prototype.push = function(func, options = {}) {
    return new Promise((resolve, reject) => {
        const queueItem = {
            priority: options.priority || 10,
            labels: options.labels || [],
            timeout: options.timeout || this.timeout,
            func,
            args: [...arguments].slice(2),
            resolve,
            reject,
        };
        const index = _.sortedIndexBy(this.queue, queueItem, (o) => {
            return o.priority;
        });
        this.queue.splice(index, 0, queueItem);

        if (this.concurrency && this.concurrency <= this.concurrent) {
            return;
        }
        this.concurrent++;
        this.startIterator();
    });
};
