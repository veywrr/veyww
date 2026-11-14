package local.personal.music.android;

import android.content.Context;
import android.content.SharedPreferences;
import android.net.Uri;
import android.util.AtomicFile;
import org.json.JSONArray;
import org.json.JSONObject;
import java.io.*;
import java.net.*;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.text.Normalizer;
import java.util.*;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Keeps complete, unprotected tracks in app-private storage. */
final class AndroidOfflineLibrary {
    private static final String ORIGIN = "https://veyww.space";
    private static final long TRACK_LIMIT = 128L * 1024 * 1024;
    private static final long LIBRARY_LIMIT = 1024L * 1024 * 1024;
    private static final Pattern ATTRIBUTE = Pattern.compile("URI=\"([^\"]+)\"");
    private final Context context;
    private final File root;
    private final SharedPreferences preferences;

    AndroidOfflineLibrary(Context context) {
        this.context = context.getApplicationContext();
        root = new File(context.getFilesDir(), "offline-tracks");
        preferences = context.getSharedPreferences("offline-downloads", Context.MODE_PRIVATE);
    }

    synchronized JSONArray list(String owner) throws Exception {
        JSONArray result = new JSONArray();
        File[] directories = root.listFiles();
        if (directories == null || owner.isEmpty()) return result;
        for (File folder : directories) {
            if (!folder.getName().matches("[a-f0-9-]{36}")) continue;
            AtomicFile metadata = new AtomicFile(new File(folder, "track.json"));
            if (!metadata.getBaseFile().isFile()) continue;
            try {
                JSONObject entry = new JSONObject(new String(metadata.readFully(), StandardCharsets.UTF_8));
                if (owner.equals(entry.optString("owner"))) {
                    File audio = new File(folder, entry.optBoolean("hls") ? "index.m3u8" : "audio");
                    if (audio.isFile()) {
                        result.put(entry.put("url", Uri.fromFile(audio).toString())
                                .put("offline", true).put("offlineKey", folder.getName()));
                    }
                }
            } catch (IOException | org.json.JSONException ignored) { }
        }
        return result;
    }

    synchronized void remove(String owner, String key) throws Exception {
        JSONArray tracks = list(owner);
        for (int i = 0; i < tracks.length(); i++) {
            if (key.equals(tracks.getJSONObject(i).optString("offlineKey"))) {
                removeFiles(new File(root, key));
                return;
            }
        }
    }

    boolean waveEnabled(String owner) {
        return preferences.getBoolean("wave:" + owner, false);
    }

    void setWaveEnabled(String owner, boolean enabled) {
        if (!owner.isEmpty()) preferences.edit().putBoolean("wave:" + owner, enabled).apply();
    }

    synchronized void recordWave(JSONObject track, String owner) throws Exception {
        if (owner.isEmpty() || !waveEnabled(owner) || !canSave(track)) return;
        String title = Normalizer.normalize(track.optString("title").replaceFirst("^.+?\\s+[–—-]\\s+", ""), Normalizer.Form.NFKC)
                .toLowerCase(Locale.ROOT).replaceAll("[^\\p{L}\\p{N}]+", " ").trim();
        if (title.isEmpty() || title.length() > 300) return;
        JSONArray tracks = list(owner);
        for (int i = 0; i < tracks.length(); i++)
            if (title.equals(tracks.getJSONObject(i).optString("waveTitle"))) return;
        String countKey = "heard:" + owner + ":" + title;
        int count = Math.min(2, preferences.getInt(countKey, 0) + 1);
        preferences.edit().putInt(countKey, count).apply();
        if (count < 2 || track.optDouble("duration", 0) <= 0) return;
        save(track, owner, title);
    }

    static boolean isSavedAudio(Context context, String uri) {
        try {
            Uri parsed = Uri.parse(uri);
            if (!"file".equals(parsed.getScheme()) || (parsed.getAuthority() != null && !parsed.getAuthority().isEmpty())) return false;
            File audio = new File(parsed.getPath()).getCanonicalFile();
            File folder = audio.getParentFile();
            File root = new File(context.getFilesDir(), "offline-tracks").getCanonicalFile();
            return folder != null && root.equals(folder.getParentFile())
                    && folder.getName().matches("[a-f0-9-]{36}")
                    && ("audio".equals(audio.getName()) || "index.m3u8".equals(audio.getName()))
                    && new File(folder, "track.json").isFile() && audio.isFile();
        } catch (IOException | RuntimeException error) {
            return false;
        }
    }

    static boolean canSave(JSONObject track) {
        if (track == null || !"SoundCloud".equals(track.optString("source"))) return false;
        return track.optString("page").matches("https://(?:www\\.)?soundcloud\\.com/[^/?#]+/[^?#]+(?:\\?[^#]*)?");
    }

    synchronized void save(JSONObject track, String owner, String waveTitle) throws Exception {
        if (owner.isEmpty() || !canSave(track)) throw new IOException("Этот трек нельзя сохранить офлайн");
        JSONArray tracks = list(owner);
        double usedSeconds = 0;
        for (int i = 0; i < tracks.length(); i++) {
            JSONObject item = tracks.getJSONObject(i);
            if (item.optString("id").equals(track.optString("id"))) return;
            if (item.has("waveTitle")) usedSeconds += item.optDouble("duration", 0);
        }
        if (waveTitle != null && usedSeconds + track.optDouble("duration", 0) > 14400) return;
        String cookie = ServerCatalog.sessionCookie();
        if (cookie.isEmpty()) throw new IOException("Войди в аккаунт, чтобы сохранить трек");
        JSONObject resolved = ServerCatalog.call(context, "resolve", track.getString("page"), 0).getJSONObject("data");
        double duration = resolved.optDouble("duration", track.optDouble("duration", 0));
        if (waveTitle != null && (duration <= 0 || usedSeconds + duration > 14400)) return;
        boolean hls = resolved.optBoolean("hls");
        URL audio = safe(new URL(new URL(ORIGIN), resolved.getString("url")));
        long limit = Math.min(TRACK_LIMIT, LIBRARY_LIMIT - bytesOnDisk(root));
        if (limit <= 0) throw new IOException("Достигнут лимит скачиваний 1 ГБ");
        if (!root.exists() && !root.mkdirs()) throw new IOException("Нет доступа к хранилищу");
        File folder = new File(root, UUID.randomUUID().toString());
        if (!folder.mkdir()) throw new IOException("Не удалось создать папку трека");
        try {
            Download download = new Download(cookie, limit);
            if (hls) download.hls(audio, folder);
            else try (OutputStream destination = new FileOutputStream(new File(folder, "audio"))) {
                download.copy(audio, destination, limit);
            }
            JSONObject metadata = new JSONObject().put("id", track.getString("id"))
                    .put("title", track.optString("title")).put("artist", track.optString("artist"))
                    .put("owner", owner).put("hls", hls).put("duration", duration);
            if (waveTitle != null) metadata.put("waveTitle", waveTitle);
            AtomicFile index = new AtomicFile(new File(folder, "track.json"));
            FileOutputStream output = index.startWrite();
            try {
                output.write(metadata.toString().getBytes(StandardCharsets.UTF_8));
                index.finishWrite(output);
            } catch (IOException error) {
                index.failWrite(output);
                throw error;
            }
        } catch (Exception exception) {
            removeFiles(folder);
            throw exception;
        }
    }

    private static URL safe(URL url) throws IOException {
        String host = url.getHost().toLowerCase(Locale.ROOT);
        boolean supported = MediaProxyAuth.isProxy(url.toString()) || host.equals("sndcdn.com")
                || host.endsWith(".sndcdn.com") || host.equals("soundcloud.cloud") || host.endsWith(".soundcloud.cloud");
        if (!"https".equals(url.getProtocol()) || url.getUserInfo() != null ||
                (url.getPort() != -1 && url.getPort() != 443) || !supported) throw new IOException("Неизвестный источник аудио");
        return url;
    }

    private static void removeFiles(File file) throws IOException {
        File[] children = file.listFiles();
        if (children != null) for (File child : children) removeFiles(child);
        Files.deleteIfExists(file.toPath());
    }

    private static long bytesOnDisk(File file) {
        File[] children = file.listFiles();
        if (children == null) return file.length();
        long result = 0;
        for (File child : children) result += bytesOnDisk(child);
        return result;
    }

    private static final class Download {
        private final String cookie;
        private long remaining;
        Download(String cookie, long limit) { this.cookie = cookie; remaining = limit; }

        void copy(URL candidate, OutputStream destination, long contentLimit) throws Exception {
            URL url = safe(candidate);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setConnectTimeout(10000);
            connection.setReadTimeout(15000);
            connection.setInstanceFollowRedirects(false);
            if (MediaProxyAuth.isProxy(url.toString())) connection.setRequestProperty("Cookie", cookie);
            try {
                if (connection.getResponseCode() != 200) throw new IOException("Источник аудио недоступен");
                try (InputStream source = connection.getInputStream()) {
                    byte[] buffer = new byte[32768];
                    for (int size; (size = source.read(buffer)) != -1;) {
                        if (Thread.currentThread().isInterrupted()) throw new InterruptedIOException();
                        remaining -= size; contentLimit -= size;
                        if (remaining < 0 || contentLimit < 0) throw new IOException("Трек слишком большой");
                        destination.write(buffer, 0, size);
                    }
                }
            } finally { connection.disconnect(); }
        }

        private String manifest(URL url) throws Exception {
            ByteArrayOutputStream buffer = new ByteArrayOutputStream();
            copy(url, buffer, 512 * 1024);
            return buffer.toString(StandardCharsets.UTF_8.name());
        }

        void hls(URL url, File directory) throws Exception {
            String playlist = manifest(url);
            if (playlist.contains("#EXT-X-STREAM-INF")) {
                boolean variant = false;
                for (String line : playlist.split("\\r?\\n")) {
                    if (line.startsWith("#EXT-X-STREAM-INF:")) variant = true;
                    else if (variant && !line.trim().isEmpty() && !line.startsWith("#")) {
                        url = safe(new URL(url, line.trim()));
                        playlist = manifest(url);
                        break;
                    }
                }
            }
            if (!playlist.startsWith("#EXTM3U") || !playlist.contains("#EXT-X-ENDLIST") ||
                    Pattern.compile("#EXT-X-(?:SESSION-)?KEY:(?!METHOD=NONE(?:,|$))", Pattern.MULTILINE).matcher(playlist).find())
                throw new IOException("Этот поток нельзя сохранить офлайн");
            Map<String, String> files = new LinkedHashMap<>();
            StringBuilder local = new StringBuilder();
            for (String line : playlist.split("\\r?\\n")) {
                if (!line.trim().isEmpty() && !line.startsWith("#")) {
                    local.append(part(url, line.trim(), directory, files));
                } else {
                    Matcher matcher = ATTRIBUTE.matcher(line);
                    StringBuffer rewritten = new StringBuffer();
                    while (matcher.find()) matcher.appendReplacement(rewritten,
                            Matcher.quoteReplacement("URI=\"" + part(url, matcher.group(1), directory, files) + "\""));
                    matcher.appendTail(rewritten);
                    local.append(rewritten);
                }
                local.append('\n');
            }
            if (files.isEmpty()) throw new IOException("Аудиопоток пуст");
            Files.write(new File(directory, "index.m3u8").toPath(), local.toString().getBytes(StandardCharsets.UTF_8));
        }

        private String part(URL parent, String relative, File directory, Map<String, String> files) throws Exception {
            URL url = safe(new URL(parent, relative));
            String key = url.toExternalForm();
            if (files.containsKey(key)) return files.get(key);
            if (files.size() >= 1800) throw new IOException("Слишком длинный аудиопоток");
            String name = "part-" + files.size();
            try (OutputStream output = new FileOutputStream(new File(directory, name))) { copy(url, output, remaining); }
            files.put(key, name);
            return name;
        }
    }
}
