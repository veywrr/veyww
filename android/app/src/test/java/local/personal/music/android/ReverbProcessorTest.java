package local.personal.music.android;
import org.junit.Test;
import static org.junit.Assert.*;
import java.nio.*;
import androidx.media3.common.C;
import androidx.media3.common.audio.AudioProcessor.AudioFormat;
@androidx.annotation.OptIn(markerClass=androidx.media3.common.util.UnstableApi.class)
public class ReverbProcessorTest {
 @Test public void dryPassThroughAndStereoTail() throws Exception {
  ReverbProcessor p=new ReverbProcessor();p.configure(new AudioFormat(48000,2,C.ENCODING_PCM_16BIT));p.flush();
  ByteBuffer dry=ByteBuffer.allocateDirect(16).order(ByteOrder.nativeOrder());dry.putShort((short)12000).putShort((short)-9000).putShort((short)0).putShort((short)5).flip();p.queueInput(dry);ByteBuffer o=p.getOutput().order(ByteOrder.nativeOrder());assertEquals(12000,o.getShort());assertEquals(-9000,o.getShort());
  p.flush();p.mix=.8f;ByteBuffer input=ByteBuffer.allocateDirect(48000*4).order(ByteOrder.nativeOrder());input.putShort((short)20000).putShort((short)0);while(input.hasRemaining())input.putShort((short)0);input.flip();p.queueInput(input);o=p.getOutput().order(ByteOrder.nativeOrder());long tail=0;int frame=0;while(o.remaining()>=4){int left=o.getShort(),right=o.getShort();assertEquals("No cross-channel leak",0,right);if(frame++>1000)tail+=Math.abs(left);}assertTrue("Reverb must produce an audible tail",tail>10000);
 }
}
