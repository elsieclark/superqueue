'use strict';

const _            = require('lodash');
const EventEmitter = require('events');

function checkAndAssignInt(obj, value, minimum, name) {
    if (_.isFinite(value) && value >= minimum) {
        obj[name] = Math.floor(value);
        return true;
    }
}

function checkAndAssignNumber(obj, value, minimum, name) {
    if (_.isFinite(value) && value >= minimum) {
        obj[name] = value;
        return true;
    }
}

class SuperQueue extends EventEmitter {
    constructor(options) {
        this._queue = [];
        this._concurrent = 0;
        this._interval = 0;
        this._rate = 0;
        this._rateDenominator = 0;
        this._flags = {};
        this._paused = false;
        
        this.concurrency = 1;
        this.length = 0;
        
        // No options
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









function SuperQueue(options = {}) {
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

SuperQueue.prototype.addLabel = function(name, concurrency) {
    this.labels[name] = concurrency;
}

SuperQueue.prototype.pause = function() {
    this.paused = true;
    return promise.resolve();
}

SuperQueue.prototype.unpause = function() {
    this.paused = false;
    if (this.queue.length)
    return promise.resolve();
}

SuperQueue.prototype.iterate = function() {
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

SuperQueue.prototype.push = function(func, options = {}) {
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



















