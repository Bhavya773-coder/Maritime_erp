$ErrorActionPreference = "Stop"
$baseUrl = "http://localhost:5000/api"

Write-Host "=============================================" -ForegroundColor Cyan
Write-Host "Arvind Port & Infra Limited - Bot Core API Test" -ForegroundColor Cyan
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
        email = "owner@apil.local"
        password = "Password@123"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -SessionVariable script:session
    return $res
}

# 2. Send valid command "Tell Hardik K to check the progress of the KB-26 repairing"
$testRes = Assert-Step "2. Send valid command" {
    $body = @{
        message = "Tell Hardik K to check the progress of the KB-26 repairing"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/test-command" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    return $res
}

# 3. Verify Task and Command Details
Assert-Step "3. Verify Task and Command Details" {
    if ($testRes.status -ne "success") { throw "Expected status to be success, got: $($testRes.status)" }
    $task = $testRes.data.task
    $command = $testRes.data.command
    $notifications = $testRes.data.notifications
    
    Write-Host "  Task ID: $($task.id)" -ForegroundColor Gray
    Write-Host "  Task Title: $($task.title)" -ForegroundColor Gray
    Write-Host "  Assignee ID: $($task.assignedToId)" -ForegroundColor Gray
    Write-Host "  Assignee Name: $($task.assignee.name)" -ForegroundColor Gray
    Write-Host "  Command Status: $($command.status)" -ForegroundColor Gray
    
    if ($task.assignee.name -ne "Hardik Kateshiya") { throw "Expected assignee to be Hardik Kateshiya, got: $($task.assignee.name)" }
    if ($command.status -ne "EXECUTED") { throw "Expected command status to be EXECUTED, got: $($command.status)" }
    if ($notifications.Count -ne 2) { throw "Expected 2 outgoing notifications, got: $($notifications.Count)" }
    
    $script:taskId = $task.id
}

# 4. Confirm BotReminder is ACTIVE
Assert-Step "4. Confirm BotReminder is ACTIVE" {
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/reminders" -Method Get -WebSession $script:session
    $reminders = $res.data.reminders
    $match = $null
    foreach ($rem in $reminders) {
        if ($rem.taskId -eq $script:taskId) {
            $match = $rem
            break
        }
    }
    if ($null -eq $match) { throw "No reminder found for task ID $script:taskId" }
    Write-Host "  Reminder ID: $($match.id)" -ForegroundColor Gray
    Write-Host "  Reminder Status: $($match.status)" -ForegroundColor Gray
    Write-Host "  Next Reminder At: $($match.nextReminderAt)" -ForegroundColor Gray
    if ($match.status -ne "ACTIVE") { throw "Expected reminder status to be ACTIVE, got: $($match.status)" }
    
    $script:reminderId = $match.id
}

# 5. Send ambiguous command "Tell Hardik to check KB-26"
$ambigRes = Assert-Step "5. Send ambiguous command" {
    $body = @{
        message = "Tell Hardik to check KB-26"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/test-command" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    return $res
}

# 6. Verify Ambiguous Response (NEEDS_CONFIRMATION)
Assert-Step "6. Verify Ambiguous Response" {
    if ($ambigRes.status -ne "NEEDS_CONFIRMATION") { throw "Expected status to be NEEDS_CONFIRMATION, got: $($ambigRes.status)" }
    Write-Host "  Message: $($ambigRes.message)" -ForegroundColor Gray
    Write-Host "  Options count: $($ambigRes.options.Count)" -ForegroundColor Gray
    foreach ($opt in $ambigRes.options) {
        Write-Host "    - $($opt.name) ($($opt.department))" -ForegroundColor Gray
    }
    if ($ambigRes.options.Count -lt 2) { throw "Expected at least 2 options, got: $($ambigRes.options.Count)" }
}

# 7. Send unknown assignee command
$unknownRes = Assert-Step "7. Send unknown assignee command" {
    $body = @{
        message = "Tell Donald Duck to inspect the vessel"
    } | ConvertTo-Json
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/test-command" -Method Post -ContentType "application/json" -Body $body -WebSession $script:session
    return $res
}

# 8. Verify Unknown Response (NEEDS_CONFIRMATION)
Assert-Step "8. Verify Unknown Response" {
    if ($unknownRes.status -ne "NEEDS_CONFIRMATION") { throw "Expected status to be NEEDS_CONFIRMATION, got: $($unknownRes.status)" }
    Write-Host "  Message: $($unknownRes.message)" -ForegroundColor Gray
    if ($unknownRes.options.Count -ne 0) { throw "Expected 0 options, got: $($unknownRes.options.Count)" }
}

# 9. Test GET /api/bot/messages as Owner
Assert-Step "9. Test GET /api/bot/messages as Owner" {
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/messages" -Method Get -WebSession $script:session
    Write-Host "  Found $($res.data.messages.Count) bot messages." -ForegroundColor Gray
    if ($res.data.messages.Count -eq 0) { throw "Expected at least 1 bot message" }
}

# 10. Pause Reminder
Assert-Step "10. Pause Reminder" {
    $res = Invoke-RestMethod -Uri "$baseUrl/bot/reminders/$script:reminderId/pause" -Method Patch -WebSession $script:session
    Write-Host "  Updated Reminder Status: $($res.data.reminder.status)" -ForegroundColor Gray
    if ($res.data.reminder.status -ne "PAUSED") { throw "Expected reminder status to be PAUSED, got: $($res.data.reminder.status)" }
}

# 11. Login as Accounts User
$script:accountsSession = $null
Assert-Step "11. Login as Accounts User" {
    $loginBody = @{
        email = "hardik@apil.local"
        password = "Password@123"
    } | ConvertTo-Json
    Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -ContentType "application/json" -Body $loginBody -SessionVariable script:accountsSession
}

# 12. Confirm GET messages blocked for Accounts
Assert-Step "12. Confirm GET messages blocked for Accounts" {
    try {
        Invoke-RestMethod -Uri "$baseUrl/bot/messages" -Method Get -WebSession $script:accountsSession
        throw "Should have thrown a 403 error for accounts user"
    } catch [System.Net.WebException] {
        $errRes = $_.Exception.Response
        $stream = $errRes.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd() | ConvertFrom-Json
        if ($errRes.StatusCode -eq 403) {
            Write-Host "  Correctly blocked access. Message: $($body.message)" -ForegroundColor Gray
        } else {
            throw "Expected status code 403, got: $($errRes.StatusCode) ($($body.message))"
        }
    }
}

# 13. Confirm GET reminders blocked for Accounts
Assert-Step "13. Confirm GET reminders blocked for Accounts" {
    try {
        Invoke-RestMethod -Uri "$baseUrl/bot/reminders" -Method Get -WebSession $script:accountsSession
        throw "Should have thrown a 403 error for accounts user"
    } catch [System.Net.WebException] {
        $errRes = $_.Exception.Response
        $stream = $errRes.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd() | ConvertFrom-Json
        if ($errRes.StatusCode -eq 403) {
            Write-Host "  Correctly blocked access. Message: $($body.message)" -ForegroundColor Gray
        } else {
            throw "Expected status code 403, got: $($errRes.StatusCode) ($($body.message))"
        }
    }
}

Write-Host "`nAll verification steps completed successfully!" -ForegroundColor Cyan
