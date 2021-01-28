"use strict";

exports.fixed = (event, context) => {
    if(event.authorizationToken == process.env.FIXED_AUTH_SECRET) {
        context.succeed(
            generateAuthResponse("fixedToken", 'Allow',  event.methodArn))
    }
    else{
        context.fail('Unauthorized')
    }
}

function generateAuthResponse(principalId, effect, methodArn) {
    return {
        'principalId': principalId,
        'policyDocument': {
            Version: '2012-10-17',
            Statement: [{
                Action: 'execute-api:Invoke',
                Effect: effect,
                Resource: methodArn
            }]
        }
    }
}