$ProjectPath = "E:\Temp\VS\petrol"
$Port = 8080

$pythonJob = Start-Job -ScriptBlock { param($p, $d) python -m http.server $p -d $d } -ArgumentList $Port, $ProjectPath

$tunnelJob = Start-Job -ScriptBlock { param($p) cmd /c "npx localtunnel --port $p 2>&1" } -ArgumentList $Port

Start-Sleep -Seconds 8

$output = Receive-Job -Job $tunnelJob
Write-Host "URL del tunel:" -ForegroundColor Green
$output
Write-Host "`nPython server en http://localhost:$Port" -ForegroundColor Green
Write-Host "`nVe a https://pwabuilder.com e ingresa la URL del tunel" -ForegroundColor Yellow
Write-Host "Presiona Ctrl+C para detener todo" -ForegroundColor Cyan

while ($true) { Start-Sleep -Seconds 10 }
