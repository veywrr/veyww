using System;
using System.IO;
using System.Runtime.InteropServices;
using System.Runtime.Serialization;
using System.Runtime.Serialization.Json;
using System.Text;

[DataContract] public class GlassInput {
 [DataMember(Name="enabled")] public bool Enabled;
 [DataMember(Name="rounded")] public bool Rounded;
 [DataMember(Name="transparency")] public double Transparency;
 [DataMember(Name="tint")] public string Tint;
}
public static class VeywwGlass {
 [StructLayout(LayoutKind.Sequential)] struct Accent { public int State; public int Flags; public uint Color; public int Animation; }
 [StructLayout(LayoutKind.Sequential)] struct Composition { public int Attribute; public IntPtr Data; public int Size; }
 [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window,out uint process);
 [DllImport("user32.dll")] static extern bool SetWindowCompositionAttribute(IntPtr window,ref Composition data);
 [StructLayout(LayoutKind.Sequential)] struct Rect { public int Left,Top,Right,Bottom; }
 [DllImport("user32.dll")] static extern bool GetWindowRect(IntPtr window,out Rect rect);
 [DllImport("gdi32.dll")] static extern IntPtr CreateRoundRectRgn(int left,int top,int right,int bottom,int width,int height);
 [DllImport("user32.dll")] static extern int SetWindowRgn(IntPtr window,IntPtr region,bool redraw);
 [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr obj);
 static uint Tint(string text,int alpha) {
  uint rgb;if(text==null||text.Length!=7||text[0]!='#'||!UInt32.TryParse(text.Substring(1),System.Globalization.NumberStyles.HexNumber,null,out rgb))rgb=0x304b53;
  uint a=(uint)Math.Max(0,Math.Min(255,alpha));return (a<<24)|((rgb&255)<<16)|(rgb&65280)|((rgb>>16)&255);
 }
 static bool Apply(ulong handle,int owner,GlassInput input) {
  IntPtr window=new IntPtr(unchecked((long)handle));uint actual;
  if(window==IntPtr.Zero||GetWindowThreadProcessId(window,out actual)==0||actual!=(uint)owner)return false;
  if(input.Rounded) { Rect rect;if(GetWindowRect(window,out rect)) { int w=rect.Right-rect.Left,h=rect.Bottom-rect.Top,pad=Math.Max(2,(int)Math.Round(h*4.0/52));IntPtr region=CreateRoundRectRgn(pad,pad,w-pad,h-pad,h-pad*2,h-pad*2);if(region!=IntPtr.Zero&&SetWindowRgn(window,region,true)==0)DeleteObject(region); } }
  double opacity=Double.IsNaN(input.Transparency)||Double.IsInfinity(input.Transparency)?65:Math.Max(0,Math.Min(98,input.Transparency));
  var policy=new Accent { State=input.Enabled?3:0,Flags=2,Color=Tint(input.Tint,(int)(25+(1-opacity/100)*110)),Animation=0 };
  IntPtr memory=Marshal.AllocHGlobal(Marshal.SizeOf(policy));
  try {
   Marshal.StructureToPtr(policy,memory,false);var data=new Composition { Attribute=19,Data=memory,Size=Marshal.SizeOf(policy) };
   if(SetWindowCompositionAttribute(window,ref data))return true;
   if(!input.Enabled)return false;
   policy.State=2;Marshal.StructureToPtr(policy,memory,false);return SetWindowCompositionAttribute(window,ref data);
  } finally { Marshal.FreeHGlobal(memory); }
 }
 public static int Main(string[] args) {
  if(args.Length==1&&args[0]=="--self-test") {
   if(Tint("#112233",128)!=0x80332211u||Tint("bad",255)!=0xff534b30u)return 2;
   Console.WriteLine("Glass helper self-test passed");return 0;
  }
  ulong handle;int owner;if(args.Length!=2||!UInt64.TryParse(args[0],out handle)||!Int32.TryParse(args[1],out owner)||owner<=0)return 1;
  var parser=new DataContractJsonSerializer(typeof(GlassInput));string line;
  while((line=Console.ReadLine())!=null){try{if(line.Length>2048)throw new InvalidDataException();GlassInput input;using(var stream=new MemoryStream(Encoding.UTF8.GetBytes(line)))input=(GlassInput)parser.ReadObject(stream);bool applied=Apply(handle,owner,input);Console.WriteLine("{\"enabled\":"+(input.Enabled?"true":"false")+",\"applied\":"+(applied?"true":"false")+"}");}catch{Console.WriteLine("{\"applied\":false}");}}
  return 0;
 }
}
