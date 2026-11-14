package local.personal.music.android;

import androidx.media3.common.C;
import androidx.media3.common.audio.BaseAudioProcessor;
import androidx.media3.common.audio.AudioProcessor.AudioFormat;
import java.nio.ByteBuffer;

/** Four damped feedback combs per channel, mixed without replacing the dry signal. */
@androidx.annotation.OptIn(markerClass = androidx.media3.common.util.UnstableApi.class)
public final class ReverbProcessor extends BaseAudioProcessor {
    public volatile float mix = 0;
    private float[][][] lines;
    private int[][] positions;
    private float[][] damp;
    private int channel;
    private float currentMix;
    private final float[] times={.0297f,.0371f,.0411f,.0437f};
    @Override protected AudioFormat onConfigure(AudioFormat format) throws UnhandledAudioFormatException {
        if(format.encoding!=C.ENCODING_PCM_16BIT)throw new UnhandledAudioFormatException(format);
        lines=new float[format.channelCount][4][];positions=new int[format.channelCount][4];damp=new float[format.channelCount][4];
        for(int c=0;c<lines.length;c++)for(int j=0;j<4;j++)lines[c][j]=new float[(int)(format.sampleRate*times[j])+c*23];
        return format;
    }
    @Override public void queueInput(ByteBuffer input){
        ByteBuffer output=replaceOutputBuffer(input.remaining());float amount=Math.max(0,Math.min(1,mix));
        while(input.remaining()>=2){float dry=input.getShort()/32768f,wet=0;int c=channel;
            if (c == 0) currentMix += (amount - currentMix) * .002f;
            for(int j=0;j<4;j++){int i=positions[c][j];float delayed=lines[c][j][i];damp[c][j]=delayed*.35f+damp[c][j]*.65f;lines[c][j][i]=dry*.29f+damp[c][j]*.84f;positions[c][j]=(i+1)%lines[c][j].length;wet+=delayed;}
            float value=dry*(1-.34f*currentMix)+wet*.68f*currentMix;output.putShort((short)(Math.max(-1,Math.min(.999969f,value))*32768));channel=(channel+1)%lines.length;
        }output.flip();
    }
    @Override protected void onFlush(){channel=0;currentMix=mix;if(lines!=null)for(int c=0;c<lines.length;c++)for(int j=0;j<4;j++){java.util.Arrays.fill(lines[c][j],0);positions[c][j]=0;damp[c][j]=0;}}
}
