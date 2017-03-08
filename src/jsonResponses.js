const crypto = require('crypto');

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
const getUsers = (request, response) => {
  // json object to send
  const responseJSON = {
    messages,
  };

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
const getUsersMeta = (request, response) => {
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
const addUser = (request, response, body) => {
  // default json message
  const responseJSON = {
    name: '',
    msg: 'Name and message are both required.',
  };

  if (!body.name || !body.msg) {
    responseJSON.id = 'missingParams';
    return respondJSON(request, response, 400, responseJSON);
  }

  // default status code to 201 created
  let responseCode = 201;

  // if that user's name already exists in our object
  // then switch to a 204 updated status
  if (messages[body.timeStamp]) {
    responseCode = 204;
  } else {
    // otherwise create an object with that name
    messages[body.timeStamp] = {};
  }

  // add or update fields for this user name
  messages[body.timeStamp].name = body.name;

  // check message for url
  const url = getUrl(body.msg);
  // add links if a url is in the message
  const message = url ? addLink(body.msg, url) : body.msg;

  messages[body.timeStamp].msg = message;

  // if response is created, then set our created message
  // and sent response with a message
  if (responseCode === 201) {
    // creating a new hash object
    etag = crypto.createHash('sha1').update(JSON.stringify(messages));

    // recalculating the hash digest for etag
    digest = etag.digest('hex');

    responseJSON.name = messages[body.timeStamp].name;
    responseJSON.msg = messages[body.timeStamp].msg;
    return respondJSON(request, response, responseCode, responseJSON);
  }
  // 204 has an empty payload, just a success
  // It cannot have a body, so we just send a 204 without a message
  // 204 will not alter the browser in any way!!!
  return respondJSONMeta(request, response, responseCode);
};

// http://stackoverflow.com/questions/26007187/node-js-check-if-a-remote-url-exists

module.exports = {
  addUser,
  getUsers,
  getUsersMeta,
  notFound,
  notFoundMeta,
};
