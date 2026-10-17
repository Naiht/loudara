package com.loudara.app;

import androidx.media3.common.ForwardingSimpleBasePlayer;
import androidx.media3.common.Player;
import androidx.media3.common.util.UnstableApi;

import com.google.common.util.concurrent.Futures;
import com.google.common.util.concurrent.ListenableFuture;

/** Maps standard media-session skip commands to the queue maintained by the app. */
@UnstableApi
final class QueueTransportPlayer extends ForwardingSimpleBasePlayer {
    interface TransportListener {
        void onTransport(String action);
    }

    private final TransportListener listener;

    QueueTransportPlayer(Player player, TransportListener listener) {
        super(player);
        this.listener = listener;
    }

    @Override
    protected State getState() {
        State state = super.getState();
        Player.Commands commands = state.availableCommands.buildUpon()
            .add(Player.COMMAND_SEEK_TO_PREVIOUS)
            .add(Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM)
            .add(Player.COMMAND_SEEK_TO_NEXT)
            .add(Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM)
            .build();
        return state.buildUpon().setAvailableCommands(commands).build();
    }

    @Override
    protected ListenableFuture<?> handleSeek(int mediaItemIndex, long positionMs, int seekCommand) {
        if (seekCommand == Player.COMMAND_SEEK_TO_PREVIOUS || seekCommand == Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM) {
            listener.onTransport("previous");
            return Futures.immediateVoidFuture();
        }
        if (seekCommand == Player.COMMAND_SEEK_TO_NEXT || seekCommand == Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM) {
            listener.onTransport("next");
            return Futures.immediateVoidFuture();
        }
        return super.handleSeek(mediaItemIndex, positionMs, seekCommand);
    }
}
