import { Audio } from 'expo-av';

let _sound = null;

export async function playChime() {
  try {
    if (_sound) { await _sound.unloadAsync(); _sound = null; }
    await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
    const { sound } = await Audio.Sound.createAsync(
      require('../assets/chime.wav'),
      { shouldPlay: true, volume: 1.0 }
    );
    _sound = sound;
    sound.setOnPlaybackStatusUpdate((s) => {
      if (s.didJustFinish) { sound.unloadAsync(); _sound = null; }
    });
  } catch (e) {
    // silently skip if audio unavailable
  }
}
