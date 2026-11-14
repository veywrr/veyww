package local.personal.music.android;
import android.content.Context;
import android.net.Uri;
import androidx.media3.datasource.*;
import org.json.*;
import java.nio.charset.StandardCharsets;
import java.net.URI;
@androidx.annotation.OptIn(markerClass=androidx.media3.common.util.UnstableApi.class)
public final class PlaybackDiagnostics {
 static String read(String url,int maximum) throws Exception {
  DefaultHttpDataSource data=new DefaultHttpDataSource.Factory().setUserAgent("PersonalMusic/0.5 (Android)").setConnectTimeoutMs(15000).setReadTimeoutMs(15000).createDataSource();
  try{data.open(new DataSpec(Uri.parse(url)));java.io.ByteArrayOutputStream out=new java.io.ByteArrayOutputStream();byte[] b=new byte[Math.min(maximum,8192)];while(out.size()<maximum){int n=data.read(b,0,Math.min(b.length,maximum-out.size()));if(n<0)break;out.write(b,0,n);}return out.toString(StandardCharsets.UTF_8.name());}finally{data.close();}
 }
 static JSONObject run(Context c,String page){JSONArray steps=new JSONArray();JSONObject report=new JSONObject();String stage="Получение аудио";try{
  JSONObject resolved=Catalog.call(c,"resolve_hls",page,0);if(resolved.has("error"))throw new Exception(resolved.getString("error"));String url=resolved.getJSONObject("data").getString("url");steps.put("Адрес открытого HLS: получен");stage="Загрузка плейлиста аудио";String manifest=read(url,262144);if(!manifest.startsWith("#EXTM3U"))throw new Exception("Сервер вернул не HLS");steps.put("HLS-плейлист: доступен");String part=null;for(String line:manifest.split("\\n")){line=line.trim();if(!line.isEmpty()&&!line.startsWith("#")){part=line;break;}}if(part!=null){stage="Загрузка аудио";String first=new URI(url).resolve(part).toString();read(first,128);steps.put("Данные аудио: доступны");}
  steps.put("Последняя ошибка плеера: "+(PlaybackService.instance==null||PlaybackService.instance.lastPlaybackError.isEmpty()?"нет":PlaybackService.instance.lastPlaybackError));report.put("ok",true);
 }catch(Exception e){String cause=e instanceof HttpDataSource.InvalidResponseCodeException?"HTTP "+((HttpDataSource.InvalidResponseCodeException)e).responseCode:e.getClass().getSimpleName();steps.put(stage+": "+cause);try{report.put("ok",false);}catch(JSONException ignored){}}
 try{report.put("version","0.6.0").put("steps",steps).put("android",android.os.Build.VERSION.RELEASE);}catch(JSONException ignored){}return report;
 }
}
