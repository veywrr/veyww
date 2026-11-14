package local.personal.music.android;
import org.junit.Test;
import static org.junit.Assert.*;
import java.nio.*;
import androidx.media3.common.C;
import androidx.media3.common.audio.*;
@androidx.annotation.OptIn(markerClass=androidx.media3.common.util.UnstableApi.class)
public class LinkedRateTest {
 @Test public void slowingWithEqualPitchFactorLowersFrequencyNaturally() throws Exception {
  SonicAudioProcessor p=new SonicAudioProcessor();p.setSpeed(.8f);p.setPitch(.8f);p.configure(new AudioProcessor.AudioFormat(48000,2,C.ENCODING_PCM_16BIT));p.flush();
  ByteBuffer input=ByteBuffer.allocateDirect(48000*4).order(ByteOrder.nativeOrder());for(int i=0;i<48000;i++){short value=(short)(Math.sin(2*Math.PI*440*i/48000)*6000);input.putShort(value).putShort(value);}input.flip();p.queueInput(input);p.queueEndOfStream();ByteBuffer out=p.getOutput().order(ByteOrder.nativeOrder());int frames=out.remaining()/4;assertTrue(Math.abs(frames/48000d-1.25)<.03);int crossing=0;short previous=0;for(int i=0;i<frames;i++){short sample=out.getShort();out.getShort();if(i>12000&&i<36000&&previous<=0&&sample>0)crossing++;previous=sample;}assertTrue("0.8x should produce about 352 Hz",Math.abs(crossing*2-352)<8);
 }
}
