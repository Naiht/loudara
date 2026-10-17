package com.loudara.app;

import android.Manifest;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Context;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;

import com.arthenica.ffmpegkit.FFmpegKit;
import com.arthenica.ffmpegkit.FFmpegSession;
import com.arthenica.ffmpegkit.ReturnCode;
import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;

import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

@CapacitorPlugin(name = "NativeDownload", permissions = {
    @Permission(alias = "storage", strings = { Manifest.permission.WRITE_EXTERNAL_STORAGE })
})
public final class NativeDownloadPlugin extends Plugin {
    private static final long CHUNK_SIZE = 1024 * 1024;
    private static final Pattern CONTENT_RANGE = Pattern.compile("bytes\\s+(\\d+)-(\\d+)/(\\d+)", Pattern.CASE_INSENSITIVE);
    private static final String USER_AGENT = "Mozilla/5.0 (Linux; Android 14; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";
    private final ExecutorService executor = Executors.newSingleThreadExecutor();

    @PluginMethod
    public void download(PluginCall call) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q && getPermissionState("storage") != PermissionState.GRANTED) {
            requestPermissionForAlias("storage", call, "storagePermissionResult");
            return;
        }
        startDownload(call);
    }

    @PermissionCallback
    private void storagePermissionResult(PluginCall call) {
        if (getPermissionState("storage") != PermissionState.GRANTED) {
            call.reject("Se necesita permiso de almacenamiento para guardar la descarga.");
            return;
        }
        startDownload(call);
    }

    private void startDownload(PluginCall call) {
        String url = call.getString("url", "");
        String title = call.getString("title", "").trim();
        String artist = call.getString("artist", "").trim();
        if (url.isEmpty() || title.isEmpty()) {
            call.reject("Faltan datos para descargar la canción.");
            return;
        }

        executor.execute(() -> {
            File input = null;
            File output = null;
            try {
                input = File.createTempFile("loudara-source-", ".audio", getContext().getCacheDir());
                output = File.createTempFile("loudara-mp3-", ".mp3", getContext().getCacheDir());
                downloadSource(url, input);

                convertToMp3(input, output, title, artist);

                String filename = safeFilename(title) + ".mp3";
                saveToDownloads(getContext(), output, filename);
                JSObject result = new JSObject();
                result.put("folder", "Download/Loudara");
                call.resolve(result);
            } catch (Exception | LinkageError error) {
                call.reject("No se pudo descargar la canción: " + error.getMessage());
            } finally {
                if (input != null) input.delete();
                if (output != null) output.delete();
            }
        });
    }

    static void convertToMp3(File input, File output, String title, String artist) throws IOException {
        FFmpegSession session = FFmpegKit.executeWithArguments(new String[] {
            "-y", "-v", "error", "-i", input.getAbsolutePath(), "-map", "0:a:0", "-vn",
            "-c:a", "libmp3lame", "-b:a", "192k", "-metadata", "title=" + title,
            "-metadata", "artist=" + artist, "-f", "mp3", output.getAbsolutePath()
        });
        if (!ReturnCode.isSuccess(session.getReturnCode()) || output.length() == 0) {
            throw new IOException("No se pudo convertir la canción a MP3.");
        }
    }

    static String safeFilename(String title) {
        String name = title.replaceAll("[\\\\/:*?\"<>|\\p{Cntrl}]", "-").trim();
        if (name.length() > 120) name = name.substring(0, 120).trim();
        return name.isEmpty() || name.equals(".") || name.equals("..") ? "Loudara" : name;
    }

    static void downloadSource(String address, File destination) throws IOException {
        URL url = new URL(address);
        if (!url.getProtocol().equals("http") && !url.getProtocol().equals("https")) {
            throw new IOException("Dirección de audio no válida.");
        }

        long offset = 0;
        long total = -1;
        try (OutputStream output = new FileOutputStream(destination)) {
            do {
                HttpURLConnection connection = (HttpURLConnection) url.openConnection();
                connection.setConnectTimeout(20_000);
                connection.setReadTimeout(60_000);
                connection.setRequestProperty("User-Agent", USER_AGENT);
                connection.setRequestProperty("Accept", "*/*");
                connection.setRequestProperty("Accept-Encoding", "identity");
                connection.setRequestProperty("Range", "bytes=" + offset + "-" + (offset + CHUNK_SIZE - 1));
                try {
                    int status = connection.getResponseCode();
                    long expected = -1;
                    if (status == HttpURLConnection.HTTP_PARTIAL) {
                        String header = connection.getHeaderField("Content-Range");
                        Matcher range = CONTENT_RANGE.matcher(header == null ? "" : header);
                        if (!range.matches()) throw new IOException("La respuesta de audio está incompleta.");
                        long start = Long.parseLong(range.group(1));
                        long end = Long.parseLong(range.group(2));
                        long nextTotal = Long.parseLong(range.group(3));
                        if (start != offset || end < start || end >= nextTotal || (total != -1 && total != nextTotal)) {
                            throw new IOException("La respuesta de audio tiene un rango inválido.");
                        }
                        total = nextTotal;
                        expected = end - start + 1;
                    } else if (status == HttpURLConnection.HTTP_OK && offset == 0) {
                        total = connection.getContentLengthLong();
                        expected = total;
                    } else {
                        throw new IOException("El servidor de audio respondió con HTTP " + status + ".");
                    }

                    long count = 0;
                    try (InputStream stream = connection.getInputStream()) {
                        byte[] buffer = new byte[64 * 1024];
                        int read;
                        while ((read = stream.read(buffer)) != -1) {
                            output.write(buffer, 0, read);
                            count += read;
                        }
                    }
                    if (count == 0 || (expected >= 0 && count != expected)) {
                        throw new IOException("La descarga de audio quedó incompleta.");
                    }
                    offset += count;
                    if (status == HttpURLConnection.HTTP_OK && total < 0) total = offset;
                } finally {
                    connection.disconnect();
                }
            } while (offset < total);
        }
    }

    static Uri saveToDownloads(Context context, File source, String filename) throws IOException {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            ContentResolver resolver = context.getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, filename);
            values.put(MediaStore.MediaColumns.MIME_TYPE, "audio/mpeg");
            values.put(MediaStore.MediaColumns.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS + "/Loudara");
            values.put(MediaStore.MediaColumns.IS_PENDING, 1);
            Uri destination = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
            if (destination == null) throw new IOException("No se pudo crear el archivo en Descargas.");
            boolean success = false;
            try {
                try (InputStream input = new FileInputStream(source); OutputStream output = resolver.openOutputStream(destination)) {
                    if (output == null) throw new IOException("No se pudo abrir el archivo de descarga.");
                    copy(input, output);
                }
                values.clear();
                values.put(MediaStore.MediaColumns.IS_PENDING, 0);
                if (resolver.update(destination, values, null, null) != 1) throw new IOException("No se pudo finalizar la descarga.");
                success = true;
                return destination;
            } finally {
                if (!success) resolver.delete(destination, null, null);
            }
        } else {
            File folder = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS), "Loudara");
            if (!folder.isDirectory() && !folder.mkdirs()) throw new IOException("No se pudo crear la carpeta Loudara.");
            File destination = new File(folder, filename);
            int suffix = 1;
            while (destination.exists()) {
                destination = new File(folder, filename.substring(0, filename.length() - 4) + " (" + suffix++ + ").mp3");
            }
            try (InputStream input = new FileInputStream(source); OutputStream output = new FileOutputStream(destination)) {
                copy(input, output);
            } catch (IOException error) {
                destination.delete();
                throw error;
            }
            MediaScannerConnection.scanFile(context, new String[] { destination.getAbsolutePath() }, new String[] { "audio/mpeg" }, null);
            return Uri.fromFile(destination);
        }
    }

    private static void copy(InputStream input, OutputStream output) throws IOException {
        byte[] buffer = new byte[64 * 1024];
        int read;
        while ((read = input.read(buffer)) != -1) output.write(buffer, 0, read);
    }
}
