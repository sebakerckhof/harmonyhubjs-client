import { EventEmitter } from 'events';
import { decodeColonSeparatedResponse, buildIqStanza } from './util';
import login from './login';

const debug = require('debug')('harmonyhubjs:client:harmonyclient');

class HarmonyClient extends EventEmitter {
  /**
   * Creates a new HarmonyClient using the given xmppClient to communication.
   *
   * @param xmppClient
   * @constructor
   */
  constructor(host, port) {
    debug('create new harmony client');
    super();
    this._hubhost = host;
    this._hubport = port;
    this._responseHandlerQueue = [];
  }

  async connect() {
    if (!this._xmppClient) {
      const xmppClient = await login(this._hubhost, this._hubport);
      xmppClient.on('stanza', this.handleStanza.bind(this));
      xmppClient.on('error', (error) => {
        debug(`XMPP Error: ${error.message}`);
      });
      this._xmppClient = xmppClient;
    }
  }

  handleStanza(stanza) {
    debug(`handleStanza(${stanza.toString()})`);

    // Check for state digest:
    const event = stanza.getChild('event');
    if (event && event.attr('type') === 'connect.stateDigest?notify') {
      this.onStateDigest(JSON.parse(event.getText()));
    }

    // Check for queued response handlers:
    this._responseHandlerQueue.forEach((responseHandler, index, array) => {
      if (responseHandler.canHandleStanza(stanza)) {
        debug('received response stanza for queued response handler');

        const response = stanza.getChildText('oa');
        let decodedResponse;

        if (responseHandler.responseType === 'json') {
          decodedResponse = JSON.parse(response);
        } else {
          decodedResponse = decodeColonSeparatedResponse(response);
        }

        responseHandler.resolve(decodedResponse);
        array.splice(index, 1);
      }
    });
  }

  onStateDigest(stateDigest) {
    debug('received state digest');
    this.emit('stateDigest', stateDigest);
  }

  /**
   * Returns the latest turned on activity from a hub.
   *
   * @returns {Promise}
   */
  async getCurrentActivity() {
    debug('retrieve current activity');

    const response = await this.request('getCurrentActivity');
    return response.result;
  }

  /**
   * Retrieves a list with all available activities.
   *
   * @returns {Promise}
   */
  async getActivities() {
    debug('retrieve activities');

    const availableCommands = await this.getAvailableCommands();
    return availableCommands.activity;
  }

  /**
   * Starts an activity with the given id.
   *
   * @param activityId
   * @returns {Promise}
   */
  async startActivity(activityId) {
    const timestamp = new Date().getTime();
    const body = `activityId=${activityId}:timestamp=${timestamp}`;
    const stanza = await this.request('startactivity', body, 'encoded');

    const event = stanza.getChild('event');
    let canHandleStanza = false;

    if (event && event.attr('type') === 'connect.stateDigest?notify') {
      const digest = JSON.parse(event.getText());
      if (activityId === '-1' && digest.activityId === activityId && digest.activityStatus === 0) {
        canHandleStanza = true;
      } else if (activityId !== '-1' && digest.activityId === activityId && digest.activityStatus === 2) {
        canHandleStanza = true;
      }
    }
    return canHandleStanza;
  }

  /**
   * Turns the currently running activity off.
   * This is implemented by "starting" an imaginary activity with the id -1.
   *
   * @returns {Promise}
   */
  turnOff() {
    debug('turn off');
    return this.startActivity('-1');
  }

  /**
   * Checks if the hub has now activity turned on.
   * This is implemented by checking the hubs current activity. If the
   * activities id is equal to -1, no activity is on currently.
   *
   * @returns {Promise}
   */
  async isOff() {
    debug('check if turned off');

    const activityId = await this.getCurrentActivity();
    const off = (activityId === '-1');
    debug(off ? 'system is currently off' : `system is currently on with activity ${activityId}`);
    return off;
  }

  /**
   * Acquires all available commands from the hub when resolving the returned promise.
   *
   * @returns {Promise}
   */
  getAvailableCommands() {
    debug('retrieve available commands');

    return this.request('config', undefined, 'json');
  }

  /**
   * Builds an IQ stanza containing a specific command with given body, ready to send to the hub.
   *
   * @param command
   * @param body
   * @returns {Stanza}
   */
  static buildCommandIqStanza(command, body) {
    debug(`buildCommandIqStanza for command "${command}" with body ${body}`);

    return buildIqStanza(
      'get',
      'connect.logitech.com',
      `vnd.logitech.harmony/vnd.logitech.harmony.engine?${command}`,
      body,
    );
  }

  static defaultCanHandleStanzaPredicate(awaitedId, stanza) {
    const stanzaId = stanza.attr('id');
    return (stanzaId && stanzaId.toString() === awaitedId.toString());
  }

  /**
   * Sends a command with the given body to the hub.
   * The returned promise gets resolved as soon as a response for this
   * very request arrives.
   *
   * By specifying expectedResponseType with either "json" or "encoded",
   * you advice the response stanza handler how you
   * expect the responses data encoding. See the protocol guide for further information.
   *
   * The canHandleStanzaFn parameter allows to define a predicate
   *  to determine if an incoming stanza is the response to your request.
   * This can be handy if a generic stateDigest message might be
   *  the acknowledgment to your initial request.
   * *
   * @param command
   * @param body
   * @param expectedResponseType
   * @param canHandleStanzaPredicate
   * @returns {Promise}
   */
  request(command, body, expectedResponseType = 'encoded', canHandleStanzaPredicate = undefined) {
    debug(`request with command "${command}" with body ${body}`);

    const iq = HarmonyClient.buildCommandIqStanza(command, body);
    const id = iq.attr('id');
    const canHandleStanza = canHandleStanzaPredicate
      || HarmonyClient.defaultCanHandleStanzaPredicate.bind(null, id);

    return new Promise((resolve) => {
      this._responseHandlerQueue.push({
        canHandleStanza,
        resolve,
        responseType: expectedResponseType,
      });

      this._xmppClient.send(iq);
    });
  }

  /**
   * Sends a command with given body to the hub.
   * The returned promise gets immediately resolved since this function does
   * not expect any specific response from the hub.
   *
   * @param command
   * @param body
   * @returns {Promise}
   */
  send(command, body) {
    debug(`send command "${command}" with body ${body}`);
    this._xmppClient.send(HarmonyClient.buildCommandIqStanza(command, body));
  }

  /**
   * Closes the connection the the hub.
   * You have to create a new client if you would like to communicate again with the hub.
   */
  end() {
    debug('close harmony client');
    this._xmppClient.end();
  }
}

export default HarmonyClient;
