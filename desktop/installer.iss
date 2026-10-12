#define AppVersion "0.3.0"
[Setup]
AppId={{6F369205-F341-4AFA-9804-E485690423B2}
AppName=RAID Companion Reader Preview
AppVersion={#AppVersion}
AppPublisher=RAID Companion
DefaultDirName={localappdata}\Programs\RAID Companion Reader Preview
DefaultGroupName=RAID Companion Reader Preview
PrivilegesRequired=lowest
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
MinVersion=10.0
OutputDir=installer-output
OutputBaseFilename=RAID-Companion-Reader-Preview-Setup-{#AppVersion}-x64
Compression=lzma2
SolidCompression=yes
WizardStyle=modern
DisableProgramGroupPage=yes
InfoBeforeFile=INSTALL-NOTES.txt
UninstallDisplayIcon={app}\RAIDCompanionReader.exe
[Tasks]
Name: "desktopicon"; Description: "Create a desktop shortcut"; GroupDescription: "Shortcuts:"
[Files]
Source: "dist\RAIDCompanionReader\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs
Source: "INSTALL-NOTES.txt"; DestDir: "{app}"; Flags: ignoreversion
[Icons]
Name: "{group}\RAID Companion Reader Preview"; Filename: "{app}\RAIDCompanionReader.exe"
Name: "{autodesktop}\RAID Companion Reader Preview"; Filename: "{app}\RAIDCompanionReader.exe"; Tasks: desktopicon
[Run]
Filename: "{app}\RAIDCompanionReader.exe"; Description: "Open RAID Companion Reader Preview"; Flags: nowait postinstall skipifsilent
