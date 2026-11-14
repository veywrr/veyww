package local.personal.music.android;
import android.content.*;
import android.net.Uri;
import android.provider.MediaStore;
import androidx.test.ext.junit.runners.AndroidJUnit4;
import androidx.test.platform.app.InstrumentationRegistry;
import org.junit.*;
import org.junit.runner.RunWith;
import org.json.*;
import java.io.*;
import java.nio.*;
import static org.junit.Assert.*;

@RunWith(AndroidJUnit4.class)
public class PlaybackRuntimeTest {
 private Context context;private PlaybackService service;private android.app.Activity activity;
 @Before public void setUp() throws Exception {context=InstrumentationRegistry.getInstrumentation().getTargetContext();activity=InstrumentationRegistry.getInstrumentation().startActivitySync(new Intent(context,MainActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));long end=System.currentTimeMillis()+10000;while(PlaybackService.instance==null&&System.currentTimeMillis()<end)Thread.sleep(100);service=PlaybackService.instance;assertNotNull(service);}
 @After public void tearDown(){if(service!=null)InstrumentationRegistry.getInstrumentation().runOnMainSync(()->service.player.stop());context.stopService(new Intent(context,PlaybackService.class));if(activity!=null)InstrumentationRegistry.getInstrumentation().runOnMainSync(()->activity.finish());}
 private void play(JSONObject t)throws Exception {final Exception[] error={null};InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{try{service.play(t);}catch(Exception e){error[0]=e;}});if(error[0]!=null)throw error[0];}
 private void assertProgress()throws Exception {long end=System.currentTimeMillis()+35000;final long[] position={0};while(System.currentTimeMillis()<end){InstrumentationRegistry.getInstrumentation().runOnMainSync(()->position[0]=service.player.getCurrentPosition());if(position[0]>700)return;if(!service.lastPlaybackError.isEmpty())fail(service.lastPlaybackError);Thread.sleep(200);}fail("Player did not progress beyond buffering");}
 @Test public void progressiveTrackIsNotMistakenForHls()throws Exception {
  ContentValues values=new ContentValues();values.put(MediaStore.Audio.Media.DISPLAY_NAME,"music-playback-test.wav");values.put(MediaStore.Audio.Media.MIME_TYPE,"audio/wav");Uri uri=context.getContentResolver().insert(MediaStore.Audio.Media.EXTERNAL_CONTENT_URI,values);assertNotNull(uri);
  try {int size=48000*2*3;ByteBuffer wav=ByteBuffer.allocate(44+size).order(ByteOrder.LITTLE_ENDIAN);wav.put("RIFF".getBytes()).putInt(36+size).put("WAVEfmt ".getBytes()).putInt(16).putShort((short)1).putShort((short)1).putInt(48000).putInt(96000).putShort((short)2).putShort((short)16).put("data".getBytes()).putInt(size);for(int i=0;i<size/2;i++)wav.putShort((short)(Math.sin(i*2*Math.PI*440/48000)*3000));try(OutputStream out=context.getContentResolver().openOutputStream(uri)){out.write(wav.array());}
   play(new JSONObject().put("id","runtime-test").put("title","Test").put("source","SoundCloud").put("url",uri.toString()).put("hls",false));assertProgress();
  }finally{context.getContentResolver().delete(uri,null,null);}
 }
 @Test public void publicSoundcloudTrackPlaysOnAndroid()throws Exception {
  JSONObject result=Catalog.call(context,"resolve","https://soundcloud.com/madk1d9/zasosy",0);
  Assume.assumeFalse("Public source unavailable: "+result.optString("error"),result.has("error"));JSONObject stream=result.getJSONObject("data"),track=stream.getJSONObject("track");track.put("url",stream.getString("url")).put("hls",stream.optBoolean("hls"));
  play(track);assertProgress();System.out.println("LIVE_ANDROID_PLAYBACK_PASSED");
 }

 @Test public void opaqueProxyHlsPreservesMimeWithNativeQueue()throws Exception {
  JSONObject entry=new JSONObject().put("id","proxy-type-test").put("source","SoundCloud").put("page","https://soundcloud.com/artist/track").put("title","Test");
  JSONObject stream=new JSONObject(entry.toString()).put("url","https://veyww.space/media/test").put("hls",true).put("nativeQueue",new JSONArray().put(entry));
  final String[] mime={null};final Exception[] problem={null};
  InstrumentationRegistry.getInstrumentation().runOnMainSync(()->{try{service.play(stream);mime[0]=service.player.getMediaItemAt(0).localConfiguration.mimeType;service.player.stop();}catch(Exception e){problem[0]=e;}});
  if(problem[0]!=null)throw problem[0];assertEquals(androidx.media3.common.MimeTypes.APPLICATION_M3U8,mime[0]);
 }
}
