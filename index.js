#!/usr/bin/env node

const http = require('http');
const request = require('request');
const PORT = process.env.PORT || 80;
const USERNAME = process.env.USERNAME || 'Rancher_Labs';
const CONSUMER = process.env.TWITTER_CONSUMER;
const SECRET = process.env.TWITTER_SECRET;
let lastToken;
let lastUpdated;
let lastResponse;

if ( !USERNAME ) {
  console.error('Must specify USERNAME in environment');
  process.exit(1);
}

if ( !CONSUMER ) {
  console.error('Must specify TWITTER_CONSUMER in environment');
  process.exit(1);
}

if ( !SECRET ) {
  console.error('Must specify TWITTER_SECRET in environment');
  process.exit(1);
}

getToken(function(err) {
  if ( err ) {
    console.error(err);
    process.exit(1);
  }
});

const server = http.createServer(handle);
server.listen(PORT, function(err) {
  if ( err ) {
    console.error(err);
    process.exit(1);
  } else {
    console.log(`Listening on ${PORT}`);
  }
});

function handle(req, res, retry=true) {
  console.log(`Request from ${req.socket.localAddress}`);

  getTweets(lastToken, function(err, tweets) {
    if ( err ) {
      if ( retry ) {
        console.log(err);
        getToken(function(err) {
          if (err) {
            return respondError(req, res, err);
          }

          handle(req, res, false);
        });
      } else {
        return respondError(req, res, err);
      }
    } else {
      return respondSuccess(req, res, tweets);
    }
  });
}

function respondSuccess(req, res, data) {
  res.setHeader('Content-Type','application/json');
  res.statusCode = 200;
  let out = (typeof data === 'string' ? data : JSON.stringify(data, null, 2));
  res.end(out);
  console.log(`Sent ${out.length} bytes to ${req.socket.localAddress}`);
}

function respondError(req, res, err) {
  const obj = {
    type: 'error',
    status: 500,
    message: err,
  };

  res.setHeader('Content-Type','application/json');
  res.statusCode = 500;
  res.end(JSON.stringify(obj, null, 2));
  console.error(err);
}

function getToken(cb) {
  request.post('https://api.twitter.com/oauth2/token', {
    auth: {
      username: CONSUMER,
      password: SECRET,
    },
    form: {
      'grant_type': 'client_credentials',
    }
  }, function(err, res, body) {
    if ( err ) {
      return cb(err);
    } else if ( res.statusCode !== 200 ) {
      return cb(body);
    }else {
      let obj;
      try {
        const obj = JSON.parse(body);
        const token = obj.access_token;
        lastToken = token;
        console.log('Got new token');

        return cb();
      } catch (err) {
        return cb(err);
      }
    }
  });
}

function getTweets(token, cb) {
  if ( lastUpdated ) {
    const now = (new Date()).getTime();
    if ( lastUpdated + (30 * 60 * 1000) > now ) {
      console.log('Returning from cache');
      return cb(null, lastResponse);
    }
  }

  request.get(`https://api.twitter.com/1.1/favorites/list.json?count=12&screen_name=${USERNAME}`, {
    auth: {
      bearer: token
    }
  }, function(err, res, body) {
    if ( err ) {
      return cb(err);
    } else if ( res.statusCode !== 200 ) {
      return cb(null, body);
    } else {
      try {
        const obj = JSON.parse(body);
        console.log('Got new tweets');
        let serialized = JSON.stringify(obj, null, 2);
        lastUpdated = (new Date()).getTime();
        lastResponse = serialized;
        return cb(null, serialized);
      } catch (err) {
        return cb(err);
      }
    }
  });
}
