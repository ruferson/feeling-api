export class LobbyNameGenerator {
  private static readonly SPATIAL_PREFIXES = [
    'Nebula',
    'Orbit',
    'Pulse',
    'Constellation',
    'Supernova',
    'Cluster',
    'Horizon',
    'Void',
    'Singularity',
    'Cosmos',
    'Eclipse',
    'Vertex',
    'Aura',
    'Galaxy',
    'Quasar',
    'Pulsar',
    'Zenith',
    'Nadir',
    'Spectrum',
    'Parallax',
    'Aether',
    'Astral',
    'Celestial',
    'Starlight',
    'Corona',
    'Helios',
    'Hyperion',
    'Titan',
    'Vortex',
    'Aurora',
  ];

  private static readonly TONAL_MODIFIERS = [
    'Major',
    'Minor',
    'Dorian',
    'Lydian',
    'Phrygian',
    'Mixolydian',
    'Chromatic',
    'Acoustic',
    'Electric',
    'Analog',
    'Digital',
    'Ambient',
    'Synth',
    'Subharmonic',
    'Overdrive',
    'Stereo',
    'Mono',
    'Binaural',
    'Resonant',
    'Polyphonic',
  ];

  private static readonly MUSICAL_NOUNS = [
    'Resonance',
    'Frequency',
    'Harmonic',
    'Synthesizer',
    'Vibration',
    'Melody',
    'Rhythm',
    'Wave',
    'Sequence',
    'Tune',
    'Cadence',
    'Modulation',
    'Symphony',
    'Echo',
    'Arpeggio',
    'Reverb',
    'Oscillation',
    'Feedback',
    'Interval',
    'Spectrum',
    'Overtone',
    'Groove',
    'Tempo',
    'Chord',
    'Octave',
    'Dynamics',
    'Transient',
    'Timbre',
    'Cadence',
    'Acoustic',
  ];

  /**
   * Generates a unique, deterministic thematic lobby name by combining:
   * [Spatial Prefix] + [Tonal Modifier] + [Musical Noun] + [Semantic Version vX.Y.Z]
   *
   * @example "Quasar Dorian Resonance v4.8.12"
   * @returns {string} Formatted thematic lobby name
   */
  public static generateName(): string {
    const spatial =
      this.SPATIAL_PREFIXES[
        Math.floor(Math.random() * this.SPATIAL_PREFIXES.length)
      ];
    const tonal =
      this.TONAL_MODIFIERS[
        Math.floor(Math.random() * this.TONAL_MODIFIERS.length)
      ];
    const musical =
      this.MUSICAL_NOUNS[Math.floor(Math.random() * this.MUSICAL_NOUNS.length)];

    const major = Math.floor(Math.random() * 9) + 1; // 1 - 9
    const minor = Math.floor(Math.random() * 20); // 0 - 19
    const patch = Math.floor(Math.random() * 20); // 0 - 19

    return `${spatial} ${tonal} ${musical} v${major}.${minor}.${patch}`;
  }
}
