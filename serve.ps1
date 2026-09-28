param([switch]$NoBrowser)
$ErrorActionPreference = 'Stop'
$root = [System.IO.Path]::GetFullPath($PSScriptRoot)
$port = 18765
$listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $port)
$mime = @{ '.html'='text/html; charset=utf-8'; '.mjs'='text/javascript; charset=utf-8'; '.js'='text/javascript; charset=utf-8'; '.css'='text/css; charset=utf-8'; '.md'='text/plain; charset=utf-8' }

try {
  $listener.Start()
  if (-not $NoBrowser) { Start-Process "http://127.0.0.1:$port/" }
  Write-Host "Starfall Exchange is running at http://127.0.0.1:$port/"
  Write-Host "Keep this window open while playing. Press Ctrl+C to stop."
  while ($true) {
    $client = $listener.AcceptTcpClient()
    try {
      $stream = $client.GetStream()
      $reader = [System.IO.StreamReader]::new($stream, [System.Text.Encoding]::ASCII, $false, 1024, $true)
      $requestLine = $reader.ReadLine()
      while (($line = $reader.ReadLine()) -ne '') { if ($null -eq $line) { break } }
      $target = if ($requestLine -match '^GET\s+([^\s]+)') { [Uri]::UnescapeDataString($Matches[1].Split('?')[0]) } else { '/' }
      if ($target -eq '/') { $target = '/index.html' }
      $relative = $target.TrimStart('/').Replace('/', [System.IO.Path]::DirectorySeparatorChar)
      $path = [System.IO.Path]::GetFullPath((Join-Path $root $relative))
      $allowed = $path.StartsWith($root, [System.StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $path -PathType Leaf)
      if ($allowed) {
        $body = [System.IO.File]::ReadAllBytes($path)
        $ext = [System.IO.Path]::GetExtension($path).ToLowerInvariant()
        $contentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $header = "HTTP/1.1 200 OK`r`nContent-Type: $contentType`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
      } else {
        $body = [System.Text.Encoding]::UTF8.GetBytes('Not found')
        $header = "HTTP/1.1 404 Not Found`r`nContent-Type: text/plain; charset=utf-8`r`nContent-Length: $($body.Length)`r`nConnection: close`r`n`r`n"
      }
      $headerBytes = [System.Text.Encoding]::ASCII.GetBytes($header)
      $stream.Write($headerBytes, 0, $headerBytes.Length)
      $stream.Write($body, 0, $body.Length)
    } finally {
      $client.Dispose()
    }
  }
} finally {
  $listener.Stop()
}
