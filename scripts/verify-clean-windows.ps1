param([string]$Packages = 'C:\DTF-input', [string]$Results = 'C:\DTF-results')
$ErrorActionPreference = 'Stop'
New-Item -ItemType Directory -Force -Path $Results | Out-Null
$script:messageId = 0
$script:report = [ordered]@{ nodePresent = [bool](Get-Command node -ErrorAction SilentlyContinue); os = [Environment]::OSVersion.Version.ToString(); checks = @(); failures = @(); success = $false }

function Assert-Condition($Condition, [string]$Message) { if (-not $Condition) { throw $Message } }
function Check([string]$Name, $Details) { $script:report.checks += @{ name = $Name; result = 'PASS'; details = $Details } }
function Wait-Until([scriptblock]$Predicate, [string]$Message, [int]$Seconds = 40) {
  $end = [DateTime]::UtcNow.AddSeconds($Seconds)
  do { if (& $Predicate) { return }; Start-Sleep -Milliseconds 250 } while ([DateTime]::UtcNow -lt $end)
  throw $Message
}
function Connect-Cdp([int]$Port) {
  $script:socketUrl = $null
  Wait-Until { try { $targets = Invoke-RestMethod "http://127.0.0.1:$Port/json/list" -TimeoutSec 1; $script:socketUrl = ($targets | Where-Object { $_.type -eq 'node' -or $_.type -eq 'page' } | Select-Object -First 1).webSocketDebuggerUrl; return [bool]$script:socketUrl } catch { return $false } } "No se pudo conectar al ejecutable en $Port."
  $socket = New-Object System.Net.WebSockets.ClientWebSocket
  $socket.ConnectAsync([Uri]$script:socketUrl, [Threading.CancellationToken]::None).GetAwaiter().GetResult() | Out-Null
  return ,$socket
}
function Cdp($Socket, [string]$Method, $Params) {
  $script:messageId++
  $id = $script:messageId
  $message = @{ id = $id; method = $Method; params = $Params } | ConvertTo-Json -Depth 30 -Compress
  $bytes = [Text.Encoding]::UTF8.GetBytes($message)
  $token = New-Object Threading.CancellationTokenSource 30000
  try {
    $Socket.SendAsync([ArraySegment[byte]]::new($bytes), [Net.WebSockets.WebSocketMessageType]::Text, $true, $token.Token).GetAwaiter().GetResult() | Out-Null
    do {
      $buffer = New-Object byte[] 65536
      $stream = New-Object IO.MemoryStream
      do { $part = $Socket.ReceiveAsync([ArraySegment[byte]]::new($buffer), $token.Token).GetAwaiter().GetResult(); $stream.Write($buffer, 0, $part.Count) } while (-not $part.EndOfMessage)
      $response = [Text.Encoding]::UTF8.GetString($stream.ToArray()) | ConvertFrom-Json
      $stream.Dispose()
    } while ($response.id -ne $id)
    if ($response.error) { throw ($response.error | ConvertTo-Json -Compress) }
    return $response.result
  } finally { $token.Dispose() }
}
function Js($Socket, [string]$Code) {
  $response = Cdp $Socket 'Runtime.evaluate' @{ expression = $Code; returnByValue = $true; awaitPromise = $true }
  if ($response.exceptionDetails) { throw ($response.exceptionDetails | ConvertTo-Json -Depth 12 -Compress) }
  return $response.result.value
}
function Run-Application([string]$Exe, [string]$Name) {
  $process = Start-Process -FilePath $Exe -ArgumentList '--inspect=127.0.0.1:9323','--remote-debugging-port=9322' -WindowStyle Hidden -PassThru
  $main = $null; $renderer = $null
  try {
    $main = Connect-Cdp 9323; $renderer = Connect-Cdp 9322
    Wait-Until { return (Js $renderer "Boolean(window.desktop && document.querySelector('h1'))") } 'La interfaz no se abrio.'
    $runtime = Js $main "(() => { const e=process.getBuiltinModule('module').createRequire(process.resourcesPath+'/app.asar/package.json')('electron'); globalThis.dtfElectron=e; return {version:e.app.getVersion(),data:e.app.getPath('userData'),exe:process.execPath}; })()"
    $isolated = Js $renderer "({protocol:location.protocol,node:typeof window.require,process:typeof window.process})"
    Assert-Condition ($isolated.protocol -eq 'app:' -and $isolated.node -eq 'undefined' -and $isolated.process -eq 'undefined') 'La interfaz no esta aislada.'
    Js $renderer "(() => { const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Empezar a maquetar'); if(b)b.click(); return true; })()" | Out-Null
    Wait-Until { return (Js $renderer "!document.querySelector('[role=dialog]') && !document.querySelector('input[type=file]').disabled") } 'No se pudo cerrar bienvenida.'
    Js $renderer "(async()=>{const c=document.createElement('canvas');c.width=600;c.height=300;const x=c.getContext('2d');x.fillStyle='red';x.fillRect(50,30,120,240);x.fillStyle='blue';x.fillRect(170,30,380,45);x.fillRect(470,75,80,195);const blob=await new Promise(r=>c.toBlob(r,'image/png'));const dt=new DataTransfer();dt.items.add(new File([blob],'prueba.png',{type:'image/png'}));const input=document.querySelector('input[type=file]');input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));return true;})()" | Out-Null
    Wait-Until { return (Js $renderer "document.querySelectorAll('[data-testid=design-card]').length===1") } 'No se pudo cargar PNG.'
    Js $renderer "(()=>{const set=(label,value)=>{const i=[...document.querySelectorAll('input')].find(i=>i.getAttribute('aria-label')===label);Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,value);i.dispatchEvent(new Event('input',{bubbles:true}));};set('Ancho (cm)','20');set('Copias','60');return true;})()" | Out-Null
    Wait-Until { return (Js $renderer "document.querySelector('[data-testid=layout-summary]')?.textContent.includes('60 piezas')") } 'No se calcularon las 60 copias.'
    $pdfFile = Join-Path $Results "$Name.pdf"
    $pdfJs = $pdfFile | ConvertTo-Json -Compress
    Js $main "dtfElectron.dialog.showSaveDialog=async()=>({canceled:false,filePath:$pdfJs});true" | Out-Null
    Js $renderer "(()=>{const a=document.querySelector('.low-dpi input');if(a&&!a.checked)a.click();return true;})()" | Out-Null
    Wait-Until { return (Js $renderer "!document.querySelector('.download-button').disabled") } 'Exportacion no disponible.'
    Js $renderer "document.querySelector('.download-button').click();true" | Out-Null
    Wait-Until { return (Test-Path -LiteralPath $pdfFile) } 'No se guardo el PDF.'
    Wait-Until { return (Js $renderer "[...document.querySelectorAll('[role=status]')].some(e=>e.textContent.includes('PDF guardado'))") } 'No se confirmo el guardado.'
    Assert-Condition ((Get-Item -LiteralPath $pdfFile).Length -gt 1000) 'PDF vacio.'
    Js $renderer "window.desktop.updatePreferences({hideWelcome:true}).then(()=>true)" | Out-Null
    $prefsFile = Join-Path $runtime.data 'preferences.json'
    $prefs = Get-Content -LiteralPath $prefsFile -Raw | ConvertFrom-Json
    Assert-Condition ($prefs.hideWelcome -eq $true -and $prefs.lastExportDirectory -eq $Results) 'No se conservaron preferencias.'
    Check "$Name-runtime-pdf" @{ version=$runtime.version; source=(Split-Path $Exe -Leaf); sha256=(Get-FileHash -LiteralPath $Exe -Algorithm SHA256).Hash; dataDirectory=$runtime.data; pdf=(Split-Path $pdfFile -Leaf); pieces=60; noExternalNode=$true; isolated=$true }
    return $runtime.data
  } finally {
    if ($main) { try { Js $main 'dtfElectron.app.exit(0)' | Out-Null } catch {}; $main.Dispose() }
    if ($renderer) { $renderer.Dispose() }
    if ($process -and -not $process.HasExited) { $process.WaitForExit(10000) | Out-Null }
    Start-Sleep -Milliseconds 500
  }
}

try {
  Assert-Condition (-not $script:report.nodePresent) 'Este Windows tiene Node instalado; no sirve como entorno limpio.'
  $script:report.packages = Get-ChildItem -LiteralPath $Packages -Filter '*.exe' | ForEach-Object { @{ name=$_.Name;sha256=(Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash } }
  $installer = (Get-ChildItem -LiteralPath $Packages -Filter 'MaquetadorDTF-Setup-*.exe' | Select-Object -First 1).FullName
  $portable = (Get-ChildItem -LiteralPath $Packages -Filter 'MaquetadorDTF-Portable-*.exe' | Select-Object -First 1).FullName
  try {
  $installDir = Join-Path $env:LOCALAPPDATA 'Programs\Maquetador DTF'
  $localInstaller = Join-Path $env:TEMP (Split-Path $installer -Leaf)
  Copy-Item -LiteralPath $installer -Destination $localInstaller
  Assert-Condition ((Get-FileHash -LiteralPath $localInstaller -Algorithm SHA256).Hash -eq (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash) 'La copia local del instalador no coincide.'
  $installer = $localInstaller
  $install = Start-Process -FilePath $installer -ArgumentList "/S /currentuser /D=$installDir" -WindowStyle Hidden -Wait -PassThru
  Assert-Condition ($install.ExitCode -eq 0) "Instalador termino con $($install.ExitCode)."
  $installedExe = Join-Path $installDir 'MaquetadorDTF.exe'
  Assert-Condition (Test-Path -LiteralPath $installedExe) 'No existe el ejecutable instalado.'
  $installedData = Run-Application $installedExe 'instalada'
  $before = Get-Content -LiteralPath (Join-Path $installedData 'preferences.json') -Raw
  $update = Start-Process -FilePath $installer -ArgumentList "/S /currentuser /D=$installDir" -WindowStyle Hidden -Wait -PassThru
  Assert-Condition ($update.ExitCode -eq 0) 'Fallo la reinstalacion/actualizacion.'
  Assert-Condition ((Get-Content -LiteralPath (Join-Path $installedData 'preferences.json') -Raw) -eq $before) 'La actualizacion cambio preferencias.'
  Check 'actualizacion-conserva-datos' $true
  $uninstaller = (Get-ChildItem -LiteralPath $installDir -Filter 'Uninstall*.exe' | Select-Object -First 1).FullName
  Start-Process -FilePath $uninstaller -ArgumentList '/S','/currentuser' -WindowStyle Hidden -Wait | Out-Null
  Wait-Until { return -not (Test-Path -LiteralPath $installedExe) } 'La desinstalacion no termino.'
  Assert-Condition (Test-Path -LiteralPath (Join-Path $installedData 'preferences.json')) 'La desinstalacion elimino preferencias.'
  Check 'desinstalacion-conserva-datos' $true
  } catch { $script:report.failures += @{ name='instalador'; error=$_.ToString(); stack=$_.ScriptStackTrace } }
  try {
  $portableDir = Join-Path $env:USERPROFILE 'Desktop\DTF-portatil'
  New-Item -ItemType Directory -Force -Path $portableDir | Out-Null
  $portableExe = Join-Path $portableDir (Split-Path $portable -Leaf)
  Copy-Item -LiteralPath $portable -Destination $portableExe
  $portableData = Run-Application $portableExe 'portatil'
  Assert-Condition ($portableData -eq (Join-Path $portableDir 'MaquetadorDTF-datos')) 'El portatil no guarda junto al exe.'
  $movedDir = Join-Path $env:USERPROFILE 'Desktop\DTF-movido'
  Move-Item -LiteralPath $portableDir -Destination $movedDir
  $movedExe = Join-Path $movedDir (Split-Path $portable -Leaf)
  $movedData = Run-Application $movedExe 'portatil-movido'
  Assert-Condition ((Get-Content -LiteralPath (Join-Path $movedData 'preferences.json') -Raw | ConvertFrom-Json).hideWelcome) 'Se perdieron preferencias al mover el portatil.'
  Check 'portatil-movido-conserva-datos' $true
  } catch { $script:report.failures += @{ name='portatil'; error=$_.ToString(); stack=$_.ScriptStackTrace } }
  $script:report.success = ($script:report.failures.Count -eq 0)
} catch {
  $script:report.error = $_.ToString()
  $script:report.stack = $_.ScriptStackTrace
} finally {
  $script:report | ConvertTo-Json -Depth 20 | Set-Content -LiteralPath (Join-Path $Results 'verification.json') -Encoding utf8
  'Comprobacion terminada. Consulta verification.json.' | Set-Content -LiteralPath (Join-Path $Results 'finished.txt')
  shutdown.exe /s /t 5 | Out-Null
}
