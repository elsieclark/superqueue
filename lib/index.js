'use strict';

const _            = require('lodash');
const EventEmitter = require('events');

function checkAndAssignInt(obj, value, minimum, name) {
    if (!_.isFinite(value) || value < minimum) {
        throw 'Error: ';
    }
    obj[name] = Math.floor(value);
}

function checkAndAssignNumber(obj, value, minimum, name) {
    if (_.isFinite(value) && value >= minimum) {
        obj[name] = value;
        return true;
    }
}



function validNumber(value, name, min, max) {
    if (!_.isFinite(value)) {
        throw new Error(`${name} option is not a valid number`);
    }
    if (_.isFinite(min) && value < min) {
        throw new Error(`${name} option must be at least ${min}`);
    }
    if (_.isFinite(max) && value > max) {
        throw new Error(`${name} option must be at most ${max}`);
    }
    return value;
}

function validInt(value, name, min, max) {
    return Math.floor(validNumber(value, name, min, max));
}

const SuperQueue = (options) => {
    const queue = [];
    const flags = {};

    const defaultFlag = Symbol();

    flags[defaultFlag] = {
        concurrent: 0,
        concurrency: 1,
        length: 0,
        interval: 0,
        rate: 0,
        rateDenominator: 1000,
        paused: false,
    };


    const getFlag = (flagName) => {
        if (_.isUndefined(flagName)) {
            return flags[defaultFlag];
        }
        if (_.has(flags, flagName)) {
            return flags[flagName];
        }
        throw new Error(`No flag named ${flagName}. Cannot access.`);
    };

    this.setPause = (flagName, val) => {
        const flag = getFlag(flagName);
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
        return getFlag(flagName).length;
    };

    this.getConcurrent = (flagName) => {
        return getFlag(flagName).concurrent;
    };

    this.addFlag = ({ name, concurrency, interval, rate, rateDenominator}) => {
        if (!_.isString(name) && !_.isSymbol(name)) {
            throw new Error(`Error creating flag: ${name} is not a valid name`);
        }
        flags[name] = {

        }
    };

    if (!options) {
        return;
    }

    const setupFlag = (options, flagName) => {

    };

    try {
        flags[defaultFlag].concurrency = validNumber(options, 'concurrency', 0);
    } catch (e) {

    }

    if (_.has(options, 'concurrency')) {
        flags[defaultFlag].concurrency = validInt(options.concurrency, 'concurrency', 1);
    }
    if (_.has(options, 'interval')) {
        flags[defaultFlag].interval = validNumber(options.interval, 'interval', 0);
    }
    if (_.has(options, 'rate')) {
        flags[defaultFlag].rate = validNumber(options.rate, 'rate', 1);
    }
    if (_.has(options, 'rateDenominator')) {
        flags[defaultFlag].rateDenominator = validNumber(options.rateDenominator, 'rateDenominator', 0.001);
    }

};

util.inherits(SuperQueue, EventEmitter);























class SuperQueue extends EventEmitter {
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
}

SuperQueue2.prototype.pause = function() {
    this.paused = true;
    return promise.resolve();
}

SuperQueue2.prototype.unpause = function() {
    this.paused = false;
    if (this.queue.length)
    return promise.resolve();
}

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
}

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
}



















