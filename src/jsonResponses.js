const crypto = require('crypto');
const XMLHttpRequest = require('xmlhttprequest').XMLHttpRequest;

const messages = {};

let etag = crypto.createHash('sha1').update(JSON.stringify(messages));
let digest = etag.digest('hex');

const getUrl = (msg) => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const src = urlRegex.exec(msg);
  return src ? src[0] : null;
};

const addLink = (msg, url) => msg.replace(url, `<a href="${url}">${url}</a>`);

// function to respond with a json object
// takes request, response, status code and object to send
const respondJSON = (request, response, status, object) => {
  const headers = {
    'Content-Type': 'application/json',
    etag: digest,
  };

  // send response with json object
  response.writeHead(status, headers);
  response.write(JSON.stringify(object));
  response.end();
};

// function to respond without json body
// takes request, response and status code
const respondJSONMeta = (request, response, status) => {
  // object for our headers
  // Content-Type for json
  // etag to version response
  // etag is a unique versioning number of an object
  const headers = {
    'Content-Type': 'application/json',
    etag: digest,
  };

  // send response without json object, just headers
  response.writeHead(status, headers);
  response.end();
};

// get user object
// should calculate a 200 or 304 based on etag
const getMessages = (request, response, params) => {
  // json object to send
  const responseJSON = {}; // need to create json based off room

  // If room is specified use it otherwise default to general
  if (params.room) {
    // get the timestamp data
    if (messages) {
      for (const time in messages) {
        // get the userdata
        if (time) {
          for (const user in messages[time]) {
            if (messages[time][user].room === params.room) {
              responseJSON[time] = messages[time];
            }
          }
        }
      }
    }
  } else if (messages) {
    // get the timestamp data
    for (const time in messages) {
          // get the userdata
      for (const user in messages[time]) {
        if (messages[time][user].room === 'general') {
          responseJSON[time] = messages[time];
        }
      }
    }
  }

  if (request.headers['if-none-match'] === digest) {
    // return 304 response without message
    // 304 is not modified and cannot have a body field
    // 304 will tell the browser to pull from cache instead
    return respondJSONMeta(request, response, 304);
  }

  // return 200 with message
  return respondJSON(request, response, 200, responseJSON);
};

// get meta info about user object
// should calculate a 200 or 304 based on etag
const getMessagesMeta = (request, response) => {
  if (request.headers['if-none-match'] === digest) {
    return respondJSONMeta(request, response, 304);
  }

  // return 200 without message, just the meta data
  return respondJSONMeta(request, response, 200);
};

// function for 404 not found requests with message
const notFound = (request, response) => {
  // create error message for response
  const responseJSON = {
    message: 'The page you are looking for was not found.',
    id: 'notFound',
  };

  // return a 404 with an error message
  respondJSON(request, response, 404, responseJSON);
};

// function for 404 not found without message
const notFoundMeta = (request, response) => {
  // return a 404 without an error message
  respondJSONMeta(request, response, 404);
};

// function to add a user from a POST body
const addMsg = (request, response, body) => {
  // default json message
  const responseJSON = {
    name: '',
    msg: 'Name and message are both required.',
    room: '',
  };

  // This should never happen but just in case
  if (!body.username || !body.msg) {
    responseJSON.id = 'missingParams';
    return respondJSON(request, response, 400, responseJSON);
  }

  // default status code to 201 created
  const responseCode = 201;

  // create a timestamp of the message if the object already doesn't exist
  if (!messages[body.timeStamp]) {
    messages[body.timeStamp] = {};
  }

  const key = messages[body.timeStamp];

  // add or update fields for this username
  key[body.username] = {};
  key[body.username].room = body.room;
  key[body.username].msg = body.msg;

  // if response is created, then set our created message
  // and sent response with a message
  if (responseCode === 201) {
    // creating a new hash object
    etag = crypto.createHash('sha1').update(JSON.stringify(messages));

    // recalculating the hash digest for etag
    digest = etag.digest('hex');

    // Cannot single out one object to handle multiple users / rooms at once
    responseJSON.name = body.username;
    responseJSON.msg = body.msg;
    responseJSON.room = body.room;

    return respondJSON(request, response, responseCode, responseJSON);
  }
  // 204 has an empty payload, just a success
  // It cannot have a body, so we just send a 204 without a message
  // 204 will not alter the browser in any way!!!
  return respondJSONMeta(request, response, responseCode);
};

const urlIsValid = (url) => {
  const handleResponse = (xhr) => {
    if (xhr.status === 200) {
      for (const time in messages) {
      // loop through and look for the url
        console.dir(messages);
        for (const user in messages[time]) {
          if (messages[time][user].msg.includes(url)) {
            // check if youtube link to add embed code
            if (url.includes('youtube')) {
              const msgUrl = url.replace('watch?v=', 'embed/');

              messages[time][user].msg += `<br><div class="aspect-ratio" id='ifr'><iframe src="${msgUrl}" allowfullscreen></iframe></div>`;
            }
          }
        }
      }
    }
  };
  const xhr = new XMLHttpRequest();
  xhr.open('HEAD', url);
  xhr.onload = () => handleResponse(xhr);
  xhr.send();
};

module.exports = {
  urlIsValid,
  getUrl,
  addLink,
  addMsg,
  getMessages,
  getMessagesMeta,
  notFound,
  notFoundMeta,
};
