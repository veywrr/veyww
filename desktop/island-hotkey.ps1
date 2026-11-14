param([switch]$Check)
Add-Type -ReferencedAssemblies System.Windows.Forms -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.Runtime.InteropServices;
using System.Windows.Forms;
public static class VeywIslandHotkey {
  private static HashSet<int> modifiers = new HashSet<int>();
  private static bool armed, cancelled;
  private static IntPtr hook;
  private delegate IntPtr HookProc(int code, IntPtr message, IntPtr data);
  private static HookProc callback = OnKey;
  [DllImport("user32.dll", SetLastError=true)] private static extern IntPtr SetWindowsHookEx(int id, HookProc proc, IntPtr module, uint thread);
  [DllImport("user32.dll")] private static extern IntPtr CallNextHookEx(IntPtr hook, int code, IntPtr message, IntPtr data);
  [DllImport("user32.dll")] private static extern bool UnhookWindowsHookEx(IntPtr hook);
  [DllImport("kernel32.dll", CharSet=CharSet.Auto)] private static extern IntPtr GetModuleHandle(string name);
  private static bool Ctrl(){return modifiers.Contains(17)||modifiers.Contains(162)||modifiers.Contains(163);}
  private static bool Shift(){return modifiers.Contains(16)||modifiers.Contains(160)||modifiers.Contains(161);}
  public static void Reset(){modifiers.Clear();armed=false;cancelled=false;}
  public static bool Update(int key,bool down){
    bool modifier=key==17||key==162||key==163||key==16||key==160||key==161;
    if(down){if(modifier)modifiers.Add(key);else if(armed)cancelled=true;
      if(Ctrl()&&Shift()&&!armed){armed=true;cancelled=false;}return false;
    }
    if(modifier)modifiers.Remove(key);
    if(armed&&!(Ctrl()&&Shift())){bool fire=!cancelled;armed=false;cancelled=false;return fire;}
    return false;
  }
  private static IntPtr OnKey(int code,IntPtr message,IntPtr data){
    if(code>=0){int m=message.ToInt32();if(m==256||m==260||m==257||m==261){
      int key=Marshal.ReadInt32(data);if(Update(key,m==256||m==260))Console.WriteLine("TOGGLE");
    }}return CallNextHookEx(hook,code,message,data);
  }
  public static void Run(){
    hook=SetWindowsHookEx(13,callback,GetModuleHandle(null),0);
    if(hook==IntPtr.Zero){Console.WriteLine("UNAVAILABLE");return;}
    try{Console.WriteLine("READY");Application.Run();}finally{UnhookWindowsHookEx(hook);GC.KeepAlive(callback);}
  }
}
'@
if($Check){
  [VeywIslandHotkey]::Reset()
  $null=[VeywIslandHotkey]::Update(162,$true)
  $null=[VeywIslandHotkey]::Update(160,$true)
  if(-not [VeywIslandHotkey]::Update(160,$false)){throw 'Ctrl+Shift must toggle on release'}
  [VeywIslandHotkey]::Reset()
  $null=[VeywIslandHotkey]::Update(162,$true)
  $null=[VeywIslandHotkey]::Update(160,$true)
  $null=[VeywIslandHotkey]::Update(83,$true)
  if([VeywIslandHotkey]::Update(160,$false)){throw 'Ctrl+Shift+S must not toggle'}
  Write-Output 'Hotkey helper compiled; modifier-only and existing shortcuts verified.'
}else{[VeywIslandHotkey]::Run()}
