package com.loudara.app;

import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertTrue;

import android.content.Context;
import android.database.Cursor;
import android.media.MediaExtractor;
import android.media.MediaFormat;
import android.net.Uri;
import android.os.Build;
import android.provider.MediaStore;

import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;

import org.junit.Test;
import org.junit.runner.RunWith;

import java.io.File;
import java.io.FileOutputStream;
import java.nio.ByteBuffer;
import java.nio.ByteOrder;
import java.util.UUID;

@RunWith(AndroidJUnit4.class)
public class NativeDownloadInstrumentedTest {
    @Test
    public void convertsAudioToMp3AndSavesInLoudaraDownloads() throws Exception {
        Context context = InstrumentationRegistry.getInstrumentation().getTargetContext();
        File input = File.createTempFile("loudara-test-", ".wav", context.getCacheDir());
        File output = File.createTempFile("loudara-test-", ".mp3", context.getCacheDir());
        Uri saved = null;
        try {
            writeWav(input);
            NativeDownloadPlugin.convertToMp3(input, output, "Prueba", "Loudara");
            assertTrue(output.length() > 0);
            saved = NativeDownloadPlugin.saveToDownloads(context, output, "loudara-test-" + UUID.randomUUID() + ".mp3");

            MediaExtractor extractor = new MediaExtractor();
            try {
                extractor.setDataSource(context, saved, null);
                assertTrue(extractor.getTrackCount() > 0);
                assertEquals("audio/mpeg", extractor.getTrackFormat(0).getString(MediaFormat.KEY_MIME));
            } finally {
                extractor.release();
            }

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                try (Cursor cursor = context.getContentResolver().query(saved,
                    new String[] { MediaStore.MediaColumns.RELATIVE_PATH, MediaStore.MediaColumns.IS_PENDING }, null, null, null)) {
                    assertTrue(cursor != null && cursor.moveToFirst());
                    assertEquals("Download/Loudara/", cursor.getString(0));
                    assertEquals(0, cursor.getInt(1));
                }
            }
        } finally {
            if (saved != null) {
                if ("file".equals(saved.getScheme())) new File(saved.getPath()).delete();
                else context.getContentResolver().delete(saved, null, null);
            }
            input.delete();
            output.delete();
        }
    }

    private static void writeWav(File file) throws Exception {
        int sampleRate = 44_100;
        int dataSize = sampleRate * 2;
        ByteBuffer wav = ByteBuffer.allocate(44 + dataSize).order(ByteOrder.LITTLE_ENDIAN);
        wav.put(new byte[] { 'R', 'I', 'F', 'F' }).putInt(36 + dataSize);
        wav.put(new byte[] { 'W', 'A', 'V', 'E', 'f', 'm', 't', ' ' }).putInt(16);
        wav.putShort((short) 1).putShort((short) 1).putInt(sampleRate).putInt(sampleRate * 2);
        wav.putShort((short) 2).putShort((short) 16);
        wav.put(new byte[] { 'd', 'a', 't', 'a' }).putInt(dataSize);
        for (int i = 0; i < sampleRate; i++) wav.putShort((short) (Math.sin(2 * Math.PI * 440 * i / sampleRate) * 10_000));
        try (FileOutputStream stream = new FileOutputStream(file)) {
            stream.write(wav.array());
        }
    }
}
