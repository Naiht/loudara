package com.loudara.app;

import android.content.Intent;

import androidx.annotation.Nullable;
import androidx.media3.common.Player;
import androidx.media3.session.MediaSession;
import androidx.media3.session.MediaSessionService;

public final class NativePlaybackService extends MediaSessionService {
    @Override
    public void onCreate() {
        super.onCreate();
        NativePlaybackManager.getInstance().initialize(getApplicationContext());
        MediaSession session = NativePlaybackManager.getInstance().getMediaSession();
        if (session != null && !isSessionAdded(session)) {
            addSession(session);
        }
        setShowNotificationForIdlePlayer(SHOW_NOTIFICATION_FOR_IDLE_PLAYER_ALWAYS);
    }

    @Override
    public void onDestroy() {
        NativePlaybackManager.getInstance().release();
        super.onDestroy();
    }

    @Override
    public void onTaskRemoved(@Nullable Intent rootIntent) {
        Player player = NativePlaybackManager.getInstance().getPlayer();
        if (player == null || !player.getPlayWhenReady()) {
            stopSelf();
        }
    }

    @Override
    public MediaSession onGetSession(MediaSession.ControllerInfo controllerInfo) {
        return NativePlaybackManager.getInstance().getMediaSession();
    }
}
