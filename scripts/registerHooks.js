require('dotenv').config()
const axios = require('axios')

console.log("Performing hook setup...")
if(process.env.API_TOKEN == null) {
    console.error("API_TOKEN not declared in .env file. Set this value and rerun.")
    return
}
if(process.env.SERVERLESS_ENDPOINT == null) {
    console.error("SERVERLESS_ENDPOINT not declared in .env file. Set this value and rerun.")
    return
}
setupPasswordInlineHook()
.then(setupEventHook)
.catch(err => {console.error(err)})

function setupPasswordInlineHook(){
    var payload = {
        "name" : "Password Migration Hook",
        "type" : "com.okta.user.credential.password.import",
        "version" : "1.0.0",
        "channel" : {
            "type" : "HTTP",
            "version" : "1.0.0",
            "config" : {
                "uri" : process.env.SERVERLESS_ENDPOINT+"/verify",
                "authScheme" : {
                    "type" : "HEADER",
                    "key" : "Authorization",
                    "value" : process.env.FIXED_AUTH_SECRET
                }
            }
        }
    }
    return axios.post(
        process.env.TENANT+"/api/v1/inlineHooks",
        payload,
        {
            headers: {
                Authorization: 'SSWS '+process.env.API_TOKEN
            }
        }
    )
}

function setupEventHook() {
    return new Promise(async function(resolve,reject){
        var payload = {
            "name" : "Password Migration Event Hook",
            "events" : {
                "type" : "EVENT_TYPE",
                "items" : [
                    "user.import.password"
                ]
            },
            "channel" : {
                "type" : "HTTP",
                "version" : "1.0.0",
                "config" : {
                    "uri" : process.env.SERVERLESS_ENDPOINT+"/complete",
                    "authScheme" : {
                        "type" : "HEADER",
                        "key" : "Authorization",
                        "value" : process.env.FIXED_AUTH_SECRET
                    }
                }
            }
        }

        var response
        try {
            response = await axios.post(
                process.env.TENANT+"/api/v1/eventHooks",
                payload,
                {
                    headers: {
                        Authorization: 'SSWS '+process.env.API_TOKEN
                    }
                }
            )
        }
        catch(err){
            reject(err)
        }
        console.log("Event hook registered, verifying...")
        try{
            var verifyResponse = await axios.post(
                process.env.TENANT+"/api/v1/eventHooks/"+response.data.id+"/lifecycle/verify",null,
                {
                    headers: {
                        Authorization: 'SSWS '+process.env.API_TOKEN
                    }
                }
            )
            console.log("Event hook verified.")
            resolve()
        } catch(err){
            reject(err)
        }


    })
}