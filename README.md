# glamour
A procedurally generating natural language Reddit bot capable of acting on a variety of triggers such as comment sentiment, emotion, and phrases

### Requirements

This requires MongoDB as a database. You will also need a Reddit API key and a Reddit user. This was made and tested with the newest version of NodeJS, v11.15.0. I do not know if it will work on older versions and it is untested on any other version. This was created on Linux, it should work on Windows but it was not tested.

### Installation

This was created on Linux, it should work on Windows but it was not tested. The instructions are for Linux.

```
git clone https://github.com/eb3095/glamour.git
cd glamour
npm install
```
Modify the configs in ./config and then start the bot with,

```
npm start
```

### Configuration

config.json
```
{
  // The following two sections shouldn't need instructions
  "redditCredentials": {
    "appID": "",
    "appSecret": "",
    "userAgent": "Glamour/{version} by Charisma",
    "username": "",
    "password": ""
  },
  // This only works with MongoDB
  "databaseCredentials": {
    "host": "localhost",
    "database": "bot",
    "user": "bot",
    "password": ""
  },
  // This is on by default and is very verbose. It doesn't post comments and gives emotional/sentiment read outs
  "debugMode": true
}
```

replies.json
```json
{
  // You can have multiple replies per bot.
  "replies": [
    {
      "name": "I Love Kitties",      
      "replyDelay": 1, // How long after a comment until the bot replies in minutes
      "delayFuzz": 60, // A random amount of seconds up to the provided number added to the delay
      "cooldown": 5, // Minutes until the reply will trigger again, this skips detected comments until it is off cooldown
      "subreddits": [ // Subreddits this post in
        "cats"
      ],
      "bannedSubreddits": [ // Subreddits this wont post in
        "dogs",
        "puppies"
      ],
      "bannedUsers": [ // Users this wont reply to 
        "automoderator"
      ],
      "detailCount": 2, // How many unique details to use
      "typos": true, // Add in typos
      "oncePerUser": true, // Only reply to a user once, ever
      "oncePerSubmission": true, // Only reply to a submission once, ever
      "prefaces": [ // First sentrance, 1 chosen randomly
        "I {love|adore|go bonkers for} kitties too!", // Words spereated with | within {} will have one chosen randomly
        "There is nothing I {adore|love} more than kitties!"
      ],
      "details": [ // Supporting details, chosen randomly
        "They are SOOOO cuddly!",
        "They are so warm and soft!",
        "They are just great!"
      ],
      "conclusions": [ // Closing sentance, chosen randomly
        "I just love them so much!",
        "OoOoO, I just can't help my self"
      ],
      "triggers": [ // These all need to be true for the reply to be used
        {
          "type": "sentiment", 
          "value": "notNegative", // Can be positive, negative, neutral, notPositive, and notNegative
          "overrides": { // Overrides for words and their values, -5 to 5
            "kitties": 5
          }
        },
        {
          "type": "phrase", // Word search
          "included": true, // true or false. Must include or must not include ONE of the phrases
          "phrases": [
            "kitty",
            "kittens",
            "cat",
            "cute"
          ]
        },
        {
          "type": "phrase",
          "included": false,
          "phrases": [
            "puppy",
            "puppies"
          ]
        },
        {
          "type": "emotion",
          "emotion": "anger", // Possible emotions are bellow. Vulnerability is 0-5, emotions are probabilities 0.0-1.0
          "value": 0 // If 0, must be 0 or not this emotion, anything over one requires the value to be >= to it
        }
      ]
    }
  ]
}
```

Possible Emotions
```
joy
worry
sadness
anger
friendly
delight
disgust
fear
courage
surprise
calm
depression
danger
relief
neutral
vulnerable
```

subreddits.json
```
{
  "subreddits": [
    {
      "name": "cats", // The sub
      "cooldown": 11, // Mintues between replies, will still eventually reply to comments heard during the cooldown
      "pollTime": 5, // Time in seconds to look for new comments
      "results": 50 // Results per poll
    }
  ]
}
```

typos.json
```
{
  "typos": {
    "typoRate": 100, // The rate typos are introduce in 10ths of a percent. 1 = 0.1%, 10 = 1%, 100 = 10%
    "typoCommas": true, // Forget to use commas
    "typoApostrophes": true, // Forget to use Apostrophes
    "typoCase": true, // Forget casing
    "speechParts": [
      {
        "string": "they're", // The speech part to misspell
        "typos": [ // The possible typos, chosen at random
          "theyre",
          "there",
          "their"
        ]
      },
      {
        "string": "theyre",
        "typos": [
          "there",
          "their"
        ]
      },
      {
        "string": "their",
        "typos": [
          "there",
          "theyre"
        ]
      },
      {
        "string": "there",
        "typos": [
          "theyre",
          "their"
        ]
      },
      {
        "string": "your",
        "typos": [
          "youre"
        ]
      },
      {
        "string": "youre",
        "typos": [
          "your"
        ]
      },
      {
        "string": "you're",
        "typos": [
          "your"
        ]
      },
      {
        "string": "you",
        "typos": [
          "u"
        ]
      },
      {
        "string": "ei",
        "typos": [
          "ie",
          "ee"
        ]
      },
      {
        "string": "ie",
        "typos": [
          "ee",
          "ei"
        ]
      },
      {
        "string": "ai",
        "typos": [
          "ia"
        ]
      },
      {
        "string": "ia",
        "typos": [
          "ai"
        ]
      },
      {
        "string": "qu",
        "typos": [
          "q"
        ]
      }
    ]
  }
}
```

### Warning

I'm not responsible for what this bot is used for, or the consequences thereof. It is a powerful tool that can be used to do many great, or terrible things. Use common sense.
