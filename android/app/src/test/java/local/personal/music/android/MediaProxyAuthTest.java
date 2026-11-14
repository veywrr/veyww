package local.personal.music.android;
import org.junit.Test;
import static org.junit.Assert.*;
public class MediaProxyAuthTest{
 @Test public void cookieIsSentOnlyToOwnMediaProxy(){assertEquals("music_session=abc",MediaProxyAuth.headers("https://veyww.space/media/123","other=x; music_session=abc").get("Cookie"));for(String url:new String[]{"https://soundcloud.com/a/b","https://veyww.space.evil.test/media/a","http://veyww.space/media/a","https://veyww.space:444/media/a","https://user@veyww.space/media/a","https://veyww.space/account/me"})assertTrue(MediaProxyAuth.headers(url,"music_session=abc").isEmpty());assertTrue(MediaProxyAuth.headers("https://veyww.space/media/a","music_session=abc\r\nx=y").isEmpty());}
}
