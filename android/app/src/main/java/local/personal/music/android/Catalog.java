package local.personal.music.android;
import android.content.Context;
import com.chaquo.python.Python;
import com.chaquo.python.android.AndroidPlatform;
import org.json.*;
public final class Catalog {
 private static synchronized void init(Context c){if(!Python.isStarted())Python.start(new AndroidPlatform(c.getApplicationContext()));}
 public static JSONObject call(Context c,String mode,String value,int offset) throws Exception {init(c);return new JSONObject(Python.getInstance().getModule("catalog").callAttr("call",mode,value,offset).toString());}
 public static String resolve(Context c,String page) throws Exception {JSONObject j=call(c,"resolve",page,0);if(j.has("error"))throw new java.io.IOException(j.getString("error"));return j.getJSONObject("data").getString("url");}
 public static String resolveHls(Context c,String page) throws Exception {JSONObject j=call(c,"resolve_hls",page,0);if(j.has("error"))throw new java.io.IOException(j.getString("error"));return j.getJSONObject("data").getString("url");}
}
