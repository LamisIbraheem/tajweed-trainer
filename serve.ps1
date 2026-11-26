# Serves this folder at http://localhost:8765 (optional; you can also just open index.html).
param([int]$Port = 8765)
$root = $PSScriptRoot
$types = @{ ".html"="text/html; charset=utf-8"; ".js"="text/javascript; charset=utf-8"; ".css"="text/css; charset=utf-8";
            ".json"="application/json"; ".svg"="image/svg+xml"; ".png"="image/png"; ".ico"="image/x-icon"; ".md"="text/plain; charset=utf-8"; ".webmanifest"="application/manifest+json" }
$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Start()
Write-Host "Tajweed Trainer running at http://localhost:$Port/  (Ctrl+C to stop)"
try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    # One bad request (e.g. a HEAD request, or a browser closing the connection early) must not stop the server.
    try {
      $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
      if ([string]::IsNullOrEmpty($path)) { $path = "index.html" }
      $file = [IO.Path]::GetFullPath((Join-Path $root $path))
      if ($file.StartsWith($root) -and (Test-Path $file -PathType Leaf)) {
        $bytes = [IO.File]::ReadAllBytes($file)
        $ext = [IO.Path]::GetExtension($file).ToLower()
        $ctx.Response.ContentType = if ($types[$ext]) { $types[$ext] } else { "application/octet-stream" }
        $ctx.Response.ContentLength64 = $bytes.Length
        if ($ctx.Request.HttpMethod -ne "HEAD") { $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length) }
      } else { $ctx.Response.StatusCode = 404 }
    } catch { Write-Host "Request failed: $($_.Exception.Message)" }
    try { $ctx.Response.Close() } catch {}
  }
} finally { $listener.Stop() }
