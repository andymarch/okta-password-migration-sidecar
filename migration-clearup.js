const okta = require('@okta/okta-sdk-nodejs');
const AWS = require("aws-sdk"); 

const client = new okta.Client({
    orgUrl: "https://"+process.env.TENANT,
    authorizationMode: 'PrivateKey',
    clientId: process.env.CLIENT_ID,
    scopes: ['okta.users.read','okta.users.manage'],
    privateKey: process.env.CLIENT_SECRET_JWT
  });

//This function simply consumes the event from Okta and publishes to SNS
//returning the 200 once publishing is complete prevents Okta from sending retrys
module.exports.perform = async function (event) {
    let snsOpts = {
        region: "us-east-1",
    };

    let sns = new AWS.SNS(snsOpts);

    let messageData = {
        Message: event.body,
        TopicArn: process.env.mySnsTopicArn,
    }

    await sns.publish(messageData).promise()
    return({ statusCode: 200 })
}

//This function handles the clear-up event published to SNS.
//Normally only one event will come per message but we need to handle the
//possibility of multiple events
module.exports.handler = async (event, context) => {
    let message = JSON.parse(event.Records[0].Sns.Message)
    var fn = function clearData(event){
        return new Promise(function(resolve,reject){
            client.getUser(event.target[0].id)
            .then(user => {
                user.profile.migratedPassword = "";
                user.update()
                .then(() => {
                    resolve()
                })
                .catch(err => {
                    console.log(err)
                    reject()
                })
            });
        })
    }
    var events = message.data.events.map(fn)
    return Promise.all(events)
  };