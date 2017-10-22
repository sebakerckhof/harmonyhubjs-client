import HarmonyHubClient from '../index';

(async () => {
  const harmonyClient = new HarmonyHubClient('192.168.1.106');

  try {
    await harmonyClient.connect();
    const off = await harmonyClient.isOff();
    if (off) {
      console.log('Currently off. Turning TV on.');

      const activities = await harmonyClient.getActivities();
      // Get an activity with the name "Fernsehen" and trigger it:
      const watchTvActivity = activities
        .filter(activity => activity.label.toLowerCase() === 'fernsehen')
        .pop();

      if (watchTvActivity) {
        await harmonyClient.startActivity(watchTvActivity.id);
      } else {
        throw new Error('Could not find an activity that sounds like Fernsehen :(');
      }
    } else {
      console.log('Currently on. Turning TV off');

      await harmonyClient.turnOff();
    }
  } catch (error) {
    console.log(error);
  } finally {
    harmonyClient.end();
  }
})();
