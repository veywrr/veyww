package local.personal.music.android;
import java.net.URI;
import java.util.*;
public final class MediaProxyAuth {
 private MediaProxyAuth(){}
 public static boolean isProxy(String url){try{URI u=new URI(url);return "https".equalsIgnoreCase(u.getScheme())&&"veyww.space".equalsIgnoreCase(u.getHost())&&u.getUserInfo()==null&&(u.getPort()==-1||u.getPort()==443)&&u.getPath().startsWith("/media/");}catch(Exception e){return false;}}
 public static String cookie(String raw){if(raw==null||raw.indexOf('\r')>=0||raw.indexOf('\n')>=0)return "";for(String part:raw.split(";")){String value=part.trim();if(value.startsWith("music_session=")&&value.length()<600)return value;}return "";}
 public static Map<String,String> headers(String url,String raw){String value=cookie(raw);return isProxy(url)&&!value.isEmpty()?Collections.singletonMap("Cookie",value):Collections.emptyMap();}
}
