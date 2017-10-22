import Client from 'node-xmpp-client';
import { decodeColonSeparatedResponse, buildIqStanza } from '../util';

const debug = require('debug')('harmonyhubjs:client:login:hub');

/** PrivateFunction: getIdentity
 * Logs in to a Harmony hub as a guest and uses the userAuthToken from logitech's
 * web service to retrieve an identity token.
 *
 * Parameters:
 *     (String) hubhost - Hostname/IP of the Harmony hub to connect.
 *     (int) hubport - Optional. Port of the Harmony hub to connect. By default,
 *                     this is set to 5222.
 *
 * Returns:
 *     (promise) - The resolved promise passes the retrieved identity token.
 */
function getIdentity(hubhost, hubport) {
  debug('retrieve identity by logging in as guest');

  // guest@x.com / guest
  // guest@connect.logitech.com/gatorade
  let iqId;

  const xmppClient = new Client({
    jid: 'guest@x.com/gatorade',
    password: 'guest',
    host: hubhost,
    port: hubport,
    disallowTLS: true,
  });

  xmppClient.on('online', () => {
    debug('XMPP client connected');

    const body = 'method=pair:name=harmonyjs#iOS6.0.1#iPhone';
    const iq = buildIqStanza(
      'get', 'connect.logitech.com', 'vnd.logitech.connect/vnd.logitech.pair',
      body, 'guest',
    );

    iqId = iq.attr('id');

    xmppClient.send(iq);
  });

  xmppClient.on('error', (e) => {
    debug('XMPP client error');
    console.log('errorhub', e);
  });

  return new Promise((resolve, reject) => {
    xmppClient.on('stanza', (stanza) => {
      debug(`received XMPP stanza: ${stanza}`);

      if (stanza.attrs.id === iqId.toString()) {
        const body = stanza.getChildText('oa');
        const response = decodeColonSeparatedResponse(body);

        if (response.identity && response.identity !== undefined) {
          debug(`received identity token: ${response.identity}`);
          xmppClient.end();
          resolve(response.identity);
        } else {
          debug('could not find identity token');
          xmppClient.end();
          reject(new Error('Did not retrieve identity.'));
        }
      }
    });
  });
}

/** PrivateFunction: loginWithIdentity
 * After fetching an identity from the Harmony hub, this function creates an
 * XMPP client using that identity. It returns a promise which, when resolved,
 * passes that XMPP client.
 *
 * Parameters:
 *     (String) identity - Identity token to login to the Harmony hub.
 *     (String) hubhost - Hostname/IP of the Harmony hub to connect.
 *     (int) hubport - Optional. Port of the Harmony hub to connect. By default,
 *                     this is set to 5222.
 *
 * Returns:
 *     (Q.promise) - When resolved, passes the logged in XMPP client, ready to
 *                   communicate with the Harmony hub.
 */
function loginWithIdentity(identity, hubhost, hubport) {
  debug(`create xmpp client using retrieved identity token: ${identity}`);

  const jid = `${identity}@connect.logitech.com/gatorade`;
  const password = identity;

  const xmppClient = new Client({
    jid,
    password,
    host: hubhost,
    port: hubport,
    disallowTLS: true,
  });

  return new Promise((resolve) => {
    xmppClient.once('online', () => {
      debug('XMPP client connected using identity token');
      resolve(xmppClient);
    });
  });
}

/** Function: loginToHub
 * Uses a userAuthToken to login to a Harmony hub.
 *
 * Parameters:
 *     (String) userAuthToken - A authentication token, retrieved from logitechs
 *                              web service.
 *     (String) hubhost - Hostname/IP of the Harmony hub to connect.
 *     (int) hubport - Optional. Port of the Harmony hub to connect. By default,
 *                     this is set to 5222.
 *
 * Returns:
 *     (promise) - The final resolved promise will pass a fully authenticated
 *                   XMPP client which can be used to communicate with the
 *                   Harmony hub.
 */
async function loginToHub(hubhost, hubport = 5222) {
  debug('perform hub login');

  const identity = await getIdentity(hubhost, hubport);
  await loginWithIdentity(identity, hubhost, hubport);
}

module.exports = loginToHub;
