const serverless = require("serverless-http");
const app = require("../../Server");

const wrappedHandler = serverless(app, {
    binary: ["application/pdf", "application/octet-stream", "image/*"]
});

module.exports.handler = async (event, context) => {
    // Netlify sometimes base64-encodes POST request bodies.
    // Decode it back to a UTF-8 string so express.json() can parse it correctly.
    if (event.body && event.isBase64Encoded) {
        event.body = Buffer.from(event.body, "base64").toString("utf8");
        event.isBase64Encoded = false;
    }

    return wrappedHandler(event, context);
};

