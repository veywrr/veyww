package local.personal.music.android;
import android.content.Context;
import android.webkit.CookieManager;
import org.json.*;
import java.net.*;
import java.io.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
public final class ServerCatalog {
 private static final String ORIGIN="https://veyww.space";
 private static final Map<String,Entry> cache=new LinkedHashMap<>();
 private static final class Entry{final JSONObject value;final long at;Entry(JSONObject v){value=v;at=System.currentTimeMillis();}}
 public static String sessionCookie(){return MediaProxyAuth.cookie(CookieManager.getInstance().getCookie(ORIGIN));}
 public static JSONObject call(Context context,String mode,String value,int offset)throws Exception{
  if(!Arrays.asList("search","artist","related","resolve","resolve_hls","import_playlist").contains(mode))throw new IOException("Неподдерживаемый запрос");
  String cookie=sessionCookie();if(cookie.isEmpty())throw new IOException("Войди в аккаунт veyww в приложении");
  String key=cookie.hashCode()+"|"+mode+"|"+value+"|"+offset;long ttl=mode.startsWith("resolve")?240000:600000;
  synchronized(cache){Entry hit=cache.get(key);if(hit!=null&&System.currentTimeMillis()-hit.at<ttl)return new JSONObject(hit.value.toString());}
  URL url=new URL(ORIGIN+"/catalog/"+mode+"?value="+URLEncoder.encode(value,StandardCharsets.UTF_8.name())+"&offset="+Math.max(0,offset));
  HttpURLConnection connection=(HttpURLConnection)url.openConnection();connection.setConnectTimeout(15000);connection.setReadTimeout(65000);connection.setInstanceFollowRedirects(false);connection.setRequestProperty("Cookie",cookie);connection.setRequestProperty("User-Agent","veyww/0.10 Android");
  try{int status=connection.getResponseCode();if(status==401)throw new IOException("Сессия истекла. Открой приложение и войди в аккаунт veyww");
   if(status!=200)throw new IOException("Сервер каталога вернул HTTP "+status);
   ByteArrayOutputStream data=new ByteArrayOutputStream();try(InputStream in=connection.getInputStream()){byte[] part=new byte[8192];int size;while((size=in.read(part))!=-1){if(data.size()+size>8*1024*1024)throw new IOException("Слишком большой ответ");data.write(part,0,size);}}
   JSONObject result=new JSONObject(data.toString(StandardCharsets.UTF_8.name()));if(result.has("error"))throw new IOException(result.getString("error"));
   synchronized(cache){cache.put(key,new Entry(result));while(cache.size()>100)cache.remove(cache.keySet().iterator().next());}
   return new JSONObject(result.toString());
  }finally{connection.disconnect();}
 }
 public static String resolveHls(Context context,String page)throws Exception{JSONObject result=call(context,"resolve_hls",page,0);String url=result.getJSONObject("data").getString("url");if(url.startsWith("/"))url=ORIGIN+url;if(!MediaProxyAuth.isProxy(url))throw new IOException("Ожидался поток сервера veyww");return url;}
}
