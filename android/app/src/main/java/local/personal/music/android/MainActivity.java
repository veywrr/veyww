package local.personal.music.android;

import android.app.*;
import android.content.*;
import android.net.Uri;
import android.os.*;
import android.provider.OpenableColumns;
import android.database.Cursor;
import android.webkit.*;
import androidx.webkit.WebViewAssetLoader;
import androidx.media3.common.*;
import org.json.*;
import java.lang.ref.WeakReference;
import java.nio.charset.StandardCharsets;

public final class MainActivity extends Activity {
    private WebView web;
    private static WeakReference<MainActivity> active=new WeakReference<>(null);
    private ValueCallback<Uri[]> chooser;
    private String pendingDocument;
    private final Handler handler=new Handler(Looper.getMainLooper());
    private final java.util.concurrent.ExecutorService catalogNetwork=java.util.concurrent.Executors.newFixedThreadPool(2);
    private final java.util.concurrent.ExecutorService playbackNetwork=java.util.concurrent.Executors.newSingleThreadExecutor();
    @Override public void onCreate(Bundle b){super.onCreate(b);active=new WeakReference<>(this);getWindow().setStatusBarColor(0xff080808);getWindow().setNavigationBarColor(0xff080808);
        web=new WebView(this);web.setBackgroundColor(0xff080808);
        android.widget.FrameLayout root=new android.widget.FrameLayout(this);root.addView(web);root.setOnApplyWindowInsetsListener((v,insets)->{v.setPadding(insets.getSystemWindowInsetLeft(),insets.getSystemWindowInsetTop(),insets.getSystemWindowInsetRight(),insets.getSystemWindowInsetBottom());return insets.consumeSystemWindowInsets();});setContentView(root);
        addStartupPanel(root);
        mountOffline(root);
        WebSettings s=web.getSettings();s.setJavaScriptEnabled(true);s.setDomStorageEnabled(true);s.setAllowFileAccess(false);s.setAllowContentAccess(true);s.setMediaPlaybackRequiresUserGesture(true);s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        WebViewAssetLoader loader=new WebViewAssetLoader.Builder().addPathHandler("/assets/",new WebViewAssetLoader.AssetsPathHandler(this)).build();
        web.setWebViewClient(new WebViewClient(){
            @Override public void onPageCommitVisible(WebView view, String url) {
                Uri uri = Uri.parse(url);
                if ("https".equals(uri.getScheme()) && "veyww.space".equals(uri.getHost())) finishStartup();
            }
            @Override public void onReceivedError(WebView view, WebResourceRequest request, WebResourceError error) {
                if (request.isForMainFrame()) showStartupFailure(
                        "Не удалось подключиться к veyww. Проверь интернет и попробуй ещё раз.");
            }
            @Override public void onReceivedHttpError(WebView view, WebResourceRequest request, WebResourceResponse error) {
                if (request.isForMainFrame()) showStartupFailure(
                        "Сервер временно недоступен. Попробуй ещё раз.");
            }
            @Override public WebResourceResponse shouldInterceptRequest(WebView v,WebResourceRequest r){return loader.shouldInterceptRequest(r.getUrl());}
            @Override public boolean shouldOverrideUrlLoading(WebView v,WebResourceRequest r){Uri u=r.getUrl();if("https".equals(u.getScheme())&&("veyww.space".equals(u.getHost())||"appassets.androidplatform.net".equals(u.getHost())))return false;if("https".equals(u.getScheme()))try{startActivity(new Intent(Intent.ACTION_VIEW,u));}catch(android.content.ActivityNotFoundException ignored){}return true;}
        });
        web.setWebChromeClient(new WebChromeClient(){@Override public boolean onShowFileChooser(WebView v,ValueCallback<Uri[]> callback,FileChooserParams params){if(chooser!=null)chooser.onReceiveValue(null);chooser=callback;Intent i=new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("*/*").addCategory(Intent.CATEGORY_OPENABLE);startActivityForResult(i,20);return true;}});
        web.addJavascriptInterface(new Bridge(),"Android");loadHome();startService(new Intent(this,PlaybackService.class));
    }
    private static final String HOME_URL = "https://veyww.space/";
    private static final long STARTUP_TIMEOUT_MS = 15000L;
    private android.widget.LinearLayout startupPanel;
    private android.widget.TextView startupMessage;
    private android.widget.ProgressBar startupProgress;
    private android.widget.Button startupRetry;
    private boolean startupPending;
    private final Runnable startupTimeout = () -> showStartupFailure(
            "Сервер долго не отвечает. Попробуй ещё раз или смени сеть.");

    private void addStartupPanel(android.widget.FrameLayout root) {
        startupPanel = new android.widget.LinearLayout(this);
        startupPanel.setOrientation(android.widget.LinearLayout.VERTICAL);
        startupPanel.setGravity(android.view.Gravity.CENTER);
        startupPanel.setBackgroundColor(0xff080808);
        startupPanel.setClickable(true);
        int padding = (int) (28 * getResources().getDisplayMetrics().density);
        startupPanel.setPadding(padding, padding, padding, padding);

        startupMessage = new android.widget.TextView(this);
        startupMessage.setGravity(android.view.Gravity.CENTER);
        startupMessage.setTextColor(0xffeeeeee);
        startupMessage.setTextSize(17);
        startupMessage.setAccessibilityLiveRegion(android.view.View.ACCESSIBILITY_LIVE_REGION_POLITE);
        startupPanel.addView(startupMessage);
        startupProgress = new android.widget.ProgressBar(this);
        startupPanel.addView(startupProgress);
        startupRetry = new android.widget.Button(this);
        startupRetry.setText("Повторить");
        startupRetry.setOnClickListener(v -> loadHome());
        startupPanel.addView(startupRetry);
        root.addView(startupPanel, new android.widget.FrameLayout.LayoutParams(-1, -1));
    }

    private void loadHome() {
        startupPending = true;
        startupMessage.setText("Загружаем veyww…");
        startupRetry.setVisibility(android.view.View.GONE);
        startupProgress.setVisibility(android.view.View.VISIBLE);
        startupPanel.setVisibility(android.view.View.VISIBLE);
        handler.removeCallbacks(startupTimeout);
        handler.postDelayed(startupTimeout, STARTUP_TIMEOUT_MS);
        web.loadUrl(HOME_URL);
    }

    private void showStartupFailure(String message) {
        if (!startupPending) return;
        startupPending = false;
        handler.removeCallbacks(startupTimeout);
        startupProgress.setVisibility(android.view.View.GONE);
        startupMessage.setText(message);
        startupRetry.setVisibility(android.view.View.VISIBLE);
        web.stopLoading();
    }

    private void finishStartup() {
        if (!startupPending) return;
        startupPending = false;
        handler.removeCallbacks(startupTimeout);
        startupPanel.setVisibility(android.view.View.GONE);
    }
    private AndroidOfflineLibrary offlineLibrary;
    private final java.util.concurrent.ExecutorService downloads = java.util.concurrent.Executors.newSingleThreadExecutor();
    private android.widget.LinearLayout offlineRows;
    private android.widget.FrameLayout appRoot;
    private android.widget.ScrollView offlineScreen;
    private String offlineOwner = "";
    private String heardId = "";
    private long heardPosition, heardMillis;
    private boolean counted;
    private boolean sampling;

    private void mountOffline(android.widget.FrameLayout root) {
        appRoot = root;
        offlineLibrary = new AndroidOfflineLibrary(this);
        offlineOwner = getPreferences(MODE_PRIVATE).getString("lastOfflineOwner", "");
        android.widget.Button open = new android.widget.Button(this);
        open.setText("Офлайн");
        android.widget.FrameLayout.LayoutParams position = new android.widget.FrameLayout.LayoutParams(
                -2, -2, android.view.Gravity.TOP | android.view.Gravity.CENTER_HORIZONTAL);
        root.addView(open, position);
        open.setOnClickListener(v -> openOffline());
    }

    private void refreshOwner(Runnable ready) {
        Uri page = Uri.parse(web.getUrl() == null ? "" : web.getUrl());
        if (!"veyww.space".equals(page.getHost()) || startupPanel.getVisibility() == android.view.View.VISIBLE) {
            ready.run();
            return;
        }
        web.evaluateJavascript("localStorage.getItem('music-active-account')", result -> {
            try {
                Object value = new JSONTokener(result).nextValue();
                offlineOwner = value instanceof String ? (String) value : "";
                getPreferences(MODE_PRIVATE).edit().putString("lastOfflineOwner", offlineOwner).apply();
            } catch (Exception ignored) { }
            ready.run();
        });
    }

    private void openOffline() {
        refreshOwner(this::showOfflineScreen);
    }

    private void closeOffline() {
        if (offlineScreen != null) appRoot.removeView(offlineScreen);
        offlineScreen = null;
    }

    private void showOfflineScreen() {
        closeOffline();
        offlineScreen = new android.widget.ScrollView(this);
        offlineScreen.setBackgroundColor(0xff101012);
        offlineScreen.setFillViewport(true);
        offlineScreen.setClickable(true);
        android.widget.LinearLayout panel = new android.widget.LinearLayout(this);
        panel.setOrientation(android.widget.LinearLayout.VERTICAL);
        int padding = (int) (20 * getResources().getDisplayMetrics().density);
        panel.setPadding(padding, padding, padding, padding);
        offlineScreen.addView(panel);
        appRoot.addView(offlineScreen, new android.widget.FrameLayout.LayoutParams(-1, -1));
        offlineButton(panel, "← Назад", v -> closeOffline());
        android.widget.TextView title = new android.widget.TextView(this);
        title.setText("Скачано на телефон");
        title.setTextSize(25);
        title.setTextColor(0xffeeeeee);
        panel.addView(title);
        android.widget.CheckBox wave = new android.widget.CheckBox(this);
        wave.setText("Скачивать Мою частоту · до 4 часов\nПосле двух прослушиваний трека");
        wave.setTextColor(0xffeeeeee);
        wave.setEnabled(!offlineOwner.isEmpty());
        wave.setChecked(offlineLibrary.waveEnabled(offlineOwner));
        wave.setOnCheckedChangeListener((button, checked) -> offlineLibrary.setWaveEnabled(offlineOwner, checked));
        panel.addView(wave);
        offlineButton(panel, "Пауза / продолжить", v -> {
            PlaybackService service = PlaybackService.instance;
            if (service != null && service.player.getCurrentMediaItem() != null) {
                if (service.player.getPlayWhenReady()) service.player.pause();
                else service.player.play();
            }
        });
        offlineButton(panel, "Сохранить текущий трек", v -> saveCurrentForOffline());
        offlineButton(panel, "Выбрать из понравившихся", v -> pickFavoriteForOffline());
        offlineRows = new android.widget.LinearLayout(this);
        offlineRows.setOrientation(android.widget.LinearLayout.VERTICAL);
        panel.addView(offlineRows);
        redrawOffline();
    }

    private void offlineButton(android.widget.LinearLayout parent, String name, android.view.View.OnClickListener press) {
        android.widget.Button button = new android.widget.Button(this);
        button.setText(name);
        button.setOnClickListener(press);
        parent.addView(button);
    }

    private void offlineToast(String message) {
        android.widget.Toast.makeText(this, message, android.widget.Toast.LENGTH_SHORT).show();
    }

    private void redrawOffline() {
        String owner = offlineOwner;
        android.widget.LinearLayout rows = offlineRows;
        downloads.execute(() -> {
            try {
                JSONArray tracks = offlineLibrary.list(owner);
                runOnUiThread(() -> {
                    if (offlineScreen == null || rows != offlineRows) return;
                    rows.removeAllViews();
                    if (tracks.length() == 0) {
                        android.widget.TextView empty = new android.widget.TextView(this);
                        empty.setText(owner.isEmpty() ? "Войди в аккаунт, чтобы скачивать треки." : "Скачанных треков пока нет.");
                        empty.setTextColor(0xffcccccc);
                        rows.addView(empty);
                    }
                    if (tracks.length() > 0) offlineButton(rows, "Слушать скачанное", v -> playDownloaded(tracks, 0));
                    for (int i = 0; i < tracks.length(); i++) {
                        final int at = i;
                        JSONObject track = tracks.optJSONObject(i);
                        offlineButton(rows, track.optString("title") + " · " + track.optString("artist"), v -> playDownloaded(tracks, at));
                        offlineButton(rows, "Удалить", v -> downloads.execute(() -> {
                            try {
                                offlineLibrary.remove(owner, track.optString("offlineKey"));
                                runOnUiThread(this::redrawOffline);
                            } catch (Exception error) { runOnUiThread(() -> offlineToast("Не удалось удалить трек")); }
                        }));
                    }
                });
            } catch (Exception error) { runOnUiThread(() -> offlineToast("Не удалось открыть скачанное")); }
        });
    }

    private void playDownloaded(JSONArray tracks, int at) {
        try {
            PlaybackService service = PlaybackService.instance;
            if (service == null) { offlineToast("Плеер запускается, попробуй ещё раз"); return; }
            JSONObject track = new JSONObject(tracks.getJSONObject(at).toString());
            track.put("nativeQueue", tracks);
            service.play(track);
            offlineToast("Играет офлайн · " + track.optString("title"));
        } catch (Exception error) { offlineToast("Не удалось включить скачанный трек"); }
    }

    private void saveCurrentForOffline() {
        PlaybackService service = PlaybackService.instance;
        MediaItem current = service == null ? null : service.player.getCurrentMediaItem();
        if (current == null || current.mediaMetadata.extras == null) { offlineToast("Сначала включи трек"); return; }
        try { saveOne(new JSONObject(current.mediaMetadata.extras.getString("trackJson", "{}"))); }
        catch (JSONException error) { offlineToast("Не удалось прочитать трек"); }
    }

    private void saveOne(JSONObject track) {
        String owner = offlineOwner;
        if (owner.isEmpty()) { offlineToast("Сначала войди в аккаунт"); return; }
        if (!AndroidOfflineLibrary.canSave(track)) { offlineToast("Этот трек нельзя скачать"); return; }
        offlineToast("Скачиваем · " + track.optString("title"));
        downloads.execute(() -> {
            try {
                offlineLibrary.save(track, owner, null);
                runOnUiThread(() -> { offlineToast("Трек сохранён"); redrawOffline(); });
            } catch (Exception error) { runOnUiThread(() -> offlineToast("Не удалось скачать трек. Проверь соединение.")); }
        });
    }

    private void pickFavoriteForOffline() {
        if (offlineOwner.isEmpty() || startupPanel.getVisibility() == android.view.View.VISIBLE) {
            offlineToast("Подключись к veyww, чтобы выбрать понравившийся трек");
            return;
        }
        // Read the persisted browser collection, including collections too large for localStorage.
        String query = "(async()=>{const owner=localStorage.getItem('music-active-account');"
                + "const {readState}=await import('/state-store.mjs');"
                + "const state=await readState('music-account:'+owner);"
                + "Android.offlineFavorites(JSON.stringify((state?.likes||[]).slice(0,1000)));"
                + "})().catch(()=>Android.offlineFavorites('[]'))";
        web.evaluateJavascript(query, null);
    }

    private void showFavoritePicker(String result) {
        if (offlineScreen == null || result == null || result.length() > 2_000_000) return;
        try {
            JSONArray entries = new JSONArray(result);
            java.util.List<JSONObject> tracks = new java.util.ArrayList<>();
            java.util.List<String> names = new java.util.ArrayList<>();
            for (int i = 0; i < entries.length(); i++) {
                JSONObject track = entries.optJSONObject(i);
                if (AndroidOfflineLibrary.canSave(track)) {
                    tracks.add(track);
                    names.add(track.optString("title") + " · " + track.optString("artist"));
                }
            }
            if (tracks.isEmpty()) { offlineToast("Нет доступных понравившихся треков"); return; }
            new AlertDialog.Builder(this).setTitle("Понравившиеся").setItems(
                    names.toArray(new String[0]), (dialog, at) -> saveOne(tracks.get(at))).show();
        } catch (Exception error) { offlineToast("Не удалось загрузить понравившиеся"); }
    }

    static void sampleOffline(Player player, boolean wave) {
    MainActivity activity = active.get();
    if (activity != null) activity.sampleWave(player, player.getCurrentMediaItem(), wave);
}

void sampleWave(Player player, MediaItem item, boolean wave) {
        if (item == null || item.mediaMetadata.extras == null) { heardId = ""; sampling = false; return; }
        long position = player.getCurrentPosition();
        if (!item.mediaId.equals(heardId) || position + 2000 < heardPosition) {
            heardId = item.mediaId;
            heardMillis = 0;
            counted = false;
            sampling = false;
        }
        long delta = position - heardPosition;
        if (wave && sampling && player.isPlaying() && delta > 0 && delta <= 1500) heardMillis += delta;
        heardPosition = position;
        sampling = wave && player.isPlaying();
        if (counted || !sampling || heardMillis < 20000) return;
        counted = true;
        refreshOwner(() -> {
            String owner = offlineOwner;
            if (!offlineLibrary.waveEnabled(owner)) return;
            downloads.execute(() -> {
                try {
                    offlineLibrary.recordWave(new JSONObject(item.mediaMetadata.extras.getString("trackJson", "{}")), owner);
                } catch (Exception error) { android.util.Log.w("veyww", "Wave download unavailable"); }
            });
        });
    }

    private void js(String code){if(web!=null)handler.post(()->web.evaluateJavascript(code,null));}
    static void sendError(String error){MainActivity a=active.get();if(a!=null)a.js("window.nativeState?.({error:"+JSONObject.quote(error)+"})");}
    static void sendPlayer(Player p){MainActivity a=active.get();if(a==null)return;try{JSONObject s=new JSONObject();s.put("playing",p.isPlaying());s.put("position",p.getCurrentPosition()/1000d);s.put("duration",p.getDuration()>0?p.getDuration()/1000d:0);MediaItem item=p.getCurrentMediaItem();s.put("id",item==null?"":item.mediaId);if(item!=null&&item.mediaMetadata.extras!=null)s.put("track",new JSONObject(item.mediaMetadata.extras.getString("trackJson","{}")));if(PlaybackService.instance!=null)s.put("effects",PlaybackService.instance.activeEffects);a.js("window.nativeState?.("+s+")");}catch(JSONException ignored){}}
    private void requestNotifications(){if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED&&!getSharedPreferences("permissions",MODE_PRIVATE).getBoolean("notificationsAsked",false)){getSharedPreferences("permissions",MODE_PRIVATE).edit().putBoolean("notificationsAsked",true).apply();requestPermissions(new String[]{android.Manifest.permission.POST_NOTIFICATIONS},33);}}
    final class Bridge {
        @JavascriptInterface public void offlineFavorites(String data) { handler.post(() -> showFavoritePicker(data)); }
        @JavascriptInterface public void playbackModes(String text){handler.post(()->{try{if(PlaybackService.instance!=null)PlaybackService.instance.playbackModes(new JSONObject(text));}catch(JSONException ignored){}});}
        @JavascriptInterface public void queue(){handler.post(()->{if(PlaybackService.instance==null)return;Player player=PlaybackService.instance.player;JSONArray tracks=new JSONArray();java.util.Set<Integer> seen=new java.util.HashSet<>();Timeline timeline=player.getCurrentTimeline();int at=player.getCurrentMediaItemIndex();while(at>=0&&at<player.getMediaItemCount()&&seen.add(at)){try{MediaItem item=player.getMediaItemAt(at);if(item.mediaMetadata.extras!=null)tracks.put(new JSONObject(item.mediaMetadata.extras.getString("trackJson","{}")));}catch(JSONException ignored){}at=timeline.getNextWindowIndex(at,Player.REPEAT_MODE_ALL,player.getShuffleModeEnabled());}js("window.nativeQueueReply?.("+tracks+")");});}
        @JavascriptInterface public int serverAudioVersion(){return 1;}
        @JavascriptInterface public void notificationSettings(){handler.post(()->{if(Build.VERSION.SDK_INT>=33&&checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)!=android.content.pm.PackageManager.PERMISSION_GRANTED&&!getSharedPreferences("permissions",MODE_PRIVATE).getBoolean("notificationsAsked",false))requestNotifications();else startActivity(new Intent(android.provider.Settings.ACTION_APP_NOTIFICATION_SETTINGS).putExtra(android.provider.Settings.EXTRA_APP_PACKAGE,getPackageName()));});}

        @JavascriptInterface public void feedback(String text){handler.post(()->{try{if(PlaybackService.instance!=null)PlaybackService.instance.feedback(new JSONArray(text));}catch(JSONException ignored){}});}
        @JavascriptInterface public void diagnostics(String page){catalogNetwork.execute(()->{JSONObject report=PlaybackDiagnostics.run(MainActivity.this,page);js("window.diagnosticsReply?.("+report+")");});}
        @JavascriptInterface public void volume(double volume){float v=(float)Math.max(0,Math.min(1,volume));getSharedPreferences("player-settings",MODE_PRIVATE).edit().putFloat("volume",v).apply();handler.post(()->{if(PlaybackService.instance!=null)PlaybackService.instance.player.setVolume(v);});}
        @JavascriptInterface public void catalog(int id,String mode,String value,int offset){if(!mode.equals("search")&&!mode.equals("resolve")&&!mode.equals("artist")&&!mode.equals("related")&&!mode.equals("import_playlist"))return;(mode.equals("resolve")?playbackNetwork:catalogNetwork).execute(()->{try{JSONObject r=ServerCatalog.call(MainActivity.this,mode,value,offset);js("window.providerReply?.("+id+","+r+")");}catch(Exception e){js("window.providerReply?.("+id+",{error:"+JSONObject.quote("SoundCloud: "+e.getMessage())+"})");}});}
        @JavascriptInterface public String listening(){JSONArray out=new JSONArray();for(Object value:getSharedPreferences("listening-details",MODE_PRIVATE).getAll().values())try{out.put(new JSONObject(String.valueOf(value)));}catch(JSONException ignored){}return out.toString();}
        @JavascriptInterface public String history(){return new JSONObject(getSharedPreferences("listening-history",MODE_PRIVATE).getAll()).toString();}
        @JavascriptInterface public void play(String text){handler.post(()->{try{requestNotifications();if(PlaybackService.instance!=null)PlaybackService.instance.play(new JSONObject(text));}catch(Exception e){sendError(e.getMessage());}});}
        @JavascriptInterface public void effects(String text){handler.post(()->{try{if(PlaybackService.instance!=null)PlaybackService.instance.effects(new JSONObject(text));}catch(Exception e){sendError(e.getMessage());}});}
        @JavascriptInterface public void toggle(){handler.post(()->{if(PlaybackService.instance!=null){Player p=PlaybackService.instance.player;if(p.isPlaying())p.pause();else p.play();}});}
        @JavascriptInterface public int queueVersion(){return 2;}
        @JavascriptInterface public void previous(){handler.post(()->{if(PlaybackService.instance!=null)PlaybackService.instance.player.seekToPrevious();});}
        @JavascriptInterface public void next(){handler.post(()->{if(PlaybackService.instance!=null)PlaybackService.instance.player.seekToNextMediaItem();});}
        @JavascriptInterface public void seek(double seconds){handler.post(()->{if(PlaybackService.instance!=null)PlaybackService.instance.player.seekTo((long)(Math.max(0,seconds)*1000));});}
        @JavascriptInterface public void pickFiles(){handler.post(()->startActivityForResult(new Intent(Intent.ACTION_OPEN_DOCUMENT).setType("audio/*").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_ALLOW_MULTIPLE,true).addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION|Intent.FLAG_GRANT_PERSISTABLE_URI_PERMISSION),21));}
        @JavascriptInterface public void saveDocument(String name,String data){handler.post(()->{pendingDocument=data;startActivityForResult(new Intent(Intent.ACTION_CREATE_DOCUMENT).setType("application/json").addCategory(Intent.CATEGORY_OPENABLE).putExtra(Intent.EXTRA_TITLE,name),22);});}
    }
    @Override protected void onActivityResult(int request,int result,Intent data){super.onActivityResult(request,result,data);if(request==20){if(chooser!=null){chooser.onReceiveValue(result==RESULT_OK&&data!=null?new Uri[]{data.getData()}:null);chooser=null;}return;}if(result!=RESULT_OK||data==null)return;
        if(request==22){try(java.io.OutputStream out=getContentResolver().openOutputStream(data.getData())){out.write(pendingDocument.getBytes(StandardCharsets.UTF_8));}catch(Exception e){sendError("Не удалось сохранить файл");}pendingDocument=null;return;}
        if(request==21){JSONArray tracks=new JSONArray();if(data.getClipData()!=null){for(int i=0;i<data.getClipData().getItemCount();i++)addTrack(tracks,data.getClipData().getItemAt(i).getUri());}else if(data.getData()!=null)addTrack(tracks,data.getData());js("window.importNativeTracks?.("+tracks+")");}
    }
    private void addTrack(JSONArray a,Uri uri){try{getContentResolver().takePersistableUriPermission(uri,Intent.FLAG_GRANT_READ_URI_PERMISSION);String name="Аудиофайл";try(Cursor c=getContentResolver().query(uri,new String[]{OpenableColumns.DISPLAY_NAME},null,null,null)){if(c!=null&&c.moveToFirst())name=c.getString(0);}JSONObject t=new JSONObject();t.put("id","file:"+uri);t.put("url",uri.toString());t.put("title",name);t.put("artist","На устройстве");t.put("source","Файл");a.put(t);}catch(Exception e){sendError("Не удалось открыть файл");}}
    @Override public void onBackPressed(){if(offlineScreen!=null){closeOffline();return;}js("document.querySelector('dialog[open]')?.close()");}
    @Override protected void onDestroy(){downloads.shutdownNow();startupPending=false;handler.removeCallbacks(startupTimeout);if(active.get()==this)active.clear();catalogNetwork.shutdownNow();playbackNetwork.shutdownNow();if(web!=null){web.removeJavascriptInterface("Android");web.destroy();web=null;}super.onDestroy();}
}
