import TrackPlayer, { Event, State } from 'react-native-track-player';

module.exports = async function () {
  TrackPlayer.addEventListener(Event.RemotePlay, async () => {
    try {
      const pbState = await TrackPlayer.getPlaybackState();
      if (pbState?.state === State.Ended) {
        await TrackPlayer.seekTo(0);
      } else {
        const prog = await TrackPlayer.getProgress();
        if (prog.duration > 0 && prog.position >= prog.duration - 0.5) {
          await TrackPlayer.seekTo(0);
        }
      }
    } catch {
      // Proceed with play anyway
    }
    await TrackPlayer.play();
  });
  TrackPlayer.addEventListener(Event.RemotePause, () => TrackPlayer.pause());
  TrackPlayer.addEventListener(Event.RemoteNext, () => TrackPlayer.skipToNext());
  TrackPlayer.addEventListener(Event.RemotePrevious, () => TrackPlayer.skipToPrevious());
  TrackPlayer.addEventListener(Event.RemoteStop, () => TrackPlayer.reset());
  TrackPlayer.addEventListener(Event.RemoteSeek, (event) => TrackPlayer.seekTo(event.position));
  TrackPlayer.addEventListener(Event.RemoteDuck, async (event) => {
    if (event.paused) {
      await TrackPlayer.pause();
    } else {
      await TrackPlayer.play();
    }
  });
};
