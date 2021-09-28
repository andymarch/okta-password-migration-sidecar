require('dotenv').config()
const axios = require('axios')
var jose = require('node-jose');
const fs = require('fs');

// This is a helper implementation to generate key material and get your client
// registered to Okta.
console.log("Performing setup...")
if(process.env.API_TOKEN == null) {
    console.error("API_TOKEN not declared in .env file unable to register client. Set this value and rerun register.")
    return
}
else {
    appExists()
        .then((value) => {
                if (!value) {
                    getKeyStore()
                        .then((keystore) => keystore.get('appkey1'))
                        .then((key) => createApplication(key.toJSON()))
                        .then((data) => console.log(data.label + " created with clientid " + data.id))
                        .catch(err => console.log(err));
                }
                else {
                    console.log("Service application already exists, skipped app registration");
                }
            })
    .then(schemaExtensionsExists)
        .then((value) => {
            if (!value) {
                updateSchema()
                    .then(() => console.log("Schema updated"))
                    .catch(err => console.log(err));
            }
            else {
                console.log("Schema has already been extended");
            }
        })
    .catch(err => console.error(err))
}

function appExists(){
    return new Promise(async function(resolve,reject){
        var appName = (process.env.APP_LABEL != null) 
        ? process.env.APP_LABEL 
        : "Password Migration Sidecar Service"

        try{
            var response = await axios.get(
                process.env.TENANT+"/api/v1/apps",
                {params: { q: appName},
                    headers: {
                        Authorization: 'SSWS '+process.env.API_TOKEN
                    }
                }
            )
            if(response.data.length!= 0){
                console.log("ClientID: "+ response.data[0].clientId)
            }
            resolve(response.data.length != 0)
        }
        catch(err) {
            reject(err)
        }
    })
}

function schemaExtensionsExists(){
    return new Promise(async function(resolve,reject){
        try{
            var response = await axios.get(
                process.env.TENANT+"/api/v1/meta/schemas/user/default",
                {
                    headers: {
                        Authorization: 'SSWS '+process.env.API_TOKEN
                    }
                }
            )
            resolve(response.data.definitions.custom.properties.migratedPassword != null)
        }
        catch {
            reject(err)
        }
    })
}

function getKeyStore(){
    return new Promise(async function(resolve,reject){
        var keystore
        if(fs.existsSync('./app.key')) {
            console.log("Using existing JWKS keystore ./app.key")
            keystore = jose.JWK.asKeyStore(fs.readFileSync('./app.key', 'utf8'))
            resolve(keystore)
        }
        else {
            keystore = jose.JWK.createKeyStore();
            console.log("No key material found creating new RSA keypair")
            var props = {
                kid: 'appkey1',
                alg: 'RS256',
                use: 'sig'
              };
            await keystore.generate("RSA",2048,props)
            output = keystore.toJSON(true);
            fs.writeFileSync('./app.key', JSON.stringify(output),'utf8')
            console.log("JWKS written to ./app.key")
            resolve(keystore)
        }      
    })
}

function createApplication(publickey){
    return new Promise(async function (resolve, reject) {
        try {
            var appName = (process.env.APP_LABEL != null) 
                ? process.env.APP_LABEL 
                : "Password Migration Sidecar Service"

            var payload = {
                "name": "oidc_client",
                "label": appName,
                "signOnMode": "OPENID_CONNECT",
                "credentials": {
                    "oauthClient": {
                    "token_endpoint_auth_method": "private_key_jwt"
                    }
                },
                "settings": {
                    "oauthClient": {
                    "response_types": [
                        "token"
                    ],
                    "grant_types": [
                        "client_credentials"
                    ],
                    "application_type": "service",
                    "jwks":{
                        "keys": [
                            publickey
                        ]
                    }
                    }
                }
            }
            var response = await axios.post(
                process.env.TENANT+"/api/v1/apps",
                payload,
                {
                    headers: {
                        Authorization: 'SSWS '+process.env.API_TOKEN
                    }
                }
            )


            var grantPayloadManage = {
                "scopeId": "okta.users.manage",
                "issuer": process.env.TENANT
            }
            var grantPayloadRead = {
                "scopeId": "okta.users.read",
                "issuer": process.env.TENANT
            }
            await axios.post(
                process.env.TENANT+"/api/v1/apps/"+response.data.id+"/grants",
                grantPayloadManage,
                {
                    headers: {
                        Authorization: 'SSWS '+process.env.API_TOKEN
                    }
                }
            )
            await axios.post(
                process.env.TENANT+"/api/v1/apps/"+response.data.id+"/grants",
                grantPayloadRead,
                {
                    headers: {
                        Authorization: 'SSWS '+process.env.API_TOKEN
                    }
                }
            )
            resolve(response.data)
        }
        catch (err){
            reject(err)
        }
    })
}

function updateSchema(){
    return new Promise(async function(resolve,reject){
        try {
            var payload = {
                "definitions": {
                    "custom": {
                    "id": "#custom",
                    "type": "object",
                    "properties": {
                        "migratedPassword": {
                            "title": "Migrated Password",
                            "description": "Imported password from existing service",
                            "type": "string",
                            "required": false,
                            "minLength": 1,
                            "maxLength": 500,
                            "permissions": [
                                {
                                "principal": "SELF",
                                "action": "HIDE"
                                }
                            ]
                        }
                    },
                    "required": []
                    }
                }
            }
            var response = await axios.post(
                process.env.TENANT+"/api/v1/meta/schemas/user/default",
                payload,
                {
                    headers: {
                        Authorization: 'SSWS '+process.env.API_TOKEN
                    }
                }
            )
            resolve(response.data)
        }
        catch (err){
            reject(err)
        }
    })
}