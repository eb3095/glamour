//
// Requires
//

const app = require('./package.json');

//
// Database
//

let db = {
    "users": {},
    "comments": [],
    "submissions": {}
}

//
// Configs
//

const config = require('./config/config.json');
const subredditsConfig = require('./config/subreddits.json');
const repliesConfig = require('./config/replies.json');
const typosConfig = require('./config/typos.json');

//
// Includes
//

const snoowrap = require('snoowrap');
const snoostorm = require('snoostorm');
const Reply = require('./libraries/reply.js').Reply;
const Typo = require('typogen').Typo;
const emotionDetection = require('emotional_alert');
const Sentiment = require('sentiment');
const fs = require('fs');

//
// Objects
//

const sentiment = new Sentiment();
const reddit = new snoowrap({
    userAgent: config.redditCredentials.userAgent.replace("{version}", `v${app.version}`),
    clientId: config.redditCredentials.appID,
    clientSecret: config.redditCredentials.appSecret,
    username: config.redditCredentials.username,
    password: config.redditCredentials.password
});


//
// Some people like to use console.log where it doesn't belong. Thanks for that.
//

console._log = console.log;
console.log = function () {
};


//
// Global Variables
//

let replies = [];
let subreddits = [];
let typoEngine;
let requireDBSave = false;


//
// Functions
//

function saveDB() {
    if (!requireDBSave) {
        return;
    }
    fs.writeFileSync("./db.json", JSON.stringify(db, null, 2));
    requireDBSave = false;
}

async function sleep(time) {
    await new Promise(r => setTimeout(r, time));
}

function log(string) {
    let date = new Date();
    let time = (date.getMonth() + 1) + "/" + (date.getDate() + 1) + "/" + date.getFullYear() + ` ${date.getHours()}:${date.getMinutes()}:${date.getSeconds()}`;
    let msg = `[${time}] ${string}`;
    console._log(msg);
    fs.appendFileSync('bot.log', `${msg}\n`);
}

function shuffle(array) {
    let index = array.length;
    let temp;
    let rIndex;

    while (0 !== index) {
        rIndex = Math.floor(Math.random() * index);
        index--;
        temp = array[index];
        array[index] = array[rIndex];
        array[rIndex] = temp;
    }

    return array;
}

function getSubmission(comment) {
    let link = comment.permalink;
    let split = link.split("/");
    return split[4];
}


function removeFromArray(object, array) {
    let index = array.indexOf(object);
    if (index !== -1) array.splice(index, 1);
}


//
// Flow
//

function startListener(subreddit) {
    subreddits.push(subreddit);
    log(`Listening for comments on: ${subreddit.displayName}`);
    let options = {
        subreddit: subreddit.name,
        results: subreddit.results,
        pollTime: subreddit.pollTime * 1000
    };
    subreddit.listener = new snoostorm.CommentStream(reddit, options);
    try {
        subreddit.listener.on("item", comment => {

            // Debug line for data gathering
            if (config.debugMode) {
                log(`Comment Received: ${comment.id} Subreddit: ${subreddit.displayName} Message: ${comment.body}`);
                let rebuild = [];

                let body = comment.body.replace(/([\uE000-\uF8FF]|\uD83C[\uDF00-\uDFFF]|\uD83D[\uDC00-\uDDFF])/g, "");

                body.split(" ").forEach(word => {
                    if (word.length < 3) {
                        return;
                    }
                    if (word.includes("/r/")
                        || word.includes("/u/")
                        || word.includes("://")) {
                        return;
                    }
                    rebuild.push(word);
                });
                let naturalized = rebuild.join(" ");
                let emotional = emotionDetection(naturalized);
                let sent = sentiment.analyze(naturalized);
                log(`- Emotion: ${emotional.bayes.prediction} Emotion Probability: ${emotional.bayes.proba} Vulnerability: ${emotional.emotional} Sentiment: ${sent.comparative}`);
            }
            // End debug lines

            commentEvent({
                subreddit: subreddit,
                comment: comment
            });
        });

        subreddit.listener.on("error", function (err) {
            log(`Error encountered listening on ${subreddit.displayName}, Error: ${err.message}`);
        });
    } catch (err) {
        log(`Error encountered listening on ${subreddit.displayName}, Error: ${err.message}`);
    }
}

function commentEvent(event) {
    if (event.comment.author.name.toLowerCase() == config.redditCredentials.username) {
        return;
    }

    if (db.comments.includes(event.comment.id)) {
        return;
    }

    event.time = new Date().getTime();

    let replyArr = [...replies];
    shuffle(replyArr);
    replyArr.some(reply => {
        if (reply.isTriggered(event)) {
            if (reply.oncePerUser) {
                if (Object.keys(db.users).includes(event.comment.author.name) &&
                    db.users[event.comment.author.name].includes(reply.name)) {
                    return false;
                }
            }

            if (reply.oncePerSubmission) {
                let sub = getSubmission(event.comment);
                if (Object.keys(db.submissions).includes(sub) &&
                    db.submissions[sub].includes(reply.name)) {
                    return false;
                }
            }

            log("Pushing to QUEUE!");
            addToReplyQueue(reply, event);
            return true;
        }
    });
}

function addToReplyQueue(reply, event) {
    if (!Object.keys(db.users).includes(event.comment.author.name)) {
        db.users[event.comment.author.name] = [];
    }

    let sub = getSubmission(event.comment);
    if (!Object.keys(db.submissions).includes(sub)) {
        db.submissions[sub] = [];
    }

    db.users[event.comment.author.name].push(reply.name);
    db.submissions[sub].push(reply.name);
    db.comments.push(event.comment.id);
    requireDBSave = true;

    let rep = {
        reply: reply,
        event: event
    };
    if (reply.replyDelay) {
        let delay = reply.replyDelay;
        if (reply.delayFuzz) {
            delay += Math.floor(Math.random() * reply.delayFuzz);
        }
        rep.delay = delay;
    }
    event.subreddit.replyQueue.push(rep);
}

async function processReplyQueues() {
    let tasks = [];
    subreddits.forEach(subreddit => {
        tasks.push(processReplyQueue(subreddit));
    });
    await Promise.all(tasks);
    saveDB();
    setTimeout(processReplyQueues, 1);
}

async function processReplyQueue(subreddit) {
    let until = subreddit.lastReply + subreddit.cooldown
    let time = new Date().getTime();
    if (until > time) {
        await sleep(until - time);
    }

    subreddit.replyQueue.some(reply => {
        let ready = reply.event.time + reply.delay;
        if (new Date().getTime() >= ready) {
            doReply(reply);
            return true;
        }
    });
}

function doReply(reply) {
    let date = new Date();
    let message = reply.reply.generateMessage();
    if (config.debugMode) {
        log("----------------------------------------------");
        log(`Would of replied to Comment: ${reply.event.comment.id}`);
        log(`Subreddit: ${reply.event.subreddit.displayName}`);
        log(`Author: ${reply.event.comment.author.name}`);
        log(`Message: ${reply.event.comment.body}`);
        log(`Reply: ${message}`);
        log("----------------------------------------------");
        removeFromArray(reply, reply.event.subreddit.replyQueue);
        reply.event.subreddit.lastReply = date.getTime();
    } else {
        reply.event.comment.reply(message).then(result => {
            log("----------------------------------------------");
            log(`Replied to Comment: ${reply.event.comment.id}`);
            log(`Author: ${reply.event.comment.author.name}`);
            log(`Message: ${reply.event.comment.body}`);
            log(`Reply: ${message}`);
            log("----------------------------------------------");
            removeFromArray(reply, reply.event.subreddit.replyQueue);
            reply.event.subreddit.lastReply = date.getTime();
            if (reply.reply.cooldown > 0) {
                reply.reply.putOnCooldown();
            }
        }, err => {
            log(`Failed to reply to Comment: ${reply.event.comment.id} Error: ${err.message}`);
        });
    }
}


//
// Entry Point
//

process.stdout.write('\033c');
console._log("Glamour - An Advanced Reddit Bot");
console._log(`Version: ${app.version}`);
console._log(`Description: ${app.description}`);
console._log(`Author: ${app.author}`);
console._log("------------------------------------\n");

log("Starting up");

log("Loading DB");
if (fs.existsSync('./db.json')) {
    let dbL = require('./db.json');
    Object.assign(db, dbL);
}

log("Setting up typo system");
typoEngine = new Typo(typosConfig.typos);

log("Starting Reply Processor");
setTimeout(processReplyQueues, 1000);

log("Building replies");
repliesConfig.replies.forEach(rep => {
    let reply;
    try {
        reply = new Reply(rep, typoEngine);
    } catch (err) {
        log(err);
        return;
    }
    replies.push(reply);
});

log("Setting up Subreddits");
subredditsConfig.subreddits.forEach(sub => {
    log(`Preparing ${sub.name}`);
    let subreddit = {
        name: sub.name,
        displayName: `/r/${sub.name}`,
        cooldown: sub.cooldown * 60000,
        reddit: reddit.getSubreddit(sub.name),
        replyQueue: [],
        lastReply: 0,
        pollTime: sub.pollTime,
        results: sub.results
    };
    startListener(subreddit);
});