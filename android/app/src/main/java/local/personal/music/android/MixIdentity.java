package local.personal.music.android;
import java.text.Normalizer;
import java.util.Locale;
import org.json.JSONObject;
public final class MixIdentity {
 static String fold(String s){return Normalizer.normalize(s,Normalizer.Form.NFKC).toLowerCase(Locale.ROOT).replace('ё','е').replaceAll("[^\\p{L}\\p{N}]+"," ").trim();}
 static String artist(JSONObject t){String[] parts=t.optString("title").split("\\s+[—–-]\\s+",2);return fold(parts.length>1&&parts[0].length()<65?parts[0]:t.optString("artist"));}
 static String key(JSONObject t){String title=t.optString("title");String[] parts=title.split("\\s+[—–-]\\s+",2);if(parts.length>1&&parts[0].length()<65)title=parts[1];title=title.replaceAll("(?i)\\([^)]*(slowed|sped|speed|reverb|ускор|замедл)[^)]*\\)|\\[[^\\]]*(slowed|sped|speed|reverb)[^\\]]*\\]","").replaceAll("(?i)\\b(slowed|sped up|speed up|reverb|slowed down)\\b","");return artist(t)+"|"+fold(title);}
}
