param(
    [string]$PythonExe = 'python',
    [string]$InnoCompiler = 'ISCC.exe'
)
$ErrorActionPreference = 'Stop'
Push-Location $PSScriptRoot
try {
    & $PythonExe -m PyInstaller --noconfirm --windowed --onedir --name RAIDCompanionReader reader_app.py
    if ($LASTEXITCODE -ne 0) { throw 'Windows application build failed.' }
    $pythonLicense = & $PythonExe -c "import sys;from pathlib import Path;print(Path(sys.base_prefix)/'LICENSE.txt')"
    $pyinstallerLicense = & $PythonExe -c "import importlib.metadata as m;d=m.distribution('pyinstaller');print(next(d.locate_file(f) for f in d.files if str(f).endswith('/licenses/COPYING.txt')))"
    Copy-Item -LiteralPath $pythonLicense -Destination 'dist/RAIDCompanionReader/PYTHON-LICENSE.txt'
    Copy-Item -LiteralPath $pyinstallerLicense -Destination 'dist/RAIDCompanionReader/PYINSTALLER-LICENSE.txt'
    $smoke = Start-Process -FilePath "$PSScriptRoot/dist/RAIDCompanionReader/RAIDCompanionReader.exe" -ArgumentList '--smoke-test' -WindowStyle Hidden -Wait -PassThru
    if ($smoke.ExitCode -ne 0) { throw 'Bundled app startup check failed.' }
    & $InnoCompiler installer.iss
    if ($LASTEXITCODE -ne 0) { throw 'Installer build failed.' }
    Get-FileHash -LiteralPath 'installer-output/RAID-Companion-Reader-Preview-Setup-0.2.0-x64.exe' -Algorithm SHA256
} finally {
    Pop-Location
}
