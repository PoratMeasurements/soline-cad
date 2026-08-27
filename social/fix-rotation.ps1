# Rotates library JPEGs so the pixels themselves are upright.
#
# 77% of the exported photos were stored sideways with an EXIF Orientation flag
# telling the viewer to rotate them. Instagram honours that flag; plenty of
# upload tools and preview panes do not, so the folders looked like a pile of
# photos on their side. GDI+'s Transformation encoder rotates the JPEG at the
# DCT-block level - no decode, no re-encode, no quality loss (iPhone frames are
# 4032x3024, both multiples of the 16px MCU, so the transform stays lossless).
#
# Deliberately ASCII-only: Windows PowerShell 5.1 reads .ps1 files as ANSI when
# there is no BOM, which mangled the Hebrew paths and messages this once had.
# -Path is required for the same reason - the caller passes it in.
#
#   .\fix-rotation.ps1 -Path "<folder>" [-Preview]

param(
  [Parameter(Mandatory = $true)][string]$Path,
  [switch]$Preview
)

Add-Type -AssemblyName System.Drawing

if (-not (Test-Path -LiteralPath $Path)) {
  Write-Host "ERROR: path not found: $Path"
  exit 1
}

$codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
# NB: PowerShell variables are case-insensitive, so this must not be named $ORIENT
# next to the per-file $orient - that collision silently broke the first version.
$OrientationTagId = [int]0x0112

function New-TransformParams([System.Drawing.Imaging.EncoderValue]$v) {
  $ep = New-Object System.Drawing.Imaging.EncoderParameters(1)
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter([System.Drawing.Imaging.Encoder]::Transformation, [int]$v)
  return $ep
}

$files = @(Get-ChildItem -LiteralPath $Path -Recurse -File | Where-Object { $_.Extension -match '^\.jpe?g$' })
Write-Host "scanning $($files.Count) jpeg files under $Path"

$rotated = 0; $skipped = 0; $failed = 0; $bytesBefore = 0; $bytesAfter = 0
$i = 0

foreach ($f in $files) {
  $i++
  if ($i % 100 -eq 0) { Write-Host "  $i/$($files.Count)..." }

  $orient = 1
  $img = $null
  try {
    $img = [System.Drawing.Image]::FromFile($f.FullName)
    if ($img.PropertyIdList -contains $OrientationTagId) {
      $orient = [int][BitConverter]::ToUInt16($img.GetPropertyItem($OrientationTagId).Value, 0)
    }
  } catch {
    if ($img) { $img.Dispose() }
    $failed++
    continue
  }

  # 2/4/5/7 involve mirroring, which a plain rotation cannot express - leave the
  # flag on those rather than produce a flipped image.
  $transform = switch ($orient) {
    3 { [System.Drawing.Imaging.EncoderValue]::TransformRotate180 }
    6 { [System.Drawing.Imaging.EncoderValue]::TransformRotate90 }
    8 { [System.Drawing.Imaging.EncoderValue]::TransformRotate270 }
    default { $null }
  }

  if ($null -eq $transform) { $img.Dispose(); $skipped++; continue }
  if ($Preview) { $img.Dispose(); $rotated++; continue }

  $tmp = "$($f.FullName).rot"
  try {
    # Drop the flag first, or the viewer would rotate the already-rotated pixels again.
    $img.RemovePropertyItem($OrientationTagId)
    $img.Save($tmp, $codec, (New-TransformParams $transform))
    $img.Dispose()
    $bytesBefore += $f.Length
    $bytesAfter += (Get-Item -LiteralPath $tmp).Length
    Move-Item -LiteralPath $tmp -Destination $f.FullName -Force
    $rotated++
  } catch {
    if ($img) { $img.Dispose() }
    if (Test-Path -LiteralPath $tmp) { Remove-Item -LiteralPath $tmp -Force }
    $failed++
    Write-Host "  failed: $($f.Name) - $($_.Exception.Message)"
  }
}

Write-Host ""
Write-Host "rotated: $rotated   already upright: $skipped   failed: $failed"
if ($bytesBefore -gt 0) {
  Write-Host ("size: {0:N0} KB -> {1:N0} KB  ({2:P1})" -f ($bytesBefore / 1KB), ($bytesAfter / 1KB), (($bytesAfter - $bytesBefore) / $bytesBefore))
}
