const http = require('http'); // pull in http module
const socket = require('socket.io');
const url = require('url');
const query = require('querystring');

// pull in our custom files
const htmlHandler = require('./htmlResponses.js');
const jsonHandler = require('./jsonResponses.js');

const port = process.env.PORT || process.env.NODE_PORT || 3010;

// handle POST requests
const handlePost = (request, response, parsedUrl) => {
  // if post is to /addUser (our only POST url)
  if (parsedUrl.pathname === '/addMsg') {
    const res = response;

    // uploads come in as a byte stream that we need
    // to reassemble once it's all arrived
    const body = [];

    // if the upload stream errors out, just throw a
    // a bad request and send it back
    request.on('error', (err) => {
      console.dir(err);
      res.statusCode = 400;
      res.end();
    });

    // on 'data' is for each byte of data that comes in
    // from the upload. We will add it to our byte array.
    request.on('data', (chunk) => {
      body.push(chunk);
    });

    // on end of upload stream.
    request.on('end', () => {
      // combine our byte array (using Buffer.concat)
      // and convert it to a string value (in this instance)
      const bodyString = Buffer.concat(body).toString();
      // since we are getting x-www-form-urlencoded data
      // the format will be the same as querystrings
      // Parse the string into an object by field name
      const bodyParsed = query.parse(bodyString);

      // Check for URL's
      const msgUrl = jsonHandler.getUrl(bodyParsed.msg);

      if (msgUrl) {
        // emit url to check to change
        jsonHandler.urlIsValid(msgUrl);
      }

      // add links if a url is in the message
      if (bodyParsed.msg && msgUrl) {
        bodyParsed.msg = jsonHandler.addLink(bodyParsed.msg, msgUrl);
      }

      // pass to our addUser function
      jsonHandler.addMsg(request, res, bodyParsed);
    });
  }
};

const onRequest = (request, response) => {
  // parse url into individual parts
  // returns an object of url parts by name
  const parsedUrl = url.parse(request.url, true);

  // check the request method (get, head, post, etc)
  switch (request.method) {
    case 'POST':
      handlePost(request, response, parsedUrl);
      break;
    case 'GET':
      if (parsedUrl.pathname === '/') {
        // if homepage, send index
        htmlHandler.getIndex(request, response);
      } else if (parsedUrl.pathname === '/style.css') {
        // if stylesheet, send stylesheet
        htmlHandler.getCSS(request, response);
      } else if (parsedUrl.pathname === '/getMessages') {
        const params = parsedUrl.query;
        // if get users, send user object back
        jsonHandler.getMessages(request, response, params);
      } else {
        // if not found, send 404 message
        jsonHandler.notFound(request, response);
      }
      break;
    case 'HEAD':
      if (parsedUrl.pathname === '/getUsers') {
        // if get users, send meta data back with etag
        jsonHandler.getUsersMeta(request, response);
      } else {
        // if not found send 404 without body
        jsonHandler.notFoundMeta(request, response);
      }
      break;
    default:
      // send 404 in any other case
      jsonHandler.notFound(request, response);
  }
};

const httpServer = http.createServer(onRequest);
httpServer.listen(port);

const io = socket(); // http://stackoverflow.com/questions/17285180/use-both-http-and-https-for-socket-io
io.attach(httpServer);

const newConnection = (socket) => {
  console.log(`New Connection: ${socket.id}`);

  const sendMessage = (msg) => {
    console.log(msg);
    io.sockets.emit('msg', msg);
  };

  socket.on('msg', sendMessage);
};

io.sockets.on('connection', newConnection);

console.log(`Listening on 127.0.0.1: ${port}`);
