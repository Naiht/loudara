package com.loudara.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertFalse;
import static org.junit.Assert.assertTrue;

import android.content.Context;

import androidx.media3.common.MediaItem;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;
import androidx.media3.exoplayer.ExoPlayer;
import androidx.media3.session.MediaController;
import androidx.media3.session.MediaSession;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import com.google.common.util.concurrent.ListenableFuture;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicReference;

@UnstableApi
@RunWith(AndroidJUnit4.class)
public class QueueTransportInstrumentedTest {
    @Test
    public void standardSessionControlsReachTheAppQueueAndPlayer() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        CopyOnWriteArrayList<String> actions = new CopyOnWriteArrayList<>();
        AtomicReference<ExoPlayer> playerRef = new AtomicReference<>();
        AtomicReference<MediaSession> sessionRef = new AtomicReference<>();
        AtomicReference<ListenableFuture<MediaController>> futureRef = new AtomicReference<>();
        InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
            ExoPlayer player = new ExoPlayer.Builder(context).build();
            player.setMediaItem(MediaItem.fromUri("https://example.invalid/track.mp3"));
            player.setPlayWhenReady(true);
            MediaSession session = new MediaSession.Builder(context,
                new QueueTransportPlayer(player, actions::add)).setId("transport-test").build();
            playerRef.set(player);
            sessionRef.set(session);
            futureRef.set(new MediaController.Builder(context, session.getToken()).buildAsync());
        });
        MediaController controller = futureRef.get().get(10, TimeUnit.SECONDS);
        try {
            InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
                assertTrue(controller.isCommandAvailable(Player.COMMAND_SEEK_TO_NEXT));
                assertTrue(controller.isCommandAvailable(Player.COMMAND_SEEK_TO_PREVIOUS));
                controller.seekToNext();
                controller.seekToPrevious();
                controller.pause();
            });
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
                assertEquals(2, actions.size());
                assertEquals("next", actions.get(0));
                assertEquals("previous", actions.get(1));
                assertFalse(playerRef.get().getPlayWhenReady());
                controller.play();
            });
            InstrumentationRegistry.getInstrumentation().waitForIdleSync();
            InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> assertTrue(playerRef.get().getPlayWhenReady()));
        } finally {
            InstrumentationRegistry.getInstrumentation().runOnMainSync(() -> {
                controller.release();
                sessionRef.get().release();
                playerRef.get().release();
            });
        }
    }
}
