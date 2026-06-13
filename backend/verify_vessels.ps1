$ErrorActionPreference = "Stop"
$baseUrl = "http://localhost:5000/api"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Sagar Shipping Maritime ERP - Vessel API Test" -ForegroundColor Cyan
Write-Host "=============================================" -ForegroundColor Cyan

# Helper function to print results and assert step status
function Assert-Step($stepName, $scriptBlock) {
    Write-Host "`n[$stepName] Running..." -ForegroundColor Yellow
    try {
        $res = & $scriptBlock
        Write-Host "[$stepName] PASS" -ForegroundColor Green
        return $res
    } catch {
        Write-Host "[$stepName] FAIL" -ForegroundColor Red
        Write-Host "Error Details: $_" -ForegroundColor DarkRed
        # Stop script execution immediately if critical
        if ($stepName -eq "1. Login as Owner" -or $stepName -eq "2. Get Vessels") {
            Write-Host "`nCRITICAL STEP FAILED. Stopping verification script." -ForegroundColor Red
            Exit 1
        }
    }
}

# 1. Login as Owner
$script:ownerSession = $null
$loginOwnerRes = Assert-Step "1. Login as Owner" {
    $loginBody = @{
        email = "owner@sagarshipping.local"
        password = "Password@123"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -SessionVariable script:ownerSession
    return $res
}

# Cleanup test vessels to ensure repeatable runs
Assert-Step "1b. Cleanup test vessels" {
    $cleanupScript = @'
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  await prisma.vesselLocationHistory.deleteMany({
    where: { vessel: { registrationNo: 'SSR-TUG-004' } }
  });
  await prisma.vessel.deleteMany({
    where: { registrationNo: 'SSR-TUG-004' }
  });
}
run().catch(console.error).finally(() => prisma.$disconnect());
'@
    $cleanupScript | Out-File -FilePath "cleanup_vessels.js" -Encoding utf8
    node cleanup_vessels.js
    Remove-Item "cleanup_vessels.js"
}

# 2. Get Vessels
$vesselsRes = Assert-Step "2. Get Vessels" {
    $res = Invoke-RestMethod -Uri "$baseUrl/vessels" -Method Get -WebSession $script:ownerSession
    Write-Host "Found $($res.data.vessels.Count) vessels in list." -ForegroundColor Gray
    $script:firstVesselId = $res.data.vessels[0].id
    Write-Host "First Vessel ID: $script:firstVesselId, Name: $($res.data.vessels[0].name)" -ForegroundColor Gray
    return $res
}

# 3. Get Export Snapshot
Assert-Step "3. Get Export Snapshot" {
    $res = Invoke-RestMethod -Uri "$baseUrl/vessels/export/snapshot" -Method Get -WebSession $script:ownerSession
    Write-Host "Snapshot generated at: $($res.data.generatedAt)" -ForegroundColor Gray
    Write-Host "Total vessels in snapshot: $($res.data.totalVessels)" -ForegroundColor Gray
    Write-Host "Active vessels: $($res.data.vesselsGroupedByStatus.ACTIVE.Count)" -ForegroundColor Gray
    return $res
}

# 4. Get first vessel detail
Assert-Step "4. Get First Vessel Detail" {
    $res = Invoke-RestMethod -Uri "$baseUrl/vessels/$script:firstVesselId" -Method Get -WebSession $script:ownerSession
    Write-Host "Vessel Name: $($res.data.vessel.name)" -ForegroundColor Gray
    Write-Host "Location History Count (Recent): $($res.data.vessel.locationHistory.Count)" -ForegroundColor Gray
    return $res
}

# 5. Get first vessel history
Assert-Step "5. Get First Vessel History" {
    $res = Invoke-RestMethod -Uri "$baseUrl/vessels/$script:firstVesselId/history?page=1&limit=20" -Method Get -WebSession $script:ownerSession
    Write-Host "Total Location History Records: $($res.data.total)" -ForegroundColor Gray
    Write-Host "Page size: $($res.data.limit)" -ForegroundColor Gray
    return $res
}

# 6. PATCH first vessel location as OWNER — should PASS
Assert-Step "6. PATCH First Vessel Location as Owner" {
    $updateBody = @{
        currentLocation = "Dharamtar Jetty"
        latitude = 18.834
        longitude = 73.021
        status = "ACTIVE"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/vessels/$script:firstVesselId/location" -Method Patch -ContentType "application/json" -Body $updateBody -WebSession $script:ownerSession
    Write-Host "Updated Location: $($res.data.vessel.currentLocation)" -ForegroundColor Gray
    Write-Host "Latest History Entry ID: $($res.data.latestHistory.id)" -ForegroundColor Gray
    return $res
}

# 7. Login as Ramesh Mota (FLEET_MANAGER)
$script:fleetSession = $null
Assert-Step "7. Login as Ramesh Mota (FLEET_MANAGER)" {
    $loginBody = @{
        email = "ramesh@sagarshipping.local"
        password = "Password@123"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -SessionVariable script:fleetSession
    return $res
}

# 8. PATCH first vessel location as FLEET_MANAGER — should PASS
Assert-Step "8. PATCH First Vessel Location as Fleet Manager" {
    $updateBody = @{
        currentLocation = "Revadanda Port"
        latitude = 18.552
        longitude = 72.934
        status = "IN_PORT"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/vessels/$script:firstVesselId/location" -Method Patch -ContentType "application/json" -Body $updateBody -WebSession $script:fleetSession
    Write-Host "Updated Location by Fleet Manager: $($res.data.vessel.currentLocation)" -ForegroundColor Gray
    return $res
}

# 9. Login as Jaman Fadadu (ACCOUNTS)
$script:accountsSession = $null
Assert-Step "9. Login as Jaman Fadadu (ACCOUNTS)" {
    $loginBody = @{
        email = "jaman@sagarshipping.local"
        password = "Password@123"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -SessionVariable script:accountsSession
    return $res
}

# 10. PATCH first vessel location as ACCOUNTS — should FAIL 403
Assert-Step "10. PATCH First Vessel Location as Accounts (Should FAIL 403)" {
    $updateBody = @{
        currentLocation = "Mumbai Anchorage"
        latitude = 18.911
        longitude = 72.822
        status = "ACTIVE"
    } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri "$baseUrl/vessels/$script:firstVesselId/location" -Method Patch -ContentType "application/json" -Body $updateBody -WebSession $script:accountsSession
        throw "Should have thrown a 403 Forbidden error"
    } catch [System.Net.WebException] {
        $errRes = $_.Exception.Response
        $stream = $errRes.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd() | ConvertFrom-Json
        if ($errRes.StatusCode -eq 403) {
            Write-Host "Correctly blocked Accounts update. Message: $($body.message)" -ForegroundColor Gray
        } else {
            throw "Expected status code 403, got: $($errRes.StatusCode) ($($body.message))"
        }
    }
}

# 11. Login back as Owner
$script:ownerSession = $null
Assert-Step "11. Login back as Owner" {
    $loginBody = @{
        email = "owner@sagarshipping.local"
        password = "Password@123"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -SessionVariable script:ownerSession
    return $res
}

# 12. POST /api/vessels create test vessel — should PASS
Assert-Step "12. Create New Vessel" {
    $newVesselBody = @{
        name = "Sagar Tug 4"
        registrationNo = "SSR-TUG-004"
        type = "TUG"
        currentLocation = "Mumbai Port"
        latitude = 18.943
        longitude = 72.842
        status = "IN_PORT"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/vessels" -Method Post -ContentType "application/json" -Body $newVesselBody -WebSession $script:ownerSession
    $script:newVesselId = $res.data.vessel.id
    Write-Host "Created New Vessel: ID=$script:newVesselId, RegNo=$($res.data.vessel.registrationNo)" -ForegroundColor Gray
    return $res
}

# 13. Try duplicate registrationNo — should FAIL cleanly
Assert-Step "13. Try Duplicate Registration No (Should FAIL 400)" {
    $dupVesselBody = @{
        name = "Sagar Tug 4 Duplicate"
        registrationNo = "SSR-TUG-004"
        type = "TUG"
        currentLocation = "Mumbai Port"
        latitude = 18.943
        longitude = 72.842
    } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri "$baseUrl/vessels" -Method Post -ContentType "application/json" -Body $dupVesselBody -WebSession $script:ownerSession
        throw "Should have thrown a 400 Bad Request error"
    } catch [System.Net.WebException] {
        $errRes = $_.Exception.Response
        $stream = $errRes.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd() | ConvertFrom-Json
        if ($errRes.StatusCode -eq 400) {
            Write-Host "Correctly blocked duplicate registration number. Message: $($body.message)" -ForegroundColor Gray
        } else {
            throw "Expected status code 400, got: $($errRes.StatusCode) ($($body.message))"
        }
    }
}

# 14. Try invalid latitude/longitude — should FAIL 400
Assert-Step "14. Try Invalid Latitude/Longitude (Should FAIL 400)" {
    $invalidCoordsBody = @{
        name = "Sagar Tug 5"
        registrationNo = "SSR-TUG-005"
        type = "TUG"
        currentLocation = "Mumbai Port"
        latitude = 95.0
        longitude = 72.842
    } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri "$baseUrl/vessels" -Method Post -ContentType "application/json" -Body $invalidCoordsBody -WebSession $script:ownerSession
        throw "Should have thrown a 400 Bad Request error"
    } catch [System.Net.WebException] {
        $errRes = $_.Exception.Response
        $stream = $errRes.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd() | ConvertFrom-Json
        if ($errRes.StatusCode -eq 400) {
            Write-Host "Correctly blocked invalid coordinates. Message: $($body.message)" -ForegroundColor Gray
        } else {
            throw "Expected status code 400, got: $($errRes.StatusCode) ($($body.message))"
        }
    }
}

# 15. Try invalid UUID — should FAIL 400
Assert-Step "15. Try Invalid UUID Param (Should FAIL 400)" {
    try {
        Invoke-RestMethod -Uri "$baseUrl/vessels/invalid-uuid" -Method Get -WebSession $script:ownerSession
        throw "Should have thrown a 400 Bad Request error"
    } catch [System.Net.WebException] {
        $errRes = $_.Exception.Response
        $stream = $errRes.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd() | ConvertFrom-Json
        if ($errRes.StatusCode -eq 400) {
            Write-Host "Correctly blocked invalid UUID param. Message: $($body.message)" -ForegroundColor Gray
        } else {
            throw "Expected status code 400, got: $($errRes.StatusCode) ($($body.message))"
        }
    }
}

Write-Host "`nAll verification steps completed successfully." -ForegroundColor Cyan
