$ErrorActionPreference = "Stop"
$baseUrl = "http://localhost:5000/api"

# Read WHATSAPP_VERIFY_TOKEN from .env if it exists
$verifyToken = "test_verify_token"
if (Test-Path ".env") {
    $envContent = Get-Content ".env"
    foreach ($line in $envContent) {
        if ($line -match "^WHATSAPP_VERIFY_TOKEN\s*=\s*`"(.*)`"") {
            $verifyToken = $Matches[1]
            break
        } elseif ($line -match "^WHATSAPP_VERIFY_TOKEN\s*=\s*(.*)") {
            $verifyToken = $Matches[1]
            break
        }
    }
}
Write-Host "Using verify token: $verifyToken" -ForegroundColor Gray

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Sagar Shipping Maritime ERP - WhatsApp Webhook API Test" -ForegroundColor Cyan
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
        Exit 1
    }
}

# 1. Login as Owner
$script:session = $null
$loginRes = Assert-Step "1. Login as Owner" {
    $loginBody = @{
        email = "owner@sagarshipping.local"
        password = "Password@123"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -SessionVariable script:session
    $script:ownerId = $res.data.user.id
    return $res
}

# 2. Get Hardik Kateshiya ID
Assert-Step "2. Get Hardik Kateshiya ID" {
    $loginBody = @{
        email = "hardik.kateshiya@sagarshipping.local"
        password = "Password@123"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody
    $script:hardikId = $res.data.user.id
    Write-Host "  Hardik Kateshiya User ID: $script:hardikId" -ForegroundColor Gray
}

# 3. Create UserContact for Owner
Assert-Step "3. Create UserContact for Owner" {
    $body = @{
        userId = $script:ownerId
        phoneNumber = "919999999999"
        channel = "WHATSAPP"
        isVerified = $true
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/contacts" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    Write-Host "  Registered owner phone: $($res.data.contact.phoneNumber)" -ForegroundColor Gray
}

# 4. Create UserContact for Hardik Kateshiya
Assert-Step "4. Create UserContact for Hardik Kateshiya" {
    $body = @{
        userId = $script:hardikId
        phoneNumber = "918888888888"
        channel = "WHATSAPP"
        isVerified = $true
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/contacts" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    Write-Host "  Registered Hardik Kateshiya phone: $($res.data.contact.phoneNumber)" -ForegroundColor Gray
}

# 5. GET Webhook verification with correct verify token returns challenge
Assert-Step "5. GET Webhook verification with correct verify token" {
    $res = Invoke-WebRequest -Uri "$baseUrl/bot/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=$verifyToken&hub.challenge=123456" -Method Get -UseBasicParsing
    Write-Host "  Response content: $($res.Content)" -ForegroundColor Gray
    if ($res.Content -ne "123456") { throw "Expected challenge '123456', got '$($res.Content)'" }
}

# 6. GET Webhook verification with wrong token returns 403
Assert-Step "6. GET Webhook verification with wrong token" {
    try {
        Invoke-WebRequest -Uri "$baseUrl/bot/whatsapp/webhook?hub.mode=subscribe&hub.verify_token=wrong_token&hub.challenge=123456" -Method Get -UseBasicParsing
        throw "Should have thrown a 403 error"
    } catch [System.Net.WebException] {
        $errRes = $_.Exception.Response
        if ($errRes.StatusCode -eq 403) {
            Write-Host "  Correctly blocked verification with 403." -ForegroundColor Gray
        } else {
            throw "Expected status code 403, got: $($errRes.StatusCode)"
        }
    }
}

# 7. POST test-webhook with registered owner phone and valid message
$testWebhookRes = Assert-Step "7. POST test-webhook with registered owner phone" {
    $body = @{
        fromPhone = "919999999999"
        message = "Tell Hardik K to check the progress of the KB-26 repairing"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/whatsapp/test-webhook" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    return $res
}

# Verify created task
Assert-Step "7b. Verify test-webhook results" {
    if ($testWebhookRes.status -ne "success") { throw "Expected status success, got: $($testWebhookRes.status)" }
    $task = $testWebhookRes.data.task
    $notifications = $testWebhookRes.data.notifications
    Write-Host "  Created Task ID: $($task.id)" -ForegroundColor Gray
    Write-Host "  Created Task Title: $($task.title)" -ForegroundColor Gray
    Write-Host "  Sender Notification text: $($notifications[1].rawText)" -ForegroundColor Gray
    Write-Host "  Assignee Notification text: $($notifications[0].rawText)" -ForegroundColor Gray
    
    if ($task.title -notmatch "Check progress of KB-26 repairing") { throw "Incorrect task title: $($task.title)" }
    if ($notifications.Count -ne 2) { throw "Expected 2 notification records, got: $($notifications.Count)" }
}

# 8. POST test-webhook with unregistered phone (Succeeds via owner fallback)
$unregRes = Assert-Step "8. POST test-webhook with unregistered phone" {
    $body = @{
        fromPhone = "911111111111"
        message = "Tell Hardik K to check the repairing"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/whatsapp/test-webhook" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    return $res
}

Assert-Step "8b. Verify unregistered test-webhook results" {
    if ($unregRes.status -ne "success") { throw "Expected status 'success', got: $($unregRes.status)" }
    $task = $unregRes.data.task
    Write-Host "  Created Task ID for unregistered sender: $($task.id)" -ForegroundColor Gray
    if ($task.title -notmatch "Check the repairing") { throw "Incorrect task title: $($task.title)" }
}

# 9. POST real-shaped WhatsApp payload to /api/bot/whatsapp/webhook
Assert-Step "9. POST real-shaped WhatsApp payload to webhook" {
    $payload = @{
        object = "whatsapp_business_account"
        entry = @(
            @{
                id = "12345"
                changes = @(
                    @{
                        field = "messages"
                        value = @{
                            messaging_product = "whatsapp"
                            metadata = @{
                                display_phone_number = "12345"
                                phone_number_id = "12345"
                            }
                            messages = @(
                                @{
                                    from = "919999999999"
                                    id = "wamid.TestWebhookMessageId"
                                    text = @{
                                        body = "Tell Hardik K to check the progress of the KB-26 repairing"
                                    }
                                    type = "text"
                                }
                            )
                        }
                    }
                )
            }
        )
    } | ConvertTo-Json -Depth 10

    $res = Invoke-WebRequest -Uri "$baseUrl/bot/whatsapp/webhook" -Method Post -ContentType "application/json" -Body $payload -UseBasicParsing
    Write-Host "  Webhook status response: $($res.StatusCode)" -ForegroundColor Gray
    if ($res.StatusCode -ne 200) { throw "Expected status 200, got: $($res.StatusCode)" }
}

# 10. GET /api/bot/contacts as owner works
Assert-Step "10. GET /api/bot/contacts as Owner" {
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/contacts" -Method Get -WebSession $script:session
    Write-Host "  Found $($res.data.contacts.Count) contacts." -ForegroundColor Gray
    if ($res.data.contacts.Count -lt 2) { throw "Expected at least 2 contacts, got: $($res.data.contacts.Count)" }
}

# 11. Login as Accounts and confirm contact management blocked (403)
$script:accountsSession = $null
Assert-Step "11. Login as Accounts" {
    $loginBody = @{
        email = "jaman@sagarshipping.local"
        password = "Password@123"
    } | ConvertTo-Json
    Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -SessionVariable script:accountsSession
}

Assert-Step "11b. Confirm GET contacts blocked for Accounts" {
    try {
        Invoke-RestMethod -Uri "$baseUrl/bot/contacts" -Method Get -WebSession $script:accountsSession
        throw "Should have thrown a 403 error"
    } catch [System.Net.WebException] {
        $errRes = $_.Exception.Response
        if ($errRes.StatusCode -eq 403) {
            Write-Host "  Correctly blocked GET contacts with 403." -ForegroundColor Gray
        } else {
            throw "Expected status code 403, got: $($errRes.StatusCode)"
        }
    }
}

Assert-Step "11c. Confirm POST contact blocked for Accounts" {
    try {
        $body = @{
            userId = $script:ownerId
            phoneNumber = "917777777777"
            channel = "WHATSAPP"
            isVerified = $true
        } | ConvertTo-Json
        Invoke-RestMethod -Uri "$baseUrl/bot/contacts" -Method Post -ContentType "application/json" -Body $body -WebSession $script:accountsSession
        throw "Should have thrown a 403 error"
    } catch [System.Net.WebException] {
        $errRes = $_.Exception.Response
        if ($errRes.StatusCode -eq 403) {
            Write-Host "  Correctly blocked POST contact with 403." -ForegroundColor Gray
        } else {
            throw "Expected status code 403, got: $($errRes.StatusCode)"
        }
    }
}

Write-Host "`nAll WhatsApp Webhook verification steps completed successfully!" -ForegroundColor Cyan
