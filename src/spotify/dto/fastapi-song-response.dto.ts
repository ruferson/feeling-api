export class FastApiSongResponseDto {
  nodeId: string;
  song: string;
  artist: string;
  isPlaying: boolean;
  animationStyle: string;
  synced: boolean;
  spotifyPlayback?: Record<string, unknown> | null;
}
