
module.exports.handler = async function (event) {
    var payload = JSON.stringify({verification: event.headers['X-Okta-Verification-Challenge']})
    return { statusCode: 200, body: payload }
  };