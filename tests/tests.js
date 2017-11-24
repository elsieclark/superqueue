'use strict';
const _     = require('lodash');
const Queue = require('../lib/index.js');

const QueueFunc = function() {
    let isExecuting = false;
    this.isExecuting = () => {
        return isExecuting;
    };

    let resolve;
    this.resolved = false;
    this.resolve = () => {
        return new Promise((res, rej) => {
            if (!isExecuting) {
                rej();
            }
            if (!resolve) {
                rej();
            }
            resolve();
            isExecuting = false;
            res();
        });
    };

    let reject;
    this.rejected = false;
    this.reject = () => {
        return new Promise((res, rej) => {
            if (!isExecuting) {
                rej();
            }
            if (!reject) {
                rej();
            }
            reject();
            isExecuting = false;
            res();
        });
    };

    this.pushable = () => {
        return new Promise((res, rej) => {
            resolve = res;
            reject = rej;
            isExecuting = true;
        });
    };
};

const getTestItems = (count) => {
    const arr = [];
    for (let i = 0; i < count; i++) {
        arr.push(new QueueFunc());
    }
    return arr;
};

const testItems = getTestItems(3);
const queue = new Queue(1);

_.forEach(testItems, (testItem, index) => {
    queue.push(testItem.pushable)
        .then(() => {
            console.log('Resolve at index:', index);
            testItem.resolved = true;
        })
        .catch(() => {
            console.log('Reject at index:', index);
            testItem.rejected = true;
        });
});

Promise.resolve()
    .then(() => {
        console.log('Concurrent', queue.getConcurrent());
        console.log('Length', queue.getLength());
        console.log('Item 0 executing', testItems[0].isExecuting());
        console.log('Item 1 executing', testItems[1].isExecuting());
        return testItems[0].resolve();
    })
    .then(() => {
        console.log('Item 0 resolved', testItems[0].resolved);
        console.log('Item 0 rejected', testItems[0].rejected);
        console.log('Concurrent', queue.getConcurrent());
        console.log('Length', queue.getLength());
        console.log('Item 0 executing', testItems[0].isExecuting());
        console.log('Item 1 executing', testItems[1].isExecuting());
    });

setTimeout(() => {
    console.log(testItems[1].isExecuting())
}, 500)





/*
const test1 = new QueueFunc();



queue.push()



const startTime = Date.now();

const thennable = (wait, msg) => {
    return new Promise((resolve, reject) => {
        setTimeout(() => {
            console.log(msg, Date.now() - startTime);
            resolve();
        }, wait);
    });
};

queue.push(thennable, 1000, 'Item1')
    .then(() => {
        console.log(queue.getLength());
    });
queue.push(thennable, 1000, 'Item2')
    .then(() => {
        console.log(queue.getLength());
    });
queue.push(thennable, 1000, 'Item3')
    .then(() => {
        console.log(queue.getLength());
    });
queue.push(thennable, 1000, 'Item4')
    .then(() => {
        console.log(queue.getLength());
    });

*/