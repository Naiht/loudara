export interface AudioStream {
  url: string;
  mimeType: string;
  itag?: number;
  bitrate?: number;
  quality?: string;
}

export interface CaptionTrack {
  url: string;
  label: string;
  languageCode: string;
}

export interface RecommendedStream {
  videoId: string;
  title: string;
  author: string;
  authorId: string;
  duration: number;
}

export interface StreamData {
  videoId: string;
  title?: string;
  author?: string;
  authorId?: string;
  duration?: number;
  streams: AudioStream[];
  videoStreams?: AudioStream[];
  captions?: CaptionTrack[];
  recommended?: RecommendedStream[];
  source?: string;
  proxy?: string;
}

export type StreamAttempt = {
  provider: string;
  message: string;
  status?: number;
};
