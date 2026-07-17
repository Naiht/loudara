package com.loudara.app;

import android.app.PendingIntent;
import android.os.Bundle;
import android.content.Context;
import android.content.Intent;
import android.net.Uri;

import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.media3.common.AudioAttributes;
import androidx.media3.common.C;
import androidx.media3.common.MediaItem;
import androidx.media3.common.MediaMetadata;
import androidx.media3.common.PlaybackException;
import androidx.media3.common.Player;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.CommandButton;
import androidx.media3.session.MediaSession;
import androidx.media3.session.SessionCommand;
import androidx.media3.session.SessionCommands;
import androidx.media3.session.SessionResult;

import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;

import java.util.Arrays;
import java.util.List;

public final class NativePlaybackManager {
    private static final NativePlaybackManager INSTANCE = new NativePlaybackManager();
    private static final String ACTION_PREVIOUS = "com.loudara.app.action.PREVIOUS";
    private static final String ACTION_NEXT = "com.loudara.app.action.NEXT";
    private static final SessionCommand PREVIOUS_COMMAND = new SessionCommand(ACTION_PREVIOUS, Bundle.EMPTY);
    private static final SessionCommand NEXT_COMMAND = new SessionCommand(ACTION_NEXT, Bundle.EMPTY);

    @Nullable
    private Context appContext;

    @Nullable
    private ExoPlayer player;

    @Nullable
    private MediaSession mediaSession;

    private String lastErrorMessage = "";

    private NativePlaybackManager() {}

    public static NativePlaybackManager getInstance() {
        return INSTANCE;
    }

    public synchronized void initialize(Context context) {
        if (appContext == null) {
            appContext = context.getApplicationContext();
        }

        if (player != null && mediaSession != null) {
            return;
        }

        ExoPlayer exoPlayer = new ExoPlayer.Builder(appContext).build();
        AudioAttributes audioAttributes = new AudioAttributes.Builder()
            .setUsage(C.USAGE_MEDIA)
            .setContentType(C.AUDIO_CONTENT_TYPE_MUSIC)
            .build();

        exoPlayer.setAudioAttributes(audioAttributes, true);
        exoPlayer.addListener(new Player.Listener() {
            @Override
            public void onPlaybackStateChanged(int playbackState) {
                emitState(playbackState == Player.STATE_ENDED);
            }

            @Override
            public void onIsPlayingChanged(boolean isPlaying) {
                emitState(false);
            }

            @Override
            public void onPlaybackParametersChanged(androidx.media3.common.PlaybackParameters playbackParameters) {
                emitState(false);
            }

            @Override
            public void onRepeatModeChanged(int repeatMode) {
                emitState(false);
            }

            @Override
            public void onVolumeChanged(float volume) {
                emitState(false);
            }

            @Override
            public void onPlayerError(PlaybackException error) {
                lastErrorMessage = error.getMessage() == null ? "No fue posible reproducir el audio." : error.getMessage();
                emitState(false);
            }
        });

        PendingIntent sessionActivity = null;
        Intent launchIntent = appContext.getPackageManager().getLaunchIntentForPackage(appContext.getPackageName());
        if (launchIntent != null) {
            launchIntent.addFlags(Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
            sessionActivity = PendingIntent.getActivity(
                appContext,
                1001,
                launchIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
        }

        player = exoPlayer;
        MediaSession.Builder sessionBuilder = new MediaSession.Builder(appContext, exoPlayer);
        if (sessionActivity != null) {
            sessionBuilder.setSessionActivity(sessionActivity);
        }
        List<CommandButton> transportButtons = createTransportButtons();
        sessionBuilder
            .setCallback(new MediaSession.Callback() {
                @Override
                public MediaSession.ConnectionResult onConnect(
                    MediaSession session,
                    MediaSession.ControllerInfo controller
                ) {
                    MediaSession.ConnectionResult defaultResult = MediaSession.Callback.super.onConnect(session, controller);
                    SessionCommands sessionCommands = defaultResult.availableSessionCommands
                        .buildUpon()
                        .add(PREVIOUS_COMMAND)
                        .add(NEXT_COMMAND)
                        .build();

                    return new MediaSession.ConnectionResult.AcceptedResultBuilder(session)
                        .setAvailablePlayerCommands(defaultResult.availablePlayerCommands)
                        .setAvailableSessionCommands(sessionCommands)
                        .setMediaButtonPreferences(transportButtons)
                        .build();
                }

                @Override
                public ListenableFuture<SessionResult> onCustomCommand(
                    MediaSession session,
                    MediaSession.ControllerInfo controller,
                    SessionCommand customCommand,
                    Bundle args
                ) {
                    if (ACTION_PREVIOUS.equals(customCommand.customAction)) {
                        NativePlaybackPlugin.emitTransportControl("previous");
                        return Futures.immediateFuture(new SessionResult(SessionResult.RESULT_SUCCESS));
                    }

                    if (ACTION_NEXT.equals(customCommand.customAction)) {
                        NativePlaybackPlugin.emitTransportControl("next");
                        return Futures.immediateFuture(new SessionResult(SessionResult.RESULT_SUCCESS));
                    }

                    return MediaSession.Callback.super.onCustomCommand(session, controller, customCommand, args);
                }
            })
            .setMediaButtonPreferences(transportButtons);
        mediaSession = sessionBuilder.build();
    }

    public synchronized void startService() {
        if (appContext == null) {
            return;
        }

        Intent intent = new Intent(appContext, NativePlaybackService.class);
        ContextCompat.startForegroundService(appContext, intent);
    }

    public synchronized void prepareTrack(
        String mediaId,
        String url,
        String title,
        String artist,
        @Nullable String artwork,
        double positionSeconds,
        boolean autoplay,
        boolean loop,
        float playbackRate,
        float volume
    ) {
        if (appContext == null) {
            throw new IllegalStateException("NativePlaybackManager is not initialized");
        }

        initialize(appContext);

        if (player == null) {
            throw new IllegalStateException("Player is not available");
        }

        MediaMetadata.Builder metadataBuilder = new MediaMetadata.Builder()
            .setTitle(title)
            .setArtist(artist);

        if (artwork != null && !artwork.isEmpty()) {
            metadataBuilder.setArtworkUri(Uri.parse(artwork));
        }

        MediaItem mediaItem = new MediaItem.Builder()
            .setMediaId(mediaId)
            .setUri(url)
            .setMediaMetadata(metadataBuilder.build())
            .build();

        lastErrorMessage = "";
        player.setRepeatMode(loop ? Player.REPEAT_MODE_ONE : Player.REPEAT_MODE_OFF);
        player.setPlaybackSpeed(playbackRate);
        player.setVolume(volume);
        player.setMediaItem(mediaItem);
        if (positionSeconds > 0) {
            player.seekTo((long) (positionSeconds * 1000));
        }
        player.setPlayWhenReady(autoplay);
        player.prepare();
        emitState(false);
    }

    public synchronized PlaybackSnapshot play() {
        if (player != null) {
            lastErrorMessage = "";
            player.play();
        }
        return getSnapshot(false);
    }

    public synchronized PlaybackSnapshot pause() {
        if (player != null) {
            player.pause();
        }
        return getSnapshot(false);
    }

    public synchronized PlaybackSnapshot stop() {
        if (player != null) {
            player.stop();
        }
        return getSnapshot(false);
    }

    public synchronized PlaybackSnapshot seekTo(double positionSeconds) {
        if (player != null) {
            player.seekTo((long) (Math.max(0, positionSeconds) * 1000));
        }
        return getSnapshot(false);
    }

    public synchronized PlaybackSnapshot setVolume(float volume) {
        if (player != null) {
            player.setVolume(Math.max(0f, Math.min(1f, volume)));
        }
        return getSnapshot(false);
    }

    public synchronized PlaybackSnapshot setPlaybackRate(float playbackRate) {
        if (player != null) {
            player.setPlaybackSpeed(Math.max(0.25f, playbackRate));
        }
        return getSnapshot(false);
    }

    public synchronized PlaybackSnapshot setLoop(boolean loop) {
        if (player != null) {
            player.setRepeatMode(loop ? Player.REPEAT_MODE_ONE : Player.REPEAT_MODE_OFF);
        }
        return getSnapshot(false);
    }

    public synchronized PlaybackSnapshot getSnapshot(boolean ended) {
        if (player == null) {
            return PlaybackSnapshot.empty();
        }

        long rawDuration = player.getDuration();
        long rawPosition = player.getCurrentPosition();

        double duration = rawDuration == C.TIME_UNSET ? 0d : Math.max(0d, rawDuration / 1000d);
        double currentTime = Math.max(0d, rawPosition / 1000d);
        boolean loop = player.getRepeatMode() == Player.REPEAT_MODE_ONE;

        return new PlaybackSnapshot(
            mapPlaybackState(player, ended),
            currentTime,
            duration,
            player.getVolume(),
            player.getPlaybackParameters().speed,
            loop,
            ended,
            lastErrorMessage
        );
    }

    @Nullable
    public synchronized MediaSession getMediaSession() {
        return mediaSession;
    }

    @Nullable
    public synchronized Player getPlayer() {
        return player;
    }

    public synchronized void release() {
        if (mediaSession != null) {
            mediaSession.release();
            mediaSession = null;
        }

        if (player != null) {
            player.release();
            player = null;
        }

        lastErrorMessage = "";
    }

    private synchronized void emitState(boolean ended) {
        NativePlaybackPlugin.emitPlaybackState(getSnapshot(ended));
    }

    private List<CommandButton> createTransportButtons() {
        return Arrays.asList(
            new CommandButton.Builder(CommandButton.ICON_PREVIOUS)
                .setDisplayName("Anterior")
                .setSessionCommand(PREVIOUS_COMMAND)
                .setSlots(new int[] { CommandButton.SLOT_BACK })
                .build(),
            new CommandButton.Builder(CommandButton.ICON_NEXT)
                .setDisplayName("Siguiente")
                .setSessionCommand(NEXT_COMMAND)
                .setSlots(new int[] { CommandButton.SLOT_FORWARD })
                .build()
        );
    }

    private String mapPlaybackState(Player currentPlayer, boolean ended) {
        if (ended || currentPlayer.getPlaybackState() == Player.STATE_ENDED) {
            return "none";
        }

        if (currentPlayer.getPlaybackState() == Player.STATE_BUFFERING) {
            return "loading";
        }

        if (currentPlayer.isPlaying()) {
            return "playing";
        }

        if (currentPlayer.getPlaybackState() == Player.STATE_READY) {
            return "paused";
        }

        return "none";
    }

    public static final class PlaybackSnapshot {
        public final String playbackState;
        public final double currentTime;
        public final double duration;
        public final double volume;
        public final double playbackRate;
        public final boolean loop;
        public final boolean ended;
        public final String error;

        public PlaybackSnapshot(
            String playbackState,
            double currentTime,
            double duration,
            double volume,
            double playbackRate,
            boolean loop,
            boolean ended,
            String error
        ) {
            this.playbackState = playbackState;
            this.currentTime = currentTime;
            this.duration = duration;
            this.volume = volume;
            this.playbackRate = playbackRate;
            this.loop = loop;
            this.ended = ended;
            this.error = error;
        }

        public static PlaybackSnapshot empty() {
            return new PlaybackSnapshot("none", 0d, 0d, 1d, 1d, false, false, "");
        }
    }
}
