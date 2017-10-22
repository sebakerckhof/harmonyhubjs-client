import xml from '@xmpp/xml';

function getUniqueId() {
  return Math.floor(Math.random() * 1000000);
}

/**
 * Splits a response from the hub (usualy seperated by ':' and '=') into a
 * proper javascript object.
 *
 * Parameters:
 *     (String) response
 *
 * Returns:
 *     (Object)
 */
function decodeColonSeparatedResponse(response) {
  let result;

  if (response && typeof response === 'string') {
    const pairs = response.split(':') || response;
    result = {};

    pairs.forEach((pair) => {
      const keyValue = pair.split('=');

      if (keyValue.length === 2) {
        const [key, value] = keyValue;
        result[key] = value;
      }
    });
  }

  return result;
}

function buildIqStanza(type, xmlns, mime, body, from) {

  const iq = xml`
    <iq type='${type}' from='${from}' id='${getUniqueId()}'>
      <query xmlns='${xmlns}'>
        ${body}
      </query>
    </iq>`;

  return iq;
}

export {
  getUniqueId,
  decodeColonSeparatedResponse,
  buildIqStanza,
};
