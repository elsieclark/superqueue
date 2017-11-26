'use strict';
const _            = require('lodash');
const Queue        = require('../lib/index.js');
const QueueItem     = require('./helpers/queueItem.js');

// Test 1:

let queue = new Queue();
let queueItems = QueueItem(queue, 4);

Promise.resolve()
    .then(() => {
        console.log(queue.getLength());
        queueItems[0].push();
        console.log(queue.getLength());
        queueItems[1].push();
        console.log(queue.getLength());
        queueItems[2].push();
        console.log(queue.getLength());
        queueItems[3].push();
        console.log(queue.getLength());
        queueItems[0].resolve();
        console.log('Resolving 0')
        return queueItems[0].waitFor('finished');
    })
    .then(() => {
        console.log(queueItems[0].isResolved())
        console.log(queueItems[0].isRejected())
        console.log(queue.getLength())
        console.log(queueItems[0].isExecuting())
        console.log(queueItems[1].isExecuting())
        console.log('Pushing 1')
        return queueItems[1].waitFor('executed');
    })
    .then(() => {
        console.log(queueItems[1].isResolved())
        console.log(queueItems[1].isRejected())
        console.log(queue.getLength())
        console.log(queueItems[1].isExecuting())
        console.log(queueItems[2].isExecuting())
        setTimeout(() => {
            console.log('Resolving 1')
            queueItems[1].resolve();
        }, 2000);
    })

