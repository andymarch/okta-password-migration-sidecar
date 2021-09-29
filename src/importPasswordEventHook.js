const okta = require('@okta/okta-sdk-nodejs');
const AWS = require("aws-sdk"); 

const client = new okta.Client({
    orgUrl: process.env.TENANT,
    authorizationMode: 'PrivateKey',
    clientId: process.env.CLIENT_ID,
    scopes: ['okta.users.read','okta.users.manage'],
    privateKey: process.env.CLIENT_SECRET_JWT
  });


module.exports.verify = async function (event) {
    var payload = JSON.stringify({verification: event.headers['X-Okta-Verification-Challenge']})
    return { statusCode: 200, body: payload }
  };

//This function simply consumes the event from Okta and publishes to SNS
//returning the 200 once publishing is complete prevents Okta from sending retrys
module.exports.handler = async function (event) {
    let snsOpts = {
        region: process.env.region,
    };

    let sns = new AWS.SNS(snsOpts);

    let messageData = {
        Message: event.body,
        TopicArn: process.env.SnsTopicArn,
    }

    await sns.publish(messageData).promise()
    return({ statusCode: 200 })
}

//This function handles the clear-up event published to SNS.
//Normally only one event will come per message but we need to handle the
//possibility of multiple events
module.exports.process = async (event, context) => {
    let message = JSON.parse(event.Records[0].Sns.Message)
    if(message.eventType !== "com.okta.event_hook"){
        console.error("Recieved payload was not Okta event hook.")
        return;
    }

    var fn = function clearData(event){
        return new Promise(function(resolve,reject){
            if(event.eventType !== "user.import.password"){
                reject("Expected event of user.import.password encountered "+ event.eventType)
            }
            client.getUser(event.target[0].id)
            .then(user => {
                user.profile.migratedPassword = "";
                user.update()
                .then(() => {
                    resolve()
                })
                .catch(err => {
                    reject(err)
                })
            });
        })
    }
    return Promise.all(message.data.events.map(fn))
  };