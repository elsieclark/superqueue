# superqueue

The only asynchronous promise queue you'll ever need. Very simple to use, with optionally configurable concurrency, rate, interval, priority, and more.
 
Installation
------------

```sh
$ npm install --save superqueue
```

Usage
-----

Always start by requiring the package.

```js
const SuperQueue = require('superqueue');
```

### Simple Single Concurrency Queue ###

To create a simple promise queue with a `concurrency` of one (i.e. only one function is executing at a time):

```js
const SuperQueue = require('superqueue');

const myQueue = new SuperQueue();

function basicThennableFunction(param1) {
    return new Promise((resolve, reject) => {
        basicAsyncFunction((err, data) => {
            console.log(param1);
            if (err) {
                reject(err);
                return;
            }
            resolve(data);
        });
    });
}

// Add thennable to queue
myQueue.push(basicThennableFunction, 'One')
    // This 'then' will be called after the function clears the queue
    .then((data) => {
        // Use the data
    })
    .catch((err) => {
        // Handle the error
    });

myQueue.push(basicThennableFunction, 'Two');
myQueue.push(basicThennableFunction, 'Three');

// Console output: 'One', 'Two', 'Three'
```

### Simple Adjustable Concurrency Queue ###

A SuperQueue's `concurrency` may be adjusted to specify how many functions can execute at once. To create a SuperQueue with a `concurrency` of 5:

```js
const SuperQueue = require('superqueue');

const myQueue = new SuperQueue(5);
```
A concurrency of 0 means unlimited.

### Advanced Queue Configuration: Interval and Rate ###

A SuperQueue can also optionally be configured with an `interval` and/or a `rate`, useful for rate-limited APIs. There is a subtle difference between the two:

* The `interval` is the amount of time (in ms) that must pass between queued items being executed.
* The `rate` is the number of requests which can be made over a given period of time (the `rateDenominator`). The `rate` must be an integer.

For example, a queue with an `interval` of 200 will execute one request every 200ms, whereas a queue with a `rate` of 5 (and a `rateDenominator` of 1000) will execute 5 requests immediately, wait 1s, and then execute the next 5.

```js
const queueConfig = {
    concurrency: 10,
    interval: 200 // Time in ms, defaults to 0
};
const myQueue = new SuperQueue(queueConfig);

```
Or:
```js
const queueConfig = {
    concurrency: 10,
    rate: 10, // Defaults to 0 (No restriction)
    rateDenominator: 2000, // Time in ms, defaults to 1000
};
const myQueue = new SuperQueue(queueConfig);
```

It is possible to set both a `rate` and an `interval` on the same Queue.

### Advanced Queue Item Configuration: Priority and Name ###

Each item added to the queue may be accompanied by options, including `name` (returned by EventEmitter when item begins or finishes execution) and `priority` (larger numbers = higher priority, default = 10).

```js

const SuperQueue = require('superqueue');

const myQueue = SuperQueue();

function lowPriorityFunc(param1) {
    return new Promise((resolve, reject) => {...});
}

function highPriorityFunc(param1) {
    return new Promise((resolve, reject) => {...});
}

const priorityConfig = {
    priority: 11 // Default priority is 10, higher numbers happen sooner
};

myQueue.push(lowPriorityFunc, 'one');
myQueue.push(lowPriorityFunc, 'two');
myQueue.push(priorityConfig, highPriorityFunc, 'three');

/* 
 * Order will be: 'one', 'three', 'two', so long as the first function
 * didn't resolve before the third one was added.
 */

```

### Advanced Queue Configuration: Flags ###

By creating a `flag`, and by assigning specific queue items to that `flag`, restrictions on execution (`concurrency`, `interval`, `rate`, `rateDenominator`) can be applied to a subset of items in the Queue.

E.g using an API which has both public and private calls. The API is rate-limited to 5 requests per second. Public requests are simple, but the private requests require a nonce value which must always be increasing.

To implement this, simply set up a 'private' flag:

```js

const SuperQueue = require('superqueue');

const queueConfig = {
    concurrency: 0, // Unlimited concurrency
    rate: 5
};
const myQueue = new SuperQueue(queueConfig);

const flagConfig = {
    name: 'private',
    concurrency: 1,
};
myQueue.addFlag(flagConfig);

function publicFunc(param1) {
    return new Promise((resolve, reject) => {...});
}

function privateFunc(param1, param2) {
    return new Promise((resolve, reject) => {...});
}

const privateConfig = {
    priority: 11, // If the private API calls are more important
    flags: ['private'],
    name: 'privateFunction',
};

myQueue.push(privateConfig, privateFunc, param1, param2)
    .then((data) => {
        // Use data
    })
    .catch((err) => {
        // Handle error
    });
    
myQueue.push(publicFunc, param1)
    .then((data) => {
        // Use the data
    })
    .catch((err) => {
        // Handle error
    });
```

Methods
-------
```js
.push(func, [...args]);

.push({
	priority,            // ?Number<10>
	flags,               // ?[String]
	name,                // ?String<''>
}, func, [...args]);

.addFlag({
	name,                // String
	concurrency,         // ?Integer<1>
	interval,            // ?Number
	rate,                // ?Number
	rateDenominator,     // ?Number<1000>
});

.pause();
// Stops executing queued items. Returns false if already paused, true otherwise.

.pause(flag);
// Stops executing queued items with flag. If any flag on an item is paused, the item will never execute. Returns false if already paused, true otherwise.

.unpause();
// Resumes queue execution. Returns false if already unpaused, true otherwise.

.unpause(flag);
// Resumes queue execution for flag. Returns false if already unpaused, true otherwise.

.getLength();
// Returns number of queued (non-executing) items

.getLength(flag);
// Returns number of queued (non-executing) items under flag

.getConcurrent();
// Returns number of items currently executing

.getConcurrent(flag);
// Returns number of items categorized under flag currently executing

.on('start', ({ name, flags }) => {} );
// Whenever a function starts executing

.on('complete', ({ name, duration, flags, error, result }) => {} );
// Whenever a function completes

.on('empty', () => {} );
// Whenever the queue becomes empty
```