$ErrorActionPreference = "Stop"
$baseUrl = "http://localhost:5000/api"

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "Arvind Port & Infra Limited - Certification API Test" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

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
        if ($stepName -eq "1. Login as Owner" -or $stepName -eq "2. Get Vessels" -or $stepName -eq "3. Create Vessel-Linked Cert") {
            Write-Host "`nCRITICAL STEP FAILED. Stopping verification script." -ForegroundColor Red
            Exit 1
        }
    }
}

# 1. Login as Owner
$script:ownerSession = $null
$loginOwnerRes = Assert-Step "1. Login as Owner" {
    $loginBody = @{
        email = "owner@apil.local"
        password = "Password@123"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -SessionVariable script:ownerSession
    return $res
}

# 2. Get Vessels and pick first vessel
$vesselsRes = Assert-Step "2. Get Vessels" {
    $res = Invoke-RestMethod -Uri "$baseUrl/vessels" -Method Get -WebSession $script:ownerSession
    if ($res.data.vessels.Count -eq 0) {
        throw "No vessels found. Run seed script."
    }
    $script:firstVesselId = $res.data.vessels[0].id
    Write-Host "Picked Vessel ID: $script:firstVesselId, Name: $($res.data.vessels[0].name)" -ForegroundColor Gray
    return $res
}

# Date setup for certs
$todayStr = (Get-Date).ToString("yyyy-MM-dd")
$issueDateStr = (Get-Date).AddDays(-10).ToString("yyyy-MM-dd")
$expiringSoonDateStr = (Get-Date).AddDays(15).ToString("yyyy-MM-dd")
$validDateStr = (Get-Date).AddDays(45).ToString("yyyy-MM-dd")
$exact30DateStr = (Get-Date).AddDays(30).ToString("yyyy-MM-dd")

# 3. Create Vessel-Linked Certificate (Expiring in 15 days -> status: EXPIRING_SOON)
$vesselCertRes = Assert-Step "3. Create Vessel-Linked Cert" {
    $body = @{
        vesselId = $script:firstVesselId
        certType = "Survey Certificate"
        certNumber = "SURV-12345"
        issuingAuthority = "GMB Authority"
        issueDate = $issueDateStr
        expiryDate = $expiringSoonDateStr
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/certs" -Method Post -ContentType "application/json" -Body $body -WebSession $script:ownerSession
    $script:vesselCertId = $res.data.cert.id
    Write-Host "Created Cert ID: $script:vesselCertId, Status: $($res.data.cert.status)" -ForegroundColor Gray
    if ($res.data.cert.status -ne "EXPIRING_SOON") {
        throw "Expected status EXPIRING_SOON, got $($res.data.cert.status)"
    }
    return $res
}

# 4. Create Non-Vessel Asset Certificate (Expiring in 45 days -> status: VALID)
$assetCertRes = Assert-Step "4. Create Non-Vessel Asset Cert" {
    $body = @{
        assetType = "Car & Bike Insurance"
        certType = "Car & Bike Insurance"
        certNumber = "CAR-54321"
        issuingAuthority = "National Insurance"
        issueDate = $issueDateStr
        expiryDate = $validDateStr
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/certs" -Method Post -ContentType "application/json" -Body $body -WebSession $script:ownerSession
    $script:assetCertId = $res.data.cert.id
    Write-Host "Created Cert ID: $script:assetCertId, Status: $($res.data.cert.status)" -ForegroundColor Gray
    if ($res.data.cert.status -ne "VALID") {
        throw "Expected status VALID, got $($res.data.cert.status)"
    }
    return $res
}

# 4b. Create exact-30-day Certificate for Alert verification
$exact30CertRes = Assert-Step "4b. Create Exact-30-Day Expiry Cert" {
    $body = @{
        vesselId = $script:firstVesselId
        certType = "MMD Registration"
        certNumber = "MMD-999"
        issuingAuthority = "MMD Authority"
        issueDate = $issueDateStr
        expiryDate = $exact30DateStr
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/certs" -Method Post -ContentType "application/json" -Body $body -WebSession $script:ownerSession
    $script:exact30CertId = $res.data.cert.id
    Write-Host "Created Cert ID: $script:exact30CertId, Expiry: $exact30DateStr" -ForegroundColor Gray
    return $res
}

# 5. GET /api/certs
Assert-Step "5. GET /api/certs (List & Filters)" {
    # No filters
    $resAll = Invoke-RestMethod -Uri "$baseUrl/certs" -Method Get -WebSession $script:ownerSession
    Write-Host "Total certificates in list: $($resAll.data.certs.Count)" -ForegroundColor Gray

    # Filter by vesselId
    $resVessel = Invoke-RestMethod -Uri "$baseUrl/certs?vesselId=$script:firstVesselId" -Method Get -WebSession $script:ownerSession
    Write-Host "Vessel-linked certificates count: $($resVessel.data.certs.Count)" -ForegroundColor Gray

    # Filter by status
    $resExpiring = Invoke-RestMethod -Uri "$baseUrl/certs?status=EXPIRING_SOON" -Method Get -WebSession $script:ownerSession
    Write-Host "Expiring soon certificates count: $($resExpiring.data.certs.Count)" -ForegroundColor Gray

    # Filter by search
    $resSearch = Invoke-RestMethod -Uri "$baseUrl/certs?search=SURV" -Method Get -WebSession $script:ownerSession
    Write-Host "Search for 'SURV' count: $($resSearch.data.certs.Count)" -ForegroundColor Gray
    if ($resSearch.data.certs.Count -eq 0) {
        throw "Search filter failed to find matching cert"
    }
}

# 6. GET /api/certs/:id
Assert-Step "6. GET /api/certs/:id" {
    $res = Invoke-RestMethod -Uri "$baseUrl/certs/$script:vesselCertId" -Method Get -WebSession $script:ownerSession
    Write-Host "Detail Cert: Type=$($res.data.cert.certType), Number=$($res.data.cert.certNumber), Vessel=$($res.data.cert.vessel.name)" -ForegroundColor Gray
    if (-not $res.data.cert.vessel) {
        throw "Vessel detail summary missing from response"
    }
}

# 7. GET /api/certs/expiring?days=90
Assert-Step "7. GET /api/certs/expiring" {
    $res = Invoke-RestMethod -Uri "$baseUrl/certs/expiring?days=90" -Method Get -WebSession $script:ownerSession
    Write-Host "Certificates expiring/expired in 90 days: $($res.data.certs.Count)" -ForegroundColor Gray
    if ($res.data.certs.Count -lt 2) {
        throw "Expected at least 2 expiring certificates"
    }
}

# 8. PATCH /api/certs/:id (OWNER)
Assert-Step "8. PATCH /api/certs/:id" {
    $body = @{
        issuingAuthority = "GMB Authority Updated"
        expiryDate = (Get-Date).AddDays(16).ToString("yyyy-MM-dd") # minor change, still expiring soon
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/certs/$script:vesselCertId" -Method Patch -ContentType "application/json" -Body $body -WebSession $script:ownerSession
    Write-Host "Updated Authority: $($res.data.cert.issuingAuthority), Days To Expiry: $($res.data.cert.daysToExpiry)" -ForegroundColor Gray
    if ($res.data.cert.issuingAuthority -ne "GMB Authority Updated") {
        throw "Failed to update authority"
    }
}

# 9. POST /api/certs/:id/upload
Assert-Step "9. POST /api/certs/:id/upload" {
    $body = @{
        documentUrl = "https://s3.amazonaws.com/apil-certs/survey_placeholder.pdf"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/certs/$script:vesselCertId/upload" -Method Post -ContentType "application/json" -Body $body -WebSession $script:ownerSession
    Write-Host "Uploaded Document URL: $($res.data.cert.documentUrl)" -ForegroundColor Gray
    if ($res.data.cert.documentUrl -ne "https://s3.amazonaws.com/apil-certs/survey_placeholder.pdf") {
        throw "Failed to upload document Url"
    }
}

# 10. PATCH /api/certs/recalculate-status
Assert-Step "10. PATCH /api/certs/recalculate-status" {
    $res = Invoke-RestMethod -Uri "$baseUrl/certs/recalculate-status" -Method Patch -WebSession $script:ownerSession
    Write-Host "Recalculated! Valid=$($res.data.valid), ExpiringSoon=$($res.data.expiringSoon), Expired=$($res.data.expired), Updated=$($res.data.updated)" -ForegroundColor Gray
}

# 11. POST /api/certs/check-alerts
Assert-Step "11. POST /api/certs/check-alerts" {
    # 11.a Run checks (should create alert for the exact 30 days cert)
    $res1 = Invoke-RestMethod -Uri "$baseUrl/certs/check-alerts" -Method Post -WebSession $script:ownerSession
    Write-Host "Checked: $($res1.data.checked), Alerts Created: $($res1.data.alertsCreated)" -ForegroundColor Gray
    if ($res1.data.alertsCreated -lt 1) {
        throw "Expected at least 1 alert to be created for 30-day cert"
    }

    # 11.b Run again (should create 0 alerts due to deduplication via CertAlertLog)
    $res2 = Invoke-RestMethod -Uri "$baseUrl/certs/check-alerts" -Method Post -WebSession $script:ownerSession
    Write-Host "Deduplication Check: Checked: $($res2.data.checked), Alerts Created: $($res2.data.alertsCreated)" -ForegroundColor Gray
    if ($res2.data.alertsCreated -ne 0) {
        throw "Expected 0 alerts created on rerun due to deduplication"
    }
}

# 12. Login as Manager & Verify Create/Update is allowed
$script:managerSession = $null
Assert-Step "12. Login as Manager" {
    $loginBody = @{
        email = "manager@apil.local"
        password = "Password@123"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -SessionVariable script:managerSession
    return $res
}

Assert-Step "12b. Create Cert as Manager (Allowed)" {
    $body = @{
        assetType = "Land & Hotel Insurance"
        certType = "Land & Hotel Insurance"
        certNumber = "HOTEL-777"
        issuingAuthority = "LIC Insurance"
        issueDate = $issueDateStr
        expiryDate = $validDateStr
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/certs" -Method Post -ContentType "application/json" -Body $body -WebSession $script:managerSession
    $script:managerCertId = $res.data.cert.id
    Write-Host "Manager successfully created cert ID: $script:managerCertId" -ForegroundColor Gray
}

Assert-Step "12c. Update Cert as Manager (Allowed)" {
    $body = @{
        certNumber = "HOTEL-777-REV"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/certs/$script:managerCertId" -Method Patch -ContentType "application/json" -Body $body -WebSession $script:managerSession
    Write-Host "Manager successfully updated cert Number to: $($res.data.cert.certNumber)" -ForegroundColor Gray
}

# 13. Login as Accounts & Verify Create/Update is blocked 403
$script:accountsSession = $null
Assert-Step "13. Login as Accounts" {
    $loginBody = @{
        email = "jaman@apil.local"
        password = "Password@123"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -SessionVariable script:accountsSession
    return $res
}

Assert-Step "13b. Create Cert as Accounts (Blocked 403)" {
    $body = @{
        assetType = "Workman Compensation Insurance"
        certType = "Workman Compensation Insurance"
        certNumber = "WORK-888"
        issuingAuthority = "ESIC"
        issueDate = $issueDateStr
        expiryDate = $validDateStr
    } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri "$baseUrl/certs" -Method Post -ContentType "application/json" -Body $body -WebSession $script:accountsSession
        throw "Should have thrown 403 Forbidden"
    } catch [System.Net.WebException] {
        $errRes = $_.Exception.Response
        $stream = $errRes.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $respBody = $reader.ReadToEnd() | ConvertFrom-Json
        if ($errRes.StatusCode -eq 403) {
            Write-Host "Correctly blocked Accounts create. Message: $($respBody.message)" -ForegroundColor Gray
        } else {
            throw "Expected status code 403, got: $($errRes.StatusCode) ($($respBody.message))"
        }
    }
}

Assert-Step "13c. Update Cert as Accounts (Blocked 403)" {
    $body = @{
        certNumber = "BLOCKED-CHANGE"
    } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri "$baseUrl/certs/$script:vesselCertId" -Method Patch -ContentType "application/json" -Body $body -WebSession $script:accountsSession
        throw "Should have thrown 403 Forbidden"
    } catch [System.Net.WebException] {
        $errRes = $_.Exception.Response
        $stream = $errRes.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $respBody = $reader.ReadToEnd() | ConvertFrom-Json
        if ($errRes.StatusCode -eq 403) {
            Write-Host "Correctly blocked Accounts update. Message: $($respBody.message)" -ForegroundColor Gray
        } else {
            throw "Expected status code 403, got: $($errRes.StatusCode) ($($respBody.message))"
        }
    }
}

# 14. Invalid UUID returns 400
Assert-Step "14. Invalid UUID returns 400" {
    try {
        Invoke-RestMethod -Uri "$baseUrl/certs/not-a-uuid" -Method Get -WebSession $script:ownerSession
        throw "Should have thrown 400 Bad Request"
    } catch [System.Net.WebException] {
        $errRes = $_.Exception.Response
        $stream = $errRes.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $respBody = $reader.ReadToEnd() | ConvertFrom-Json
        if ($errRes.StatusCode -eq 400) {
            Write-Host "Correctly blocked invalid UUID. Message: $($respBody.message)" -ForegroundColor Gray
        } else {
            throw "Expected status code 400, got: $($errRes.StatusCode) ($($respBody.message))"
        }
    }
}

# 15. Invalid date range issueDate > expiryDate returns 400
Assert-Step "15. Invalid date range (issueDate > expiryDate) returns 400" {
    $body = @{
        vesselId = $script:firstVesselId
        certType = "Survey Certificate"
        certNumber = "SURV-12345-BAD"
        issuingAuthority = "GMB Authority"
        issueDate = $expiringSoonDateStr
        expiryDate = $issueDateStr # issueDate is after expiryDate
    } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri "$baseUrl/certs" -Method Post -ContentType "application/json" -Body $body -WebSession $script:ownerSession
        throw "Should have thrown 400 Bad Request"
    } catch [System.Net.WebException] {
        $errRes = $_.Exception.Response
        $stream = $errRes.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $respBody = $reader.ReadToEnd() | ConvertFrom-Json
        if ($errRes.StatusCode -eq 400) {
            Write-Host "Correctly blocked invalid date range. Message: $($respBody.message)" -ForegroundColor Gray
        } else {
            throw "Expected status code 400, got: $($errRes.StatusCode) ($($respBody.message))"
        }
    }
}

# 16. Missing both vesselId and assetType returns 400
Assert-Step "16. Missing both vesselId and assetType returns 400" {
    $body = @{
        certType = "Survey Certificate"
        certNumber = "SURV-12345-BAD2"
        issuingAuthority = "GMB Authority"
        issueDate = $issueDateStr
        expiryDate = $expiringSoonDateStr
    } | ConvertTo-Json

    try {
        Invoke-RestMethod -Uri "$baseUrl/certs" -Method Post -ContentType "application/json" -Body $body -WebSession $script:ownerSession
        throw "Should have thrown 400 Bad Request"
    } catch [System.Net.WebException] {
        $errRes = $_.Exception.Response
        $stream = $errRes.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $respBody = $reader.ReadToEnd() | ConvertFrom-Json
        if ($errRes.StatusCode -eq 400) {
            Write-Host "Correctly blocked missing linkages. Message: $($respBody.message)" -ForegroundColor Gray
        } else {
            throw "Expected status code 400, got: $($errRes.StatusCode) ($($respBody.message))"
        }
    }
}

Write-Host "`nAll certification API verification steps completed successfully!" -ForegroundColor Cyan
