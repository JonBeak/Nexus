# DuckDNS Auto-Update Script
# Updates nexuswebapphome.duckdns.org with current public IP
# Set up as a Windows Scheduled Task to run periodically

$domain = "nexuswebapphome"
$token = "ac85f710-4500-41e7-ba2c-02b948cfcc53"  # Get from https://www.duckdns.org

# Update DuckDNS (empty ip= means use detected IP)
$url = "https://www.duckdns.org/update?domains=$domain&token=$token&ip="

try {
    $response = Invoke-WebRequest -Uri $url -UseBasicParsing
    $result = [System.Text.Encoding]::UTF8.GetString($response.Content).Trim()

    if ($result -eq "OK") {
        Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - DuckDNS updated successfully"
    } else {
        Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - DuckDNS update failed: $result"
    }
} catch {
    Write-Host "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') - Error: $_"
}
