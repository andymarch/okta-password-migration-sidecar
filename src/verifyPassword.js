const okta = require('@okta/okta-sdk-nodejs');
const crypto = require('crypto');

const client = new okta.Client({
    orgUrl: "https://"+process.env.TENANT,
    authorizationMode: 'PrivateKey',
    clientId: process.env.CLIENT_ID,
    scopes: ['okta.users.read'],
    privateKey: process.env.CLIENT_SECRET_JWT
  });

const rejectPayload = JSON.stringify(
    {
        "commands":[
            {
               "type":"com.okta.action.update","value": { "credential":"UNVERIFIED" }
            }
         ]
    },
    null,2 )
const acceptPayload = JSON.stringify(
    {
        "commands":[
            {
               "type":"com.okta.action.update", "value": { "credential":"VERIFIED" }
            }
         ]
    },
    null,2 ) 

module.exports.handler = async function (event) {
    const promise = new Promise(function(resolve,reject){
        var payload = JSON.parse(event.body)
        client.getUser(payload.data.context.credential.username)
        .then(user => 
            validatePassword(
                user.profile.migratedPassword,
                payload.data.context.credential.password)
                )
        .then(result => {
            if(result){
                resolve({ statusCode: 200, body: acceptPayload })
            }
            else {
                resolve({ statusCode: 200, body: rejectPayload })
            }
        })
        .catch(err => {
            console.log(err)
            reject({statusCode: 500})
        })
    })
    return promise
}

function validatePassword(migrationInfo,password){
    const promise = new Promise(function(resolve,reject){
        if(migrationInfo === undefined){
            //user does not have migration info
            resolve(false)
        }
        var migInfo = JSON.parse(migrationInfo)
        switch(migInfo.hashAlgorithm){
            case "pbkdf2":
                validatePBKDF2(migInfo,password)
                .then((result) => {
                        resolve(result);
                    })   
                break
            default:
                console.log("No matching algo " + migInfo.hashAlgorithm)
                resolve(false)
                break;
        }
    })
    return promise
}

async function validatePBKDF2(migrationInfo,password){
    var derivedKey = crypto.pbkdf2Sync(
            password,
            Buffer.from(migrationInfo.salt, 'base64'),
            parseInt(migrationInfo.iterations),
            parseInt(migrationInfo.keyLength),
            migrationInfo.digestAlgorithm
        )
    return (derivedKey.toString('base64') === migrationInfo.hash)
}