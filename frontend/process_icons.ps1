Add-Type -AssemblyName System.Drawing
$path = "d:\New\Apps\UrbanAnalysis\frontend\public\assets\icons.png"
$img = [System.Drawing.Bitmap]::FromFile($path)
$newImg = New-Object System.Drawing.Bitmap $img.Width, $img.Height
for ($x = 0; $x -lt $img.Width; $x++) {
    for ($y = 0; $y -lt $img.Height; $y++) {
        $p = $img.GetPixel($x, $y)
        $lum = [math]::Floor(0.299*$p.R + 0.587*$p.G + 0.114*$p.B)
        $newImg.SetPixel($x, $y, [System.Drawing.Color]::FromArgb($lum, 255, 255, 255))
    }
}
$img.Dispose()
$newImg.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
$newImg.Dispose()
Write-Host "Success"
