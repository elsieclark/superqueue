'use strict';
const _            = require('lodash');
const EventEmitter = require('events').EventEmitter;

const States = {
    unqueued: 0,
    queued: 1,
    executing: 2,
    completed: 3,
};

const State = function() {
    let state = States.unqueued;
    this.getState = () => {
        return state;
    };
    this.is = (otherState) => {
        return state === otherState;
    };
    this.isAtLeast = (otherState) => {
        return state >= otherState;
    };
    this.setState = (newState) => {
        state = Math.max(newState, state);
    };
};

const QueueItem = function(queue) {
    const state = new State();
    let resolve;
    let reject;
    let resolved = false;
    let rejected = false;

    const emitter = new EventEmitter();

    this.isExecuting = () => {
        return state.is(States.executing);
    };

    this.isResolved = () => {
        return resolved;
    };

    this.isRejected = () => {
        return rejected;
    };

    this.resolve = () => {
        if (!this.isExecuting()) {
            return false;
        }
        if (typeof resolve !== 'function') {
            return false;
        }
        resolve();
        state.setState(States.completed);
        resolved = true;
        return true;
    };

    this.reject = () => {
        if (!this.isExecuting()) {
            return false;
        }
        if (typeof reject !== 'function') {
            return false;
        }
        reject();
        state.setState(States.completed);
        rejected = true;
        return true;
    };

    this.push = (options) => {
        emitter.emit('pushed');
        const params = [() => {
            return new Promise((res, rej) => {
                state.setState(States.executing);
                emitter.emit('executed');
                resolve = res;
                reject = rej;
            });
        }];
        if (options !== undefined) {
            params.unshift(options);
        }
        queue.push(...params)
            .then((result) => {
                emitter.emit('finished');
                return result;
            })
            .catch((err) => {
                emitter.emit('finished');
                throw err;
            });
        state.setState(States.queued);
    };

    this.waitFor = (eventType, timeout) => {
        const eventTypes = ['pushed', 'executed', 'finished'];
        if (!_.includes(eventTypes, eventType)) {
            throw new Error(`Test Error: Waiting for unknown event type ${eventType}`);
        }
        if (eventType === 'pushed' && state.isAtLeast(States.queued)) {
            return Promise.resolve();
        }
        if (eventType === 'executed' && state.isAtLeast(States.executing)) {
            return Promise.resolve();
        }
        if (eventType === 'finished' && state.isAtLeast(States.completed)) {
            return Promise.resolve();
        }
        return new Promise((res, rej) => {
            let timer;
            emitter.once(eventType, () => {
                res();
                clearTimeout(timer);
            });
            if (!Number.isFinite(timeout) || timeout <= 0) {
                return;
            }
            timer = setTimeout(() => {
                rej();
            }, timeout);
        });
    };
};

const applyCommand = (command) => {
    return (index, ...args) => {
        if (Array.isArray(index)) {
            index.forEach((i) => this[i][command](...args));
            return;
        }
        this[i][command](...args);
    };
};

const applyCommandToAll = (command) => {
    return (...args) => {
        this.forEach((o) => {o[command](...args)})
    }
}

module.exports = function(queue, count) {
    if (Number.isFinite(count)) {
        const arr = [];
        for (let i = 0; i < count; i++) {
            arr.push(new QueueItem(queue));
        }
        _.defaults(arr, {
            push: applyCommand('push'),
            resolve: applyCommand('resolve'),
            reject: applyCommand('reject'),
            pushAll: applyCommandToAll('push'),
            resolveAll: applyCommandToAll('resolve'),
            rejectAll: applyCommandToAll('reject'),
        });
        return arr;
    }
    return new QueueItem(queue);
};
