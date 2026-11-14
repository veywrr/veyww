package local.personal.music.android;

import android.app.PendingIntent;
import android.content.*;
import android.os.*;
import androidx.media3.common.*;
import androidx.media3.common.audio.AudioProcessor;
import androidx.media3.datasource.*;
import androidx.media3.exoplayer.*;
import androidx.media3.exoplayer.audio.*;
import androidx.media3.exoplayer.source.DefaultMediaSourceFactory;
import androidx.media3.session.*;
import org.json.*;
import java.util.*;

@androidx.annotation.OptIn(markerClass=androidx.media3.common.util.UnstableApi.class)
public final class PlaybackService extends MediaSessionService {
 static PlaybackService instance;
 volatile String lastPlaybackError="";
 ExoPlayer player;
 final ReverbProcessor reverb=new ReverbProcessor();
 JSONObject activeEffects=new JSONObject();
 private MediaSession session;
 private JSONObject config=new JSONObject();
 private final Handler handler=new Handler(Looper.getMainLooper());
 private final java.util.concurrent.ExecutorService network=java.util.concurrent.Executors.newFixedThreadPool(2);
 private boolean refilling=false;
 private int feedOffset=30,feedSeed=0,queueVersion=0;
 private int failedTracks=0;

 @Override public void onCreate(){super.onCreate();instance=this;
  DefaultRenderersFactory renderers=new DefaultRenderersFactory(this){
   @Override protected AudioSink buildAudioSink(Context c,boolean floats,boolean params){return new DefaultAudioSink.Builder(c).setEnableFloatOutput(false).setEnableAudioTrackPlaybackParams(false).setAudioProcessors(new AudioProcessor[]{reverb}).build();}
  };
  ResolvingDataSource.Factory data=new ResolvingDataSource.Factory(new DefaultDataSource.Factory(this,new DefaultHttpDataSource.Factory().setUserAgent("veyww/0.10 (Android)").setConnectTimeoutMs(15000).setReadTimeoutMs(20000)),spec->{
   if("soundcloud.com".equals(spec.uri.getHost())||"www.soundcloud.com".equals(spec.uri.getHost())){
    try{String url=config.optBoolean("serverCatalog")?ServerCatalog.resolveHls(this,spec.uri.toString()):Catalog.resolveHls(this,spec.uri.toString());return spec.withUri(android.net.Uri.parse(url)).withAdditionalHeaders(MediaProxyAuth.headers(url,ServerCatalog.sessionCookie()));}catch(Exception e){throw new java.io.IOException("Не удалось открыть трек SoundCloud: "+e.getMessage(),e);}
   }return spec.withAdditionalHeaders(MediaProxyAuth.headers(spec.uri.toString(),ServerCatalog.sessionCookie()));
  });
  player=new ExoPlayer.Builder(this,renderers).setMaxSeekToPreviousPositionMs(7000).setMediaSourceFactory(new DefaultMediaSourceFactory(data)).setLoadControl(new DefaultLoadControl.Builder().setBufferDurationsMs(15000,60000,500,2000).setBackBuffer(30000,true).build()).build();
  player.setWakeMode(C.WAKE_MODE_NETWORK);
  player.setAudioAttributes(new AudioAttributes.Builder().setUsage(C.USAGE_MEDIA).setContentType(C.AUDIO_CONTENT_TYPE_MUSIC).build(),true);
  player.setHandleAudioBecomingNoisy(true);
  player.setVolume(getSharedPreferences("player-settings",MODE_PRIVATE).getFloat("volume",1f));
  player.addListener(new Player.Listener(){
   @Override public void onMediaItemTransition(MediaItem item,int reason){applyForTrack();prefetchNext();refill();}
   @Override public void onPlayerError(PlaybackException e){lastPlaybackError=playbackError(e);if(config.optBoolean("waveMode")&&failedTracks++<5&&player.hasNextMediaItem()){player.seekToNextMediaItem();player.prepare();player.play();}else MainActivity.sendError(playbackError(e));}
   @Override public void onIsPlayingChanged(boolean playing){if(playing){failedTracks=0;remember();}}
  });
  PendingIntent pi=PendingIntent.getActivity(this,0,new Intent(this,MainActivity.class),PendingIntent.FLAG_IMMUTABLE|PendingIntent.FLAG_UPDATE_CURRENT);
  session=new MediaSession.Builder(this,player).setSessionActivity(pi).build();
  addSession(session);
  handler.post(tick);
 }
 static String playbackError(PlaybackException e){
  Throwable cause=e;int http=0;for(int i=0;i<8&&cause!=null;i++,cause=cause.getCause())if(cause instanceof HttpDataSource.InvalidResponseCodeException)http=((HttpDataSource.InvalidResponseCodeException)cause).responseCode;
  if(http==401)return "Сессия истекла. Открой приложение и войди в аккаунт veyww.";
  String reason=http>0?"Источник аудио вернул HTTP "+http: e.errorCode==PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_FAILED?"Нет соединения с сервером аудио":e.errorCode==PlaybackException.ERROR_CODE_IO_NETWORK_CONNECTION_TIMEOUT?"Сервер аудио не ответил вовремя":e.errorCode==PlaybackException.ERROR_CODE_PARSING_MANIFEST_MALFORMED?"Не удалось прочитать формат потока":"Ошибка Android-плеера";
  return reason+" · "+e.getErrorCodeName()+". Попробуй другую версию трека. Подробности: «Источники → Проверить воспроизведение».";
 }
 private final Runnable tick=new Runnable(){public void run(){MainActivity.sendPlayer(player);MainActivity.sampleOffline(player, config.optBoolean("waveMode"));handler.postDelayed(this,500);}};
 private MediaItem mediaItem(JSONObject t,String override) throws JSONException {
  String uri=override==null?t.optString("url"):override;
  if(override==null&&"SoundCloud".equals(t.optString("source")))uri=t.optString("page");
  if (!(uri.startsWith("https://") || uri.startsWith("content://") || t.optBoolean("offline") && AndroidOfflineLibrary.isSavedAudio(this, uri))) return null;
  Bundle extras=new Bundle();extras.putString("trackJson",t.toString());
  MediaMetadata meta=new MediaMetadata.Builder().setTitle(t.optString("title")).setArtist(t.optString("artist")).setExtras(extras).build();
  MediaItem.Builder b=new MediaItem.Builder().setMediaId(t.optString("id")).setUri(uri).setMediaMetadata(meta);
  if(t.optBoolean("hls")||override==null&&"SoundCloud".equals(t.optString("source")))b.setMimeType(MimeTypes.APPLICATION_M3U8);
  return b.build();
 }
 void play(JSONObject track) throws JSONException {
  config=track;lastPlaybackError="";queueVersion++;feedOffset=track.optInt("feedOffset",30);feedSeed=0;
  JSONArray q=track.optJSONArray("nativeQueue");if(q==null)q=new JSONArray().put(track);List<MediaItem> items=new ArrayList<>();
  int startIndex=0;for(int i=0;i<q.length();i++){JSONObject entry=q.getJSONObject(i);boolean selected=entry.optString("id").equals(track.optString("id"));if(selected)entry.put("hls",track.optBoolean("hls"));MediaItem m=mediaItem(entry,selected?track.optString("url"):null);if(m!=null){if(selected)startIndex=items.size();items.add(m);}}
  if(items.isEmpty())throw new JSONException("Нет доступного аудио");
  player.setMediaItems(items,startIndex,0);playbackModes(track);apply(track);player.prepare();player.play();
 }
 void playbackModes(JSONObject modes){try{config.put("shuffle",modes.optBoolean("shuffle"));config.put("repeat",modes.optString("repeat","off"));}catch(JSONException ignored){}player.setShuffleModeEnabled(modes.optBoolean("shuffle"));String repeat=modes.optString("repeat","off");player.setRepeatMode("one".equals(repeat)?Player.REPEAT_MODE_ONE:"all".equals(repeat)?Player.REPEAT_MODE_ALL:Player.REPEAT_MODE_OFF);}
 void effects(JSONObject e){apply(e);try{config.put("speed",activeEffects.optDouble("speed",1));config.put("pitch",activeEffects.optDouble("pitch",0));config.put("reverb",activeEffects.optDouble("reverb",0));config.put("linked",activeEffects.optBoolean("linked",true));if(e.has("lock"))config.put("lock",e.optBoolean("lock"));MediaItem item=player.getCurrentMediaItem();if(item!=null){JSONObject all=config.optJSONObject("trackEffects");if(all==null)all=new JSONObject();all.put(item.mediaId,activeEffects);config.put("trackEffects",all);}}catch(JSONException ignored){}}
 private void applyForTrack(){JSONObject e=config;if(!config.optBoolean("lock")){JSONObject all=config.optJSONObject("trackEffects");MediaItem item=player.getCurrentMediaItem();e=all==null||item==null?null:all.optJSONObject(item.mediaId);}try{JSONObject selected=e==null?new JSONObject():new JSONObject(e.toString());selected.put("linked",config.optBoolean("linked",true));apply(selected);}catch(JSONException ignored){}}
 private void apply(JSONObject e){float speed=(float)Math.max(.5,Math.min(2,e.optDouble("speed",1)));boolean linked=e.optBoolean("linked",true);float pitch=(float)Math.max(-12,Math.min(12,e.optDouble("pitch",0)));float pitchFactor=linked?speed:(float)Math.pow(2,pitch/12);player.setPlaybackParameters(new PlaybackParameters(speed,pitchFactor));reverb.mix=(float)Math.max(0,Math.min(1,e.optDouble("reverb",0)));try{activeEffects=new JSONObject().put("speed",speed).put("pitch",linked?12*Math.log(speed)/Math.log(2):pitch).put("reverb",reverb.mix).put("linked",linked);}catch(JSONException ignored){}}
 private int waveScore(MediaItem item){
  int score=negativeScore(item)*1000;
  try{JSONObject track=new JSONObject(item.mediaMetadata.extras.getString("trackJson","{}"));String artist=MixIdentity.artist(track);JSONArray seeds=config.optJSONArray("familiarSeeds");boolean familiar=false;
   if(seeds!=null)for(int i=0;i<seeds.length();i++)if(artist.equals(MixIdentity.artist(new JSONObject().put("artist",seeds.optString(i))))){familiar=true;break;}
   if(familiar)score-=200;double plays=Math.max(0,track.optDouble("plays",0));score-=(int)Math.min(80,Math.log10(1+plays)*10);if(!familiar&&plays<1000)score+=50;
  }catch(JSONException ignored){}return score;
 }
 private void refill(){
  if(!config.optBoolean("waveMode")||refilling||player.getMediaItemCount()-player.getCurrentMediaItemIndex()>6||feedOffset>=900)return;
  JSONArray seeds=config.optJSONArray("familiarSeeds");if(seeds==null||seeds.length()==0)seeds=config.optJSONArray("genres");String seed=seeds!=null&&seeds.length()>0?seeds.optString(feedSeed%seeds.length()):"popular music";
  String relatedPage="";JSONArray likedPages=config.optJSONArray("likedPages");if(likedPages!=null&&likedPages.length()>0)relatedPage=likedPages.optString(feedSeed%likedPages.length());
  boolean discovery=feedSeed%12==11;String[] explore={"drum and bass","indie rock","soul","jazz","hyperpop","post punk","ambient","uk garage","house","russian rap","synthpop","trip hop"};if(discovery)seed=explore[(feedSeed/3)%explore.length];String mode=!discovery&&feedSeed%3==1&&!relatedPage.isEmpty()?"related":"search",value=mode.equals("related")?relatedPage:seed;
  int offset=mode.equals("related")||discovery?0:feedOffset,version=queueVersion;feedSeed++;if(seeds==null||seeds.length()==0||feedSeed%seeds.length()==0)feedOffset+=30;refilling=true;
  network.execute(()->{List<MediaItem> added=new ArrayList<>();String error=null;try{
   JSONObject response=config.optBoolean("serverCatalog")?ServerCatalog.call(this,mode,value,offset):Catalog.call(this,mode,value,offset);if(response.has("error"))throw new Exception(response.getString("error"));JSONArray tracks=response.getJSONArray("data");
   for(int i=0;i<tracks.length();i++){MediaItem m=mediaItem(tracks.getJSONObject(i),null);if(m!=null)added.add(m);}
  }catch(Exception e){error="Не удалось продолжить подборку. Открой приложение и обнови её.";}
   final String message=error;handler.post(()->{refilling=false;if(instance!=this||version!=queueVersion)return;Set<String> ids=new HashSet<>();for(Map.Entry<String,?> h:getSharedPreferences("listening-history",MODE_PRIVATE).getAll().entrySet())if(h.getValue() instanceof Number&&System.currentTimeMillis()-((Number)h.getValue()).longValue()<repeatDelay(h.getKey(),((Number)h.getValue()).longValue()))ids.add(h.getKey());for(int i=0;i<player.getMediaItemCount();i++)ids.add(player.getMediaItemAt(i).mediaId);List<MediaItem> fresh=new ArrayList<>();Collections.shuffle(added);added.sort(Comparator.comparingInt(this::waveScore));Set<String> keys=new HashSet<>();Map<String,Integer> artistCounts=new HashMap<>();for(Object historyValue:getSharedPreferences("listening-details",MODE_PRIVATE).getAll().values())try{JSONObject detail=new JSONObject(String.valueOf(historyValue));if(System.currentTimeMillis()-detail.optLong("at")<repeatDelay(MixIdentity.key(detail),detail.optLong("at")))keys.add(MixIdentity.key(detail));}catch(JSONException ignored){}for(int i=0;i<player.getMediaItemCount();i++)try{MediaItem existing=player.getMediaItemAt(i);if(existing.mediaMetadata.extras!=null)keys.add(MixIdentity.key(new JSONObject(existing.mediaMetadata.extras.getString("trackJson","{}"))));}catch(JSONException ignored){}JSONArray rejected=config.optJSONArray("dislikes");if(rejected!=null)for(int j=0;j<rejected.length();j++){JSONObject t=rejected.optJSONObject(j);if(t!=null)keys.add(MixIdentity.key(t));}for(MediaItem m:added)try{JSONObject detail=new JSONObject(m.mediaMetadata.extras.getString("trackJson","{}"));String artist=MixIdentity.artist(detail);if(!ids.contains(m.mediaId)&&!keys.contains(MixIdentity.key(detail))&&artistCounts.getOrDefault(artist,0)<(negativeScore(m)>0?1:2)){ids.add(m.mediaId);keys.add(MixIdentity.key(detail));artistCounts.put(artist,artistCounts.getOrDefault(artist,0)+1);fresh.add(m);}}catch(JSONException ignored){}player.addMediaItems(fresh);if(message!=null)MainActivity.sendError(message);});
  });
 }

 void feedback(JSONArray values){try{config.put("dislikes",values);Set<String> keys=new HashSet<>();for(int i=0;i<values.length();i++)if(values.optJSONObject(i)!=null)keys.add(MixIdentity.key(values.optJSONObject(i)));for(int i=player.getMediaItemCount()-1;i>player.getCurrentMediaItemIndex();i--){MediaItem item=player.getMediaItemAt(i);if(item.mediaMetadata.extras!=null&&keys.contains(MixIdentity.key(new JSONObject(item.mediaMetadata.extras.getString("trackJson","{}")))))player.removeMediaItem(i);}}catch(JSONException ignored){}}
 private int negativeScore(MediaItem item){int score=0;try{if(item.mediaMetadata.extras==null)return 0;JSONObject track=new JSONObject(item.mediaMetadata.extras.getString("trackJson","{}"));JSONArray rejected=config.optJSONArray("dislikes");if(rejected!=null)for(int i=0;i<rejected.length();i++){JSONObject t=rejected.optJSONObject(i);if(t==null)continue;if(MixIdentity.artist(t).equals(MixIdentity.artist(track)))score+=4;if(!t.optString("genre").isEmpty()&&t.optString("genre").equalsIgnoreCase(track.optString("genre")))score++;}}catch(JSONException ignored){}return score;}

 private void remember(){MediaItem item=player.getCurrentMediaItem();if(item==null)return;android.content.SharedPreferences prefs=getSharedPreferences("listening-history",MODE_PRIVATE);android.content.SharedPreferences.Editor editor=prefs.edit().putLong(item.mediaId,System.currentTimeMillis());Map<String,?> all=prefs.getAll();if(all.size()>600){List<String> keys=new ArrayList<>(all.keySet());keys.sort(Comparator.comparingLong(k->((Number)all.get(k)).longValue()));for(int i=0;i<keys.size()-600;i++)editor.remove(keys.get(i));}editor.apply();try{if(item.mediaMetadata.extras!=null){JSONObject detail=new JSONObject(item.mediaMetadata.extras.getString("trackJson","{}"));JSONObject record=new JSONObject().put("id",item.mediaId).put("title",detail.optString("title")).put("artistName",detail.optString("artist")).put("artist",detail.optString("artist")).put("genre",detail.optString("genre")).put("page",detail.optString("page")).put("at",System.currentTimeMillis());android.content.SharedPreferences details=getSharedPreferences("listening-details",MODE_PRIVATE);android.content.SharedPreferences.Editor changes=details.edit().putString(item.mediaId,record.toString());if(details.getAll().size()>1200)for(String key:details.getAll().keySet())try{if(System.currentTimeMillis()-new JSONObject(details.getString(key,"{}")).optLong("at")>30L*86400000)changes.remove(key);}catch(JSONException ignored){}changes.apply();}}catch(JSONException ignored){}}
 private void prefetchNext(){List<String> pages=new ArrayList<>();for(int i=player.getCurrentMediaItemIndex()+1;i<Math.min(player.getMediaItemCount(),player.getCurrentMediaItemIndex()+3);i++){MediaItem item=player.getMediaItemAt(i);try{if(item.mediaMetadata.extras!=null){String page=new JSONObject(item.mediaMetadata.extras.getString("trackJson","{}")).optString("page");if(!page.isEmpty())pages.add(page);}}catch(JSONException ignored){}}network.execute(()->{for(String page:pages)try{{if(config.optBoolean("serverCatalog"))ServerCatalog.resolveHls(this,page);else Catalog.resolve(this,page);}}catch(Exception ignored){}});}
 @Override public MediaSession onGetSession(MediaSession.ControllerInfo i){return i.isTrusted()||i.getUid()==android.os.Process.myUid()?session:null;}
 @Override public void onDestroy(){handler.removeCallbacksAndMessages(null);network.shutdownNow();instance=null;if(session!=null)session.release();if(player!=null)player.release();super.onDestroy();}
private static long repeatDelay(String key,long at){long h=2166136261L;String seed=key+"|"+at;for(int i=0;i<seed.length();i++)h=((h^seed.charAt(i))*16777619L)&0xffffffffL;return (long)((6+30*h/4294967295.0)*3600000);}
}
