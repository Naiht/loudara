import {
  getYoutubeStream,
  isYoutubeBotChallenge,
  isYoutubeSessionConfigurationError,
  type YoutubeSessionConfig
} from './getYoutubeStream.js';

type StreamResult = {
  data?: unknown;
  attempts: Array<{
    provider: string;
    message: string;
    status?: number;
  }>;
};

function isValidVideoId(videoId: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(videoId);
}

export async function getStream(
  videoId: string,
  session: YoutubeSessionConfig = {}
): Promise<StreamResult> {
  const attempts: StreamResult['attempts'] = [];

  if (!isValidVideoId(videoId)) {
    return {
      attempts: [{
        provider: 'validation',
        message: 'Invalid video id'
      }]
    };
  }

  try {
    const data = await getYoutubeStream(videoId, { session });
    return { data, attempts };
  } catch (error) {
    const isBotChallenge = isYoutubeBotChallenge(error);
    const isConfigurationError = isYoutubeSessionConfigurationError(error);
    attempts.push({
      provider: isBotChallenge
        ? 'youtubei:bot-challenge'
        : isConfigurationError
          ? 'youtubei:configuration'
          : 'youtubei',
      message: error instanceof Error ? error.message : String(error)
    });
  }

  return { attempts };
}
