export class FastApiSongResponseDto {
  nodeId: string;
  song: string;
  artist: string;
  isPlaying: boolean;
  synced: boolean;
  spotifyPlayback?: Record<string, unknown> | null;
}
