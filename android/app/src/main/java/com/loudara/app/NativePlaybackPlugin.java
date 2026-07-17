package com.loudara.app;

import android.Manifest;

import androidx.annotation.Nullable;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;

@CapacitorPlugin(
    name = "NativePlayback",
    permissions = {
        @Permission(alias = "notifications", strings = { Manifest.permission.POST_NOTIFICATIONS })
    }
)
public final class NativePlaybackPlugin extends Plugin {
    private interface MainThreadCall {
        JSObject run() throws Exception;
    }

    @Nullable
    private static NativePlaybackPlugin instance;

    @Override
    public void load() {
        instance = this;
        NativePlaybackManager.getInstance().initialize(getContext().getApplicationContext());
    }

    @Override
    protected void handleOnDestroy() {
        if (instance == this) {
            instance = null;
        }
    }

    @PluginMethod
    public void prepareTrack(PluginCall call) {
        runOnMainThread(call, () -> {
            String id = call.getString("id");
            String url = call.getString("url");
            String title = call.getString("title");
            String artist = call.getString("artist");

            if (id == null || url == null || title == null || artist == null) {
                throw new IllegalArgumentException("Missing playback payload.");
            }

            NativePlaybackManager manager = NativePlaybackManager.getInstance();
            manager.initialize(getContext().getApplicationContext());
            manager.startService();

            float playbackRate = call.getDouble("playbackRate", 1d).floatValue();
            float volume = call.getDouble("volume", 1d).floatValue();
            manager.prepareTrack(
                id,
                url,
                title,
                artist,
                call.getString("artwork"),
                call.getDouble("position", 0d),
                call.getBoolean("autoplay", true),
                call.getBoolean("loop", false),
                playbackRate,
                volume
            );
            return toJSObject(manager.getSnapshot(false));
        });
    }

    @PluginMethod
    public void play(PluginCall call) {
        runOnMainThread(call, () -> toJSObject(NativePlaybackManager.getInstance().play()));
    }

    @PluginMethod
    public void pause(PluginCall call) {
        runOnMainThread(call, () -> toJSObject(NativePlaybackManager.getInstance().pause()));
    }

    @PluginMethod
    public void stop(PluginCall call) {
        runOnMainThread(call, () -> toJSObject(NativePlaybackManager.getInstance().stop()));
    }

    @PluginMethod
    public void seekTo(PluginCall call) {
        runOnMainThread(call, () -> toJSObject(NativePlaybackManager.getInstance().seekTo(call.getDouble("position", 0d))));
    }

    @PluginMethod
    public void setVolume(PluginCall call) {
        runOnMainThread(call, () -> toJSObject(NativePlaybackManager.getInstance().setVolume(call.getDouble("volume", 1d).floatValue())));
    }

    @PluginMethod
    public void setPlaybackRate(PluginCall call) {
        runOnMainThread(call, () -> toJSObject(NativePlaybackManager.getInstance().setPlaybackRate(call.getDouble("playbackRate", 1d).floatValue())));
    }

    @PluginMethod
    public void setLoop(PluginCall call) {
        runOnMainThread(call, () -> toJSObject(NativePlaybackManager.getInstance().setLoop(call.getBoolean("loop", false))));
    }

    @PluginMethod
    public void getState(PluginCall call) {
        runOnMainThread(call, () -> toJSObject(NativePlaybackManager.getInstance().getSnapshot(false)));
    }

    static void emitPlaybackState(NativePlaybackManager.PlaybackSnapshot snapshot) {
        NativePlaybackPlugin plugin = instance;
        if (plugin == null) {
            return;
        }

        plugin.notifyListeners("playbackStateChange", toJSObject(snapshot), true);
    }

    static void emitTransportControl(String action) {
        NativePlaybackPlugin plugin = instance;
        if (plugin == null) {
            return;
        }

        JSObject data = new JSObject();
        data.put("action", action);
        plugin.notifyListeners("transportControl", data, true);
    }

    private static JSObject toJSObject(NativePlaybackManager.PlaybackSnapshot snapshot) {
        JSObject data = new JSObject();
        data.put("playbackState", snapshot.playbackState);
        data.put("currentTime", snapshot.currentTime);
        data.put("duration", snapshot.duration);
        data.put("volume", snapshot.volume);
        data.put("playbackRate", snapshot.playbackRate);
        data.put("loop", snapshot.loop);
        data.put("ended", snapshot.ended);
        data.put("error", snapshot.error);
        return data;
    }

    private void runOnMainThread(PluginCall call, MainThreadCall action) {
        getActivity().runOnUiThread(() -> {
            try {
                call.resolve(action.run());
            } catch (Exception error) {
                call.reject(error.getMessage(), error);
            }
        });
    }
}
