'use strict';
const _ = require('lodash');

const Flag = require('./flag.service');

const executeItem = (item, emitter, flags, flagUnlockTimes) => {
    const startTime = Date.now();
    const emission = {
        name: item.name,
        flags: _.drop(item.flags),
        error: false,
    };
    emitter.emit('start', emission);

    _.forEach(item.flags, (flagName) => {
        Flag.updateForExecutionStart(flags[flagName]);
        flagUnlockTimes[flagName] = Flag.findUnlockTime(flags[flagName]);
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
                Flag.updateForExecutionFinish(flags[flagName]);
            });
            emission.duration = Date.now() - startTime;
            emitter.emit('complete', emission);
        });
};

const ExecuteService = {
    queue: (queue, flags, defaultFlag, timeout, emitter) => {
        clearTimeout(timeout.timeout);
        if (!queue.length) {
            return;
        }
        const currentTime = Date.now();
        const flagNames = [...Object.getOwnPropertySymbols(flags), ...Object.getOwnPropertyNames(flags)];

        let flagUnlockTimes = _.zipObject(flagNames, flagNames.map((flagName) => {
            return Flag.findUnlockTime(flags[flagName]);
        }));

        // Check if default flag is blocked. setTimeout stops working above 2147483647 (~24 days)
        let waitDuration = Math.min(flagUnlockTimes[defaultFlag] - currentTime, 2147483647);
        if (waitDuration > 0) {
            timeout.timeout = setTimeout(this.queue, waitDuration, queue, flags, defaultFlag, timeout, emitter);
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
            return Flag.findUnlockTime(flags[flagName]);
        }) + 1 - currentTime;

        // setTimeout stops working above this (~24 days)
        waitDuration = Math.min(Math.max(waitDuration, 1), 2147483647);
        timeout.timeout = setTimeout(this.queue, waitDuration, queue, flags, defaultFlag, timeout, emitter);
    },
};

module.exports = ExecuteService;