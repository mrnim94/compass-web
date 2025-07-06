function capMaxTimeMSAtPreferenceLimit(preferences, value) {
  const preferenceMaxTimeMS = preferences.getPreferences().maxTimeMS;
  if (typeof value === 'number' && typeof preferenceMaxTimeMS === 'number') {
    return Math.min(value, preferenceMaxTimeMS);
  } else if (typeof preferenceMaxTimeMS === 'number') {
    return preferenceMaxTimeMS;
  }
  return value;
}

module.exports = { capMaxTimeMSAtPreferenceLimit };
