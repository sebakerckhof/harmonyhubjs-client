import fetch from 'node-fetch';

const debug = require('debug')('harmonyhubjs:client:login:auth');

const logitechUrl = 'https://svcs.myharmony.com/CompositeSecurityServices/Security.svc/json/GetUserAuthToken';

/** Function: getUserAuthToken
 * Connects to Logitechs web service to retrieve a userAuthToken. This token
 * then can be used to login to a Harmony hub as guest.
 *
 * Parameters:
 *     (String) email - E-mail address of a Harmony account
 *     (String) password - Password of a Harmony account
 *
 * Returns:
 *     (promise) - When resolved, passes the userAuthToken.
 */
async function getUserAuthToken(email, password) {
  debug(`retrieve userAuthToken from logitech for email ${email}`);

  const response = await fetch(logitechUrl, {
    method: 'POST',
    body: {
      email,
      password,
    },
  });

  const result = await response.json();
  if (!result.ErrorCode) {
    debug('userAuthToken retrieved');

    const authToken = result.GetUserAuthTokenResult.UserAuthToken;
    debug(`authToken: ${authToken}`);

    return authToken;
  }
  debug('failed to retrieve userAuthToken');

  throw new Error('Could not retrieve userAuthToken via Logitech! ' +
      'Please check email & password.');
}

export default getUserAuthToken;
