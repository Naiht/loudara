package com.loudara.app;

import static org.junit.Assert.assertArrayEquals;
import static org.junit.Assert.assertEquals;
import static org.junit.Assert.assertThrows;

import org.junit.Test;

import java.io.BufferedReader;
import java.io.File;
import java.io.IOException;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.ServerSocket;
import java.net.Socket;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.util.Arrays;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

public class NativeDownloadPluginTest {
    @Test
    public void downloadsAllRangesWithoutTruncation() throws Exception {
        byte[] source = new byte[1024 * 1024 + 111];
        for (int i = 0; i < source.length; i++) source[i] = (byte) (i % 251);
        AtomicInteger requests = new AtomicInteger();
        try (TestServer server = new TestServer((rangeHeader, output) -> {
            requests.incrementAndGet();
            Matcher range = Pattern.compile("bytes=(\\d+)-(\\d+)").matcher(rangeHeader);
            if (!range.matches()) throw new IOException("Missing Range");
            int start = Integer.parseInt(range.group(1));
            int end = Math.min(Integer.parseInt(range.group(2)), source.length - 1);
            byte[] chunk = Arrays.copyOfRange(source, start, end + 1);
            respond(output, "bytes " + start + "-" + end + "/" + source.length, chunk);
        })) {
            File output = File.createTempFile("loudara-test-", ".audio");
            try {
                NativeDownloadPlugin.downloadSource(server.url(), output);
                assertArrayEquals(source, Files.readAllBytes(output.toPath()));
                assertEquals(2, requests.get());
            } finally {
                output.delete();
            }
        }
    }

    @Test
    public void rejectsInvalidRangesAndSanitizesFilename() throws Exception {
        try (TestServer server = new TestServer((range, output) ->
            respond(output, "bytes 10-12/20", new byte[] { 1, 2, 3 }))) {
            File output = File.createTempFile("loudara-test-", ".audio");
            try {
                assertThrows(IOException.class, () -> NativeDownloadPlugin.downloadSource(server.url(), output));
                assertEquals("Un - título - canción", NativeDownloadPlugin.safeFilename("Un / título : canción"));
            } finally {
                output.delete();
            }
        }
    }

    private static void respond(OutputStream output, String contentRange, byte[] bytes) throws IOException {
        String headers = "HTTP/1.1 206 Partial Content\r\nContent-Range: " + contentRange
            + "\r\nContent-Length: " + bytes.length + "\r\nConnection: close\r\n\r\n";
        output.write(headers.getBytes(StandardCharsets.US_ASCII));
        output.write(bytes);
    }

    private interface ResponseHandler {
        void respond(String range, OutputStream output) throws IOException;
    }

    private static final class TestServer implements AutoCloseable {
        private final ServerSocket server;
        private final Thread worker;

        TestServer(ResponseHandler handler) throws IOException {
            server = new ServerSocket(0);
            worker = new Thread(() -> {
                while (!server.isClosed()) {
                    try (Socket client = server.accept()) {
                        BufferedReader input = new BufferedReader(new InputStreamReader(client.getInputStream(), StandardCharsets.US_ASCII));
                        String range = "";
                        String line;
                        while ((line = input.readLine()) != null && !line.isEmpty()) {
                            if (line.regionMatches(true, 0, "Range:", 0, 6)) range = line.substring(6).trim();
                        }
                        handler.respond(range, client.getOutputStream());
                    } catch (IOException error) {
                        if (!server.isClosed()) throw new RuntimeException(error);
                    }
                }
            });
            worker.start();
        }

        String url() { return "http://127.0.0.1:" + server.getLocalPort() + "/audio"; }

        @Override
        public void close() throws Exception {
            server.close();
            worker.join();
        }
    }
}
