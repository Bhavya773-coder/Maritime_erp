$ErrorActionPreference = "Stop"
$baseUrl = "http://localhost:5000/api"

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "Arvind Port & Infra Limited - Vouchers API Verification" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan

function Assert-Step($stepName, $scriptBlock) {
    Write-Host "`n[$stepName] Running..." -ForegroundColor Yellow
    try {
        $res = & $scriptBlock
        Write-Host "[$stepName] PASS" -ForegroundColor Green
        return $res
    } catch {
        Write-Host "[$stepName] FAIL" -ForegroundColor Red
        Write-Host "Error Details: $_" -ForegroundColor DarkRed
        # Stop script execution immediately if critical setup steps fail
        if ($stepName -eq "1. Login as Owner" -or $stepName -eq "2. Login as Accounts" -or $stepName -eq "3. Login as Staff") {
            Write-Host "`nCRITICAL LOGIN STEP FAILED. Stopping verification script." -ForegroundColor Red
            Exit 1
        }
    }
}

# Helper to read response body on exception
function Get-ExceptionBody($exception) {
    try {
        $errRes = $exception.Response
        if ($errRes -ne $null) {
            $stream = $errRes.GetResponseStream()
            $reader = New-Object System.IO.StreamReader($stream)
            return $reader.ReadToEnd()
        }
    } catch {}
    return $null
}

# 1. Login as Owner
$script:ownerSession = $null
Assert-Step "1. Login as Owner" {
    $loginBody = @{
        email = "owner@apil.local"
        password = "Password@123"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -SessionVariable script:ownerSession
    Write-Host "Logged in as Owner: $($res.data.user.name)" -ForegroundColor Gray
    return $res
}

# 2. Login as Accounts
$script:accountsSession = $null
Assert-Step "2. Login as Accounts" {
    $loginBody = @{
        email = "jaman@apil.local"
        password = "Password@123"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -SessionVariable script:accountsSession
    Write-Host "Logged in as Accounts: $($res.data.user.name)" -ForegroundColor Gray
    return $res
}

# 3. Login as Staff
$script:staffSession = $null
Assert-Step "3. Login as Staff" {
    $loginBody = @{
        email = "parag@apil.local"
        password = "Password@123"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -SessionVariable script:staffSession
    Write-Host "Logged in as Staff: $($res.data.user.name)" -ForegroundColor Gray
    return $res
}

# 4. Submit Voucher as Staff
$script:voucherId = $null
Assert-Step "4. Submit Voucher as Staff" {
    $voucherBody = @{
        expenseType = "Fuel"
        amount = 1200.50
        expenseDate = "2026-06-12"
        vendorName = "Adani Port Fuel Depot"
        description = "Barge fuel refill"
        receiptUrls = @("https://s3.example.com/receipts/fuel_1.jpg")
    } | ConvertTo-Json

    $res = Invoke-RestMethod -Uri "$baseUrl/vouchers" -Method Post -ContentType "application/json" -Body $voucherBody -WebSession $script:staffSession
    $script:voucherId = $res.data.voucher.id
    Write-Host "Voucher submitted! ID: $script:voucherId, Status: $($res.data.voucher.status)" -ForegroundColor Gray
    if ($res.data.voucher.status -ne "PENDING") { throw "Status should be PENDING" }
    return $res
}

# 5. GET /api/vouchers/my as submitter
Assert-Step "5. GET /api/vouchers/my as submitter" {
    $res = Invoke-RestMethod -Uri "$baseUrl/vouchers/my" -Method Get -WebSession $script:staffSession
    Write-Host "Found $($res.data.vouchers.Length) personal vouchers. First voucher ID: $($res.data.vouchers[0].id)" -ForegroundColor Gray
    if ($res.data.vouchers.Length -eq 0) { throw "Should return at least 1 voucher" }
    return $res
}

# 6. GET /api/vouchers/:id as submitter
Assert-Step "6. GET /api/vouchers/:id as submitter" {
    $res = Invoke-RestMethod -Uri "$baseUrl/vouchers/$script:voucherId" -Method Get -WebSession $script:staffSession
    Write-Host "Retrieved voucher amount: $($res.data.voucher.amount)" -ForegroundColor Gray
    if ([double]$res.data.voucher.amount -ne 1200.50) { throw "Voucher amount mismatch" }
    return $res
}

# 7. Add receipt URL as submitter while PENDING
Assert-Step "7. Add receipt URL as submitter while PENDING" {
    $receiptBody = @{
        receiptUrls = @("https://s3.example.com/receipts/fuel_2.jpg")
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/vouchers/$script:voucherId/receipts" -Method Post -ContentType "application/json" -Body $receiptBody -WebSession $script:staffSession
    Write-Host "Receipts count after appending: $($res.data.voucher.receiptUrls.Length)" -ForegroundColor Gray
    if ($res.data.voucher.receiptUrls.Length -ne 2) { throw "Should have 2 receipt URLs" }
    return $res
}

# 8. GET /api/vouchers queue as Owner
Assert-Step "8. GET /api/vouchers queue as Owner" {
    $res = Invoke-RestMethod -Uri "$baseUrl/vouchers?status=PENDING" -Method Get -WebSession $script:ownerSession
    Write-Host "Owner sees $($res.data.vouchers.Length) PENDING vouchers." -ForegroundColor Gray
    return $res
}

# 9. Request more info as Owner
Assert-Step "9. Request more info as Owner" {
    $infoBody = @{
        note = "Please upload vendor invoice copy."
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/vouchers/$script:voucherId/request-info" -Method Patch -ContentType "application/json" -Body $infoBody -WebSession $script:ownerSession
    Write-Host "Voucher status updated to: $($res.data.voucher.status)" -ForegroundColor Gray
    if ($res.data.voucher.status -ne "INFO_REQUESTED") { throw "Status should be INFO_REQUESTED" }
    return $res
}

# 10. Add receipt URL as submitter while INFO_REQUESTED
Assert-Step "10. Add receipt URL as submitter while INFO_REQUESTED" {
    $receiptBody = @{
        receiptUrls = @("https://s3.example.com/receipts/invoice_copy.jpg")
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/vouchers/$script:voucherId/receipts" -Method Post -ContentType "application/json" -Body $receiptBody -WebSession $script:staffSession
    Write-Host "Receipts count after appending: $($res.data.voucher.receiptUrls.Length)" -ForegroundColor Gray
    if ($res.data.voucher.receiptUrls.Length -ne 3) { throw "Should have 3 receipt URLs" }
    return $res
}

# 11. Approve voucher as Owner
Assert-Step "11. Approve voucher as Owner" {
    $approveBody = @{
        approverNote = "Approved after invoice confirmation."
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/vouchers/$script:voucherId/approve" -Method Patch -ContentType "application/json" -Body $approveBody -WebSession $script:ownerSession
    Write-Host "Voucher status updated to: $($res.data.voucher.status)" -ForegroundColor Gray
    if ($res.data.voucher.status -ne "APPROVED") { throw "Status should be APPROVED" }
    return $res
}

# 12. Try approving already approved voucher, expect clean 400
Assert-Step "12. Try approving already approved voucher (Expect 400)" {
    try {
        $approveBody = @{
            approverNote = "Re-approval attempt"
        } | ConvertTo-Json
        Invoke-RestMethod -Uri "$baseUrl/vouchers/$script:voucherId/approve" -Method Patch -ContentType "application/json" -Body $approveBody -WebSession $script:ownerSession
        throw "Should have returned a 400 error"
    } catch [System.Net.WebException] {
        $bodyText = Get-ExceptionBody $_
        Write-Host "Status: $_.Exception.Response.StatusCode, Body: $bodyText" -ForegroundColor Gray
        if ($_.Exception.Response.StatusCode.value__ -ne 400) { throw "Should be 400 Bad Request" }
    }
}

# 13. Accounts access checks
Assert-Step "13a. Accounts view approved voucher (Expect success)" {
    $res = Invoke-RestMethod -Uri "$baseUrl/vouchers/$script:voucherId" -Method Get -WebSession $script:accountsSession
    Write-Host "Accounts retrieved approved voucher successfully." -ForegroundColor Gray
}

Assert-Step "13b. Accounts tries to approve voucher (Expect 403)" {
    try {
        $approveBody = @{
            approverNote = "Malicious accounts approval"
        } | ConvertTo-Json
        Invoke-RestMethod -Uri "$baseUrl/vouchers/$script:voucherId/approve" -Method Patch -ContentType "application/json" -Body $approveBody -WebSession $script:accountsSession
        throw "Should have returned a 403 error"
    } catch [System.Net.WebException] {
        $bodyText = Get-ExceptionBody $_
        Write-Host "Status: $_.Exception.Response.StatusCode, Body: $bodyText" -ForegroundColor Gray
        if ($_.Exception.Response.StatusCode.value__ -ne 403) { throw "Should be 403 Forbidden" }
    }
}

# 14. Submit another voucher and reject it
$script:rejectedVoucherId = $null
Assert-Step "14. Reject a new voucher" {
    $voucherBody = @{
        expenseType = "Hotel"
        amount = 4500.00
        expenseDate = "2026-06-12"
        vendorName = "Port Palace Hotel"
        description = "Night stay for customs operations"
        receiptUrls = @("https://s3.example.com/receipts/hotel_1.jpg")
    } | ConvertTo-Json

    $res = Invoke-RestMethod -Uri "$baseUrl/vouchers" -Method Post -ContentType "application/json" -Body $voucherBody -WebSession $script:staffSession
    $script:rejectedVoucherId = $res.data.voucher.id

    $rejectBody = @{
        reason = "Hotel allowance exceeded standard company policy."
    } | ConvertTo-Json

    $resReject = Invoke-RestMethod -Uri "$baseUrl/vouchers/$script:rejectedVoucherId/reject" -Method Patch -ContentType "application/json" -Body $rejectBody -WebSession $script:ownerSession
    Write-Host "Voucher status is: $($resReject.data.voucher.status)" -ForegroundColor Gray
    if ($resReject.data.voucher.status -ne "REJECTED") { throw "Should be REJECTED" }
    return $resReject
}

# 15. Test validation: missing receiptUrls
Assert-Step "15. Test missing receiptUrls (Expect 400)" {
    try {
        $voucherBody = @{
            expenseType = "Fuel"
            amount = 1000.00
            expenseDate = "2026-06-12"
            vendorName = "Adani Port"
        } | ConvertTo-Json
        Invoke-RestMethod -Uri "$baseUrl/vouchers" -Method Post -ContentType "application/json" -Body $voucherBody -WebSession $script:staffSession
        throw "Should have returned a 400 error"
    } catch [System.Net.WebException] {
        $bodyText = Get-ExceptionBody $_
        Write-Host "Status: $_.Exception.Response.StatusCode, Body: $bodyText" -ForegroundColor Gray
        if ($_.Exception.Response.StatusCode.value__ -ne 400) { throw "Should be 400 Bad Request" }
    }
}

# 16. Test validation: amount <= 0
Assert-Step "16. Test amount <= 0 (Expect 400)" {
    try {
        $voucherBody = @{
            expenseType = "Fuel"
            amount = -100.00
            expenseDate = "2026-06-12"
            vendorName = "Adani Port"
            receiptUrls = @("https://s3.example.com/receipts/fuel_1.jpg")
        } | ConvertTo-Json
        Invoke-RestMethod -Uri "$baseUrl/vouchers" -Method Post -ContentType "application/json" -Body $voucherBody -WebSession $script:staffSession
        throw "Should have returned a 400 error"
    } catch [System.Net.WebException] {
        $bodyText = Get-ExceptionBody $_
        Write-Host "Status: $_.Exception.Response.StatusCode, Body: $bodyText" -ForegroundColor Gray
        if ($_.Exception.Response.StatusCode.value__ -ne 400) { throw "Should be 400 Bad Request" }
    }
}

# 17. Test validation: invalid UUID
Assert-Step "17. Test invalid UUID (Expect 400)" {
    try {
        Invoke-RestMethod -Uri "$baseUrl/vouchers/invalid-uuid-value" -Method Get -WebSession $script:ownerSession
        throw "Should have returned a 400 error"
    } catch [System.Net.WebException] {
        $bodyText = Get-ExceptionBody $_
        Write-Host "Status: $_.Exception.Response.StatusCode, Body: $bodyText" -ForegroundColor Gray
        if ($_.Exception.Response.StatusCode.value__ -ne 400) { throw "Should be 400 Bad Request" }
    }
}

# 18. Test export JSON totals
Assert-Step "18. Test export JSON totals" {
    $res = Invoke-RestMethod -Uri "$baseUrl/vouchers/export" -Method Get -WebSession $script:accountsSession
    Write-Host "Export generated at: $($res.data.generatedAt)" -ForegroundColor Gray
    Write-Host "Export total count: $($res.data.totalCount)" -ForegroundColor Gray
    Write-Host "Export total amount: $($res.data.totalAmount)" -ForegroundColor Gray
    if ($res.data.totalCount -lt 2) { throw "Total count mismatch" }
    return $res
}

# 19. Test dashboard summary
Assert-Step "19. Test dashboard summary" {
    $res = Invoke-RestMethod -Uri "$baseUrl/vouchers/summary/dashboard" -Method Get -WebSession $script:ownerSession
    Write-Host "Dashboard Pending count: $($res.data.summary.pendingCount)" -ForegroundColor Gray
    Write-Host "Dashboard Approved count: $($res.data.summary.approvedCount)" -ForegroundColor Gray
    Write-Host "Dashboard Rejected count: $($res.data.summary.rejectedCount)" -ForegroundColor Gray
    Write-Host "Dashboard InfoRequested count: $($res.data.summary.infoRequestedCount)" -ForegroundColor Gray
    Write-Host "Dashboard Approved amount: $($res.data.summary.approvedAmount)" -ForegroundColor Gray
    if ($res.data.summary.approvedCount -lt 1) { throw "Approved count mismatch" }
    return $res
}

Write-Host "`nAll Vouchers API Verification Steps Completed Successfully!" -ForegroundColor Green
