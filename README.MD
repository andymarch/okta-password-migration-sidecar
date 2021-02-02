# Okta Password Migration Sidecar

This service implementation aims to provide support for standard password
hashing functions that are not natively supported by Okta. Okta natively
supports the BCRYPT, SHA-512, SHA-256, SHA-1, and MD5 hashes functions during
the creation of a user. If you have hashes in any of these format follow the
example
[here](https://developer.okta.com/docs/reference/api/users/#create-user-with-imported-hashed-password)
to import these. This service utilities the password import hook to register as
a source of truth for password migration, [see
here](https://developer.okta.com/docs/reference/password-hook/) for details on
how this works.

This implementation extends the Okta user schema to store the migration data
within Universal Directory. This removes the dependency on external sources of
data however the implementation in this repository can be easily modified to
address internal stores for these hashes if they are accessible from the internet.

# Supported hashing functions
* PBKDF2

# Setup

Included in this repo is a setup script which automates the configuration of the
tenant. This is creating a new OAuth service to allow the reading of user's UD
profiles as well as extending the default user schema to add additional
attributes to store the migration data.

1. Create a .env file in the repository directory with the following content

```
TENANT=https://<yourtenant>.okta.com
API_TOKEN=<Superuser API token>
```

2. Then execute the following commands

```
npm install
npm run setup
```

3. Create a config.json with the following content:

```
{
    "tenant": "<yourtenant>.okta.com",
    "fixed_auth_secret": "<a static value>",
    "client_id": "<the client id generated during setup>",
    "client_secret_jwt": "-----BEGIN RSA PRIVATE KEY-----\n<the PEM of the private key in app.key>\n-----END RSA PRIVATE KEY-----"
}
```

4. Deploy the service to AWS with serverless. (🚀 AWS Serverless quickstart
[here](https://www.serverless.com/framework/docs/providers/aws/guide/quick-start/))

```
serverless deploy
```

This will return the newly created endpoint. 

5. Add the serverless endpoint value to your .env file like below:

```
SERVERLESS_ENDPOINT=https://<yourid>.execute-api.us-east-1.amazonaws.com/dev
```

6. You can now execute the following commands to configure both the inline and
event hooks in Okta

```
npm run setupHooks
```

This is creating a new Password Import inline hook pointing to ```/verify``` and
a event hook for user.import.password pointing to ```/complete```.

# Importing user data

To import the hash you will upload the migrated material into the user's profile
in the following structure

```
{ 
    "hash": "<base 64 encoded hash>",
    "hashAlgorithm": "pbkdf2",
    "digestAlgorithm": "sha512",
    "salt": "<base 64 encoded salt>",
    "iterations": 1000,
    "keyLength": 128 
}
```

To create a test user this would look like the below (note you need to escape
the JSON payload into migratedPassword)

```
curl -v -X POST \
-H "Accept: application/json" \
-H "Content-Type: application/json" \
-H "Authorization: SSWS ${api_token}" \
-d '{
  "profile": {
    "firstName": "Isaac",
    "lastName": "Brock",
    "email": "isaac.brock@example.com",
    "login": "isaac.brock@example.com",
    "mobilePhone": "555-415-1337",
    "migratedPassword":"{ \"hash\": \"tlXeEf65TEWTW41acGi\/4LrbcT84v2H0vXSjIWdNT7Wr79qHyAB\/z30FGBiHNICUgIGKzWgA3FH5oMGHUesR+uwuWf0PhVA0seFeYi16tFMMwVdsJZjze0paBsVGxkCJ6yiL57jbe0v3MOGsPKMNUOb2n1kZk9fooajNBoTqGF4=\", \"hashAlgorithm\": \"pbkdf2\", \"digestAlgorithm\": \"sha512\", \"salt\": \"vQIHs71+xAa4lxK9J+VhfA==\", \"iterations\": 1000, \"keyLength\": 128 }"
  },
  "credentials": {
    "password" : {
      "hook": {
        "type": "default"
      }
    }
  }
}' "https://${yourOktaDomain}/api/v1/users?activate=true"
```

If you now visit you tenant and attempt to login with "isaac.brock" and "Hello" you
will be able to login successfully.