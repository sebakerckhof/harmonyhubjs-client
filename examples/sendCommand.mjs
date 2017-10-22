import HarmonyHubClient from '../index';

(async () => {
  const harmonyClient = new HarmonyHubClient('10.69.69.50');

  try {
    await harmonyClient.connect();
    const commands = await harmonyClient.getAvailableCommands();
    console.log(commands);
    return;
    const device = commands.device[0];
    const powerControls = device.controlGroup
      .filter(group => group.name.toLowerCase() === 'power')
      .pop();
    const powerOnFunction = powerControls.function
      .filter(action => action.name.toLowerCase())
      .pop();

    if (powerOnFunction) {
      const encodedAction = powerOnFunction.action.replace(/:/g, '::');
      await harmonyClient.send('holdAction', `action=${encodedAction}:status=press`);
    }
    throw new Error('could not find poweron function of first device :(');
  } catch (error) {
    console.log(error);
  } finally {
    harmonyClient.end();
  }
})();
